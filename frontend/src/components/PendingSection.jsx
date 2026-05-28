import React, { useState, useEffect } from 'react'
import {
  Paper, Typography, Button, Stack, Chip, List, ListItem, ListItemText,
  IconButton, Collapse, Box, Alert,
} from '@mui/material'
import CheckCircle from '@mui/icons-material/CheckCircle'
import Cancel from '@mui/icons-material/Cancel'
import ExpandMore from '@mui/icons-material/ExpandMore'
import ExpandLess from '@mui/icons-material/ExpandLess'
import Folder from '@mui/icons-material/Folder'
import UploadFile from '@mui/icons-material/UploadFile'
import { fetchPending, adminApprove, adminReject, adminApproveFile, adminRejectFile } from '../api'

export default function PendingSection({ path, onRefresh }) {
  const [pending, setPending] = useState([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

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

  const formatSize = (b) => {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  if (pending.length === 0) return null

  return (
    <Paper variant="outlined" sx={{ mb: 2, borderColor: 'warning.main', borderWidth: 2 }}>
      <Box
        sx={{ p: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}
        onClick={() => setVisible(!visible)}
      >
        <Chip label={`⏳ Pending: ${pending.length}`} color="warning" size="small" />
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
                    {group.files?.map((file) => (
                      <ListItem key={file.file_id} sx={{ py: 0.5 }}>
                        <ListItemText
                          primary={file.original_name}
                          secondary={formatSize(file.size)}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                        <IconButton size="small" color="success" onClick={() => handleApproveFile(group.group_id, file.file_id)}>
                          <CheckCircle fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleRejectFile(group.group_id, file.file_id)}>
                          <Cancel fontSize="small" />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </Paper>
          ))}
        </Box>
      </Collapse>
    </Paper>
  )
}
