import * as vscode from "vscode";
import { eventEmitter } from "../events/eventEmitter";
import { AIProvider } from "../service/base";
import { AppMessage, CodeContext, CodeContextDetails } from "../types/Message";
import { InteractionSettings } from "../types/Settings";
import { loggingProvider } from './loggingProvider';
import { getSymbolsFromOpenFiles } from "./utilities";

let abortController = new AbortController();

export class ChatViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "wing-man-chat-view";

	private _disposables: vscode.Disposable[] = [];

	constructor(
		private readonly _aiProvider: AIProvider,
		private readonly _context: vscode.ExtensionContext,
		private readonly _interactionSettings: InteractionSettings
	) { }

	dispose() {
		this._disposables.forEach((d) => d.dispose());
		this._disposables = [];
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._context.extensionUri,
				vscode.Uri.joinPath(
					this._context.extensionUri,
					"node_modules/vscode-codicons"
				),
			],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		token.onCancellationRequested((e) => {
			abortController.abort();
			eventEmitter._onQueryComplete.fire();
		});

		this._disposables.push(
			webviewView.webview.onDidReceiveMessage((data: AppMessage) => {
				if (!data) {
					return;
				}

				const { command, value } = data;

				switch (command) {
					case "chat": {
						this.handleChatMessage({ value, webviewView });
						break;
					}
					case "cancel": {
						abortController.abort();
						break;
					}
					case "clipboard": {
						vscode.env.clipboard.writeText(value as string);
						break;
					}
					case "copyToFile": {
						this.sendContentToNewDocument(value as string);
						break;
					}
					case "clear": {
						this._aiProvider.clearChatHistory();
						break;
					}
					case "showContext": {
						const { fileName, lineRange } = value as CodeContext;
						const [start, end] = lineRange.split("-").map(Number);
						const uri = vscode.Uri.file(fileName);
						vscode.window.showTextDocument(uri).then(() => {
							if (!vscode.window.activeTextEditor) {
								return;
							}

							vscode.window.activeTextEditor.selection =
								new vscode.Selection(
									new vscode.Position(start, 0),
									new vscode.Position(end, 0)
								);
						});
						break;
					}
					case "ready": {
						webviewView.webview.postMessage({
							command: "init",
							value: {
								workspaceFolder: getActiveWorkspace(),
								theme: vscode.window.activeColorTheme.kind
							},
						});
						break;
					}
					case "log": {
						this.log(value);
						break;
					}
				}
			}),
			vscode.window.onDidChangeActiveColorTheme((theme: vscode.ColorTheme) => {
				webviewView.webview.postMessage({ command: 'setTheme', value: theme.kind });
			})
		);
	}

	private async sendContentToNewDocument(content: string) {
		const newFile = await vscode.workspace.openTextDocument({
			content,
		});
		vscode.window.showTextDocument(newFile);
	}

	private async handleChatMessage({
		value,
		webviewView,
	}: Pick<AppMessage, "value"> & { webviewView: vscode.WebviewView }) {
		abortController = new AbortController();

		await this.streamChatResponse(
			value as string,
			getChatContext(this._interactionSettings.chatContextWindow),
			webviewView
		);
	}

	private async streamChatResponse(
		prompt: string,
		context: CodeContextDetails | undefined,
		webviewView: vscode.WebviewView
	) {
		let ragContext = "";

		if (context) {
			const {
				text,
				currentLine,
				language,
				fileName,
				lineRange,
				workspaceName,
			} = context;

			const symbols = await getSymbolsFromOpenFiles();

			ragContext = `The user is seeking coding advice using ${language}.  
Here are the available types to use as a reference in answering questions, these may not be related to the code provided:

${symbols}

=======

Reference the following code context in order to provide a working solution.

${text}

=======

The most important line of the code context is as follows: 

${currentLine}

=======

`.replace(/\t/g, "");

			webviewView.webview.postMessage({
				command: "context",
				value: {
					fileName,
					lineRange,
					workspaceName,
				} satisfies CodeContext,
			});
		}

		eventEmitter._onQueryStart.fire();

		const response = this._aiProvider.chat(
			prompt,
			ragContext,
			abortController.signal
		);

		for await (const chunk of response) {
			webviewView.webview.postMessage({
				command: "response",
				value: chunk,
			});
		}

		eventEmitter._onQueryComplete.fire();

		webviewView.webview.postMessage({
			command: "done",
			value: null,
		});
	}

	private getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"out",
				"index.es.js"
			)
		);

		const codiconsUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._context.extensionUri,
				"node_modules",
				"@vscode/codicons",
				"dist",
				"codicon.css"
			)
		);

		const nonce = getNonce();

		return `<!DOCTYPE html>
        <html lang="en" style="height: 100%">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
			<title>Wingman</title>
			<link rel="stylesheet" href="${codiconsUri}" nonce="${nonce}">
          </head>
          <body style="height: 100%">
            <div id="root" style="height: 100%"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>`;
	}


	private log = (value: unknown) => {
		loggingProvider.logInfo(JSON.stringify(value ?? ""));
	};
}

function getActiveWorkspace() {
	const defaultWorkspace = "default";

	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		return (
			vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
				?.name ?? defaultWorkspace
		);
	}

	return vscode.workspace.workspaceFolders?.[0].name ?? defaultWorkspace;
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function getChatContext(contextWindow: number): CodeContextDetails | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return undefined;
	}

	const { document, selection } = editor;
	let codeContextRange: vscode.Range;
	let lastDirection = -1;

	if (selection && !selection.isEmpty) {
		codeContextRange = new vscode.Range(
			selection.start.line,
			selection.start.character,
			selection.end.line,
			selection.end.character
		);
	} else {
		const currentLine = selection.active.line;
		let upperLine = currentLine;
		let lowerLine = currentLine;

		const halfContext = Math.floor(contextWindow / 2);

		let upperText =
			upperLine > 0 ? document.lineAt(upperLine - 1).text : "";
		let lowerText = document.lineAt(lowerLine).text;

		// Expand context in both directions
		for (let i = 0; i < halfContext; i++) {
			if (upperLine > 0) {
				upperLine--;
				upperText = document.lineAt(upperLine).text + "\n" + upperText;
				lastDirection = 0;
			}

			if (lowerLine < document.lineCount - 1) {
				lowerLine++;
				lowerText += "\n" + document.lineAt(lowerLine).text;
				lastDirection = 1;
			}

			// Stop if we've reached the context window size
			if (upperText.length + lowerText.length >= contextWindow) {
				break;
			}
		}

		const beginningWindowLine = document.lineAt(upperLine);
		const endWindowLine = document.lineAt(lowerLine);

		codeContextRange = new vscode.Range(
			beginningWindowLine.range.start,
			endWindowLine.range.end
		);
	}

	let text = document.getText(codeContextRange);

	if (text.length > contextWindow) {
		if (lastDirection === 0) {
			text = text.substring(text.length - contextWindow, text.length);
		} else if (lastDirection === 1) {
			text = text.substring(0, contextWindow);
		}
	}

	const documentUri = vscode.Uri.file(document.fileName);
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);

	return {
		text,
		currentLine: document.lineAt(selection.active.line).text,
		lineRange: `${codeContextRange.start.line}-${codeContextRange.end.line}`,
		fileName: document.fileName,
		workspaceName: workspaceFolder?.name ?? "",
		language: document.languageId,
	};
}
