import fs from 'fs';
import path from 'path';
import { INDEX_FILE } from './config';
import { formatSize, getIcon, isPreviewable, getPreviewType } from './helpers';

// ============ INDEX ============

let _indexDescriptions: Record<string, string> | null = null;

export function loadIndex(): void {
  if (_indexDescriptions) return;
  _indexDescriptions = {};
  if (!fs.existsSync(INDEX_FILE)) return;
  const lines = fs.readFileSync(INDEX_FILE, 'utf-8').split('\n');
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length >= 5) {
      const relPath = parts[0].trim().replace(/\\/g, '/');
      const desc = parts[4].trim();
      if (desc) _indexDescriptions![relPath] = desc;
    }
  }
}

export function getDescription(relPath: string): string {
  loadIndex();
  return _indexDescriptions![relPath] || '';
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

export function searchIndex(query: string): any[] {
  loadIndex();
  if (!fs.existsSync(INDEX_FILE)) return [];
  const conditions = parseSearchQuery(query);
  if (!conditions) return [];

  const lines = fs.readFileSync(INDEX_FILE, 'utf-8').split('\n');
  const results: any[] = [];

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';');
    if (parts.length < 5) continue;

    const relPath = parts[0].trim();
    const semester = parts[1].trim();
    const subject = parts[2].trim();
    const sizeStr = parts[3].trim();
    const desc = parts[4].trim();

    const filename = path.basename(relPath);
    const searchable = `${relPath} ${semester} ${subject} ${desc} ${filename}`.toLowerCase();

    if (matchesConditions(searchable, conditions)) {
      const relNorm = relPath.replace(/\\/g, '/');
      const ext = path.extname(filename).toLowerCase();
      const size = parseInt(sizeStr) || 0;
      results.push({
        name: filename, rel: relNorm, ext, size,
        sizeFormatted: formatSize(size), icon: getIcon(ext),
        previewable: isPreviewable(ext), previewType: getPreviewType(ext),
        description: desc, semester, subject,
        path: relNorm.split('/').slice(0, -1).join('/'),
      });
    }
  }
  return results;
}
