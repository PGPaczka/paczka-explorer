import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { createReadStream } from 'fs';
import { FILES_ROOT, GITHUB_PR_URL } from '../config';
import { safePath, formatSize, isPreviewable, getPreviewType, checkAdmin } from '../helpers';

const router = Router();

// Lazy-load yauzl-promise or use built-in unzipper
// We'll use the 'archiver' approach with node's built-in zlib + a simple ZIP reader
import { Open } from 'unzipper';

/**
 * Browse inside a ZIP file.
 * Path format: /api/browse-zip/path/to/file.zip/inner/path
 * The ZIP file path is everything up to and including .zip
 */
router.get('/api/browse-zip/:path(*)', async (req, res) => {
  const fullPath = req.params.path || '';

  // Split at .zip boundary
  const zipMatch = fullPath.match(/^(.+\.zip)(\/(.*))?$/i);
  if (!zipMatch) return res.status(400).json({ detail: 'Invalid zip path' });

  const zipRelPath = zipMatch[1];
  const innerPath = (zipMatch[3] || '').replace(/^\/+/, '');

  const zipFullPath = safePath(zipRelPath);
  if (!zipFullPath || !fs.existsSync(zipFullPath) || !fs.statSync(zipFullPath).isFile()) {
    return res.status(404).json({ detail: 'ZIP nie istnieje' });
  }

  try {
    const directory = await Open.file(zipFullPath);
    const entries = directory.files;

    const dirs = new Set<string>();
    const files: any[] = [];

    for (const entry of entries) {
      let entryPath = entry.path.replace(/\\/g, '/');
      // Remove leading slash if any
      if (entryPath.startsWith('/')) entryPath = entryPath.slice(1);

      // Skip entries not in current inner path
      if (innerPath && !entryPath.startsWith(innerPath + '/') && entryPath !== innerPath) continue;

      // Get relative path from innerPath
      const relative = innerPath ? entryPath.slice(innerPath.length + 1) : entryPath;
      if (!relative || relative === '') continue;

      const parts = relative.split('/');

      if (parts.length === 1 && entry.type !== 'Directory') {
        // Direct file in this directory
        const ext = path.extname(parts[0]).toLowerCase();
        files.push({
          name: parts[0],
          rel: `${zipRelPath}/${entryPath}`,
          ext,
          size: entry.uncompressedSize || 0,
          sizeFormatted: formatSize(entry.uncompressedSize || 0),
          previewable: isPreviewable(ext),
          previewType: getPreviewType(ext),
          description: '',
          isInZip: true,
        });
      } else if (parts.length >= 1) {
        // Subdirectory
        dirs.add(parts[0]);
      }
    }

    // Build breadcrumb
    const zipParts = zipRelPath.split('/');
    const innerParts = innerPath ? innerPath.split('/').filter(Boolean) : [];
    const breadcrumb: any[] = [{ name: 'Główna', path: '' }];

    // Add path to the zip file's parent folders
    for (let i = 0; i < zipParts.length - 1; i++) {
      breadcrumb.push({ name: zipParts[i], path: zipParts.slice(0, i + 1).join('/') });
    }
    // Add the zip file itself
    breadcrumb.push({ name: zipParts[zipParts.length - 1], path: zipRelPath, isZip: true });
    // Add inner path parts
    for (let i = 0; i < innerParts.length; i++) {
      breadcrumb.push({ name: innerParts[i], path: `${zipRelPath}/${innerParts.slice(0, i + 1).join('/')}`, isZip: true });
    }

    const dirsList = Array.from(dirs).sort().map(name => ({
      name,
      rel: `${zipRelPath}/${innerPath ? innerPath + '/' : ''}${name}`,
      fileCount: 0,
      isInZip: true,
    }));

    res.json({
      path: fullPath,
      breadcrumb,
      dirs: dirsList,
      files: files.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
      isAdmin: checkAdmin(req),
      githubPrUrl: GITHUB_PR_URL,
      isZipView: true,
    });
  } catch (err: any) {
    res.status(500).json({ detail: 'Błąd odczytu ZIP: ' + err.message });
  }
});

/**
 * Serve a file from inside a ZIP.
 * /view-zip/path/to/file.zip/inner/file.txt
 */
router.get('/view-zip/:path(*)', async (req, res) => {
  const fullPath = req.params.path || '';
  const zipMatch = fullPath.match(/^(.+\.zip)\/(.+)$/i);
  if (!zipMatch) return res.status(400).json({ detail: 'Invalid zip path' });

  const zipRelPath = zipMatch[1];
  const innerFile = zipMatch[2];

  const zipFullPath = safePath(zipRelPath);
  if (!zipFullPath || !fs.existsSync(zipFullPath)) return res.status(404).json({ detail: 'ZIP nie istnieje' });

  try {
    const directory = await Open.file(zipFullPath);
    const entry = directory.files.find(e => {
      const p = e.path.replace(/\\/g, '/').replace(/^\//, '');
      return p === innerFile;
    });

    if (!entry || entry.type === 'Directory') return res.status(404).json({ detail: 'Plik nie istnieje w ZIP' });

    const ext = path.extname(innerFile).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
      '.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.bmp':'image/bmp',
      '.txt':'text/plain; charset=utf-8','.csv':'text/plain; charset=utf-8',
      '.json':'application/json','.xml':'text/xml','.html':'text/html',
      '.js':'text/javascript','.css':'text/css','.py':'text/plain; charset=utf-8',
      '.java':'text/plain; charset=utf-8','.c':'text/plain; charset=utf-8',
      '.cpp':'text/plain; charset=utf-8','.h':'text/plain; charset=utf-8',
      '.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.mp3':'audio/mpeg',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    entry.stream().pipe(res);
  } catch (err: any) {
    res.status(500).json({ detail: 'Błąd odczytu z ZIP: ' + err.message });
  }
});

export default router;
