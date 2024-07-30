import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import TracesList from './TracesList';

const vscode = acquireVsCodeApi();

window.addEventListener('message', event => {
    console.log('Got message', event);
});

setInterval(() => {
    vscode.postMessage({
        command: 'alert',
        text: '🐛  on line ' + 10
    });
}, 1000);

const container = document.getElementById('app');
const root = createRoot(container!);
root.render(<App />);

function App() {
    const [traces, setTraces] = useState(window._traces);

    // useEffect(() => {
    //     window.addEventListener('message', event => {
    //         if ('traces' in event.data) {
    //             setTraces(event.data.traces);
    //         }
    //     });
    //     vscode.postMessage({
    //         command: 'ready',
    //     });
    // }, []);

    return <TracesList traces={traces}/>;
}
