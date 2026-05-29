import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { FILES_ROOT, PENDING_DIR, MAX_UPLOAD_SIZE, MAX_FILES_PER_UPLOAD } from '../config';
import { checkAdmin, safePath, loadPending, savePending } from '../helpers';

const router = Router();

const upload = multer({
  dest: PENDING_DIR,
  limits: { fileSize: MAX_UPLOAD_SIZE, files: MAX_FILES_PER_UPLOAD },
});

// ============ PENDING ============

router.get('/api/pending-all', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  res.json({ pending: loadPending() });
});

router.get('/api/pending/:path(*)?', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const p = req.params.path || '';
  const pending = loadPending();
  res.json({ pending: pending.filter(g => (g.target_path || '') === p) });
});

// ============ UPLOAD ============

router.post('/api/upload', upload.array('file', MAX_FILES_PER_UPLOAD), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || !files.length) return res.status(400).json({ detail: 'Brak plików' });

  const targetPath = req.body.target_path || '';
  const uploaderName = req.body.uploader || 'Anonim';
  const clientIp = req.ip || 'unknown';
  const groupId = uuidv4().slice(0, 8);
  const now = new Date().toISOString();

  const pending = loadPending();
  const uploadedFiles: any[] = [];

  for (const f of files) {
    const fileId = uuidv4().slice(0, 8);
    const safeName = f.originalname.replace(/[/\\]/g, '_');
    const pendingPath = path.join(PENDING_DIR, `${fileId}_${safeName}`);
    fs.renameSync(f.path, pendingPath);
    uploadedFiles.push({
      file_id: fileId, original_name: f.originalname,
      filename: safeName, size: f.size, pending_file: pendingPath,
    });
  }

  if (!uploadedFiles.length) return res.status(400).json({ detail: 'Żaden plik nie został zaakceptowany' });

  let existingGroup: any = null;
  for (const item of pending) {
    if (item.ip === clientIp && item.uploader === uploaderName && item.target_path === targetPath) {
      const itemTime = new Date(item.uploaded_at).getTime();
      if (Date.now() - itemTime < 600000) { existingGroup = item; break; }
    }
  }

  if (existingGroup) {
    existingGroup.files.push(...uploadedFiles);
    existingGroup.uploaded_at = now;
  } else {
    pending.push({
      group_id: groupId, target_path: targetPath, uploader: uploaderName,
      ip: clientIp, uploaded_at: now, files: uploadedFiles,
    });
  }

  savePending(pending);
  res.json({ success: true, message: 'Pliki wysłane do zatwierdzenia' });
});

// ============ CREATE FOLDER ============

router.post('/api/create-folder', (req, res) => {
  const { target_path = '', folder_name = '' } = req.body || {};
  const name = folder_name.trim().replace(/[/\\]/g, '').replace(/\.\./g, '');
  if (!name) return res.status(400).json({ detail: 'Nazwa folderu nie może być pusta' });

  const clientIp = req.ip || 'unknown';
  const groupId = uuidv4().slice(0, 8);
  const now = new Date().toISOString();

  const pending = loadPending();
  pending.push({
    group_id: groupId, type: 'folder', target_path, folder_name: name,
    uploader: 'Anonim', ip: clientIp, uploaded_at: now, files: [],
  });
  savePending(pending);
  res.json({ success: true, message: 'Folder wysłany do zatwierdzenia' });
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

// ============ VIEW PENDING FILE ============

router.get('/admin/view/:fileId/:filename?', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const pending = loadPending();
  for (const group of pending) {
    for (const f of (group.files || [])) {
      if (f.file_id === req.params.fileId) {
        if (!fs.existsSync(f.pending_file)) return res.status(404).json({ detail: 'Not found' });
        const ext = path.extname(f.original_name).toLowerCase();
        const mimeTypes: Record<string, string> = {'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
          '.gif':'image/gif','.svg':'image/svg+xml','.txt':'text/plain','.csv':'text/plain'};
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');
        return fs.createReadStream(f.pending_file).pipe(res);
      }
    }
  }
  res.status(404).json({ detail: 'Not found' });
});

// ============ APPROVE / REJECT ============

router.post('/api/admin/approve', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const { group_id } = req.body || {};
  const pending = loadPending();
  const group = pending.find(g => g.group_id === group_id);
  if (!group) return res.status(404).json({ detail: 'Not found' });

  const targetPath = group.target_path || '';
  if (group.type === 'folder') {
    const dir = path.join(safePath(targetPath) || FILES_ROOT, group.folder_name);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    const targetDir = path.join(FILES_ROOT, targetPath);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const f of (group.files || [])) {
      if (fs.existsSync(f.pending_file)) {
        fs.renameSync(f.pending_file, path.join(targetDir, f.original_name));
      }
    }
  }
  savePending(pending.filter(g => g.group_id !== group_id));
  res.json({ success: true });
});

router.post('/api/admin/reject', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const { group_id } = req.body || {};
  const pending = loadPending();
  const group = pending.find(g => g.group_id === group_id);
  if (!group) return res.status(404).json({ detail: 'Not found' });

  for (const f of (group.files || [])) {
    if (fs.existsSync(f.pending_file)) fs.unlinkSync(f.pending_file);
  }
  savePending(pending.filter(g => g.group_id !== group_id));
  res.json({ success: true });
});

router.post('/api/admin/approve-file', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const { group_id, file_id } = req.body || {};
  const pending = loadPending();
  const group = pending.find(g => g.group_id === group_id);
  if (!group) return res.status(404).json({ detail: 'Not found' });

  const fileEntry = (group.files || []).find((f: any) => f.file_id === file_id);
  if (!fileEntry) return res.status(404).json({ detail: 'Not found' });

  const targetDir = path.join(FILES_ROOT, group.target_path || '');
  fs.mkdirSync(targetDir, { recursive: true });
  if (fs.existsSync(fileEntry.pending_file)) {
    fs.renameSync(fileEntry.pending_file, path.join(targetDir, fileEntry.original_name));
  }

  group.files = group.files.filter((f: any) => f.file_id !== file_id);
  if (!group.files.length) savePending(pending.filter(g => g.group_id !== group_id));
  else savePending(pending);
  res.json({ success: true });
});

router.post('/api/admin/reject-file', (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ detail: 'Forbidden' });
  const { group_id, file_id } = req.body || {};
  const pending = loadPending();
  const group = pending.find(g => g.group_id === group_id);
  if (!group) return res.status(404).json({ detail: 'Not found' });

  const fileEntry = (group.files || []).find((f: any) => f.file_id === file_id);
  if (!fileEntry) return res.status(404).json({ detail: 'Not found' });

  if (fs.existsSync(fileEntry.pending_file)) fs.unlinkSync(fileEntry.pending_file);

  group.files = group.files.filter((f: any) => f.file_id !== file_id);
  if (!group.files.length) savePending(pending.filter(g => g.group_id !== group_id));
  else savePending(pending);
  res.json({ success: true });
});

export default router;
