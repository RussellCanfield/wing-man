import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import * as vscode from "vscode";

import { getTypescriptFileContext, TypescriptFileContext } from './TypescriptFileContext';

const compilerOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  strict: false,
  noEmitOnError: false,
  skipLibCheck: true,
  noImplicitAny: false,
  suppressImplicitAnyIndexErrors: true
};
export class TypescriptLangParser {
  tsFileContext?: TypescriptFileContext;
  checker?: ts.TypeChecker;
  tsConfig: ts.CompilerOptions;
  constructor(config: ts.CompilerOptions = {}) {
    this.lazy();
    this.tsConfig = { ...config, ...compilerOptions };
  }

  lazy = async () => {
    const configFiles = await vscode.workspace.findFiles('tsconfig.json');
    if (!configFiles.length) return;
    const config = configFiles[0];
    const document = await vscode.workspace.openTextDocument(config);
    const text = document.getText();
    const workspaceConfig = ts.parseConfigFileTextToJson(config.fsPath, text);
    if (workspaceConfig.config) {
      delete workspaceConfig.config.compilerOptions['moduleResolution'];
      this.tsConfig = { ...workspaceConfig.config.compilerOptions, ...compilerOptions };
    }
  };

  init = (doc: vscode.TextDocument) => {
    const fileName = doc.fileName;
    this.tsFileContext = getTypescriptFileContext(fileName)!;
    const host = ts.createCompilerHost(this.tsConfig);
    console.log(fileName);
    host.writeFile = (filename: string, contents: string) => {
      const removeExt = filename.replace('.d.ts', '');
      this.tsFileContext!.imports.set(removeExt, contents);
    };
    const program = ts.createProgram([fileName], this.tsConfig, host);
    program.emit();
    // const program = ts.createProgram([fileName], compilerOptions);
    // this.checker = program.getTypeChecker();
    // const source = program.getSourceFile(fileName);
    // if (source) {
    //   ts.forEachChild(source, this.initNode);
    // }
  };
  // this method is not in used for now, but do not remove
  initNode = (node: ts.Node) => {
    if (!this.checker || !this.tsFileContext) {
      return;
    }

    let addClosingBracket = false;

    if (ts.isVariableDeclaration(node)) {
      // Check if the variable is declared with a name
      if (node.name && ts.isIdentifier(node.name)) {
        const variableName = node.name.text;
        if (node.type) {
          // Get the type of the variable
          const type = this.checker.getTypeAtLocation(node.name);
          const varType = this.checker.typeToString(type);
          this.tsFileContext.lines.push(`${variableName}:${varType}`);
        }
        else if (node.initializer && ts.isFunctionLike(node.initializer)) {
          // If the initializer is a function-like expression, get its type
          const type = this.checker.getTypeAtLocation(node.initializer);
          const varType = this.checker.typeToString(type);
          let functionType = varType.replace(/\s?=>\s?/, ':');
          this.tsFileContext.lines.push(`${variableName}${functionType}{`);
          addClosingBracket = true;
        }
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      // Process named function declarations
      const functionName = node.name.text;
      const symbol = this.checker.getSymbolAtLocation(node.name);
      if (symbol) {
        const type = this.checker.getTypeOfSymbolAtLocation(symbol, node.name);
        const functionDef = this.checker.typeToString(type);
        this.tsFileContext.lines.push(`${functionName}${functionDef}{`);
      }
    }

    ts.forEachChild(node, this.initNode);
    if (addClosingBracket) {
      this.tsFileContext.lines.push('}');
      addClosingBracket = false;
    }
  };
}

const tsLangParserService = new TypescriptLangParser();
export { tsLangParserService };
