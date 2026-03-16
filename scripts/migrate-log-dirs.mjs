/**
 * Migration script: rename old-style log directories (using _ for /)
 * to new-style (using %2F for /).
 *
 * Strategy: read request_metadata.json from each request dir to get the real
 * URL path, then reconstruct the correct directory name using %2F encoding.
 *
 * Usage:
 *   node scripts/migrate-log-dirs.mjs [logDir1] [logDir2] ...
 *   node scripts/migrate-log-dirs.mjs  (uses LOG_DIRS from .env)
 */

import fs from 'fs';
import path from 'path';

// ─── Resolve log directories ────────────────────────────────────────────────

function getLogDirs() {
  // From CLI args
  if (process.argv.length > 2) {
    return process.argv.slice(2);
  }

  // From .env
  for (const envFile of [
    path.join(process.cwd(), 'apps', 'log-viewer', '.env'),
    path.join(process.cwd(), 'apps', 'log-viewer', '.env.local'),
  ]) {
    try {
      const content = fs.readFileSync(envFile, 'utf-8');
      const match = content.match(/LOG_DIRS\s*=\s*(.+)/);
      if (match) {
        const parsed = JSON.parse(match[1].replace(/^'|'$/g, ''));
        return parsed.map(d => d.path);
      }
    } catch {}
  }

  return [path.join(process.cwd(), 'logs')];
}

// ─── Build expected dir name from metadata ──────────────────────────────────

function buildExpectedDirName(timestamp, method, urlPath) {
  const safePath = urlPath
    .replace(/^\//, '')
    .replace(/\//g, '%2F')
    .replace(/[\\:*?"<>|]/g, '_')
    .substring(0, 200) || 'root';

  return `${timestamp}_${method}_${safePath}`;
}

// ─── Check if a directory needs migration ───────────────────────────────────

function needsMigration(requestDirName) {
  // If it already has %2F or %2f, it's new-style
  if (requestDirName.includes('%2F') || requestDirName.includes('%2f')) {
    return false;
  }

  // Parse: timestamp_METHOD_path
  const firstUs = requestDirName.indexOf('_');
  if (firstUs === -1) return false;

  const rest = requestDirName.slice(firstUs + 1);
  const secondUs = rest.indexOf('_');
  if (secondUs === -1) return false; // no path part

  const pathPart = rest.slice(secondUs + 1);
  // If path part has underscores, it might have been a / originally
  // But we can't be sure without metadata, so we check all dirs with metadata
  return pathPart.length > 0;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function migrate(logDir) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Migrating: ${logDir}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(logDir)) {
    console.log('  NOT FOUND, skipping');
    return { renamed: 0, skipped: 0, errors: 0 };
  }

  const minuteDirs = fs.readdirSync(logDir).filter(d => {
    return /^\d{8}_\d{6}$/.test(d) && fs.statSync(path.join(logDir, d)).isDirectory();
  });

  let renamed = 0;
  let skipped = 0;
  let errors = 0;

  for (const md of minuteDirs) {
    const minutePath = path.join(logDir, md);
    const reqDirs = fs.readdirSync(minutePath).filter(d => {
      try { return fs.statSync(path.join(minutePath, d)).isDirectory(); }
      catch { return false; }
    });

    for (const rd of reqDirs) {
      const fullPath = path.join(minutePath, rd);

      // Already new-style?
      if (rd.includes('%2F') || rd.includes('%2f')) {
        skipped++;
        continue;
      }

      // Try to read metadata to get the real URL path
      const metaFile = path.join(fullPath, 'request_metadata.json');
      if (!fs.existsSync(metaFile)) {
        skipped++;
        continue;
      }

      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      } catch {
        console.log(`  ERROR: can't parse ${metaFile}`);
        errors++;
        continue;
      }

      // Get the real URL path and method from metadata
      const realPath = meta.path || meta.url || '';
      const method = meta.method || 'GET';

      // Extract timestamp from directory name
      const firstUs = rd.indexOf('_');
      if (firstUs === -1) { skipped++; continue; }
      const timestamp = rd.slice(0, firstUs);

      // Parse URL path (could be full URL or just path)
      let urlPath;
      try {
        // Could be a full URL like "https://host/path?query"
        const parsed = new URL(realPath, 'http://dummy');
        urlPath = parsed.pathname + parsed.search;
      } catch {
        urlPath = realPath;
      }

      // Build expected new name
      const expectedName = buildExpectedDirName(timestamp, method, urlPath);

      // Same name? Skip
      if (expectedName === rd) {
        skipped++;
        continue;
      }

      const newPath = path.join(minutePath, expectedName);

      // Avoid collision
      if (fs.existsSync(newPath)) {
        console.log(`  SKIP (collision): ${rd}`);
        console.log(`    -> ${expectedName} already exists`);
        skipped++;
        continue;
      }

      // Rename
      try {
        fs.renameSync(fullPath, newPath);
        renamed++;
        console.log(`  RENAME: ${rd}`);
        console.log(`      ->  ${expectedName}`);
      } catch (err) {
        console.log(`  ERROR renaming ${rd}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n  Summary: ${renamed} renamed, ${skipped} skipped, ${errors} errors`);
  return { renamed, skipped, errors };
}

// ─── Entry point ────────────────────────────────────────────────────────────

const logDirs = getLogDirs();
console.log(`Log directories to migrate: ${logDirs.length}`);
logDirs.forEach(d => console.log(`  - ${d}`));

let totalRenamed = 0;
let totalSkipped = 0;
let totalErrors = 0;

for (const dir of logDirs) {
  const result = migrate(dir);
  totalRenamed += result.renamed;
  totalSkipped += result.skipped;
  totalErrors += result.errors;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`  TOTAL: ${totalRenamed} renamed, ${totalSkipped} skipped, ${totalErrors} errors`);
console.log('='.repeat(60));
