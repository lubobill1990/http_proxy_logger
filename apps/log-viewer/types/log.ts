export interface RequestMetadata {
  method: string;
  url: string;
  headers: Record<string, string>;
  timestamp: string;
}

export interface ResponseMetadata {
  statusCode: number;
  headers: Record<string, string | string[]>;
  timestamp: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  directory: string;
  minuteDirectory: string;
  requestMetadata?: RequestMetadata;
  responseMetadata?: ResponseMetadata;
  hasRequestBody: boolean;
  hasResponseBody: boolean;
  requestBodyType?: string;
  responseBodyType?: string;
}

export interface LogDetail extends LogEntry {
  requestBody?: string | object;
  responseBody?: string | object;
  error?: string;
}
