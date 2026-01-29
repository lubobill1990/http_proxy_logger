'use client';

import { LogDetail } from '@/types/log';
import { format } from 'date-fns';
import { isClaudeSSE, parseSSEStreamToJSON } from '@/lib/sse-parser';
import JsonViewer from './JsonViewer';

interface RequestDetailProps {
  log: LogDetail | null;
  isDark?: boolean;
}

export default function RequestDetail({ log, isDark = false }: RequestDetailProps) {
  if (!log) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        Select a request to view details
      </div>
    );
  }

  const isSSE = isClaudeSSE(log.requestMetadata, log.responseMetadata);
  const parsedSSE = isSSE && typeof log.responseBody === 'string'
    ? parseSSEStreamToJSON(log.responseBody)
    : null;

  const renderBody = (
    body: string | object | undefined,
    bodyType: string | undefined,
    isResponse: boolean
  ) => {
    if (!body) {
      return (
        <div className="text-gray-500 dark:text-gray-400 text-sm italic">
          No body
        </div>
      );
    }

    // Check if it's SSE response
    if (isResponse && isSSE && parsedSSE) {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Parsed Message:</h4>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              <pre className="whitespace-pre-wrap text-sm">
                {parsedSSE.fullText || '(empty)'}
              </pre>
            </div>
          </div>
          {parsedSSE.contentBlocks && parsedSSE.contentBlocks.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Content Blocks Summary:</h4>
              <div className="space-y-2">
                {parsedSSE.contentBlocks.map((block: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        Index {block.index}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                        {block.type}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                      {block.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <h4 className="font-semibold text-sm mb-2">Stream Events (Raw):</h4>
            <JsonViewer data={parsedSSE} isDark={isDark} id="response-sse" />
          </div>
        </div>
      );
    }

    if (typeof body === 'object') {
      return <JsonViewer data={body} isDark={isDark} id={isResponse ? 'response-body' : 'request-body'} />;
    }

    if (typeof body === 'string') {
      if (body.startsWith('[Binary file:')) {
        return (
          <div className="text-gray-500 dark:text-gray-400 text-sm italic">
            {body}
          </div>
        );
      }

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(body);
        return <JsonViewer data={parsed} isDark={isDark} id={isResponse ? 'response-body' : 'request-body'} />;
      } catch {
        // Not JSON, display as text
        return (
          <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-auto max-h-96 p-3 bg-white dark:bg-gray-900">
            <pre className="text-sm whitespace-pre-wrap">{body}</pre>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
              log.method === 'GET'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : log.method === 'POST'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : log.method === 'PUT'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : log.method === 'DELETE'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
            }`}
          >
            {log.method}
          </span>
          <span className="text-sm font-mono break-all">{log.path || '/'}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}
        </div>
        {isSSE && (
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
            Claude API SSE Stream Detected
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Request */}
        <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-sm">Request</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Request Metadata */}
              {log.requestMetadata && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Metadata</h3>
                  <JsonViewer data={log.requestMetadata} isDark={isDark} id="request-metadata" />
                </div>
              )}

              {/* Request Body */}
              {log.hasRequestBody && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Body</h3>
                  {renderBody(log.requestBody, log.requestBodyType, false)}
                </div>
              )}

              {!log.hasRequestBody && (
                <div className="text-gray-500 dark:text-gray-400 text-sm italic">
                  No request body
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Response */}
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-sm">Response</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Response Metadata */}
              {log.responseMetadata && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Metadata</h3>
                  <JsonViewer data={log.responseMetadata} isDark={isDark} id="response-metadata" />
                </div>
              )}

              {/* Response Body */}
              {log.hasResponseBody && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Body</h3>
                  {renderBody(log.responseBody, log.responseBodyType, true)}
                </div>
              )}

              {!log.hasResponseBody && !log.error && (
                <div className="text-gray-500 dark:text-gray-400 text-sm italic">
                  No response body
                </div>
              )}

              {/* Error */}
              {log.error && (
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-red-600 dark:text-red-400">
                    Error
                  </h3>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <pre className="text-sm whitespace-pre-wrap text-red-800 dark:text-red-200">
                      {log.error}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
