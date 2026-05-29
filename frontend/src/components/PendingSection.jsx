import React, { useState, useEffect } from 'react'
import {
  Paper, Typography, Button, Stack, Chip, List,
  IconButton, Collapse, Box,
} from '@mui/material'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Cancel from '@mui/icons-material/Cancel'
import ExpandMore from '@mui/icons-material/ExpandMore'
import ExpandLess from '@mui/icons-material/ExpandLess'
import Folder from '@mui/icons-material/Folder'
import HourglassEmpty from '@mui/icons-material/HourglassEmpty'
import UploadFile from '@mui/icons-material/UploadFile'
import FileEntry from './FileEntry'
import PreviewModal from './PreviewModal'
import { fetchPending, getAdminViewUrl, adminApprove, adminReject, adminApproveFile, adminRejectFile } from '../api'

function formatSize(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const PREVIEWABLE_EXTS = new Set([
  '.txt','.py','.java','.c','.cpp','.cs','.js','.html','.css',
  '.h','.hpp','.asm','.s','.m','.sql','.xml','.json','.yml','.yaml','.sh','.bat',
  '.cfg','.ini','.log','.csv','.adb','.ads','.hs','.st','.pl','.pro','.ts','.rb','.php','.r','.kt','.swift','.go','.rs',
  '.tex','.typ','.bib','.mmd','.env','.in','.dat','.data','.names','.org','.ws',
  '.aspx','.csproj','.sln','.config','.resx','.filters','.xaml','.xsd','.xslt','.kml','.user','.build',
  '.ipynb','.out',
  '.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg',
  '.pdf',
  '.md',
  '.docx','.doc','.pptx','.ppt','.xlsx','.xls','.odt','.odp','.ods','.pps',
  '.mp4','.webm','.mov',
  '.wav','.mp3','.ogg','.flac',
  '.url','.webloc',
])

function getPreviewType(ext) {
  ext = (ext || '').toLowerCase()
  if (['.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg'].includes(ext)) return 'image'
  if (ext === '.pdf') return 'pdf'
  if (ext === '.md') return 'markdown'
  if (['.url','.webloc'].includes(ext)) return 'link'
  if (['.mp4','.webm','.mov'].includes(ext)) return 'video'
  if (['.wav','.mp3','.ogg','.flac'].includes(ext)) return 'audio'
  if (['.docx','.doc','.pptx','.ppt','.xlsx','.xls','.odt','.odp','.ods','.pps'].includes(ext)) return 'office'
  if (PREVIEWABLE_EXTS.has(ext)) return 'text'
  return null
}

function pendingFileToFileEntry(file) {
  const ext = '.' + (file.original_name || '').split('.').pop().toLowerCase()
  const previewType = getPreviewType(ext)
  return {
    name: file.original_name,
    rel: file.file_id,
    ext,
    size: file.size,
    sizeFormatted: formatSize(file.size),
    previewable: !!previewType,
    previewType,
    downloadUrl: getAdminViewUrl(file.file_id, file.original_name),
  }
}

export default function PendingSection({ path, onRefresh }) {
  const [pending, setPending] = useState([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFiles, setPreviewFiles] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)

  const loadPending = async () => {
    setLoading(true)
    try {
      const data = await fetchPending(path)
      setPending(data.pending)
    } catch {
      setPending([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPending() }, [path])

  const handleApprove = async (groupId) => {
    await adminApprove(groupId)
    loadPending()
    onRefresh()
  }

  const handleReject = async (groupId) => {
    await adminReject(groupId)
    loadPending()
    onRefresh()
  }

  const handleApproveFile = async (groupId, fileId) => {
    await adminApproveFile(groupId, fileId)
    loadPending()
    onRefresh()
  }

  const handleRejectFile = async (groupId, fileId) => {
    await adminRejectFile(groupId, fileId)
    loadPending()
    onRefresh()
  }

  const handlePreview = (file, group) => {
    const entries = (group.files || []).map(pendingFileToFileEntry).filter(f => f.previewable)
    const idx = entries.findIndex(f => f.rel === file.rel)
    if (idx >= 0) {
      setPreviewFiles(entries)
      setPreviewIndex(idx)
      setPreviewOpen(true)
    }
  }

  if (pending.length === 0) return null

  return (
    <Paper variant="outlined" sx={{ mb: 2, borderColor: 'warning.main', borderWidth: 2 }}>
      <Box
        sx={{ p: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
        onClick={() => setVisible(!visible)}
      >
        <Chip icon={<HourglassEmpty />} label={`Pending: ${pending.length}`} color="warning" size="small" />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Pliki oczekujące na zatwierdzenie w tym folderze
        </Typography>
        {visible ? <ExpandLess /> : <ExpandMore />}
      </Box>
      <Collapse in={visible}>
        <Box sx={{ px: 2, pb: 2 }}>
          {pending.map((group) => (
            <Paper key={group.group_id} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'action.hover' }}>
              {group.type === 'folder' ? (
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Folder fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight={600}>
                    Nowy folder: {group.folder_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.uploader} ({group.ip})
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    <IconButton size="small" color="success" onClick={() => handleApprove(group.group_id)}>
                      <CheckCircle fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleReject(group.group_id)}>
                      <Cancel fontSize="small" />
                    </IconButton>
                  </Box>
                </Stack>
              ) : (
                <>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1 }}>
                    <UploadFile fontSize="small" color="warning" />
                    <Typography variant="body2" fontWeight={600}>
                      {group.files?.length} plik(ów) od {group.uploader}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {group.ip} | {formatSize(group.files?.reduce((s, f) => s + f.size, 0) || 0)}
                    </Typography>
                    <Box sx={{ ml: 'auto' }}>
                      <Button size="small" color="success" startIcon={<CheckCircle />} onClick={() => handleApprove(group.group_id)}>
                        Wszystkie
                      </Button>
                      <Button size="small" color="error" startIcon={<Cancel />} onClick={() => handleReject(group.group_id)}>
                        Wszystkie
                      </Button>
                    </Box>
                  </Stack>
                  <List dense disablePadding>
                    {group.files?.map((file) => {
                      const entry = pendingFileToFileEntry(file)
                      return (
                        <FileEntry
                          key={file.file_id}
                          file={entry}
                          hideCheckbox
                          onPreview={(f) => handlePreview(f, group)}
                          onDelete={() => handleRejectFile(group.group_id, file.file_id)}
                          isAdmin
                          extraActions={
                            <IconButton size="small" color="success" onClick={() => handleApproveFile(group.group_id, file.file_id)}>
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          }
                        />
                      )
                    })}
                  </List>
                </>
              )}
            </Paper>
          ))}
        </Box>
      </Collapse>
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        files={previewFiles}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        isPending
      />
    </Paper>
  )
}
