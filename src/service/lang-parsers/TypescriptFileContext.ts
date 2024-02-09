export class TypescriptFileContext {
  imports: Map<string, string> = new Map();
  types: string[] = [];
  interface: string[] = [];
  functions: string[] = [];
  classes: string[] = [];

  lines: string[] = [];
}

const fileContext = new Map<string, TypescriptFileContext>();
export const getTypescriptFileContext = (fileName: string) => {
  if (!fileContext.has(fileName)) {
    fileContext.set(fileName, new TypescriptFileContext());
  }
  return fileContext.get(fileName)!;
};
