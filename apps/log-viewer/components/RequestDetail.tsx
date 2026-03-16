'use client';

import { LogDetail } from '@/types/log';
import { format } from 'date-fns';
import { isSSEResponse, parseSSEStreamToJSON, ParsedSSE, SSEContentBlock } from '@/lib/sse-parser';
import JsonViewer from './JsonViewer';
import { useState, useRef, useEffect } from 'react';

interface RequestDetailProps {
  log: LogDetail | null;
  isDark?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (title?: string) => void;
  currentDir?: string;
}

function FavoriteDialog({ onConfirm }: { onConfirm: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
        setTitle('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSubmit = () => {
    onConfirm(title.trim());
    setOpen(false);
    setTitle('');
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1 text-sm font-medium rounded-md transition-colors bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-700 dark:hover:text-yellow-300 hover:border-yellow-300 dark:hover:border-yellow-700"
      >
        &#9734; 收藏
      </button>
      {open && (
        <div ref={dialogRef} className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 p-4 w-72">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            添加收藏
          </h3>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') { setOpen(false); setTitle(''); } }}
            placeholder="输入标题 (可选)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 mb-3"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setOpen(false); setTitle(''); }}
              className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="px-3 py-1.5 text-sm rounded-md bg-yellow-500 text-white hover:bg-yellow-600 font-medium"
            >
              确认收藏
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestDetail({ log, isDark = false, isFavorite = false, onToggleFavorite, currentDir }: RequestDetailProps) {
  if (!log) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        Select a request to view details
      </div>
    );
  }

  const isSSE = isSSEResponse(log.requestMetadata, log.responseMetadata);
  const parsedSSE = isSSE && typeof log.responseBody === 'string'
    ? parseSSEStreamToJSON(log.responseBody)
    : null;

  // Detect LLM call: response is SSE stream + request JSON has messages key
  const isLlmCall = (() => {
    if (!isSSE) return false;
    let reqBody: any = null;
    if (typeof log.requestBody === 'object') reqBody = log.requestBody;
    else if (typeof log.requestBody === 'string') {
      try { reqBody = JSON.parse(log.requestBody); } catch { return false; }
    }
    return reqBody && (Array.isArray(reqBody.messages) || reqBody.messages !== undefined);
  })();

  const llmUrl = isLlmCall
    ? `/llm/${encodeURIComponent(log.minuteDirectory)}/${log.directory}${currentDir ? `?dir=${encodeURIComponent(currentDir)}` : ''}`
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
                {parsedSSE.contentBlocks.map((block: SSEContentBlock, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        Index {block.index}
                      </span>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        block.type === 'thinking'
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          : block.type === 'tool_use'
                          ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                          : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                      }`}>
                        {block.type}
                      </span>
                      {block.name && (
                        <span className="text-xs font-mono px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                          {block.name}
                        </span>
                      )}
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
          <span className="text-sm font-mono break-all flex-1">{log.path ? '/' + decodeURIComponent(log.path) : '/'}</span>
          {onToggleFavorite && (
            isFavorite ? (
              <button
                onClick={() => onToggleFavorite()}
                className="shrink-0 px-3 py-1 text-sm font-medium rounded-md transition-colors bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
              >
                &#9733; 已收藏
              </button>
            ) : (
              <FavoriteDialog onConfirm={(title) => onToggleFavorite(title)} />
            )
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')}
        </div>
        {isSSE && (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              SSE Stream Detected
            </span>
            {llmUrl && (
              <a
                href={llmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors"
              >
                深入 LLM 调用 &rarr;
              </a>
            )}
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Request */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-gray-200 dark:border-gray-700">
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
        <div className="flex-1 min-w-0 flex flex-col">
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
