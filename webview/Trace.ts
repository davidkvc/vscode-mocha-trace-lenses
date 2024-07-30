type TraceCommon = {
  type: string;
  file: string;
  testTitlePath: string;
  start?: string;
  result: "success" | "error";
  elapsed: number;
};
export type RequestTrace = TraceCommon & {
  type: "request";
  request: any;
  response: any;
  error?: {
    str: string;
    data: any;
  };
};
export type SqlTrace = TraceCommon & {
  type: "sql";
  sql: string;
  sqlParams: any;
  data: any;
  error?: {
    str: string;
    data: any;
  };
};
export type Trace =
  | RequestTrace
  | SqlTrace
  | TraceCommon;
