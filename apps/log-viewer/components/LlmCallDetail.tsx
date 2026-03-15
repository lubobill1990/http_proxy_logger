'use client';

import { LogDetail } from '@/types/log';
import { parseSSEStreamToJSON } from '@/lib/sse-parser';
import JsonViewer from './JsonViewer';
import { useEffect, useState } from 'react';

interface LlmMessage {
  role: string;
  content: any;
}

interface LlmCallDetailProps {
  log: LogDetail;
  dir?: string;
}

function getRequestBody(log: LogDetail): any {
  if (typeof log.requestBody === 'object') return log.requestBody;
  if (typeof log.requestBody === 'string') {
    try { return JSON.parse(log.requestBody); } catch { return null; }
  }
  return null;
}

function extractSystemMessage(body: any): string | null {
  // Try $.system first (Claude format)
  if (body?.system) {
    if (typeof body.system === 'string') return body.system;
    if (Array.isArray(body.system)) {
      return body.system
        .map((s: any) => typeof s === 'string' ? s : s?.text || JSON.stringify(s))
        .join('\n');
    }
  }
  // Try $.messages with role=system (OpenAI format)
  if (Array.isArray(body?.messages)) {
    const systemMsgs = body.messages.filter((m: any) => m.role === 'system');
    if (systemMsgs.length > 0) {
      return systemMsgs
        .map((m: any) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
        .join('\n\n');
    }
  }
  return null;
}

function extractConversationMessages(body: any): LlmMessage[] {
  if (!Array.isArray(body?.messages)) return [];
  return body.messages.filter((m: any) => m.role === 'user' || m.role === 'assistant' || m.role === 'tool');
}

function extractTools(body: any): any[] | null {
  if (Array.isArray(body?.tools) && body.tools.length > 0) return body.tools;
  return null;
}

function renderContent(content: any, isDark: boolean): React.ReactNode {
  if (typeof content === 'string') {
    return <pre className="whitespace-pre-wrap text-sm leading-relaxed border-none bg-transparent p-0 m-0 font-sans">{content}</pre>;
  }
  if (Array.isArray(content)) {
    return (
      <div className="space-y-4">
        {content.map((part: any, i: number) => {
          if (part.type === 'text') {
            return <pre key={i} className="whitespace-pre-wrap text-sm leading-relaxed border-none bg-transparent p-0 m-0 font-sans">{part.text}</pre>;
          }
          if (part.type === 'image_url' || part.type === 'image') {
            return (
              <div key={i} className="text-sm text-gray-500 italic p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 inline-block">
                &#128444; [Image: {part.source?.type || part.image_url?.url?.slice(0, 50) || 'embedded'}]
              </div>
            );
          }
          if (part.type === 'tool_use') {
            let parsedInput = part.input;
            if (typeof parsedInput === 'string') {
              try { parsedInput = JSON.parse(parsedInput); } catch {}
            }
            return (
              <div key={i} className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
                    tool_use
                  </span>
                  <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{part.name}</span>
                  {part.id && <span className="text-xs text-gray-500 font-mono ml-auto">{part.id}</span>}
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                  {typeof parsedInput === 'object' ? (
                    <JsonViewer data={parsedInput} isDark={isDark} id={`tu-${i}`} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 overflow-auto">{parsedInput}</pre>
                  )}
                </div>
              </div>
            );
          }
          if (part.type === 'tool_result') {
            let parsedContent = part.content;
            if (typeof parsedContent === 'string') {
              try { parsedContent = JSON.parse(parsedContent); } catch {}
            }
            return (
              <div key={i} className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono px-2 py-0.5 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 rounded">
                    tool_result
                  </span>
                  {part.tool_use_id && <span className="text-xs text-gray-500 font-mono ml-auto">{part.tool_use_id}</span>}
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                  {typeof parsedContent === 'object' ? (
                    <JsonViewer data={parsedContent} isDark={isDark} id={`tr-${i}`} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 overflow-auto">{parsedContent}</pre>
                  )}
                </div>
              </div>
            );
          }
          if (part.type === 'thinking') {
            return (
              <div key={i} className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                    thinking
                  </span>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {part.thinking}
                </pre>
              </div>
            );
          }
          return (
            <div key={i} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
              <JsonViewer data={part} isDark={isDark} id={`part-${i}`} />
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <JsonViewer data={content} isDark={isDark} id="content-json" />
    </div>
  );
}

function renderMessageContent(msg: any, isDark: boolean): React.ReactNode {
  // Check if it's OpenAI tool_calls
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    const blocks: React.ReactNode[] = [];
    if (msg.content) {
      blocks.push(renderContent(msg.content, isDark));
    }
    msg.tool_calls.forEach((tc: any, i: number) => {
      let parsedArgs = tc.function?.arguments;
      if (typeof parsedArgs === 'string') {
        try { parsedArgs = JSON.parse(parsedArgs); } catch {}
      }
      blocks.push(
        <div key={`tc-${i}`} className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10 p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
              tool_use
            </span>
            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{tc.function?.name || 'unknown'}</span>
            {tc.id && <span className="text-xs text-gray-500 font-mono ml-auto">{tc.id}</span>}
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 p-3">
            {typeof parsedArgs === 'object' ? (
              <JsonViewer data={parsedArgs} isDark={isDark} id={`tu-${tc.id || i}`} />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 overflow-auto">{parsedArgs}</pre>
            )}
          </div>
        </div>
      );
    });
    return <div className="space-y-4">{blocks}</div>;
  }

  // Check if it's OpenAI tool role message
  if (msg.role === 'tool') {
    let parsedContent = msg.content;
    if (typeof parsedContent === 'string') {
      try { parsedContent = JSON.parse(parsedContent); } catch {}
    }
    return (
      <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono px-2 py-0.5 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 rounded">
            tool_result
          </span>
          {msg.tool_call_id && <span className="text-xs text-gray-500 font-mono ml-auto">{msg.tool_call_id}</span>}
          {msg.name && <span className="text-xs text-gray-500 font-mono items-center ml-2">{msg.name}</span>}
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 p-3">
          {typeof parsedContent === 'object' ? (
            <JsonViewer data={parsedContent} isDark={isDark} id={`tr-${msg.tool_call_id || Math.random().toString()}`} />
          ) : (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 overflow-auto">{parsedContent}</pre>
          )}
        </div>
      </div>
    );
  }

  return renderContent(msg.content, isDark);
}

function parseResponseToolUse(block: any, isDark: boolean, idx: number) {
  let parsedInput: any = block.content;
  try { parsedInput = JSON.parse(block.content); } catch {}
  return (
    <div key={idx} className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-mono px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
          tool_use
        </span>
        {block.name && (
          <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">{block.name}</span>
        )}
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 p-3">
        {typeof parsedInput === 'object' ? (
          <JsonViewer data={parsedInput} isDark={isDark} id={`tr-tu-${idx}`} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 overflow-auto">{parsedInput}</pre>
        )}
      </div>
    </div>
  );
}

function renderResponseBlocks(blocks: any, isDark: boolean): React.ReactNode {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return <span className="text-gray-400 text-sm italic">(empty response)</span>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block: any, idx: number) => {
        if (block.type === 'thinking') {
          return (
            <div key={idx} className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                  thinking
                </span>
                <span className="text-xs text-gray-500">{(block.content?.length || 0)} chars</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 mt-1 max-h-96 overflow-auto">
                {block.content}
              </pre>
            </div>
          );
        }
        if (block.type === 'tool_use') {
          return parseResponseToolUse(block, isDark, idx);
        }
        // text block
        return (
          <div key={idx} className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed border-none bg-transparent p-0 m-0 text-[inherit] font-sans">
              {block.content}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({ role, children, isResponse }: { role: string; children: React.ReactNode; isResponse?: boolean }) {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const isAssistant = role === 'assistant';
  const isTool = role === 'tool';

  const borderColor = isUser ? 'border-blue-200 dark:border-blue-800' 
    : isAssistant ? 'border-purple-200 dark:border-purple-800' 
    : isTool ? 'border-teal-200 dark:border-teal-800'
    : 'border-gray-300 dark:border-gray-600';
  
  const bgColor = isUser ? 'bg-blue-50/30 dark:bg-blue-900/10'
    : isAssistant ? 'bg-purple-50/30 dark:bg-purple-900/10'
    : isTool ? 'bg-teal-50/30 dark:bg-teal-900/10'
    : 'bg-white dark:bg-gray-900';

  const icon = isUser ? '👤 User' : isSystem ? '⚙️ System' : isTool ? '🛠️ Tool Response' : '🤖 Assistant';
  const headerColor = isUser ? 'text-blue-700 dark:text-blue-300'
    : isAssistant ? 'text-purple-700 dark:text-purple-300'
    : isTool ? 'text-teal-700 dark:text-teal-300'
    : 'text-gray-700 dark:text-gray-300';

  return (
    <div className={`rounded-xl border shadow-sm ${borderColor} ${bgColor} overflow-hidden mb-6`}>
      <div className={`px-4 py-2.5 border-b ${borderColor} flex items-center justify-between bg-white/50 dark:bg-gray-900/50`}>
        <div className={`text-sm font-bold tracking-wide flex items-center gap-2 ${headerColor}`}>
          {icon}
        </div>
        {isResponse && (
          <span className="text-xs font-mono px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-semibold border border-green-200 dark:border-green-800 shadow-sm">
            Response (streamed)
          </span>
        )}
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

export default function LlmCallDetail({ log, dir }: LlmCallDetailProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    check();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);

  const requestBody = getRequestBody(log);
  const systemMessage = requestBody ? extractSystemMessage(requestBody) : null;
  const conversationMessages = requestBody ? extractConversationMessages(requestBody) : [];
  const tools = requestBody ? extractTools(requestBody) : null;

  // Parse response SSE stream for the assistant reply
  const responseText = typeof log.responseBody === 'string'
    ? parseSSEStreamToJSON(log.responseBody)
    : null;

  // Group messages into turns based on user logic:
  // "一次 turn 可以认为从 user 或者 tool 开始，到 assistant 结束。"
  interface Turn {
    messages: {
      role: string;
      rawMsg?: any;
      content?: any;
      isResponse?: boolean;
    }[];
  }
  const turns: Turn[] = [];
  let currentTurn: Turn | null = null;
  
  for (const msg of conversationMessages) {
    if (!currentTurn) {
      currentTurn = { messages: [] };
    }
    
    currentTurn.messages.push({ role: msg.role, rawMsg: msg });
    
    if (msg.role === 'assistant') {
      turns.push(currentTurn);
      currentTurn = null;
    }
  }

  if (responseText) {
    if (!currentTurn) currentTurn = { messages: [] };
    currentTurn.messages.push({
      role: 'assistant',
      content: responseText.contentBlocks,
      isResponse: true
    });
    turns.push(currentTurn);
    currentTurn = null;
  }

  if (currentTurn && currentTurn.messages.length > 0) {
    turns.push(currentTurn);
  }

  const [selectedSection, setSelectedSection] = useState<string | number>(
    systemMessage ? 'system' : (turns.length > 0 ? 0 : (tools ? 'tools' : 'none'))
  );

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4 shadow-sm z-10">
        <button
          onClick={() => window.history.back()}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 shrink-0 transition-colors bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md"
        >
          &larr; 返回
        </button>
        <h1 className="text-lg font-semibold truncate shrink-0">
          LLM 调用详情
        </h1>
        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate flex-1 opacity-75">
          {log.path ? '/' + (() => { try { return decodeURIComponent(log.path); } catch { return log.path; } })() : '/'}
        </span>
        {requestBody?.model && (
          <span className="text-xs font-mono px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-md shrink-0 font-semibold shadow-sm border border-indigo-200 dark:border-indigo-800">
            {requestBody.model}
          </span>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col overflow-y-auto">
          <div className="py-3 flex flex-col gap-1 px-3">
            {systemMessage && (
              <button
                onClick={() => setSelectedSection('system')}
                className={`text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedSection === 'system' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                ⚙️ System Message
              </button>
            )}

            {tools && (
              <>
                <button
                  onClick={() => setSelectedSection('tools')}
                  className={`text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-between ${
                    selectedSection === 'tools' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>🛠️ Tools</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selectedSection === 'tools' ? 'bg-blue-200 dark:bg-blue-800' : 'bg-gray-200 dark:bg-gray-700'}`}>{tools.length}</span>
                </button>
                {selectedSection === 'tools' && tools.length > 0 && (
                  <div className="pl-6 flex flex-col gap-1 mt-1 mb-2 border-l-2 border-gray-200 dark:border-gray-700 ml-4 py-1">
                    {tools.map((tool: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedSection('tools');
                          setTimeout(() => {
                            document.getElementById(`tool-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 0);
                        }}
                        className="text-left px-2 py-1 text-xs truncate rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                        title={tool.name || tool.function?.name || `tool_${idx}`}
                      >
                       {tool.name || tool.function?.name || `tool_${idx}`}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {turns.length > 0 && (
              <div className="px-3 pt-4 pb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Conversation
              </div>
            )}
            {turns.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedSection(idx)}
                className={`text-left px-3 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  selectedSection === idx ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 shadow-sm' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${selectedSection === idx ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                Turn {idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto p-8 space-y-6">
            {selectedSection === 'system' && systemMessage && (
              <MessageBubble role="system">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                  {systemMessage}
                </pre>
              </MessageBubble>
            )}

            {selectedSection === 'tools' && tools && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tools Definition</h2>
                  <span className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1 rounded-full font-semibold">{tools.length} available</span>
                </div>
                {tools.map((tool: any, idx: number) => (
                  <div key={idx} id={`tool-card-${idx}`} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 shadow-sm overflow-hidden scroll-m-6 mt-6">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded font-semibold">
                          {tool.type || 'function'}
                        </span>
                        <span className="text-base font-mono font-bold text-gray-900 dark:text-gray-100">
                          {tool.name || tool.function?.name || `tool_${idx}`}
                        </span>
                      </div>
                      {(tool.description || tool.function?.description) && (
                        <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl">
                          {tool.description || tool.function?.description}
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Parameters Schema</h4>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <JsonViewer data={tool.function?.parameters || tool.parameters || tool} isDark={isDark} id={`tool-${idx}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {typeof selectedSection === 'number' && turns[selectedSection] && (
              <div className="py-2">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    Turn {selectedSection + 1}
                  </h2>
                </div>
                {turns[selectedSection].messages.map((msg, idx) => (
                  <MessageBubble key={idx} role={msg.role} isResponse={msg.isResponse}>
                    {msg.isResponse
                      ? renderResponseBlocks(msg.content, isDark)
                      : renderMessageContent(msg.rawMsg || msg, isDark)
                    }
                  </MessageBubble>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

