import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { METADATA_DB_PATH, METADATA_DB_PATH_IS_EXPLICIT } from './config';

let _db: Database.Database | null = null;
let _stmt: Database.Statement | null = null;
const _cache = new Map<string, { expires: number; value: any | null }>();
const CACHE_TTL_MS = 30_000;
let _startupLogPrinted = false;
let _lastDbError: string | null = null;

function normalizeRelPath(relPath: string): string {
  return String(relPath || '').replace(/\\/g, '/');
}

function getStatement(): Database.Statement | null {
  if (_stmt) return _stmt;

  if (!fs.existsSync(METADATA_DB_PATH)) {
    _lastDbError = 'Plik bazy nie istnieje.';
    return null;
  }

  try {
    if (!_db) {
      _db = new Database(METADATA_DB_PATH, { readonly: true, fileMustExist: true });
    }
    _stmt = _db.prepare(
      `SELECT
         source_file,
         content_kind,
         content_kind_extended,
         source_hash,
         source_hash_short,
         source_hash_algorithm,
         source_size_bytes,
         generated_at,
         short_summary,
         detailed_summary
       FROM metadata_entries
       WHERE source_file = ?
          OR source_file LIKE ?
          OR source_file = ?
       ORDER BY
         CASE
           WHEN source_file = ? THEN 0
           WHEN source_file LIKE ? THEN 1
           WHEN source_file = ? THEN 2
           ELSE 3
         END,
         generated_at DESC
       LIMIT 1`
    );
    _lastDbError = null;
    return _stmt;
  } catch (error) {
    _lastDbError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    try {
      if (_db) _db.close();
    } catch {}
    _db = null;
    _stmt = null;
    return null;
  }
}

export function logMetadataDbStartupStatus(): void {
  if (_startupLogPrinted) return;
  _startupLogPrinted = true;
  const stmt = getStatement();
  if (stmt) {
    console.log(`[metadata-db] connected: ${METADATA_DB_PATH}`);
  } else {
    const message = `[metadata-db] unavailable: ${METADATA_DB_PATH}`;
    const withCause = _lastDbError ? `${message}; cause=${_lastDbError}` : message;
    if (METADATA_DB_PATH_IS_EXPLICIT) {
      throw new Error(`${withCause} (METADATA_DB_PATH ustawione jawnie - zatrzymuje start backendu)`);
    }
    console.warn(withCause);
  }
}

export function readDbMetadataByRelPath(relPath: string): any | null {
  const key = normalizeRelPath(relPath);
  const basename = path.posix.basename(key);
  const suffixPattern = `%/${key}`;
  const now = Date.now();
  const cached = _cache.get(key);
  if (cached && now < cached.expires) return cached.value;

  const stmt = getStatement();
  if (!stmt) {
    _cache.set(key, { expires: now + CACHE_TTL_MS, value: null });
    return null;
  }

  try {
    const row = stmt.get(
      key,
      suffixPattern,
      basename,
      key,
      suffixPattern,
      basename
    ) as Record<string, unknown> | undefined;
    const value = row || null;
    _cache.set(key, { expires: now + CACHE_TTL_MS, value });
    return value;
  } catch {
    _cache.set(key, { expires: now + CACHE_TTL_MS, value: null });
    return null;
  }
}

