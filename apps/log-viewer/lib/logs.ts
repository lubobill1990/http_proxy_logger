import { promises as fs } from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { fdir } from 'fdir';
import { LogEntry, RequestMetadata, ResponseMetadata } from '@/types/log';

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Get content-encoding header value (normalized to lowercase)
 */
function getContentEncoding(headers: Record<string, string | string[]> | undefined): string | null {
  if (!headers) return null;

  const encoding = headers['content-encoding'];
  if (typeof encoding === 'string') {
    return encoding.toLowerCase();
  }
  if (Array.isArray(encoding) && encoding.length > 0) {
    return encoding[0].toLowerCase();
  }
  return null;
}

/**
 * Get content-type header value (normalized to lowercase)
 */
function getContentType(headers: Record<string, string | string[]> | undefined): string | null {
  if (!headers) return null;

  const contentType = headers['content-type'];
  if (typeof contentType === 'string') {
    return contentType.toLowerCase();
  }
  if (Array.isArray(contentType) && contentType.length > 0) {
    return contentType[0].toLowerCase();
  }
  return null;
}

/**
 * Check if content-type indicates text content
 */
function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return false;

  return (
    contentType.includes('text/') ||
    contentType.includes('application/json') ||
    contentType.includes('application/xml') ||
    contentType.includes('application/javascript') ||
    contentType.includes('+json') ||
    contentType.includes('+xml')
  );
}

/**
 * Decompress buffer based on content-encoding
 */
async function decompressBuffer(buffer: Buffer, encoding: string): Promise<Buffer> {
  switch (encoding) {
    case 'gzip':
      return await gunzip(buffer);
    case 'deflate':
      // Try inflate first, fall back to inflateRaw
      try {
        return await inflate(buffer);
      } catch {
        return await inflateRaw(buffer);
      }
    case 'br':
      return await brotliDecompress(buffer);
    default:
      return buffer;
  }
}

export interface LogDirEntry {
  name: string;
  path: string;
}

function getLogDirsFromEnv(): LogDirEntry[] {
  const raw = process.env.LOG_DIRS;
  if (raw) {
    try {
      return JSON.parse(raw) as LogDirEntry[];
    } catch {
      console.error('Failed to parse LOG_DIRS env variable');
    }
  }
  // Fallback to legacy default
  return [{ name: 'default', path: path.join(process.cwd(), '..', '..', 'logs') }];
}

export function getLogDirs(): LogDirEntry[] {
  return getLogDirsFromEnv();
}

function resolveLogDir(dirName?: string): string {
  const dirs = getLogDirsFromEnv();
  if (dirName) {
    const found = dirs.find(d => d.name === dirName);
    if (found) return found.path;
  }
  return dirs[0]?.path || path.join(process.cwd(), '..', '..', 'logs');
}

