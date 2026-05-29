import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { FILES_ROOT, GITHUB_PR_URL } from '../config';
import { safePath, formatSize, getIcon, isPreviewable, getPreviewType, countFiles, checkAdmin } from '../helpers';
import { getDescription } from '../search';

function detectLinkService(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('drive.google.com')) return 'gdrive';
  if (lower.includes('docs.google.com')) return 'gdocs';
  if (lower.includes('discord.gg') || lower.includes('discord.com')) return 'discord';
  if (lower.includes('facebook.com') || lower.includes('fb.com')) return 'facebook';
  if (lower.includes('wikipedia.org')) return 'wikipedia';
  if (lower.includes('stackoverflow.com')) return 'stackoverflow';
  return 'web';
}

const router = Router();

router.get('/api/browse/:path(*)?', (req, res) => {
  const relPath = req.params.path || '';
  const target = safePath(relPath);
  if (!target || !fs.existsSync(target)) return res.status(404).json({ detail: 'Folder nie istnieje' });

  const dirs: any[] = [];
  const files: any[] = [];

  if (fs.statSync(target).isDirectory()) {
    const entries = fs.readdirSync(target, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

    for (const entry of entries) {
      const full = path.join(target, entry.name);
      const rel = path.relative(FILES_ROOT, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        dirs.push({ name: entry.name, rel, fileCount: countFiles(full) });
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const stat = fs.statSync(full);
        const previewType = getPreviewType(ext);
        const fileEntry: any = {
          name: entry.name, rel, ext, size: stat.size,
          sizeFormatted: formatSize(stat.size), icon: getIcon(ext),
          previewable: isPreviewable(ext), previewType,
          description: getDescription(rel),
        };

        // For link files, parse URL and detect service
        if (previewType === 'link') {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            const urlMatch = content.match(/URL=(.+)/i);
            const hrefMatch = content.match(/<string>(https?:\/\/[^<]+)<\/string>/i);
            const linkUrl = (urlMatch?.[1] || hrefMatch?.[1] || '').trim();
            if (linkUrl) {
              fileEntry.linkUrl = linkUrl;
              fileEntry.linkService = detectLinkService(linkUrl);
              const serviceIcons: Record<string, string> = {
                youtube: '▶️', github: '🐙', gdrive: '💾', gdocs: '📝',
                discord: '💬', facebook: '👤', wikipedia: '📖', stackoverflow: '💡', web: '🔗',
              };
              fileEntry.icon = serviceIcons[fileEntry.linkService] || '🔗';
            }
          } catch {}
        }

        files.push(fileEntry);
      }
    }
  }

  const parts = relPath ? relPath.split('/').filter(Boolean) : [];
  const breadcrumb = [{ name: 'Główna', path: '' }];
  for (let i = 0; i < parts.length; i++) {
    breadcrumb.push({ name: parts[i], path: parts.slice(0, i + 1).join('/') });
  }

  res.json({ path: relPath, breadcrumb, dirs, files, isAdmin: checkAdmin(req), githubPrUrl: GITHUB_PR_URL });
});

export default router;
