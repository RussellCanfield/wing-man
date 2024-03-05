import * as vscode from "vscode";
import { GenDocs } from "./commands/GenDocs.js";
import { ChatViewProvider } from "./providers/chatViewProvider.js";
import { CodeSuggestionProvider } from "./providers/codeSuggestionProvider.js";
import { ConfigViewProvider } from "./providers/configViewProvider.js";
import { HotKeyCodeSuggestionProvider } from './providers/hotkeyCodeSuggestionProvider.js';
import { RefactorProvider } from "./providers/refactorProvider.js";
import { ActivityStatusBar } from "./providers/statusBarProvider.js";
import {
	GetAllSettings,
	GetInteractionSettings,
	GetProviderFromSettings,
} from "./service/base.js";

let statusBarProvider: ActivityStatusBar;

export async function activate(context: vscode.ExtensionContext) {
	const aiProvider = GetProviderFromSettings();
	const interactionSettings = GetInteractionSettings();

	statusBarProvider = new ActivityStatusBar();

	const settings = GetAllSettings();

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConfigViewProvider.viewType,
			new ConfigViewProvider(context.extensionUri, settings)
		)
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("Wingman")) {
				vscode.commands.executeCommand("workbench.action.reloadWindow");
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(GenDocs.command, GenDocs.generateDocs)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			RefactorProvider.command,
			RefactorProvider.refactorCode
		)
	);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			CodeSuggestionProvider.selector,
			new GenDocs(aiProvider)
		)
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

	if (interactionSettings.codeCompletionEnabled) {
		context.subscriptions.push(
			vscode.languages.registerInlineCompletionItemProvider(
				CodeSuggestionProvider.selector,
				new CodeSuggestionProvider(aiProvider, interactionSettings)
			)
		);
	}

	// context.subscriptions.push(
	// 	vscode.languages.registerCodeActionsProvider(
	// 		QuickFixProvider.selector,
	// 		new QuickFixProvider(),
	// 		{
	// 			providedCodeActionKinds:
	// 				QuickFixProvider.providedCodeActionKinds,
	// 		}
	// 	)
	// );

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			RefactorProvider.selector,
			new RefactorProvider(aiProvider),
			{
				providedCodeActionKinds:
					RefactorProvider.providedCodeActionKinds,
			}
		)
	);

	HotKeyCodeSuggestionProvider.provider = new HotKeyCodeSuggestionProvider(aiProvider, interactionSettings);
	context.subscriptions.push(
		vscode.commands.registerCommand(HotKeyCodeSuggestionProvider.command, HotKeyCodeSuggestionProvider.showSuggestion)
	);
}

export function deactivate() {
	if (statusBarProvider) {
		statusBarProvider.dispose();
	}
}
