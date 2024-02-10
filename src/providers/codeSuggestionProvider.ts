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
import { getTypescriptFileContext, isTsRelated } from '../service';
import { AIProvider } from "../service/base";
import { InteractionSettings } from "../types/Settings";

let timeout: NodeJS.Timeout | undefined;

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
	];

	constructor(
		private readonly _aiProvider: AIProvider,
		private readonly _interactionSettings: InteractionSettings
	) { }

	async provideInlineCompletionItems(
		document: TextDocument,
		position: Position,
		context: InlineCompletionContext,
		token: CancellationToken
	) {
		const abort = new AbortController();
		token.onCancellationRequested((e) => {
			console.log(e);
			abort.abort();
			eventEmitter._onQueryComplete.fire();
		});

		const prefix = this.getPrefixContent();
		const suffix = this.getSuffixContent();

		if (timeout) {
			clearTimeout(timeout);
		}

		return new Promise<InlineCompletionItem[]>((res) => {
			timeout = setTimeout(() => {
				this.bouncedRequest(prefix, abort.signal, suffix).then(
					(items) => {
						res(items);
					}
				);
			}, 300);
		});
	}

	private getPrefixContent() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return "";
		}

		const { document, selection } = editor;
		let currentLine = selection.active.line;
		let text = document
			.lineAt(selection.active.line)
			.text.substring(0, selection.active.character);
		const halfContext = this._interactionSettings.codeContextWindow / 2;

		while (text.length < halfContext && currentLine > 0) {
			currentLine--;
			text = document.lineAt(currentLine).text + "\n" + text;
		}

		if (text.length > halfContext) {
			const start = text.length - halfContext;
			text = text.substring(start, text.length);
		}
		if (isTsRelated(document.languageId)) {
			const importContext = ['Imports context']
			const tsContext = getTypescriptFileContext(document.fileName);
			for (const [_, content] of tsContext.imports) {
				importContext.push(content);
			}
			text = importContext.join('') + text;
			console.log('FIM for ', text)
		}

		return text;
	}

	private getSuffixContent() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return "";
		}

		const { document, selection } = editor;

		let currentLine = selection.active.line;

		let text = document
			.lineAt(selection.active.line)
			.text.substring(selection.active.character);
		const halfContext = this._interactionSettings.codeContextWindow / 2;

		while (
			text.length < halfContext &&
			currentLine < document.lineCount - 1
		) {
			currentLine++;
			text += "\n" + document.lineAt(currentLine).text;
		}

		if (text.length > halfContext) {
			text = text.substring(0, halfContext);
		}

		return text;
	}

	async bouncedRequest(
		prefix: string,
		signal: AbortSignal,
		suffix: string
	): Promise<InlineCompletionItem[]> {
		try {
			eventEmitter._onQueryStart.fire();
			const codeResponse = await this._aiProvider.codeComplete(
				prefix,
				suffix,
				signal
			);
			eventEmitter._onQueryComplete.fire();
			return [new InlineCompletionItem(codeResponse)];
		} catch (error) {
			console.warn(error);
			eventEmitter._onQueryComplete.fire();
			return [];
		}
	}
}
