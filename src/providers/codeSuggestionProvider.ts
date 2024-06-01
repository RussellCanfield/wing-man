import * as vscode from "vscode";
import {
	CancellationToken,
	DocumentSelector,
	InlineCompletionContext,
	InlineCompletionItem,
	InlineCompletionItemProvider,
	Position,
	TextDocument,
} from "vscode";
import { eventEmitter } from "../events/eventEmitter";
import { AIProvider, AIStreamProvicer } from "../service/base";
import { delay } from "../service/delay";
import { getContentWindow } from "../service/utils/contentWindow";
import { InteractionSettings } from "../types/Settings";
import { getSymbolsFromOpenFiles } from "./utilities";

export class CodeSuggestionProvider implements InlineCompletionItemProvider {
	public static readonly selector: DocumentSelector = [
		{ scheme: "file", language: "typescript" },
		{ scheme: "file", language: "javascript" },
		{ scheme: "file", language: "javascriptreact" },
		{ scheme: "file", language: "typescriptreact" },
		{ scheme: "file", language: "csharp" },
		{ scheme: "file", language: "java" },
		{ scheme: "file", language: "python" },
		{ scheme: "file", language: "go" },
		{ scheme: "file", language: "php" },
		{ scheme: "file", language: "ruby" },
		{ scheme: "file", language: "rust" },
		{ scheme: "file", language: "css" },
		{ scheme: "file", language: "markdown" },
		{ scheme: "file", language: "sql" },
		{ scheme: "file", language: "less" },
		{ scheme: "file", language: "scss" },
		{ scheme: "file", language: "html" },
		{ scheme: "file", language: "json" },
		{ scheme: "file", language: "vue" },
		{ scheme: 'file', language: 'shellscript' },
		{ scheme: 'file', language: 'sh' },
		{ scheme: 'file', language: 'bash' }
	];

	constructor(
		private readonly _aiProvider: AIProvider | AIStreamProvicer,
		private readonly _interactionSettings: InteractionSettings
	) { }

	async provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	) {
		if (!this._interactionSettings.codeCompletionEnabled) {
			return [];
		}

		let timeout: NodeJS.Timeout | undefined;

		const abort = new AbortController();
		const [prefix, suffix] = getContentWindow(
			document,
			position,
			this._interactionSettings.codeContextWindow
		);

		const types = await getSymbolsFromOpenFiles();

		token.onCancellationRequested(() => {
			try {
				if (timeout) {
					clearTimeout(timeout);
				}
				abort.abort();
			} finally {
				eventEmitter._onQueryComplete.fire();
			}
		});

		const delayMs = this._interactionSettings.codeStreaming ? 300 : 300;
		try {
			await delay(delayMs);
			if (abort.signal.aborted) {
				return [new InlineCompletionItem("")];
			}
			return await this.bouncedRequest(
				prefix,
				abort.signal,
				suffix,
				this._interactionSettings.codeStreaming,
				types
			);
		} catch {
			return [new InlineCompletionItem("")];
		}
	}

	async bouncedRequest(
		prefix: string,
		signal: AbortSignal,
		suffix: string,
		streaming: boolean,
		additionalContext?: string
	): Promise<InlineCompletionItem[]> {
		try {
			eventEmitter._onQueryStart.fire();
			if ("codeCompleteStream" in this._aiProvider && streaming) {
				const codeStream = await this._aiProvider.codeCompleteStream(
					prefix,
					suffix,
					signal,
					additionalContext
				);
				return [new InlineCompletionItem(codeStream)];
			} else {
				const codeResponse = await this._aiProvider.codeComplete(
					prefix,
					suffix,
					signal,
					additionalContext
				);
				return [new InlineCompletionItem(codeResponse)];
			}
		} catch (error) {
			return [];
		} finally {
			eventEmitter._onQueryComplete.fire();
		}
	}
}
