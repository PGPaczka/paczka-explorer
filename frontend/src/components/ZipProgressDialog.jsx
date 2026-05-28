import React, { useState, useEffect, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  LinearProgress, Typography, Box, Stack,
} from '@mui/material'
import FolderZip from '@mui/icons-material/FolderZip'
import { getZipProgress, getZipDownloadUrl } from '../api'

export default function ZipProgressDialog({ open, onClose, jobId, totalFiles }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('packing') // packing | done | error
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!open || !jobId) return

    setProgress(0)
    setStatus('packing')
    setError('')

    const poll = async () => {
      try {
        const data = await getZipProgress(jobId)
        setProgress(data.progress)
        setStatus(data.status)
        if (data.status === 'error') {
          setError(data.error || 'Nieznany błąd')
          clearInterval(intervalRef.current)
        }
        if (data.status === 'done') {
          clearInterval(intervalRef.current)
        }
      } catch (err) {
        setError(err.message)
        setStatus('error')
        clearInterval(intervalRef.current)
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 500)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [open, jobId])

  const handleDownload = () => {
    window.location.href = getZipDownloadUrl(jobId)
    onClose()
  }

  return (
    <Dialog open={open} onClose={status !== 'packing' ? onClose : undefined} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderZip color="primary" />
        Tworzenie archiwum ZIP
      </DialogTitle>
      <DialogContent>
        {status === 'packing' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Pakowanie plików... {totalFiles && `(${totalFiles} plików)`}
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}>
              {progress}%
            </Typography>
          </Box>
        )}
        {status === 'done' && (
          <Stack alignItems="center" spacing={1}>
            <Typography variant="body1" color="success.main" fontWeight={500}>
              ✅ Archiwum gotowe!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Kliknij "Pobierz" aby pobrać plik.
            </Typography>
          </Stack>
        )}
        {status === 'error' && (
          <Typography color="error">
            ❌ Błąd: {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {status === 'packing' && (
          <Button disabled>Pakowanie...</Button>
        )}
        {status === 'done' && (
          <>
            <Button onClick={onClose}>Zamknij</Button>
            <Button variant="contained" onClick={handleDownload}>
              Pobierz
            </Button>
          </>
        )}
        {status === 'error' && (
          <Button onClick={onClose}>Zamknij</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
