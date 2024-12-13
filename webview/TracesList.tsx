import React from "react";
import TracePanel from "./TracePanel";
import { RequestTrace, SqlTrace, Trace } from "./Trace";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-sql";
import { WebviewApi } from "./typings";
var escape = require("escape-html");

export type TracesListProps = {
  traces: Trace[];
  vscode: WebviewApi;
};

function calculateTestDuration(traces: Trace[]) {
  if (traces.length === 0) {
    return 0;
  }

  if ('start' in traces[0]) {
    let start = new Date(traces[0].start!);
    let end = start.valueOf() + traces[0].elapsed;
    for (let i = 1; i < traces.length; i++) {
      const localStart = new Date(traces[i].start!);
      const localEnd = localStart.valueOf() + traces[i].elapsed;
      if (localStart.valueOf() < start.valueOf()) {
        start = localStart;
      }
      if (localEnd > end) {
        end = localEnd;
      }
    }

    return end - start.valueOf();
  }

  return traces.reduce((agg, curr) => {
    if ("elapsed" in curr) {
      return agg + curr.elapsed;
    }
    return agg;
  }, 0);
}

export default function TracesList(props: TracesListProps) {
  const totalDuration = calculateTestDuration(props.traces);

  let testStart = new Date();
  if ('start' in props.traces[0]) {
    testStart = props.traces.reduce((agg, curr) => {
      const start = new Date(curr.start!);
      if (start.valueOf() < agg.valueOf()) {
        return start;
      }

      return agg;
    }, new Date());
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {props.traces.map((trace) => {
        if (trace.type === "request") {
          return renderRequestTrace(trace as RequestTrace, totalDuration, testStart, props.vscode);
        }

        if (trace.type === "sql") {
          return renderSqlTrace(trace as SqlTrace, totalDuration, testStart, props.vscode);
        }

        return <div>Unknown trace type {trace.type}</div>;
      })}
    </div>
  );
}

function renderSqlTrace(trace: SqlTrace, totalDuration: number, testStart: Date, vscode: WebviewApi) {
  const firstWord = trace.sql.slice(0, trace.sql.indexOf(" "));

  const sqlTraceContent = createSqlTraceContent(trace, escape, (sql) => Prism.highlight(
    sql,
    Prism.languages.sql,
    "sql"
  ));

  const [startFillPercentage, endFillPercentage] = calculateFill(trace, totalDuration, testStart);

  const handleCopyClick = (e: any) => {
    vscode.postMessage({
      command: 'saveClip',
      data: {
        text: createSqlTraceContent(trace, x => x, x => x),
      }
    });
  };
  
  return (
    <TracePanel
      summary={`${firstWord}`}
      durationMs={trace.elapsed}
      startFillPercentage={startFillPercentage}
      endFillPercentage={endFillPercentage}
    >
      <div style={{
        position: 'relative',
      }}>
        <button onClick={handleCopyClick} style={{
          position: 'absolute',
          right: '4px',
          top: '4px',
        }}>Copy</button>
        <pre>
          <code dangerouslySetInnerHTML={{ __html: sqlTraceContent }}></code>
        </pre>
      </div>
    </TracePanel>
  );
}

function createSqlTraceContent(trace: SqlTrace, htmlEscape: (str: string) => string, highlightSql: (str: string) => string) {
  let lines = `Executed SQL in ${trace.elapsed}ms\n\n${highlightSql(trace.sql)}`;

  if (trace.result === 'success') {
    lines += `\n\n<<< success`;

    if ('rows' in trace.data && Array.isArray(trace.data.rows)) {
      lines += `\n${trace.data.rows.length} rows (experimental)`;
      lines += `<table class="styled-table">`;
      lines += `<thead>`;
      lines += `<tr>`;
      Object.keys(trace.data.rows[0]).forEach(k => {
        lines += `<th>${htmlEscape(k)}</th>`;
      });
      lines += `</tr>`;
      lines += `</thead>`;
      lines += `<tbody>`;
      trace.data.rows.forEach((row: Object) => {
        lines += `<tr>`;
        Object.values(row).forEach(val => {
          lines += `<td>${htmlEscape(val)}</td>`;
        });
        lines += `</tr>`;
      });
      lines += `</tbody>`;
      lines += `</table>`;
    }
  }

  if (trace.result === "error") {
    lines += `\n\n<<< error\n${htmlEscape(trace.error!.str)}`;
  }

  return lines;
}

