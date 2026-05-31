import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { Request } from 'express';
import { FILES_ROOT, PENDING_META, ADMIN_PASSWORD, SERVICE_TOKENS } from './config';
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

// ============ METADATA FILES ============

const METADATA_FILE_RE = /\.[a-f0-9]{6,64}\.metadata\.json$/i;
const _metadataCache: Map<string, { expires: number; value: any | null }> = new Map();
const METADATA_CACHE_TTL_MS = 30_000;

export function isMetadataFileName(name: string): boolean {
  return METADATA_FILE_RE.test(name);
}

export function getSidecarMetadataPath(filePath: string): string | null {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  for (const name of entries) {
    if (name.startsWith(`${basename}.`) && METADATA_FILE_RE.test(name)) {
      return path.join(dir, name);
    }
  }
  return null;
}

export function readSidecarMetadata(filePath: string): any | null {
  const now = Date.now();
  const cached = _metadataCache.get(filePath);
  if (cached && now < cached.expires) return cached.value;

  const metadataPath = getSidecarMetadataPath(filePath);
  if (!metadataPath) {
    _metadataCache.set(filePath, { expires: now + METADATA_CACHE_TTL_MS, value: null });
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    _metadataCache.set(filePath, { expires: now + METADATA_CACHE_TTL_MS, value: parsed });
    return parsed;
  } catch {
    _metadataCache.set(filePath, { expires: now + METADATA_CACHE_TTL_MS, value: null });
    return null;
  }
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

function getHeaderValue(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] || '';
  return header || '';
}

function getServiceTokenFromRequest(req: Request): string {
  const authorization = getHeaderValue(req.headers.authorization).trim();
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return getHeaderValue(req.headers['x-service-token']).trim();
}

export function checkAdmin(req: Request): boolean {
  const cookieToken = req.cookies?.admin_token || '';
  if (cookieToken === hashPw(ADMIN_PASSWORD)) return true;

  if (!SERVICE_TOKENS.length) return false;
  const serviceToken = getServiceTokenFromRequest(req);
  if (!serviceToken) return false;
  return SERVICE_TOKENS.includes(serviceToken);
}

export interface GitCommitInfo {
  commit: string;
  shortCommit: string;
  branch: string | null;
  committedAt: string;
}

export interface GitRepoStatus extends GitCommitInfo {
  upstream: string | null;
  ahead: number;
  behind: number;
  fetchedAt: string;
}

export interface GitPullResult {
  success: boolean;
  output: string;
  status: GitRepoStatus | null;
}

const GIT_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
let _gitRepoStatusCache: { repoPath: string; expiresAt: number; value: GitRepoStatus | null } | null = null;

export function invalidateGitRepoStatusCache(repoPath = FILES_ROOT): void {
  if (_gitRepoStatusCache && _gitRepoStatusCache.repoPath === repoPath) {
    _gitRepoStatusCache = null;
  }
}

export function getGitCommitInfo(repoPath = FILES_ROOT): GitCommitInfo | null {
  try {
    const insideWorkTree = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoPath }).toString().trim();
    if (insideWorkTree !== 'true') return null;

    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath }).toString().trim();
    const shortCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoPath }).toString().trim();
    const committedAt = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: repoPath }).toString().trim();

    let branch: string | null = null;
    try {
      const b = execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: repoPath }).toString().trim();
      branch = b || null;
    } catch {
      branch = null;
    }

    return { commit, shortCommit, branch, committedAt };
  } catch {
    return null;
  }
}

export function getGitRepoStatus(repoPath = FILES_ROOT): GitRepoStatus | null {
  const now = Date.now();
  if (_gitRepoStatusCache && _gitRepoStatusCache.repoPath === repoPath && now < _gitRepoStatusCache.expiresAt) {
    return _gitRepoStatusCache.value;
  }

  let value: GitRepoStatus | null = null;
  try {
    const insideWorkTree = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoPath }).toString().trim();
    if (insideWorkTree === 'true') {
      // Refresh remote refs to compute accurate ahead/behind.
      try {
        execFileSync('git', ['fetch', '--all', '--prune'], { cwd: repoPath, stdio: 'pipe', timeout: 15000 });
      } catch {}

      const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath }).toString().trim();
      const shortCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoPath }).toString().trim();
      const committedAt = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: repoPath }).toString().trim();

      let branch: string | null = null;
      try {
        const b = execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: repoPath }).toString().trim();
        branch = b || null;
      } catch {
        branch = null;
      }

      let upstream: string | null = null;
      let ahead = 0;
      let behind = 0;
      try {
        const up = execFileSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd: repoPath }).toString().trim();
        upstream = up || null;
      } catch {
        upstream = null;
      }

      if (upstream) {
        try {
          const counts = execFileSync('git', ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], { cwd: repoPath }).toString().trim();
          const [aheadRaw = '0', behindRaw = '0'] = counts.split(/\s+/);
          ahead = parseInt(aheadRaw, 10) || 0;
          behind = parseInt(behindRaw, 10) || 0;
        } catch {
          ahead = 0;
          behind = 0;
        }
      }

      value = {
        commit,
        shortCommit,
        branch,
        committedAt,
        upstream,
        ahead,
        behind,
        fetchedAt: new Date().toISOString(),
      };
    }
  } catch {
    value = null;
  }

  _gitRepoStatusCache = {
    repoPath,
    expiresAt: now + GIT_STATUS_CACHE_TTL_MS,
    value,
  };
  return value;
}

export function gitPullRepo(repoPath = FILES_ROOT): GitPullResult {
  try {
    const insideWorkTree = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoPath }).toString().trim();
    if (insideWorkTree !== 'true') {
      return {
        success: false,
        output: 'Podany katalog nie jest repozytorium git.',
        status: null,
      };
    }

    const pullOutput = execFileSync('git', ['pull', '--ff-only'], {
      cwd: repoPath,
      stdio: 'pipe',
      timeout: 120000,
    }).toString().trim();

    invalidateGitRepoStatusCache(repoPath);
    return {
      success: true,
      output: pullOutput || 'git pull zakonczony bez dodatkowego outputu.',
      status: getGitRepoStatus(repoPath),
    };
  } catch (error: any) {
    const stdout = error?.stdout ? String(error.stdout) : '';
    const stderr = error?.stderr ? String(error.stderr) : '';
    const message = [stdout, stderr, error?.message || 'git pull zakonczyl sie bledem.']
      .filter(Boolean)
      .join('\n')
      .trim();
    invalidateGitRepoStatusCache(repoPath);
    return {
      success: false,
      output: message || 'git pull zakonczyl sie bledem.',
      status: getGitRepoStatus(repoPath),
    };
  }
}

// ============ RECURSIVE DIR ============

export function readdirRecursive(dir: string): string[] {
  let results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isFile() && isMetadataFileName(entry.name)) continue;
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
