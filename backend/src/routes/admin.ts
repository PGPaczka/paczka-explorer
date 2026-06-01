import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { FILES_ROOT, TEMP_DIR, MAX_UPLOAD_SIZE, MAX_FILES_PER_UPLOAD } from '../config';
import { checkAdmin, safePath, gitPullRepo, createUploadPullRequest } from '../helpers';
import { rateLimitUpload } from '../rateLimit';
import { notifyNewUpload } from '../discord';
import { rebuildIndex } from '../search';

const router = Router();

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: MAX_FILES_PER_UPLOAD },
});

router.post('/api/admin/reindex', (_req, res) => {
  if (!checkAdmin(_req)) return res.status(403).json({ detail: 'Forbidden' });
  try {
    const stats = rebuildIndex();
    res.json({ success: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ detail: `Błąd reindexu: ${err.message}` });
  }
});

router.post('/api/admin/git-pull', (_req, res) => {
  if (!checkAdmin(_req)) return res.status(403).json({ detail: 'Forbidden' });
  const result = gitPullRepo();
  if (!result.success) {
    return res.status(500).json({
      detail: 'Nie udalo sie wykonac git pull.',
      output: result.output,
      filesRootGit: result.status,
    });
  }
  return res.json({
    success: true,
    output: result.output,
    filesRootGit: result.status,
  });
});

// ============ UPLOAD ============

router.post('/api/upload', rateLimitUpload, upload.array('file', MAX_FILES_PER_UPLOAD), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || !files.length) return res.status(400).json({ detail: 'Brak plików' });

  const targetPath = req.body.target_path || '';
  const uploaderName = req.body.uploader || 'Anonim';
  const uploadedFiles = files.map((f) => ({
    originalName: f.originalname,
    tempPath: f.path,
    size: f.size,
  }));

  createUploadPullRequest(targetPath, uploaderName, uploadedFiles)
    .then((result) => {
      if (!result.success) {
        return res.status(500).json({ detail: result.output });
      }

      // Discord notification (fire-and-forget)
      notifyNewUpload({
        uploader: uploaderName,
        targetPath,
        files: uploadedFiles.map(f => ({ original_name: f.originalName, size: f.size })),
      });

      return res.json({
        success: true,
        message: 'Utworzono pull request z uploadem.',
        pr_url: result.prUrl,
        pr_number: result.prNumber,
        branch: result.branch,
      });
    })
    .catch((err: any) => {
      return res.status(500).json({ detail: err?.message || 'Nie udalo sie utworzyc PR.' });
    });
});

// ============ DELETE ============

router.post('/api/admin/delete-file', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const target = safePath(req.body.file_path || '');
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) return res.status(404).json({ detail: 'Not found' });
  fs.unlinkSync(target);
  res.json({ success: true });
});

router.post('/api/admin/delete-folder', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const folderPath = req.body.folder_path || '';
  if (!folderPath) return res.status(400).json({ detail: 'Nie można usunąć folderu głównego' });
  const target = safePath(folderPath);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) return res.status(404).json({ detail: 'Not found' });
  fs.rmSync(target, { recursive: true, force: true });
  res.json({ success: true });
});

// ============ RENAME ============

router.post('/api/admin/rename', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const { path: oldPath, new_name } = req.body || {};
  if (!oldPath || !new_name) return res.status(400).json({ detail: 'Brak ścieżki lub nowej nazwy' });

  const sanitized = new_name.trim().replace(/[/\\]/g, '').replace(/\.\./g, '');
  if (!sanitized) return res.status(400).json({ detail: 'Nieprawidłowa nazwa' });

  const target = safePath(oldPath);
  if (!target || !fs.existsSync(target)) return res.status(404).json({ detail: 'Plik/folder nie istnieje' });

  const newTarget = path.join(path.dirname(target), sanitized);
  if (fs.existsSync(newTarget)) return res.status(409).json({ detail: 'Element o takiej nazwie już istnieje' });

  fs.renameSync(target, newTarget);
  res.json({ success: true, new_path: path.relative(FILES_ROOT, newTarget).replace(/\\/g, '/') });
});

export default router;
