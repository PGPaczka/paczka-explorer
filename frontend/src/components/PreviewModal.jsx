import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, IconButton, Typography, Stack, Button, Box,
} from '@mui/material'
import Close from '@mui/icons-material/Close'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import Download from '@mui/icons-material/Download'
import { getViewUrl, getDownloadUrl, getAdminViewUrl } from '../api'

export default function PreviewModal({ open, onClose, files, index, onIndexChange, isPending = false }) {
  const [textContent, setTextContent] = useState('')
  const [loadingText, setLoadingText] = useState(false)

  const file = files[index]

  const getUrl = useCallback((f) => {
    if (isPending) return getAdminViewUrl(f.rel)
    return getViewUrl(f.rel)
  }, [isPending])

  useEffect(() => {
    if (!open || !file) return
    if (file.previewType === 'text') {
      setLoadingText(true)
      fetch(getUrl(file))
        .then(r => r.text())
        .then(text => { setTextContent(text.substring(0, 50000)); setLoadingText(false) })
        .catch(() => { setTextContent('Nie udało się załadować pliku.'); setLoadingText(false) })
    }
  }, [open, index, file, getUrl])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
      if (e.key === 'ArrowRight' && index < files.length - 1) onIndexChange(index + 1)
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, index, files.length, onIndexChange, onClose])

  if (!file) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        {!isPending && (
          <IconButton disabled={index <= 0} onClick={() => onIndexChange(index - 1)}>
            <ArrowBack />
          </IconButton>
        )}
        {!isPending && (
          <IconButton disabled={index >= files.length - 1} onClick={() => onIndexChange(index + 1)}>
            <ArrowForward />
          </IconButton>
        )}
        <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'center', wordBreak: 'break-all' }}>
          {file.name}
        </Typography>
        <Stack direction="row" gap={0.5}>
          {!isPending && (
            <Button
              size="small"
              variant="contained"
              startIcon={<Download />}
              href={getDownloadUrl(file.rel)}
            >
              Pobierz
            </Button>
          )}
          <IconButton onClick={onClose}><Close /></IconButton>
        </Stack>
        
      </DialogTitle>
      <DialogContent sx={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {file.previewType === 'pdf' && (
          <iframe
            src={getUrl(file)}
            style={{ width: '100%', height: '70vh', border: 'none' }}
            title={file.name}
          />
        )}
        {file.previewType === 'image' && (
          <Box
            component="img"
            src={getUrl(file)}
            alt={file.name}
            sx={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 1 }}
          />
        )}
        {file.previewType === 'text' && (
          <Box
            component="pre"
            sx={{
              width: '100%',
              maxHeight: '70vh',
              overflow: 'auto',
              bgcolor: '#1e1e1e',
              color: '#d4d4d4',
              p: 2,
              borderRadius: 2,
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}
          >
            {loadingText ? 'Ładowanie...' : textContent}
          </Box>
        )}
      </DialogContent>
      {!isPending && files.length > 1 && (
        <Typography variant="caption" textAlign="center" sx={{ pb: 1 }} color="text.secondary">
          {index + 1} / {files.length}
        </Typography>
      )}
    </Dialog>
  )
}
