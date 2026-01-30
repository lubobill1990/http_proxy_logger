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

        // Handle content_block_delta events with text
        if (data.type === 'content_block_delta' && data.delta?.text) {
          const index = data.index ?? 0;
          if (!contentBlocks[index]) {
            contentBlocks[index] = [];
          }
          contentBlocks[index].push(data.delta.text);
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
  const contentBlocks: Record<number, { type: string; text: string; name?: string }> = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const eventType = line.substring(7).trim();
      events.push({ type: eventType });
    } else if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim();
      if (dataStr && dataStr !== '[DONE]' && events.length > 0) {
        try {
          const data = JSON.parse(dataStr);
          events[events.length - 1].data = data;

          // Track content blocks for summary
          if (data.type === 'content_block_start') {
            const index = data.index ?? 0;
            const blockType = data.content_block?.type || 'unknown';
            const toolName = data.content_block?.name;  // Extract tool name for tool_use blocks
            contentBlocks[index] = { type: blockType, text: '', name: toolName };
          } else if (data.type === 'content_block_delta' && data.delta?.text) {
            const index = data.index ?? 0;
            if (!contentBlocks[index]) {
              contentBlocks[index] = { type: 'text', text: '' };
            }
            contentBlocks[index].text += data.delta.text;
          } else if (data.type === 'content_block_delta' && data.delta?.partial_json) {
            const index = data.index ?? 0;
            if (!contentBlocks[index]) {
              contentBlocks[index] = { type: 'tool_use', text: '' };
            }
            contentBlocks[index].text += data.delta.partial_json;
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

export function isClaudeSSE(
  requestMetadata?: { headers: Record<string, string> },
  responseMetadata?: { headers: Record<string, string | string[]> }
): boolean {
  if (!requestMetadata || !responseMetadata) return false;

  const userAgent = requestMetadata.headers['user-agent'] || '';
  const contentType = Array.isArray(responseMetadata.headers['content-type'])
    ? responseMetadata.headers['content-type'][0]
    : responseMetadata.headers['content-type'];

  return (
    userAgent.includes('claude-cli') &&
    contentType?.includes('text/event-stream')
  );
}
