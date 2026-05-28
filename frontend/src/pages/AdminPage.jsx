import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Button, List, ListItem, ListItemText,
  ListItemIcon, IconButton, Stack, Chip, Alert, LinearProgress, Box,
  Accordion, AccordionSummary, AccordionDetails, Divider,
} from '@mui/material'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Cancel from '@mui/icons-material/Cancel'
import Logout from '@mui/icons-material/Logout'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Folder from '@mui/icons-material/Folder'
import UploadFile from '@mui/icons-material/UploadFile'
import Visibility from '@mui/icons-material/Visibility'
import { fetchPendingAll, fetchAuthStatus, logout, adminApprove, adminReject, adminApproveFile, adminRejectFile } from '../api'
import PreviewModal from '../components/PreviewModal'

export default function AdminPage() {
  const navigate = useNavigate()
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { isAdmin } = await fetchAuthStatus()
      if (!isAdmin) {
        navigate('/admin/login')
        return
      }
      loadPending()
    } catch {
      navigate('/admin/login')
    }
  }

  const loadPending = async () => {
    setLoading(true)
    try {
      const data = await fetchPendingAll()
      setPending(data.pending)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  const handleApprove = async (groupId) => {
    await adminApprove(groupId)
    loadPending()
  }

  const handleReject = async (groupId) => {
    await adminReject(groupId)
    loadPending()
  }

  const handleApproveFile = async (groupId, fileId) => {
    await adminApproveFile(groupId, fileId)
    loadPending()
  }

  const handleRejectFile = async (groupId, fileId) => {
    await adminRejectFile(groupId, fileId)
    loadPending()
  }

  const handlePreviewPending = (fileId, name, ext) => {
    setPreviewFile({ fileId, name, ext })
    setPreviewOpen(true)
  }

  const formatSize = (b) => {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <LinearProgress />
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5">📋 Do zatwierdzenia ({pending.length} grup)</Typography>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" onClick={() => navigate('/browse')}>
            Przeglądaj pliki
          </Button>
          <Button variant="outlined" color="error" startIcon={<Logout />} onClick={handleLogout}>
            Wyloguj
          </Button>
        </Stack>
      </Stack>

      {pending.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Brak plików do zatwierdzenia 🎉
          </Typography>
        </Paper>
      ) : (
        pending.map((group) => (
          <Paper key={group.group_id} sx={{ mb: 2, overflow: 'hidden', borderLeft: 4, borderColor: group.type === 'folder' ? 'primary.main' : 'warning.main' }}>
            {group.type === 'folder' ? (
              <Box sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                  <Folder color="primary" />
                  <Typography fontWeight={600}>
                    Nowy folder: <code>{group.folder_name}</code>
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  📁 W: {group.target_path || '/'} | 🌐 {group.ip} | 📅 {group.uploaded_at?.slice(0, 16)}
                </Typography>
                <Stack direction="row" gap={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => handleApprove(group.group_id)}>
                    Utwórz
                  </Button>
                  <Button size="small" variant="contained" color="error" startIcon={<Cancel />} onClick={() => handleReject(group.group_id)}>
                    Odrzuć
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%', pr: 2 }}>
                    <UploadFile color="warning" />
                    <Typography fontWeight={600}>
                      {group.files?.length || 0} plik(ów) od <em>{group.uploader}</em>
                    </Typography>
                    <Chip size="small" label={group.target_path || '/'} variant="outlined" />
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {group.ip} | {group.uploaded_at?.slice(0, 16)} | {formatSize(group.files?.reduce((s, f) => s + f.size, 0) || 0)}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack direction="row" gap={1} sx={{ mb: 2 }}>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckCircle />} onClick={() => handleApprove(group.group_id)}>
                      Zatwierdź wszystkie
                    </Button>
                    <Button size="small" variant="contained" color="error" startIcon={<Cancel />} onClick={() => handleReject(group.group_id)}>
                      Odrzuć wszystkie
                    </Button>
                  </Stack>
                  <Divider sx={{ mb: 1 }} />
                  <List dense disablePadding>
                    {group.files?.map((file) => {
                      const ext = file.original_name.split('.').pop()?.toLowerCase()
                      return (
                        <ListItem key={file.file_id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                          <ListItemText
                            primary={file.original_name}
                            secondary={formatSize(file.size)}
                          />
                          <Stack direction="row" gap={0.5}>
                            <IconButton size="small" color="info" onClick={() => handlePreviewPending(file.file_id, file.original_name, '.' + ext)} title="Podgląd">
                              <Visibility fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="success" onClick={() => handleApproveFile(group.group_id, file.file_id)} title="Zatwierdź">
                              <CheckCircle fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleRejectFile(group.group_id, file.file_id)} title="Odrzuć">
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Stack>
                        </ListItem>
                      )
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
        ))
      )}

      {/* Simple pending file preview */}
      {previewFile && (
        <PreviewModal
          open={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewFile(null) }}
          files={[{
            name: previewFile.name,
            ext: previewFile.ext,
            rel: previewFile.fileId,
            previewType: getPreviewType(previewFile.ext),
          }]}
          index={0}
          onIndexChange={() => {}}
          isPending
        />
      )}
    </Container>
  )
}

function getPreviewType(ext) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
  if (imageExts.includes(ext)) return 'image'
  if (ext === '.pdf') return 'pdf'
  return 'text'
}
