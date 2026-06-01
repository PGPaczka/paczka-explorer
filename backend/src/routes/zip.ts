import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { TEMP_DIR } from '../config';
import { safePath, readdirRecursive } from '../helpers';

const router = Router();

interface ZipJob {
  status: 'packing' | 'done' | 'error';
  progress: number;
  tmpPath: string | null;
  filename: string;
  error?: string;
  created: number;
}

const zipJobs: Record<string, ZipJob> = {};

function cleanupOldJobs(): void {
  const now = Date.now();
  for (const [jid, job] of Object.entries(zipJobs)) {
    if (now - job.created > 600000) {
      if (job.tmpPath && fs.existsSync(job.tmpPath)) fs.unlinkSync(job.tmpPath);
      delete zipJobs[jid];
    }
  }
}

function buildZipJob(jobId: string, fileList: { fullPath: string; arcName: string }[], filename: string): void {
  const tmpPath = path.join(TEMP_DIR, `zip_${jobId}.zip`);
  zipJobs[jobId] = { status: 'packing', progress: 0, tmpPath, filename, created: Date.now() };

  const output = fs.createWriteStream(tmpPath);
  const archive = archiver('zip', { zlib: { level: 6 } });
  let processed = 0;
  const total = fileList.length;

  archive.on('entry', () => {
    processed++;
    zipJobs[jobId].progress = Math.round((processed / total) * 100);
  });
  output.on('close', () => { zipJobs[jobId].status = 'done'; });
  archive.on('error', (err) => { zipJobs[jobId].status = 'error'; zipJobs[jobId].error = err.message; });

  archive.pipe(output);
  for (const { fullPath, arcName } of fileList) {
    archive.file(fullPath, { name: arcName });
  }
  archive.finalize();
}

router.post('/api/prepare-zip-folder', (req, res) => {
  const relPath = req.body?.path || '';
  const target = safePath(relPath);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) return res.status(404).json({ detail: 'Not found' });

  cleanupOldJobs();
  const fileList = readdirRecursive(target).map(fp => ({
    fullPath: fp, arcName: path.relative(target, fp).replace(/\\/g, '/'),
  }));
  if (!fileList.length) return res.status(400).json({ detail: 'Folder jest pusty' });

  const jobId = uuidv4().slice(0, 12);
  buildZipJob(jobId, fileList, `${path.basename(target)}.zip`);
  res.json({ jobId, totalFiles: fileList.length });
});

router.post('/api/prepare-zip-selected', (req, res) => {
  const rels: string[] = req.body?.files || [];
  if (!rels.length) return res.status(400).json({ detail: 'Brak plików' });

  cleanupOldJobs();
  const fileList: { fullPath: string; arcName: string }[] = [];
  for (const rel of rels) {
    const target = safePath(rel);
    if (!target || !fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (stat.isFile()) {
      fileList.push({ fullPath: target, arcName: path.basename(target) });
    } else if (stat.isDirectory()) {
      for (const fp of readdirRecursive(target)) {
        fileList.push({ fullPath: fp, arcName: `${path.basename(target)}/${path.relative(target, fp).replace(/\\/g, '/')}` });
      }
    }
  }
  if (!fileList.length) return res.status(400).json({ detail: 'Brak plików do spakowania' });

  const jobId = uuidv4().slice(0, 12);
  buildZipJob(jobId, fileList, 'wybrane_pliki.zip');
  res.json({ jobId, totalFiles: fileList.length });
});

router.get('/api/zip-progress/:jobId', (req, res) => {
  const job = zipJobs[req.params.jobId];
  if (!job) return res.status(404).json({ detail: 'Job nie istnieje' });
  res.json({ status: job.status, progress: job.progress, filename: job.filename, error: job.error || '' });
});

router.get('/api/zip-download/:jobId', (req, res) => {
  const job = zipJobs[req.params.jobId];
  if (!job) return res.status(404).json({ detail: 'Job nie istnieje' });
  if (job.status !== 'done') return res.status(400).json({ detail: 'ZIP nie jest jeszcze gotowy' });

  const tmpPath = job.tmpPath!;
  const filename = job.filename;
  delete zipJobs[req.params.jobId];

  if (!fs.existsSync(tmpPath)) return res.status(404).json({ detail: 'Plik nie istnieje' });

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/zip');
  const stream = fs.createReadStream(tmpPath);
  stream.pipe(res);
  stream.on('end', () => { try { fs.unlinkSync(tmpPath); } catch {} });
});

// Legacy
router.get('/download-folder/:path(*)', (req, res) => {
  const target = safePath(req.params.path);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) return res.status(404).json({ detail: 'Not found' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(target)}.zip"`);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);
  archive.directory(target, false);
  archive.finalize();
});

router.post('/api/download-selected', (req, res) => {
  const rels: string[] = req.body?.files || [];
  if (!rels.length) return res.status(400).json({ detail: 'Brak plików' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="wybrane_pliki.zip"');
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  for (const rel of rels) {
    const target = safePath(rel);
    if (!target || !fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (stat.isFile()) archive.file(target, { name: path.basename(target) });
    else if (stat.isDirectory()) archive.directory(target, path.basename(target));
  }
  archive.finalize();
});

export default router;