export async function getLogEntries(startTime?: number, endTime?: number, dirName?: string, search?: string): Promise<LogEntry[]> {
  const LOG_DIR = resolveLogDir(dirName);
  const logDirWithSep = LOG_DIR.replace(/\\/g, '/').replace(/\/?$/, '/');

  try {
    // Single fdir crawl — gets all directories in one native call (~50ms for thousands)
    const allDirs = await new fdir()
      .onlyDirs()
      .crawl(LOG_DIR)
      .withPromise() as string[];

    const entries: LogEntry[] = [];

    // Cache minute-dir time bounds to avoid re-parsing
    const minuteBoundsCache = new Map<string, { start: number; end: number } | null>();

    for (const dir of allDirs) {
      // Normalize to forward slashes and extract relative path
      const rel = dir.replace(/\\/g, '/').replace(/\/?$/, '').slice(logDirWithSep.length);
      const segs = rel.split('/');
      if (segs.length !== 2) continue; // only minute_dir/request_dir

      const [minuteDir, requestDir] = segs;

      // Validate minute dir format
      if (!/^\d{8}_\d{6}$/.test(minuteDir)) continue;

      // Coarse time filter on minute dir
      if (startTime || endTime) {
        let bounds = minuteBoundsCache.get(minuteDir);
        if (bounds === undefined) {
          const m = minuteDir.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
          if (m) {
            const dirStart = new Date(
              parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
              parseInt(m[4]), parseInt(m[5]), parseInt(m[6])
            ).getTime();
            bounds = { start: dirStart, end: dirStart + 60_000 };
          } else {
            bounds = null;
          }
          minuteBoundsCache.set(minuteDir, bounds);
        }
        if (bounds) {
          if (endTime && bounds.start > endTime) continue;
          if (startTime && bounds.end < startTime) continue;
        }
      }

      // Parse request dir: timestamp_METHOD_path
      const firstUnderscore = requestDir.indexOf('_');
      if (firstUnderscore === -1) continue;

      const timestamp = parseInt(requestDir.slice(0, firstUnderscore));
      if (isNaN(timestamp)) continue;

      // Precise time filter
      if (startTime && timestamp < startTime) continue;
      if (endTime && timestamp > endTime) continue;

      // Search filter on directory name
      if (search) {
        const searchNormalized = search.toLowerCase().replace(/\//g, '%2f');
        if (!requestDir.toLowerCase().includes(searchNormalized)) continue;
      }

      const rest = requestDir.slice(firstUnderscore + 1);
      const secondUnderscore = rest.indexOf('_');
      const method = secondUnderscore === -1 ? rest : rest.slice(0, secondUnderscore);
      const urlPath = secondUnderscore === -1 ? '' : rest.slice(secondUnderscore + 1);

      entries.push({
        id: `${minuteDir}/${requestDir}`,
        timestamp,
        method,
        path: urlPath,
        directory: requestDir,
        minuteDirectory: minuteDir,
        hasRequestBody: false,
        hasResponseBody: false,
      });
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    return entries;
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
}

export async function getLogDetail(minuteDir: string, requestDir: string, dirName?: string) {
  const LOG_DIR = resolveLogDir(dirName);
  const requestPath = path.join(LOG_DIR, minuteDir, requestDir);

  try {
    const files = await fs.readdir(requestPath);

    const requestBodyFile = files.find(f => f.startsWith('request_body'));
    const responseBodyFile = files.find(f => f.startsWith('response_body'));
    const hasError = files.includes('error.txt');

    // Read ALL files in parallel
    const [reqMetaRaw, resMetaRaw, reqBodyRaw, resBodyRaw, errorText] = await Promise.all([
      fs.readFile(path.join(requestPath, 'request_metadata.json'), 'utf-8').catch(() => null),
      fs.readFile(path.join(requestPath, 'response_metadata.json'), 'utf-8').catch(() => null),
      requestBodyFile
        ? (requestBodyFile.endsWith('.json') || requestBodyFile.match(/\.(txt|html|css|js|xml)$/))
          ? fs.readFile(path.join(requestPath, requestBodyFile), 'utf-8').catch(() => null)
          : fs.readFile(path.join(requestPath, requestBodyFile)).catch(() => null)
        : Promise.resolve(null),
      responseBodyFile
        ? fs.readFile(path.join(requestPath, responseBodyFile)).catch(() => null)
        : Promise.resolve(null),
      hasError
        ? fs.readFile(path.join(requestPath, 'error.txt'), 'utf-8').catch(() => null)
        : Promise.resolve(null),
    ]);

    // Parse metadata
    let requestMetadata: RequestMetadata | undefined;
    let responseMetadata: ResponseMetadata | undefined;

    if (reqMetaRaw) {
      try { requestMetadata = JSON.parse(reqMetaRaw); } catch {}
    }
    if (resMetaRaw) {
      try { responseMetadata = JSON.parse(resMetaRaw); } catch {}
    }

    // Parse request body
    let requestBody: string | object | undefined;
    if (requestBodyFile && reqBodyRaw !== null) {
      if (typeof reqBodyRaw === 'string') {
        if (requestBodyFile.endsWith('.json')) {
          try { requestBody = JSON.parse(reqBodyRaw); } catch { requestBody = reqBodyRaw; }
        } else {
          requestBody = reqBodyRaw;
        }
      } else {
        requestBody = `[Binary file: ${requestBodyFile}]`;
      }
    } else if (requestBodyFile) {
      requestBody = `[Binary file: ${requestBodyFile}]`;
    }

    // Parse response body
    let responseBody: string | object | undefined;
    if (responseBodyFile && resBodyRaw !== null) {
      const contentEncoding = getContentEncoding(responseMetadata?.headers);
      const contentType = getContentType(responseMetadata?.headers);
      const isCompressed = contentEncoding && ['gzip', 'deflate', 'br'].includes(contentEncoding);
      const isSSE = contentType?.includes('text/event-stream') ?? false;
      const isTextContent = isTextContentType(contentType) || isSSE;

      const bodyBuffer: Buffer = Buffer.isBuffer(resBodyRaw) ? resBodyRaw : Buffer.from(resBodyRaw as string, 'utf-8');

      if (isCompressed) {
        try {
          const decompressed = await decompressBuffer(bodyBuffer, contentEncoding);
          if (isTextContent) {
            const textContent = decompressed.toString('utf-8');
            if (contentType?.includes('json')) {
              try { responseBody = JSON.parse(textContent); } catch { responseBody = textContent; }
            } else {
              responseBody = textContent;
            }
          } else {
            responseBody = `[Decompressed binary content: ${decompressed.length} bytes]`;
          }
        } catch (err) {
          responseBody = `[Failed to decompress ${contentEncoding} content: ${err instanceof Error ? err.message : 'Unknown error'}]`;
        }
      } else if (isTextContent || responseBodyFile.endsWith('.json') || responseBodyFile.match(/\.(txt|html|css|js|xml)$/)) {
        const textContent = bodyBuffer.toString('utf-8');
        if (responseBodyFile.endsWith('.json') || contentType?.includes('json')) {
          try { responseBody = JSON.parse(textContent); } catch { responseBody = textContent; }
        } else {
          responseBody = textContent;
        }
      } else {
        responseBody = `[Binary file: ${responseBodyFile}]`;
      }
    }

    // Parse directory name
    const firstUnderscore = requestDir.indexOf('_');
    const timestamp = parseInt(requestDir.slice(0, firstUnderscore));
    const rest = requestDir.slice(firstUnderscore + 1);
    const secondUnderscore = rest.indexOf('_');
    const method = secondUnderscore === -1 ? rest : rest.slice(0, secondUnderscore);
    const urlPath = secondUnderscore === -1 ? '' : rest.slice(secondUnderscore + 1);

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
      error: errorText ?? undefined,
    };
  } catch (error) {
    console.error('Error reading log detail:', error);
    throw error;
  }
}
