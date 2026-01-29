import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface ProxyConfig {
  targetHost: string;
  targetPort: number;
  logDir: string;
}

const config: ProxyConfig = {
  targetHost: process.env.TARGET_HOST || 'localhost',
  targetPort: parseInt(process.env.TARGET_PORT || '4141'),
  logDir: process.env.LOG_DIR || 'logs',
};

const app = new Hono();

// Ensure log directory exists
if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

/**
 * Get the directory for the current minute
 * Format: YYYYMMDD_HHMMSS (start of the minute)
 */
function getMinuteDirectory(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  const dirName = `${year}${month}${day}_${hour}${minute}00`;
  const dirPath = path.join(config.logDir, dirName);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return dirPath;
}

/**
 * Generate a safe directory name for this request
 * Format: timestamp_method_path
 */
function getRequestDirectory(method: string, urlPath: string): string {
  const timestamp = new Date().getTime();
  const safePath = urlPath
    .replace(/^\//, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .substring(0, 100) || 'root';

  const dirName = `${timestamp}_${method}_${safePath}`;
  const minuteDir = getMinuteDirectory();
  const requestDir = path.join(minuteDir, dirName);

  fs.mkdirSync(requestDir, { recursive: true });

  return requestDir;
}

/**
 * Detect content type and determine appropriate file extension
 */
function getFileExtension(contentType: string | null, defaultExt: string = 'bin'): string {
  if (!contentType) return defaultExt;

  const mimeMap: Record<string, string> = {
    'application/json': 'json',
    'text/html': 'html',
    'text/plain': 'txt',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/javascript': 'js',
    'application/xml': 'xml',
    'text/xml': 'xml',
    'text/event-stream': 'txt',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/octet-stream': 'bin',
  };

  const lowerContentType = contentType.toLowerCase().split(';')[0].trim();
  return mimeMap[lowerContentType] || defaultExt;
}

/**
 * Check if content type is JSON
 */
function isJson(contentType: string | null): boolean {
  return contentType?.toLowerCase().includes('application/json') || false;
}

/**
 * Check if content is binary
 */
function isBinary(contentType: string | null): boolean {
  if (!contentType) return false;
  const lowerContentType = contentType.toLowerCase();
  return (
    lowerContentType.includes('image/') ||
    lowerContentType.includes('application/pdf') ||
    lowerContentType.includes('application/zip') ||
    lowerContentType.includes('application/octet-stream') ||
    lowerContentType.includes('audio/') ||
    lowerContentType.includes('video/')
  );
}

/**
 * Save request data to disk
 */
async function saveRequest(
  requestDir: string,
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Buffer | null
) {
  const metadata = {
    method,
    url,
    headers,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(requestDir, 'request_metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  if (body && body.length > 0) {
    const contentType = headers['content-type'] || null;

    if (isJson(contentType)) {
      try {
        const jsonData = JSON.parse(body.toString('utf-8'));
        fs.writeFileSync(
          path.join(requestDir, 'request_body.json'),
          JSON.stringify(jsonData, null, 2)
        );
      } catch {
        fs.writeFileSync(path.join(requestDir, 'request_body.txt'), body);
      }
    } else {
      const ext = getFileExtension(contentType, 'bin');
      fs.writeFileSync(path.join(requestDir, `request_body.${ext}`), body);
    }
  }
}

/**
 * Save response data to disk
 */
function saveResponse(
  requestDir: string,
  statusCode: number,
  headers: Record<string, string | string[]>,
  body: Buffer
) {
  const metadata = {
    statusCode,
    headers,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(requestDir, 'response_metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  if (body && body.length > 0) {
    const contentType = (Array.isArray(headers['content-type'])
      ? headers['content-type'][0]
      : headers['content-type']) || null;

    if (isJson(contentType)) {
      try {
        const jsonData = JSON.parse(body.toString('utf-8'));
        fs.writeFileSync(
          path.join(requestDir, 'response_body.json'),
          JSON.stringify(jsonData, null, 2)
        );
      } catch {
        fs.writeFileSync(path.join(requestDir, 'response_body.txt'), body);
      }
    } else {
      const ext = getFileExtension(contentType, 'bin');
      fs.writeFileSync(path.join(requestDir, `response_body.${ext}`), body);
    }
  }
}

/**
 * Forward request to target server
 */
function proxyRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Buffer | null
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: config.targetHost,
      port: config.targetPort,
      path,
      method,
      headers: {
        ...headers,
        host: `${config.targetHost}:${config.targetPort}`,
      },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 500,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

// Catch-all route to proxy all requests
app.all('*', async (c) => {
  const method = c.req.method;
  const url = c.req.url;
  const urlPath = new URL(url).pathname + new URL(url).search;

  // Get headers
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Get body
  let body: Buffer | null = null;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const arrayBuffer = await c.req.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } catch {
      body = null;
    }
  }

  // Create directory for this request
  const requestDir = getRequestDirectory(method, urlPath);

  // Save request
  await saveRequest(requestDir, method, urlPath, headers, body);

  try {
    // Forward request to target
    const response = await proxyRequest(method, urlPath, headers, body);

    // Convert headers to Record<string, string | string[]>
    const responseHeaders: Record<string, string | string[]> = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        responseHeaders[key] = value;
      }
    });

    // Save response
    saveResponse(requestDir, response.statusCode, responseHeaders, response.body);

    // Return response to client
    Object.entries(responseHeaders).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => c.header(key, v));
      } else {
        c.header(key, value);
      }
    });

    return c.body(response.body, response.statusCode);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    fs.writeFileSync(
      path.join(requestDir, 'error.txt'),
      `Error proxying request: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`
    );

    return c.text(`Proxy error: ${errorMessage}`, 502);
  }
});

const port = parseInt(process.env.PROXY_PORT || '8080');
const host = process.env.PROXY_HOST || 'localhost';

console.log(`HTTP Proxy Server starting...`);
console.log(`Listening on: http://${host}:${port}`);
console.log(`Forwarding to: http://${config.targetHost}:${config.targetPort}`);
console.log(`Logging to: ${config.logDir}`);

serve({
  fetch: app.fetch,
  port,
  hostname: host,
});
