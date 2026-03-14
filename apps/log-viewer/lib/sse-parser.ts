export interface SSEContentBlock {
  index: number;
  type: string;
  content: string;
  name?: string;  // Tool name for tool_use blocks
}

export interface ParsedSSE {
  events: any[];
  fullText: string;
  contentBlocks: SSEContentBlock[];
}

export function parseSSEStream(streamText: string): string {
  const lines = streamText.split('\n');
  // Store content blocks by index
  const contentBlocks: Record<number, string[]> = {};

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim();
      if (!dataStr || dataStr === '[DONE]') continue;

      try {
        const data = JSON.parse(dataStr);

        // Claude format: content_block_delta with delta.text or delta.thinking
        if (data.type === 'content_block_delta') {
          const index = data.index ?? 0;
          const text = data.delta?.text ?? data.delta?.thinking;
          if (text) {
            if (!contentBlocks[index]) {
              contentBlocks[index] = [];
            }
            contentBlocks[index].push(text);
          }
        }

        // OpenAI format: choices[].delta.content
        if (data.choices) {
          for (const choice of data.choices) {
            const index = choice.index ?? 0;
            const content = choice.delta?.content;
            if (content) {
              if (!contentBlocks[index]) {
                contentBlocks[index] = [];
              }
              contentBlocks[index].push(content);
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  // Combine all content blocks in order
  const allText: string[] = [];
  const sortedIndexes = Object.keys(contentBlocks).map(Number).sort((a, b) => a - b);

  for (const index of sortedIndexes) {
    const blockText = contentBlocks[index].join('');
    if (blockText) {
      allText.push(blockText);
    }
  }

  return allText.join('\n\n');
}

export function parseSSEStreamToJSON(streamText: string): ParsedSSE {
  const lines = streamText.split('\n');
  const events: any[] = [];
  // Store content blocks by index for summary
  const contentBlocks: Record<number, { type: string; text: string; name?: string; model?: string }> = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const eventType = line.substring(7).trim();
      events.push({ type: eventType });
    } else if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim();
      if (dataStr && dataStr !== '[DONE]') {
        try {
          const data = JSON.parse(dataStr);
          if (events.length > 0 && !events[events.length - 1].data) {
            events[events.length - 1].data = data;
          } else {
            events.push({ type: 'data', data });
          }

          // ── Claude format ──
          if (data.type === 'content_block_start') {
            const index = data.index ?? 0;
            const blockType = data.content_block?.type || 'unknown';
            const toolName = data.content_block?.name;
            contentBlocks[index] = { type: blockType, text: '', name: toolName };
          } else if (data.type === 'content_block_delta') {
            const index = data.index ?? 0;
            if (data.delta?.text) {
              if (!contentBlocks[index]) {
                contentBlocks[index] = { type: 'text', text: '' };
              }
              contentBlocks[index].text += data.delta.text;
            } else if (data.delta?.thinking) {
              if (!contentBlocks[index]) {
                contentBlocks[index] = { type: 'thinking', text: '' };
              }
              contentBlocks[index].text += data.delta.thinking;
            } else if (data.delta?.partial_json) {
              if (!contentBlocks[index]) {
                contentBlocks[index] = { type: 'tool_use', text: '' };
              }
              contentBlocks[index].text += data.delta.partial_json;
            }
            // signature_delta is intentionally skipped (not useful as content)
          }

          // ── OpenAI format ──
          if (data.choices) {
            for (const choice of data.choices) {
              const index = choice.index ?? 0;
              const content = choice.delta?.content;
              const role = choice.delta?.role;
              const model = data.model;
              if (!contentBlocks[index]) {
                contentBlocks[index] = { type: role || 'assistant', text: '', model };
              }
              if (content) {
                contentBlocks[index].text += content;
              }
              if (model && !contentBlocks[index].model) {
                contentBlocks[index].model = model;
              }
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  // Create summary of content blocks
  const summary: any[] = [];
  const sortedIndexes = Object.keys(contentBlocks).map(Number).sort((a, b) => a - b);

  for (const index of sortedIndexes) {
    const block = contentBlocks[index];
    summary.push({
      index,
      type: block.type,
      content: block.text,
      name: block.name,
    });
  }

  return {
    events,
    fullText: parseSSEStream(streamText),
    contentBlocks: summary,
  };
}

export function isSSEResponse(
  requestMetadata?: { headers: Record<string, string> },
  responseMetadata?: { headers: Record<string, string | string[]> }
): boolean {
  if (!responseMetadata?.headers) return false;

  // Case-insensitive header lookup
  const contentTypeKey = Object.keys(responseMetadata.headers)
    .find(k => k.toLowerCase() === 'content-type');
  if (!contentTypeKey) return false;

  const contentType = Array.isArray(responseMetadata.headers[contentTypeKey])
    ? (responseMetadata.headers[contentTypeKey] as string[])[0]
    : responseMetadata.headers[contentTypeKey] as string;

  return contentType?.includes('text/event-stream') ?? false;
}
