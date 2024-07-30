// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import ts from 'typescript';
import * as vscode from 'vscode';
import { TracesWebView } from './TracesWebView';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const codeLensProvider = new TraceCodeLensProvider();
	const tracesWebView = new TracesWebView(context);

	context.subscriptions.push(tracesWebView);
	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider("*", codeLensProvider)
	);

	vscode.commands.registerCommand("trace-lenses.codelensAction", (testNode: testNode, documentUri: vscode.Uri) => {
		tracesWebView.render(testNode, documentUri);
    });
}

// this method is called when your extension is deactivated
export function deactivate() {}

type testNode = {
	title: string,
	pos: number,
	parent?: testNode,
	children: testNode[]
};

class TraceCodeLensProvider implements vscode.CodeLensProvider {
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	constructor() {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

	async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
		const result: vscode.CodeLens[] = [];

		if(document.fileName.endsWith('.ts')) {
			try {
				const parsedFile = ts.createSourceFile('x.ts', document.getText(), ts.ScriptTarget.Latest);
				const testNodes = this.traverse(parsedFile, parsedFile);

				testNodes.forEach(createLenses);
				function createLenses(testNode: testNode) {
					const { line } = parsedFile.getLineAndCharacterOfPosition(testNode.pos);
					const lens = new vscode.CodeLens(
						new vscode.Range(line, 0, line, 0),
						{
							command: 'trace-lenses.codelensAction',
							title: 'Traces',
							arguments: [testNode, document.uri]
						}
					);
					result.push(lens);

					testNode.children.forEach(createLenses);
				}
			} catch (err) {
				console.error(err);
			}
		}

		return result;
	}

	traverse(node: ts.Node, sourceFile: ts.SourceFile): testNode[] {
		const rootTests: testNode[] = [];
		traverseInternal(node, sourceFile);

		return rootTests;

		function traverseInternal(node: ts.Node, sourceFile: ts.SourceFile, parentTest?: testNode) {
			switch (node.kind) {
				case ts.SyntaxKind.CallExpression:
					const call = node as ts.CallExpression;
					if (isTestFunctionCall(call)) {
						const test = {
							title: (call.arguments[0] as any).text,
							pos: node.getStart(sourceFile),
							parent: parentTest,
							children: []
						};

						if (parentTest)
							parentTest.children.push(test);
						else {
							rootTests.push(test);
						}
						ts.forEachChild(node, n => traverseInternal(n, sourceFile, test));
					} else {
						ts.forEachChild(node, n => traverseInternal(n, sourceFile, parentTest));
					}
					break;
				default:
					ts.forEachChild(node, n => traverseInternal(n, sourceFile, parentTest));
					break;
			}
		}

		function isTestFunctionCall(node: ts.CallExpression): boolean {
			const functionName = getFunctionName(node.expression);
			return (functionName === 'describe' || functionName === 'it') && node.arguments.length === 2;
		}

		function getFunctionName(node: ts.Node) {
			switch (node.kind) {
				case ts.SyntaxKind.Identifier:
					const ident = node as ts.Identifier;
					return ident.text;
				case ts.SyntaxKind.PropertyAccessExpression:
					const propertyAccess = node as ts.PropertyAccessExpression;
					const name = propertyAccess.name.text;
					if (propertyAccess.expression.kind === ts.SyntaxKind.CallExpression) {
						const call = propertyAccess.expression as ts.CallExpression;
						if (call.expression.kind == ts.SyntaxKind.Identifier) {
							const callIden = call.expression as ts.Identifier;
							if (callIden.text === 'tags') {
								return name;
							}
						}
					}
					if (name === 'only' && propertyAccess.expression.kind === ts.SyntaxKind.Identifier) {
						const ident = propertyAccess.expression as ts.Identifier;
						return ident.text;
					}
			}
		}
	}
}
