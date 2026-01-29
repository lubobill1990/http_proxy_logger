import { promises as fs } from 'fs';
import path from 'path';
import { LogEntry, RequestMetadata, ResponseMetadata } from '@/types/log';

const LOG_DIR = path.join(process.cwd(), '..', '..', 'logs');

export async function getLogEntries(startTime?: number, endTime?: number): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];

  try {
    const minuteDirs = await fs.readdir(LOG_DIR);

    for (const minuteDir of minuteDirs) {
      const minutePath = path.join(LOG_DIR, minuteDir);
      const stat = await fs.stat(minutePath);

      if (!stat.isDirectory()) continue;

      const requestDirs = await fs.readdir(minutePath);

      for (const requestDir of requestDirs) {
        const requestPath = path.join(minutePath, requestDir);
        const requestStat = await fs.stat(requestPath);

        if (!requestStat.isDirectory()) continue;

        // Parse directory name: timestamp_method_path
        const parts = requestDir.split('_');
        if (parts.length < 2) continue;

        const timestamp = parseInt(parts[0]);
        if (isNaN(timestamp)) continue;

        // Filter by time range
        if (startTime && timestamp < startTime) continue;
        if (endTime && timestamp > endTime) continue;

        const method = parts[1];
        const urlPath = parts.slice(2).join('_');

        // Check what files exist
        const files = await fs.readdir(requestPath);
        const hasRequestBody = files.some(f => f.startsWith('request_body'));
        const hasResponseBody = files.some(f => f.startsWith('response_body'));

        let requestBodyType: string | undefined;
        let responseBodyType: string | undefined;

        if (hasRequestBody) {
          const bodyFile = files.find(f => f.startsWith('request_body'));
          requestBodyType = bodyFile?.split('.').pop();
        }

        if (hasResponseBody) {
          const bodyFile = files.find(f => f.startsWith('response_body'));
          responseBodyType = bodyFile?.split('.').pop();
        }

        // Read metadata
        let requestMetadata: RequestMetadata | undefined;
        let responseMetadata: ResponseMetadata | undefined;

        try {
          const reqMeta = await fs.readFile(
            path.join(requestPath, 'request_metadata.json'),
            'utf-8'
          );
          requestMetadata = JSON.parse(reqMeta);
        } catch {
          // Metadata file doesn't exist or is invalid
        }

        try {
          const resMeta = await fs.readFile(
            path.join(requestPath, 'response_metadata.json'),
            'utf-8'
          );
          responseMetadata = JSON.parse(resMeta);
        } catch {
          // Metadata file doesn't exist or is invalid
        }

        entries.push({
          id: `${minuteDir}/${requestDir}`,
          timestamp,
          method,
          path: urlPath,
          directory: requestDir,
          minuteDirectory: minuteDir,
          requestMetadata,
          responseMetadata,
          hasRequestBody,
          hasResponseBody,
          requestBodyType,
          responseBodyType,
        });
      }
    }
  } catch (error) {
    console.error('Error reading logs:', error);
  }

  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => b.timestamp - a.timestamp);

  return entries;
}

export async function getLogDetail(minuteDir: string, requestDir: string) {
  const requestPath = path.join(LOG_DIR, minuteDir, requestDir);

  try {
    const files = await fs.readdir(requestPath);

    // Read metadata
    let requestMetadata: RequestMetadata | undefined;
    let responseMetadata: ResponseMetadata | undefined;

    try {
      const reqMeta = await fs.readFile(
        path.join(requestPath, 'request_metadata.json'),
        'utf-8'
      );
      requestMetadata = JSON.parse(reqMeta);
    } catch {
      // Ignore
    }

    try {
      const resMeta = await fs.readFile(
        path.join(requestPath, 'response_metadata.json'),
        'utf-8'
      );
      responseMetadata = JSON.parse(resMeta);
    } catch {
      // Ignore
    }

    // Read request body
    let requestBody: string | object | undefined;
    const requestBodyFile = files.find(f => f.startsWith('request_body'));
    if (requestBodyFile) {
      const bodyPath = path.join(requestPath, requestBodyFile);
      if (requestBodyFile.endsWith('.json')) {
        const content = await fs.readFile(bodyPath, 'utf-8');
        requestBody = JSON.parse(content);
      } else if (requestBodyFile.match(/\.(txt|html|css|js|xml)$/)) {
        requestBody = await fs.readFile(bodyPath, 'utf-8');
      } else {
        requestBody = `[Binary file: ${requestBodyFile}]`;
      }
    }

    // Read response body
    let responseBody: string | object | undefined;
    const responseBodyFile = files.find(f => f.startsWith('response_body'));
    if (responseBodyFile) {
      const bodyPath = path.join(requestPath, responseBodyFile);

      // Check if this is a text/event-stream response (SSE)
      const contentType = responseMetadata?.headers['content-type'];
      const isSSE = typeof contentType === 'string'
        ? contentType.includes('text/event-stream')
        : Array.isArray(contentType) && contentType.some(ct => ct.includes('text/event-stream'));

      if (responseBodyFile.endsWith('.json')) {
        const content = await fs.readFile(bodyPath, 'utf-8');
        responseBody = JSON.parse(content);
      } else if (responseBodyFile.match(/\.(txt|html|css|js|xml)$/) || isSSE) {
        // Read as text if it's a known text format OR if it's an SSE stream
        responseBody = await fs.readFile(bodyPath, 'utf-8');
      } else {
        responseBody = `[Binary file: ${responseBodyFile}]`;
      }
    }

    // Read error if exists
    let error: string | undefined;
    if (files.includes('error.txt')) {
      error = await fs.readFile(path.join(requestPath, 'error.txt'), 'utf-8');
    }

    // Parse directory name
    const parts = requestDir.split('_');
    const timestamp = parseInt(parts[0]);
    const method = parts[1];
    const urlPath = parts.slice(2).join('_');

    return {
      id: `${minuteDir}/${requestDir}`,
      timestamp,
      method,
      path: urlPath,
      directory: requestDir,
      minuteDirectory: minuteDir,
      requestMetadata,
      responseMetadata,
      hasRequestBody: !!requestBodyFile,
      hasResponseBody: !!responseBodyFile,
      requestBodyType: requestBodyFile?.split('.').pop(),
      responseBodyType: responseBodyFile?.split('.').pop(),
      requestBody,
      responseBody,
      error,
    };
  } catch (error) {
    console.error('Error reading log detail:', error);
    throw error;
  }
}
