import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, IconButton, Typography, Stack, Button, Box,
  LinearProgress,
} from '@mui/material'
import Close from '@mui/icons-material/Close'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import Download from '@mui/icons-material/Download'
import { getViewUrl, getDownloadUrl, getAdminViewUrl } from '../api'

export default function PreviewModal({ open, onClose, files, index, onIndexChange, isPending = false }) {
  const [textContent, setTextContent] = useState('')
  const [loadingText, setLoadingText] = useState(false)
  const [loadingOffice, setLoadingOffice] = useState(false)
  const [officeError, setOfficeError] = useState('')
  const [xlsxHtml, setXlsxHtml] = useState('')
  const [markdownHtml, setMarkdownHtml] = useState('')
  const docxContainerRef = useRef(null)
  const pptxContainerRef = useRef(null)

  const file = files[index]

  const getUrl = useCallback((f) => {
    if (isPending) return getAdminViewUrl(f.rel)
    return getViewUrl(f.rel)
  }, [isPending])

  useEffect(() => {
    if (!open || !file) return
    setOfficeError('')
    setXlsxHtml('')
    setMarkdownHtml('')

    // Clear previous renders
    if (docxContainerRef.current) docxContainerRef.current.innerHTML = ''
    if (pptxContainerRef.current) pptxContainerRef.current.innerHTML = ''

    if (file.previewType === 'text') {
      setLoadingText(true)
      fetch(getUrl(file))
        .then(r => r.text())
        .then(text => { setTextContent(text.substring(0, 50000)); setLoadingText(false) })
        .catch(() => { setTextContent('Nie udało się załadować pliku.'); setLoadingText(false) })
    } else if (file.previewType === 'markdown') {
      setLoadingText(true)
      fetch(getUrl(file))
        .then(r => r.text())
        .then(async (text) => {
          const { marked } = await import('marked')
          setMarkdownHtml(marked(text))
          setLoadingText(false)
        })
        .catch(() => { setMarkdownHtml('<p>Nie udało się załadować pliku.</p>'); setLoadingText(false) })
    } else if (file.previewType === 'office') {
      const ext = (file.ext || '.' + file.name.split('.').pop()).toLowerCase()
      setLoadingOffice(true)

      if (ext === '.docx') {
        renderDocx(getUrl(file))
      } else if (ext === '.xlsx' || ext === '.xls') {
        renderXlsx(getUrl(file))
      } else if (ext === '.pptx') {
        renderPptx(getUrl(file))
      } else {
        setOfficeError(`Podgląd formatu ${ext} nie jest w pełni obsługiwany. Pobierz plik aby go otworzyć.`)
        setLoadingOffice(false)
      }
    }
  }, [open, index, file, getUrl])

  const renderDocx = async (url) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const { renderAsync } = await import('docx-preview')
      setTimeout(() => {
        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = ''
          renderAsync(blob, docxContainerRef.current, null, {
            className: 'docx-preview',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
          }).then(() => setLoadingOffice(false))
            .catch((err) => { setOfficeError('Błąd renderowania DOCX: ' + err.message); setLoadingOffice(false) })
        }
      }, 50)
    } catch (err) {
      setOfficeError('Nie udało się załadować pliku: ' + err.message)
      setLoadingOffice(false)
    }
  }

  const renderXlsx = async (url) => {
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      let html = ''
      for (const sheetName of workbook.SheetNames.slice(0, 5)) {
        const sheet = workbook.Sheets[sheetName]
        const sheetHtml = XLSX.utils.sheet_to_html(sheet, { editable: false })
        html += `<div style="margin-bottom: 24px;">
          ${workbook.SheetNames.length > 1 ? `<h3 style="margin: 8px 0; color: #333;">📋 ${sheetName}</h3>` : ''}
          <div style="overflow-x: auto;">${sheetHtml}</div>
        </div>`
      }
      setXlsxHtml(html)
      setLoadingOffice(false)
    } catch (err) {
      setOfficeError('Błąd renderowania arkusza: ' + err.message)
      setLoadingOffice(false)
    }
  }

  const renderPptx = async (url) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const { init } = await import('pptx-preview')

      setTimeout(() => {
        if (pptxContainerRef.current) {
          pptxContainerRef.current.innerHTML = ''
          const width = pptxContainerRef.current.clientWidth || 800
          const instance = init(pptxContainerRef.current, {
            width,
            height: null,
            mode: 'vertical',
          })
          instance.preview(blob)
            .then(() => setLoadingOffice(false))
            .catch((err) => {
              setOfficeError('Błąd renderowania PPTX: ' + err.message)
              setLoadingOffice(false)
            })
        }
      }, 100)
    } catch (err) {
      setOfficeError('Nie udało się załadować prezentacji: ' + err.message)
      setLoadingOffice(false)
    }
  }

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
        {file.previewType === 'markdown' && (
          <Box
            sx={{
              width: '100%',
              maxHeight: '70vh',
              overflow: 'auto',
              p: 3,
              '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 2, mb: 1 },
              '& p': { mb: 1.5, lineHeight: 1.7 },
              '& code': { bgcolor: 'action.hover', px: 0.5, py: 0.25, borderRadius: 0.5, fontSize: '0.9em' },
              '& pre': { bgcolor: '#1e1e1e', color: '#d4d4d4', p: 2, borderRadius: 2, overflow: 'auto', fontSize: 13 },
              '& pre code': { bgcolor: 'transparent', p: 0 },
              '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', pl: 2, ml: 0, color: 'text.secondary' },
              '& table': { borderCollapse: 'collapse', width: '100%', mb: 2 },
              '& td, & th': { border: '1px solid', borderColor: 'divider', p: 1 },
              '& th': { bgcolor: 'action.hover', fontWeight: 'bold' },
              '& img': { maxWidth: '100%' },
              '& a': { color: 'primary.main' },
              '& ul, & ol': { pl: 3 },
              '& li': { mb: 0.5 },
            }}
            dangerouslySetInnerHTML={{ __html: loadingText ? '<p>Ładowanie...</p>' : markdownHtml }}
          />
        )}
        {file.previewType === 'office' && (
          <Box sx={{ width: '100%', maxHeight: '70vh', overflow: 'auto' }}>
            {loadingOffice && <LinearProgress sx={{ mb: 2 }} />}
            {officeError && (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {officeError}
              </Typography>
            )}
            {/* DOCX rendered here by docx-preview */}
            <Box
              ref={docxContainerRef}
              sx={{
                '& .docx-wrapper': {
                  background: 'white',
                  padding: '20px',
                  minHeight: '200px',
                },
                '& .docx-wrapper section.docx': {
                  boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                  marginBottom: '16px',
                  padding: '40px 60px',
                },
              }}
            />
            {/* PPTX rendered here by pptx-preview */}
            <Box
              ref={pptxContainerRef}
              sx={{
                '& .slide-wrapper': {
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                },
              }}
            />
            {/* XLSX rendered as HTML */}
            {xlsxHtml && (
              <Box
                dangerouslySetInnerHTML={{ __html: xlsxHtml }}
                sx={{
                  '& table': {
                    borderCollapse: 'collapse',
                    width: '100%',
                    fontSize: '13px',
                  },
                  '& td, & th': {
                    border: '1px solid #ddd',
                    padding: '4px 8px',
                  },
                  '& th': {
                    background: '#f5f5f5',
                    fontWeight: 'bold',
                  },
                  '& tr:nth-of-type(even)': {
                    background: '#fafafa',
                  },
                }}
              />
            )}
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
