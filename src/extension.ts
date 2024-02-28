import * as vscode from 'vscode';
import { exec } from 'child_process';

const complexityMap: { [funcPos: string]: string } = {};

function calculateCyclomaticComplexity() {
    const isEnabled = vscode.workspace.getConfiguration('vscode-gocyclo').get('enabled', true);
    if (!isEnabled) {
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'go') {
        const filePath = editor.document.fileName;
        exec(`gocyclo ${filePath}`, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                vscode.window.showErrorMessage(`Stderr: ${stderr}`);
                return;
            }
            updateComplexityMap(complexityMap, stdout, editor.document);
        });
    }    
}

function updateComplexityMap(complexityMap: { [funcName: string]: string }, gocycloOutput: string, document: vscode.TextDocument) {
    const lines = gocycloOutput.split('\n').filter((line) => line.trim().length > 0);
    for (const line of lines) {
        const parts = line.split(' ');
        if (parts.length >= 3) {
            const complexity = parts[0];
            const [filePath, lineNumber] = parts.slice(-1)[0].split(':');
            const funcPos = `${filePath}:${lineNumber}`;
            complexityMap[funcPos] = complexity;
        }
    }
}

function showComplexityOnHover(document: vscode.TextDocument, position: vscode.Position) {
    const fileName = document.fileName;
    const lineNumber = position.line + 1;
    const funcPos = `${fileName}:${lineNumber}`;
    if (complexityMap[funcPos]) {
        const markdownContent = new vscode.MarkdownString();
        const complexityInfo = `Cyclomatic complexity: ${complexityMap[funcPos]} (calculated by [gocyclo](https://github.com/fzipp/gocyclo))`;
        markdownContent.appendMarkdown(`${complexityInfo}`);
        markdownContent.isTrusted = true;
        return new vscode.Hover(markdownContent);
    }
}

function shouldAnalyzeDocument(document: vscode.TextDocument): boolean {
    return vscode.workspace.getConfiguration('vscode-gocyclo').get('enabled', true) && document.languageId === 'go';
}

export function activate(context: vscode.ExtensionContext) {
  
    let disposable = vscode.commands.registerCommand(
        'vscode-gocyclo.calculateCyclomaticComplexity', calculateCyclomaticComplexity
    );
    context.subscriptions.push(disposable);

    const hoverProvider = vscode.languages.registerHoverProvider('go', {
        provideHover(document, position) {
            return showComplexityOnHover(document, position);
        }
    });
    context.subscriptions.push(hoverProvider);

    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && shouldAnalyzeDocument(editor.document)) {
            vscode.commands.executeCommand('vscode-gocyclo.calculateCyclomaticComplexity');
        }
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
        if (shouldAnalyzeDocument(document)) {
            vscode.commands.executeCommand('vscode-gocyclo.calculateCyclomaticComplexity');
        }
    });
}

export function deactivate() {}