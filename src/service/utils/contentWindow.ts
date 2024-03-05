import { Position, TextDocument } from 'vscode';

export const getContentWindow = (document: TextDocument, position: Position, window: number) => {
  let prefix: string = "";
  let suffix: string = "";
  const length = window;
  let tokenCount = 0;
  const text = document.getText();
  let current = document.offsetAt(position);
  let top = current;
  let bottom = current;

  // every 3 chars we add a new token to the token count
  let letCurrentChatToTokenCount = 0;
  while (tokenCount < length && (top > -1 || bottom < text.length)) {
    if (top > -1) {
      letCurrentChatToTokenCount++;
      top--;
    }

    if (letCurrentChatToTokenCount === 3) {
      tokenCount++;
      letCurrentChatToTokenCount = 0;
    }

    if (bottom < text.length) {
      letCurrentChatToTokenCount++;
      bottom++;
    }

    if (letCurrentChatToTokenCount === 3) {
      tokenCount++;
      letCurrentChatToTokenCount = 0;
    }
  }
  prefix = text.substring(top, current);
  suffix = text.substring(current, bottom);
  return [prefix, suffix];
};