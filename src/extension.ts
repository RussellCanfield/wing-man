import * as vscode from "vscode";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { ActivityStatusBar } from "./providers/statusBarProvider.js";
import {
	GetInteractionSettings,
	GetProviderFromSettings,
} from "./service/base.js";
import { tsLangParserService } from './service/lang-parsers/TypescriptLangParser.js';

let statusBarProvider: ActivityStatusBar;

const isTsRelated = (langId: string) => {
	return langId === 'typescript' || langId === 'javascript' || langId === 'typescriptreact' || langId === 'javascriptreact';
};

export async function activate(context: vscode.ExtensionContext) {
	const aiProvider = GetProviderFromSettings();
	const interactionSettings = GetInteractionSettings();

	statusBarProvider = new ActivityStatusBar();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("Wingman")) {
				vscode.commands.executeCommand("workbench.action.reloadWindow");
			}
		})
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ChatViewProvider.viewType,
			new ChatViewProvider(aiProvider, context, interactionSettings),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		)
	);

	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider(
			CodeSuggestionProvider.selector,
			new CodeSuggestionProvider(aiProvider, interactionSettings)
		)
	);

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(doc => {
			if (isTsRelated(doc.languageId)) {
				tsLangParserService.init(doc);
			}
		}));
}

export function deactivate() {
	if (statusBarProvider) {
		statusBarProvider.dispose();
	}
}
