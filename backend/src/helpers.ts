import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { FILES_ROOT, PENDING_META, ADMIN_PASSWORD } from './config';

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

const ICONS: Record<string, string> = {
  '.pdf':'📄','.jpg':'🖼️','.jpeg':'🖼️','.png':'🖼️','.gif':'🖼️','.docx':'📝','.doc':'📝',
  '.pptx':'📊','.ppt':'📊','.zip':'📦','.rar':'📦','.7z':'📦','.py':'💻','.java':'💻',
  '.c':'💻','.cpp':'💻','.cs':'💻','.js':'💻','.html':'💻','.css':'💻','.txt':'📋',
  '.md':'📋','.xlsx':'📊','.csv':'📊','.m':'💻','.asm':'💻',
};

export function getIcon(ext: string): string {
  return ICONS[ext.toLowerCase()] || '📎';
}

const PREVIEWABLE_TEXT = new Set(['.txt','.py','.java','.c','.cpp','.cs','.js','.html','.css',
  '.h','.hpp','.asm','.s','.m','.sql','.xml','.json','.yml','.yaml','.sh','.bat',
  '.cfg','.ini','.log','.csv','.adb','.ads','.hs','.st','.pl','.pro','.ts','.rb','.php','.r','.kt','.swift','.go','.rs',
  '.tex','.typ','.bib','.mmd','.env','.in','.dat','.data','.names','.org','.ws',
  '.aspx','.csproj','.sln','.config','.resx','.filters','.xaml','.xsd','.xslt','.kml','.user','.build',
  '.ipynb','.out']);
const PREVIEWABLE_IMAGE = new Set(['.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg']);
const PREVIEWABLE_PDF = new Set(['.pdf']);
const PREVIEWABLE_OFFICE = new Set(['.docx','.doc','.pptx','.ppt','.xlsx','.xls','.odt','.odp','.ods','.pps']);
const PREVIEWABLE_MARKDOWN = new Set(['.md']);
const PREVIEWABLE_LINK = new Set(['.url','.webloc']);
const PREVIEWABLE_VIDEO = new Set(['.mp4','.webm','.mov']);
const PREVIEWABLE_AUDIO = new Set(['.wav','.mp3','.ogg','.flac']);

export function isPreviewable(ext: string): boolean {
  ext = ext.toLowerCase();
  return PREVIEWABLE_TEXT.has(ext) || PREVIEWABLE_IMAGE.has(ext) || PREVIEWABLE_PDF.has(ext) || PREVIEWABLE_OFFICE.has(ext) || PREVIEWABLE_MARKDOWN.has(ext) || PREVIEWABLE_LINK.has(ext) || PREVIEWABLE_VIDEO.has(ext) || PREVIEWABLE_AUDIO.has(ext);
}

export function getPreviewType(ext: string): string | null {
  ext = ext.toLowerCase();
  if (PREVIEWABLE_IMAGE.has(ext)) return 'image';
  if (PREVIEWABLE_PDF.has(ext)) return 'pdf';
  if (PREVIEWABLE_MARKDOWN.has(ext)) return 'markdown';
  if (PREVIEWABLE_LINK.has(ext)) return 'link';
  if (PREVIEWABLE_VIDEO.has(ext)) return 'video';
  if (PREVIEWABLE_AUDIO.has(ext)) return 'audio';
  if (PREVIEWABLE_TEXT.has(ext)) return 'text';
  if (PREVIEWABLE_OFFICE.has(ext)) return 'office';
  return null;
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
