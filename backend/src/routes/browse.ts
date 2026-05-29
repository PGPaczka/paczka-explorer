import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { FILES_ROOT, GITHUB_PR_URL } from '../config';
import { safePath, formatSize, getIcon, isPreviewable, getPreviewType, countFiles, checkAdmin } from '../helpers';
import { getDescription } from '../search';

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
        files.push({
          name: entry.name, rel, ext, size: stat.size,
          sizeFormatted: formatSize(stat.size), icon: getIcon(ext),
          previewable: isPreviewable(ext), previewType: getPreviewType(ext),
          description: getDescription(rel),
        });
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
