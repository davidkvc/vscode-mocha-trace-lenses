import fs from 'fs';
import path from 'path';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import { Disposable, ExtensionContext, Uri, ViewColumn, WebviewPanel, window, workspace } from "vscode";
var escape = require('escape-html');

type testNode = {
	title: string,
	pos: number,
	parent?: testNode,
	children: testNode[]
};

export class TracesWebView {
    private _showResponseInDifferentTab: boolean = false;

    private panels: WebviewPanel[] = [];
    private activePanel: WebviewPanel | undefined;

    constructor(protected readonly context: ExtensionContext) {
        
    }

    public render(testNode: testNode, documentUri: Uri) {
        let panel: WebviewPanel;
        if (this._showResponseInDifferentTab || this.panels.length === 0) {
            panel = window.createWebviewPanel(
                'trace-lenses.preview',
                'Traces',
                ViewColumn.Beside,
                {
                    enableFindWidget: true,
                    enableScripts: true,
                    retainContextWhenHidden: true
                });

            panel.onDidDispose(() => {
                if (panel === this.activePanel) {
                    this.activePanel = undefined;
                }

                const index = this.panels.findIndex(v => v === panel);
                if (index !== -1) {
                    this.panels.splice(index, 1);
                }
            });

            panel.onDidChangeViewState(({ webviewPanel }) => {
                this.activePanel = webviewPanel.active ? webviewPanel : undefined;
            });

            this.panels.push(panel);
        } else {
            panel = this.panels[this.panels.length - 1];
        }

        const traces = this.loadTraces(documentUri, testNode);
        panel.webview.html = this.getHtml(testNode, traces);

        panel.reveal();

        this.activePanel = panel;
    }

    loadTraces(documentUri: Uri, testNode: testNode): any[] {
        const ws = workspace.getWorkspaceFolder(documentUri);
        if (!ws) {
            return [];
        }

        const tracesFolder = path.join(ws.uri.fsPath, 'traces');
        if (!fs.existsSync(tracesFolder)) {
            return [];
        }

        const files = fs.readdirSync(tracesFolder)
            .sort((a, b) => a.localeCompare(b));
        
        if (files.length === 0) {
            return [];
        }

        const lastTracesFile = files[files.length - 1];
        const lastTraces = <any[]>JSON.parse(fs.readFileSync(path.join(tracesFolder, lastTracesFile), 'utf8'));

        function getTestPath(t: testNode): string[] {
            if (t.parent) {
                return [...getTestPath(t.parent), t.title];
            }
            return [t.title];
        }
        const testPath = getTestPath(testNode);

        const relativeFilePath = path.relative(ws.uri.fsPath, documentUri.fsPath)
            .replace(/\\/g, '/');

        const testTraces = lastTraces
            .filter(x => x.file.replace(/\\/g, '/') === relativeFilePath)
            .filter(x => {
                if (x.testTitlePath.length !== testPath.length) {
                    return false;
                }

                for (let i = 0; i < testPath.length; i++) {
                    if (x.testTitlePath[i] !== testPath[i]) {
                        return false;
                    }
                }

                return true;
            })

        return testTraces;
    }

    getHtml(testNode: testNode, traces: any[]): string {
        function getTestPath(testNode: testNode): string {
            if (testNode.parent) {
                return getTestPath(testNode.parent) + ' > ' + testNode.title;
            }
            return testNode.title;
        }
        const testPath = getTestPath(testNode);

        const tracesHtml = traces.reduce((str, trace) => str + this.renderTrace(trace), '');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <style>
        code {
            background: #f5f2f0;
            border: 1px solid #ddd;
            border-left: 3px solid #f36d33;
            color: #666;
            page-break-inside: avoid;
            font-family: monospace;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 1.6em;
            max-width: 100%;
            overflow: auto;
            padding: 1em 1.5em;
            display: block;
            word-wrap: break-word;
        }
    </style>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.23.0/themes/prism.min.css" rel="stylesheet" />
</head>
<body>
    <div>
        <p>${escape(testPath)}</p>
        <div>${tracesHtml}</div>
    </div>
</body>
</html>`;
    }

    renderTrace(trace: any): string {
        switch (trace.type) {
            case 'request':
                return this.renderRequestTrace(trace);
            default:
                return `<p>Can not render trace of type '${escape(trace.type)}'</p>`;
        }
    }

    renderRequestTrace(trace: any): string {

        function isJson(contentType: string): boolean {
            return contentType.split(';')
                .map(x => x.trim())
                .some(x => x === 'application/json' || /^application\/[^+]+\+json$/.test(x));
        }

        function renderBody(body: any, headers: any): string {
            if (typeof body === 'string') {
                if (headers && headers['content-type'] && isJson(headers['content-type'])) {
                    return `\n${Prism.highlight(JSON.stringify(JSON.parse(body), null, 2), Prism.languages.json, 'json')}\n`;
                } else {
                    return `\n${escape(body)}\n`;
                }
            } else {
                return `\n${Prism.highlight(JSON.stringify(body, null, 2), Prism.languages.json, 'json')}\n`;
            }
        }

        let lines = `${escape(trace.request.method)} ${escape(trace.request.url)}\n`;

        if (trace.request.headers) {
            for (const key in trace.request.headers) {
                lines += `${escape(key)}: ${escape(trace.request.headers[key])}\n`;
            }
        }

        if (trace.request.body) {
            lines += renderBody(trace.request.body, trace.request.headers);
        }

        lines += '\n';

        if (trace.result === 'success') {
            lines += `<<< ${escape(trace.response.status)}\n`;
            if (trace.response.headers) {
                for (const key in trace.response.headers) {
                    lines += `${escape(key)}: ${escape(trace.response.headers[key])}\n`;
                }
            }

            if (trace.response.body) {
                lines += renderBody(trace.response.body, trace.response.headers);
            }
        }

        return `<div><pre><code>${lines}</code></pre></div>`;
    }

    public dispose() {
        this.disposeAll(this.panels);
    }

    private disposeAll(disposables: Disposable[]) {
        while (disposables.length) {
            const item = disposables.pop();
            if (item) {
                item.dispose();
            }
        }
    }
}