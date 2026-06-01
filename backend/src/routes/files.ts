import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { INDEX_FILE, INDEX_DIR_FILE } from '../config';
import { safePath, getGitRepoStatus } from '../helpers';

const router = Router();

const MIME_TYPES: Record<string, string> = {
  '.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
  '.gif':'image/gif','.svg':'image/svg+xml','.webp':'image/webp','.bmp':'image/bmp','.tif':'image/tiff',
  '.txt':'text/plain; charset=utf-8','.csv':'text/plain; charset=utf-8',
  '.json':'application/json','.xml':'text/xml',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc':'application/msword','.ppt':'application/vnd.ms-powerpoint','.xls':'application/vnd.ms-excel',
  '.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime',
  '.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.flac':'audio/flac',
};

router.get('/view/:path(*)', (req, res) => {
  const target = safePath(req.params.path);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) return res.status(404).json({ detail: 'Not found' });
  const ext = path.extname(target).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', 'inline');
  fs.createReadStream(target).pipe(res);
});

router.get('/download/:path(*)', (req, res) => {
  const target = safePath(req.params.path);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) return res.status(404).json({ detail: 'Not found' });
  res.download(target);
});

router.get('/indeks.csv', (_req, res) => {
  if (!fs.existsSync(INDEX_FILE)) return res.status(404).json({ detail: 'Not found' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.download(INDEX_FILE, 'INDEKS.csv');
});

router.get('/structure', (_req, res) => {
  if (!fs.existsSync(INDEX_DIR_FILE)) return res.status(404).json({ detail: 'Not found' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.download(INDEX_DIR_FILE, 'INDEKS_DIR.csv');
});

router.get('/api/files-root-git', (_req, res) => {
  res.json({ filesRootGit: getGitRepoStatus() });
});

export default router;