function renderRequestTrace(trace: RequestTrace, totalDuration: number, testStart: Date, vscode: WebviewApi) {
  const reqPath = new URL(trace.request.url).pathname;

  const requestTraceContent = createRequestTraceContent(trace, escape, (data) => Prism.highlight(
    data,
    Prism.languages.json,
    "json"
  ));

  const [startFillPercentage, endFillPercentage] = calculateFill(trace, totalDuration, testStart);

  const handleCopyClick = (e: any) => {
    vscode.postMessage({
      command: 'saveClip',
      data: {
        text: createRequestTraceContent(trace, x => x, x => x),
      }
    });
  };

  return (
    <TracePanel
      summary={`${trace.request.method} ${reqPath}`}
      durationMs={trace.elapsed}
      startFillPercentage={startFillPercentage}
      endFillPercentage={endFillPercentage}
    >
      <div style={{
        position: 'relative',
      }}>
        <button onClick={handleCopyClick} style={{
          position: 'absolute',
          right: '4px',
          top: '4px',
        }}>Copy</button>
        <pre>
          <code dangerouslySetInnerHTML={{ __html: requestTraceContent }}></code>
        </pre>
      </div>
    </TracePanel>
  );
}

function createRequestTraceContent(trace: RequestTrace, htmlEscape: (str: string) => string, highlightJson: (str: string) => string) {
  function isJson(contentType: string): boolean {
    return contentType
      .split(";")
      .map((x) => x.trim())
      .some(
        (x) => x === "application/json" || /^application\/[^+]+\+json$/.test(x)
      );
  }

  function renderBody(body: any, headers: any): string {
    if (typeof body === "string") {
      if (
        headers &&
        headers["content-type"] &&
        isJson(headers["content-type"])
      ) {
        return `\n${highlightJson(JSON.stringify(JSON.parse(body), null, 2))}\n`;
      } else {
        return `\n${htmlEscape(body)}\n`;
      }
    } else {
      return `\n${highlightJson(JSON.stringify(body, null, 2))}\n`;
    }
  }

  let lines = `${htmlEscape(trace.request.method)} ${htmlEscape(trace.request.url)} (${
    trace.elapsed
  }ms)\n`;

  if (trace.request.headers) {
    for (const key in trace.request.headers) {
      lines += `${htmlEscape(key)}: ${htmlEscape(trace.request.headers[key])}\n`;
    }
  }

  if (trace.request.body) {
    lines += renderBody(trace.request.body, trace.request.headers);
  }

  lines += "\n";

  if (trace.result === "success") {
    lines += `<<< ${htmlEscape(trace.response.status)}\n`;
    if (trace.response.headers) {
      for (const key in trace.response.headers) {
        lines += `${htmlEscape(key)}: ${htmlEscape(trace.response.headers[key])}\n`;
      }
    }

    if (trace.response.body) {
      lines += renderBody(trace.response.body, trace.response.headers);
    }
  }

  if (trace.result === 'error') {
    lines += `<<< error\n${htmlEscape(trace.error!.str)}`;
  }

  return lines;
}

function calculateFill(trace: Trace, totalDurationMs: number, testStart: Date) {
  if (trace.start === undefined) {
    return [0, (trace.elapsed / totalDurationMs) * 100];
  }

  const traceStart = new Date(trace.start);
  const traceDelay = traceStart.valueOf() - testStart.valueOf();
  const traceEnd = traceDelay + trace.elapsed;

  return [(traceDelay / totalDurationMs) * 100, (traceEnd / totalDurationMs) * 100];
}
