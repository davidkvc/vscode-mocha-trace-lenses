import React from "react";
import TracePanel from "./TracePanel";
import { RequestTrace, SqlTrace, Trace } from "./Trace";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/components/prism-sql";
var escape = require("escape-html");

export type TracesListProps = {
  traces: Trace[];
};

export default function TracesList(props: TracesListProps) {
  const totalDuration = props.traces.reduce((agg, curr) => {
    if ("elapsed" in curr) {
      return agg + curr.elapsed;
    }
    return agg;
  }, 0);

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
          return renderRequestTrace(trace as RequestTrace, totalDuration);
        }

        if (trace.type === "sql") {
          return renderSqlTrace(trace as SqlTrace, totalDuration);
        }

        return <div>Unknown trace type {trace.type}</div>;
      })}
    </div>
  );
}

function renderSqlTrace(trace: SqlTrace, totalDuration: number) {
  const firstWord = trace.sql.slice(0, trace.sql.indexOf(" "));

  let lines = `Executed SQL in ${trace.elapsed}ms\n\n${Prism.highlight(
    trace.sql,
    Prism.languages.sql,
    "sql"
  )}`;

  if (trace.result === 'success') {
    lines += `\n\n<<< success`;
  }

  if (trace.result === "error") {
    lines += `\n\n<<< error\n${escape(trace.error!.str)}`;
  }

  return (
    <TracePanel
      summary={`${firstWord}`}
      durationMs={trace.elapsed}
      fillPercentage={(trace.elapsed / totalDuration) * 100}
    >
      <div>
        <pre>
          <code dangerouslySetInnerHTML={{ __html: lines }}></code>
        </pre>
      </div>
    </TracePanel>
  );
}

function renderRequestTrace(trace: RequestTrace, totalDuration: number) {
  const reqPath = new URL(trace.request.url).pathname;

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
        return `\n${Prism.highlight(
          JSON.stringify(JSON.parse(body), null, 2),
          Prism.languages.json,
          "json"
        )}\n`;
      } else {
        return `\n${escape(body)}\n`;
      }
    } else {
      return `\n${Prism.highlight(
        JSON.stringify(body, null, 2),
        Prism.languages.json,
        "json"
      )}\n`;
    }
  }

  let lines = `${escape(trace.request.method)} ${escape(trace.request.url)} (${
    trace.elapsed
  }ms)\n`;

  if (trace.request.headers) {
    for (const key in trace.request.headers) {
      lines += `${escape(key)}: ${escape(trace.request.headers[key])}\n`;
    }
  }

  if (trace.request.body) {
    lines += renderBody(trace.request.body, trace.request.headers);
  }

  lines += "\n";

  if (trace.result === "success") {
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

  if (trace.result === 'error') {
    lines += `<<< error\n${escape(trace.error!.str)}`;
  }

  return (
    <TracePanel
      summary={`${trace.request.method} ${reqPath}`}
      durationMs={trace.elapsed}
      fillPercentage={(trace.elapsed / totalDuration) * 100}
    >
      <div>
        <pre>
          <code dangerouslySetInnerHTML={{ __html: lines }}></code>
        </pre>
      </div>
    </TracePanel>
  );
}
