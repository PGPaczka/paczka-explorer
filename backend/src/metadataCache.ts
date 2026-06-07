import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { METADATA_FILE } from './config';

interface MetadataEntry {
  source_file: string;
  content_kind: string;
  content_kind_extended: string;
  source_hash: string;
  source_hash_short: string;
  source_hash_algorithm: string;
  source_size_bytes: string;
  generated_at: string;
  short_summary: string;
  detailed_summary: string;
  date?: string | null;
}

let _cache: Map<string, MetadataEntry> = new Map();
let _loaded = false;
let _loadError: string | null = null;

function normalizeRelPath(relPath: string): string {
  return String(relPath || '').replace(/\\/g, '/');
}

/**
 * Load metadata from CSV file into memory cache.
 * This is called at startup and when reindex happens.
 */
export function loadMetadataCache(force = false): void {
  if (_loaded && !force) return;

  _cache.clear();
  _loadError = null;
  _loaded = true;

  if (!fs.existsSync(METADATA_FILE)) {
    _loadError = `Metadata file not found: ${METADATA_FILE}`;
    console.warn(`[metadata-cache] ${_loadError}`);
    return;
  }

  try {
    const csvContent = fs.readFileSync(METADATA_FILE, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as MetadataEntry[];

    for (const record of records) {
      if (!record.source_file) continue;
      const normalized = normalizeRelPath(record.source_file);
      _cache.set(normalized, record);
    }

    console.log(`[metadata-cache] Loaded ${_cache.size} metadata entries from ${METADATA_FILE}`);
  } catch (error) {
    _loadError = error instanceof Error ? error.message : String(error);
    console.error(`[metadata-cache] Failed to load metadata: ${_loadError}`);
  }
}

/**
 * Get metadata entry by relative path.
 * Only matches exact paths - no basename or pattern matching.
 * This prevents /test.txt from matching /Ogolne/test.txt
 */
export function getMetadataByRelPath(relPath: string): MetadataEntry | null {
  if (!_loaded) loadMetadataCache();

  const key = normalizeRelPath(relPath);

  // Try exact match only
  if (_cache.has(key)) {
    return _cache.get(key) || null;
  }

  return null;
}

/**
 * Get metadata entry by exact source_file value.
 */
export function getMetadataBySourceFile(sourceFile: string): MetadataEntry | null {
  if (!_loaded) loadMetadataCache();
  const key = normalizeRelPath(sourceFile);
  return _cache.get(key) || null;
}

/**
 * Reload metadata cache (called when reindex happens).
 */
export function reloadMetadataCache(): void {
  loadMetadataCache(true);
}

/**
 * Get cache status for logging/debugging.
 */
export function getMetadataCacheStatus(): {
  loaded: boolean;
  entryCount: number;
  error: string | null;
} {
  return {
    loaded: _loaded,
    entryCount: _cache.size,
    error: _loadError,
  };
}
