import { useState, useRef, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Typography, Box, List, ListItem, ListItemText, IconButton, Alert,
} from '@mui/material'
import CloudUpload from '@mui/icons-material/CloudUpload'
import Delete from '@mui/icons-material/Delete'
import { uploadFiles } from '../api'

export default function UploadDialog({ open, onClose, targetPath, onSuccess }) {
  const [files, setFiles] = useState([])
  const [uploader, setUploader] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  // Listen for files dropped on the page
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      const dropped = e.detail
      if (dropped && dropped.length > 0) {
        validateAndSetFiles(dropped)
      }
    }
    window.addEventListener('paczka-drop-files', handler)
    return () => window.removeEventListener('paczka-drop-files', handler)
  }, [open])

  const validateAndSetFiles = (selected) => {
    if (selected.length > 10) {
      setError('Maksymalnie 10 plików na raz!')
      return
    }
    const tooBig = selected.find(f => f.size > 10 * 1024 * 1024)
    if (tooBig) {
      setError(`Plik "${tooBig.name}" jest za duży! Maks. 10 MB.`)
      return
    }
    setError('')
    setFiles(selected)
  }

  const handleFileChange = (e) => {
    validateAndSetFiles(Array.from(e.target.files || []))
  }

  const handleRemove = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    validateAndSetFiles(Array.from(e.dataTransfer.files))
  }

  const handleSubmit = async () => {
    if (files.length === 0) return
    setLoading(true)
    setError('')
    try {
      const result = await uploadFiles(files, targetPath, uploader, description)
      setFiles([])
      setUploader('')
      setDescription('')
      onClose()
      onSuccess(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFiles([])
    setError('')
    setUploader('')
    setDescription('')
    onClose()
  }

  const formatSize = (b) => {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Wrzuć pliki</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
          onClick={() => inputRef.current?.click()}
        >
          <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography>Kliknij lub przeciągnij pliki tutaj</Typography>
          <Typography variant="caption" color="text.secondary">
            Maks. 10 plików, 10 MB/plik
          </Typography>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileChange}
          />
        </Box>

        {files.length > 0 && (
          <List dense sx={{ mt: 2 }}>
            {files.map((f, i) => (
              <ListItem key={i} secondaryAction={
                <IconButton size="small" onClick={() => handleRemove(i)}>
                  <Delete fontSize="small" />
                </IconButton>
              }>
                <ListItemText primary={f.name} secondary={formatSize(f.size)} />
              </ListItem>
            ))}
          </List>
        )}

        <TextField
          fullWidth
          size="small"
          label="Twoje imię/nick (opcjonalne)"
          value={uploader}
          onChange={(e) => setUploader(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />

        <TextField
          fullWidth
          multiline
          rows={3}
          size="small"
          label="Opis materiałów (opcjonalnie)"
          placeholder="np. Notatki z całego semestru, przygotowanie do kolokwium..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Anuluj</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={files.length === 0 || loading}
        >
          {loading ? 'Wysyłanie...' : `Wyślij (${files.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
