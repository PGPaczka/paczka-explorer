const API_BASE = import.meta.env.VITE_API_BASE || ''

const fetchOpts = { credentials: 'include' }

export async function searchFiles(query) {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`, fetchOpts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchBrowse(path = '') {
  const res = await fetch(`${API_BASE}/api/browse/${path}`, fetchOpts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchPending(path = '') {
  const res = await fetch(`${API_BASE}/api/pending/${path}`, fetchOpts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchPendingAll() {
  const res = await fetch(`${API_BASE}/api/pending-all`, fetchOpts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function fetchAuthStatus() {
  const res = await fetch(`${API_BASE}/api/auth-status`, fetchOpts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function login(password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) throw new Error('Nieprawidłowe hasło')
  return res.json()
}

export async function logout() {
  const res = await fetch(`${API_BASE}/api/logout`, { ...fetchOpts, method: 'POST' })
  return res.json()
}

export async function uploadFiles(files, targetPath, uploader) {
  const formData = new FormData()
  formData.append('target_path', targetPath)
  formData.append('uploader', uploader)
  for (const f of files) {
    formData.append('file', f)
  }
  const res = await fetch(`${API_BASE}/api/upload`, {
    ...fetchOpts,
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createFolder(targetPath, folderName) {
  const res = await fetch(`${API_BASE}/api/create-folder`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_path: targetPath, folder_name: folderName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function adminApprove(groupId) {
  const res = await fetch(`${API_BASE}/api/admin/approve`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function adminReject(groupId) {
  const res = await fetch(`${API_BASE}/api/admin/reject`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function adminApproveFile(groupId, fileId) {
  const res = await fetch(`${API_BASE}/api/admin/approve-file`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId, file_id: fileId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function adminRejectFile(groupId, fileId) {
  const res = await fetch(`${API_BASE}/api/admin/reject-file`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId, file_id: fileId }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function adminDeleteFile(filePath) {
  const res = await fetch(`${API_BASE}/api/admin/delete-file`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: filePath }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function adminDeleteFolder(folderPath) {
  const res = await fetch(`${API_BASE}/api/admin/delete-folder`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_path: folderPath }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function adminRename(path, newName) {
  const res = await fetch(`${API_BASE}/api/admin/rename`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, new_name: newName }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function downloadSelected(files) {
  const res = await fetch(`${API_BASE}/api/download-selected`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

export async function prepareZipFolder(path) {
  const res = await fetch(`${API_BASE}/api/prepare-zip-folder`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function prepareZipSelected(files) {
  const res = await fetch(`${API_BASE}/api/prepare-zip-selected`, {
    ...fetchOpts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function getZipProgress(jobId) {
  const res = await fetch(`${API_BASE}/api/zip-progress/${jobId}`, fetchOpts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function encodePath(rel) {
  return rel.split('/').map(encodeURIComponent).join('/')
}

export function getZipDownloadUrl(jobId) {
  return `${API_BASE}/api/zip-download/${jobId}`
}

export function getViewUrl(rel) {
  return `${API_BASE}/view/${encodePath(rel)}`
}

export function getDownloadUrl(rel) {
  return `${API_BASE}/download/${encodePath(rel)}`
}

export function getDownloadFolderUrl(rel) {
  return `${API_BASE}/download-folder/${encodePath(rel)}`
}

export function getAdminViewUrl(fileId) {
  return `${API_BASE}/admin/view/${fileId}`
}
