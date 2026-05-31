import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { FILES_ROOT, PENDING_META, ADMIN_PASSWORD } from './config';
import previewableExtensions from './previewable-extensions.json';

// ============ PENDING ============

export function loadPending(): any[] {
  try {
    if (fs.existsSync(PENDING_META)) {
      return JSON.parse(fs.readFileSync(PENDING_META, 'utf-8'));
    }
  } catch {}
  return [];
}

export function savePending(data: any[]): void {
  fs.writeFileSync(PENDING_META, JSON.stringify(data, null, 2), 'utf-8');
}

// ============ FILE UTILS ============

export function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const PREVIEWABLE_TYPES = Object.entries(previewableExtensions as Record<string, string[]>)
  .reduce((acc, [type, exts]) => {
    for (const ext of exts) {
      acc[ext.toLowerCase()] = type;
    }
    return acc;
  }, {} as Record<string, string>);

export function isPreviewable(ext: string): boolean {
  ext = ext.toLowerCase();
  return Object.prototype.hasOwnProperty.call(PREVIEWABLE_TYPES, ext);
}

export function getPreviewType(ext: string): string | null {
  ext = ext.toLowerCase();
  return PREVIEWABLE_TYPES[ext] || null;
}

// ============ PATH SAFETY ============

export function safePath(relPath: string): string | null {
  const target = path.resolve(FILES_ROOT, relPath);
  if (!target.startsWith(path.resolve(FILES_ROOT))) return null;
  return target;
}

// ============ AUTH ============

export function hashPw(pw: string): string {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

export function checkAdmin(req: Request): boolean {
  const token = req.cookies?.admin_token || '';
  return token === hashPw(ADMIN_PASSWORD);
}

// ============ RECURSIVE DIR ============

export function readdirRecursive(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(readdirRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

// countFiles cache with 60s TTL
const _countCache: Map<string, { count: number; expires: number }> = new Map();
const COUNT_CACHE_TTL = 60000;

export function countFiles(dir: string): number {
  const now = Date.now();
  const cached = _countCache.get(dir);
  if (cached && now < cached.expires) return cached.count;

  const count = readdirRecursive(dir).length;
  _countCache.set(dir, { count, expires: now + COUNT_CACHE_TTL });
  return count;
}

// Invalidate cache for a specific directory (call after file changes)
export function invalidateCountCache(dir?: string): void {
  if (dir) {
    // Invalidate this dir and all parents
    for (const [key] of _countCache) {
      if (dir.startsWith(key) || key.startsWith(dir)) _countCache.delete(key);
    }
  } else {
    _countCache.clear();
  }
}
