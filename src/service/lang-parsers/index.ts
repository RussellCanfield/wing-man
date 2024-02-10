export * from './TypescriptFileContext';
export * from './TypescriptLangParser';
export const isTsRelated = (langId: string) => {
  return langId === 'typescript' || langId === 'javascript' || langId === 'typescriptreact' || langId === 'javascriptreact';
};