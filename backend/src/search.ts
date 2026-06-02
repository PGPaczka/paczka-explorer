import fs from 'fs';
import path from 'path';
import { INDEX_FILE } from './config';
import { formatSize, isPreviewable, getPreviewType, isMetadataFileName } from './helpers';
import { rebuildIndexFiles } from './indexer';
import { getMetadataByRelPath, reloadMetadataCache } from './metadataCache';

// ============ IN-MEMORY INDEX ============

interface IndexEntry {
  relPath: string;
  relNorm: string;
  filename: string;
  ext: string;
  semester: string;
  subject: string;
  size: number;
  sizeFormatted: string;
  previewable: boolean;
  previewType: string | null;
  description: string;
  dirPath: string;
  metadata: any | null;
  /** Pre-computed lowercase searchable string for fast matching */
  searchable: string;
}

let _entries: IndexEntry[] = [];
let _descriptions: Record<string, string> = {};
let _loaded = false;

const METADATA_INDEX_KEYS = [
  "source_file",
  "content_kind",
  "content_kind_extended",
  "source_hash",
  "source_hash_short",
  "source_hash_algorithm",
  "source_size_bytes",
  "generated_at",
  "short_summary",
] as const;

function buildMetadataSearchable(metadata: any | null): string {
  if (!metadata || typeof metadata !== "object") return "";
  const values = METADATA_INDEX_KEYS.map((key) => {
    const value = metadata[key];
    return value === undefined || value === null ? "" : String(value);
  });
  return values.join(" ").trim();
}

/**
 * Load the entire index CSV into memory.
 * Call once at startup; subsequent calls are no-ops unless force=true.
 */
export function loadIndex(force = false): void {
  if (_loaded && !force) return;

  _entries = [];
  _descriptions = {};

  if (!fs.existsSync(INDEX_FILE)) {
    _loaded = true;
    return;
  }

  const lines = fs.readFileSync(INDEX_FILE, 'utf-8').split('\n');

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length < 5) continue;

    const relPath = parts[0].trim();
    if (isMetadataFileName(path.basename(relPath))) continue;
    const semester = parts[1].trim();
    const subject = parts[2].trim();
    const sizeStr = parts[3].trim();
    const desc = parts[4].trim();

    const relNorm = relPath.replace(/\\/g, '/');
    const filename = path.basename(relPath);
    const ext = path.extname(filename).toLowerCase();
    const size = parseInt(sizeStr) || 0;
    const metadata = getMetadataByRelPath(relNorm);
    const metadataSearchable = buildMetadataSearchable(metadata);

    const searchable = `${relPath} ${semester} ${subject} ${desc} ${filename} ${metadataSearchable}`.toLowerCase();

    if (desc) _descriptions[relNorm] = desc;

    _entries.push({
      relPath,
      relNorm,
      filename,
      ext,
      semester,
      subject,
      size,
      sizeFormatted: formatSize(size),
      previewable: isPreviewable(ext),
      previewType: getPreviewType(ext),
      description: desc,
      dirPath: relNorm.split('/').slice(0, -1).join('/'),
      metadata,
      searchable,
    });
  }

  _loaded = true;
  console.log(`[search] Index loaded: ${_entries.length} entries in memory`);
}

export function rebuildIndex(): { fileCount: number; dirCount: number } {
  const stats = rebuildIndexFiles();
  reloadMetadataCache();
  loadIndex(true);
  return stats;
}

/**
 * Get description for a given relative path (from in-memory cache).
 */
export function getDescription(relPath: string): string {
  loadIndex();
  return _descriptions[relPath] || '';
}

// ============ SEARCH ============

interface SearchCondition {
  negated: boolean;
  term: string;
}

function parseSearchQuery(query: string): SearchCondition[][] | null {
  query = query.trim();
  if (!query) return null;
  const orGroups = query.split(/\s+OR\s+|\s*\|\s*/i);
  const parsed: SearchCondition[][] = [];
  for (let group of orGroups) {
    group = group.trim();
    if (!group) continue;
    const andTerms = group.split(/\s+AND\s+|\s*&\s*/i);
    const terms: SearchCondition[] = [];
    for (let term of andTerms) {
      term = term.trim();
      if (!term) continue;
      let negated = false;
      if (/^NOT\s+/i.test(term)) {
        negated = true;
        term = term.replace(/^NOT\s+/i, '').trim();
      } else if (term.startsWith('!')) {
        negated = true;
        term = term.slice(1).trim();
      }
      if (term) terms.push({ negated, term: term.toLowerCase() });
    }
    if (terms.length) parsed.push(terms);
  }
  return parsed.length ? parsed : null;
}

function matchesConditions(searchable: string, conditions: SearchCondition[][]): boolean {
  for (const group of conditions) {
    let matches = true;
    for (const { negated, term } of group) {
      const found = searchable.includes(term);
      if (negated ? found : !found) { matches = false; break; }
    }
    if (matches) return true;
  }
  return false;
}

/**
 * Search the in-memory index. No disk I/O on each request.
 */
export function searchIndex(query: string): any[] {
  loadIndex(); // no-op if already loaded
  const conditions = parseSearchQuery(query);
  if (!conditions) return [];

  const results: any[] = [];

  for (const entry of _entries) {
    if (matchesConditions(entry.searchable, conditions)) {
      results.push({
        name: entry.filename,
        rel: entry.relNorm,
        ext: entry.ext,
        size: entry.size,
        sizeFormatted: entry.sizeFormatted,
        previewable: entry.previewable,
        previewType: entry.previewType,
        description: entry.description,
        semester: entry.semester,
        subject: entry.subject,
        path: entry.dirPath,
        metadata: entry.metadata,
      });
    }
  }

  return results;
}
