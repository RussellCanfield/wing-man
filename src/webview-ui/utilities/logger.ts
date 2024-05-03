import { vscode } from './vscode';

export const logger = (msg: string) => {
  vscode.postMessage({
    command: 'log',
    value: { msg }
  });
}