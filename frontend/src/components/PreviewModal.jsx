import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Dialog, DialogTitle, DialogContent, IconButton, Typography, Stack, Button, Box,
  LinearProgress, ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import Close from '@mui/icons-material/Close'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import Download from '@mui/icons-material/Download'
import Code from '@mui/icons-material/Code'
import Article from '@mui/icons-material/Article'
import { getViewUrl, getDownloadUrl, getAdminViewUrl, getViewZipUrl } from '../api'
import CodePreview from './CodePreview'

// Individual slide renderer - handles one file preview
function PreviewSlide({ file, getUrl, visible, viewMode }) {
  const [textContent, setTextContent] = useState('')
  const [rawContent, setRawContent] = useState('')
  const [markdownHtml, setMarkdownHtml] = useState('')
  const [xlsxHtml, setXlsxHtml] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [officeError, setOfficeError] = useState('')
  const docxRef = useRef(null)
  const pptxRef = useRef(null)
  const rendered = useRef(false)

  const isRenderable = file && (file.previewType === 'markdown' || (file.previewType === 'text' && ['.html','.htm','.xml'].includes((file.ext || '').toLowerCase())))

  useEffect(() => {
    if (!file || rendered.current) return
    rendered.current = true

    const url = getUrl(file)

    if (file.previewType === 'text') {
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(buf => {
          let text
          try {
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(buf)
            text = decoded
          } catch {
            text = new TextDecoder('windows-1250').decode(buf)
          }
          const trimmed = text.substring(0, 50000)
          setTextContent(trimmed)
          setRawContent(trimmed)
          setLoading(false)
        })
        .catch(() => { setTextContent('Nie udało się załadować pliku.'); setLoading(false) })
    } else if (file.previewType === 'markdown') {
      fetch(url)
        .then(r => r.text())
        .then(async (text) => {
          setRawContent(text.substring(0, 50000))
          const { marked } = await import('marked')
          setMarkdownHtml(marked(text))
          setLoading(false)
        })
        .catch(() => { setMarkdownHtml('<p>Nie udało się załadować pliku.</p>'); setLoading(false) })
    } else if (file.previewType === 'link') {
      fetch(url)
        .then(r => r.text())
        .then(text => {
          // Parse .url (INI format) or .webloc (XML plist)
          let parsed = ''
          const urlMatch = text.match(/URL=(.+)/i)
          if (urlMatch) {
            parsed = urlMatch[1].trim()
          } else {
            const hrefMatch = text.match(/<string>(https?:\/\/[^<]+)<\/string>/i)
            if (hrefMatch) parsed = hrefMatch[1].trim()
          }
          if (parsed) {
            setLinkUrl(parsed)
            window.open(parsed, '_blank', 'noopener')
          }
          setLoading(false)
        })
        .catch(() => { setLoading(false) })
    } else if (file.previewType === 'office') {
      const ext = (file.ext || '.' + file.name.split('.').pop()).toLowerCase()
      if (ext === '.docx') {
        renderDocx(url)
      } else if (ext === '.xlsx' || ext === '.xls') {
        renderXlsx(url)
      } else if (ext === '.pptx') {
        renderPptx(url)
      } else {
        setOfficeError(`Podgląd formatu ${ext} nie jest w pełni obsługiwany. Pobierz plik.`)
        setLoading(false)
      }
    } else {
      // image, pdf - handled directly in JSX
      setLoading(false)
    }
  }, [file, getUrl])

  const renderDocx = async (url) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const { renderAsync } = await import('docx-preview')
      setTimeout(() => {
        if (docxRef.current) {
          renderAsync(blob, docxRef.current, null, {
            className: 'docx-preview',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
          }).then(() => setLoading(false))
            .catch((err) => { setOfficeError('Błąd renderowania DOCX: ' + err.message); setLoading(false) })
        }
      }, 50)
    } catch (err) {
      setOfficeError('Nie udało się załadować pliku: ' + err.message)
      setLoading(false)
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
          ${workbook.SheetNames.length > 1 ? `<h3 style="margin: 8px 0; color: #333;">${sheetName}</h3>` : ''}
          <div style="overflow-x: auto;">${sheetHtml}</div>
        </div>`
      }
      setXlsxHtml(html)
      setLoading(false)
    } catch (err) {
      setOfficeError('Błąd renderowania arkusza: ' + err.message)
      setLoading(false)
    }
  }

  const renderPptx = async (url) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const { init } = await import('pptx-preview')
      setTimeout(() => {
        if (pptxRef.current) {
          const width = 800
          const instance = init(pptxRef.current, { width, height: null, mode: 'vertical' })
          instance.preview(blob)
            .then(() => setLoading(false))
            .catch((err) => { setOfficeError('Błąd renderowania PPTX: ' + err.message); setLoading(false) })
        }
      }, 100)
    } catch (err) {
      setOfficeError('Nie udało się załadować prezentacji: ' + err.message)
      setLoading(false)
    }
  }

  if (!file) return null

  const url = getUrl(file)

  return (
    <Box sx={{ display: visible ? 'flex' : 'none', width: '100%', minHeight: 400, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      {loading && visible && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}

      {file.previewType === 'pdf' && (
        <iframe src={url} style={{ width: '100%', height: '70vh', border: 'none' }} title={file.name} />
      )}

      {file.previewType === 'image' && (
        <Box component="img" src={url} alt={file.name} sx={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 1 }} />
      )}

      {file.previewType === 'video' && (
        <Box component="video" controls src={url} sx={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 1 }} />
      )}

      {file.previewType === 'audio' && (
        <Box component="audio" controls src={url} sx={{ width: '100%', maxWidth: 500 }} />
      )}

      {file.previewType === 'text' && (
        isRenderable && viewMode === 'render' ? (
          <Box sx={{ width: '100%', maxHeight: '70vh', overflow: 'auto', p: 2 }}
            dangerouslySetInnerHTML={{ __html: loading ? '<p>Ładowanie...</p>' : textContent }} />
        ) : !loading ? (
          <CodePreview content={textContent} ext={file.ext} />
        ) : (
          <Box sx={{ p: 2, color: 'text.secondary' }}>Ładowanie...</Box>
        )
      )}

      {file.previewType === 'markdown' && (
        viewMode === 'render' ? (
          <Box sx={{
            width: '100%', maxHeight: '70vh', overflow: 'auto', p: 3,
            '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 2, mb: 1 },
            '& p': { mb: 1.5, lineHeight: 1.7 },
            '& code': { bgcolor: 'action.hover', px: 0.5, py: 0.25, borderRadius: 0.5, fontSize: '0.9em' },
            '& pre': { bgcolor: '#1e1e1e', color: '#d4d4d4', p: 2, borderRadius: 2, overflow: 'auto', fontSize: 13 },
            '& pre code': { bgcolor: 'transparent', p: 0 },
            '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', pl: 2, ml: 0, color: 'text.secondary' },
            '& table': { borderCollapse: 'collapse', width: '100%', mb: 2 },
            '& td, & th': { border: '1px solid', borderColor: 'divider', p: 1 },
            '& th': { bgcolor: 'action.hover', fontWeight: 'bold' },
            '& img': { maxWidth: '100%' }, '& a': { color: 'primary.main' },
            '& ul, & ol': { pl: 3 }, '& li': { mb: 0.5 },
          }} dangerouslySetInnerHTML={{ __html: loading ? '<p>Ładowanie...</p>' : markdownHtml }} />
        ) : !loading ? (
          <CodePreview content={rawContent} ext=".md" />
        ) : (
          <Box sx={{ p: 2, color: 'text.secondary' }}>Ładowanie...</Box>
        )
      )}

      {file.previewType === 'link' && (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, gap: 2 }}>
          {linkUrl ? (
            <>
              <Typography variant="body1" color="text.secondary">Przekierowano do:</Typography>
              <Button variant="contained" href={linkUrl} target="_blank" rel="noopener noreferrer">
                {linkUrl.length > 80 ? linkUrl.substring(0, 80) + '...' : linkUrl}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Jeśli strona się nie otworzyła, kliknij przycisk powyżej.
              </Typography>
            </>
          ) : (
            <Typography color="text.secondary">
              {loading ? 'Ładowanie...' : 'Nie udało się odczytać linku z pliku.'}
            </Typography>
          )}
        </Box>
      )}

      {file.previewType === 'office' && (
        <Box sx={{ width: '100%', maxHeight: '70vh', overflow: 'auto' }}>
          {officeError && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>{officeError}</Typography>
          )}
          <Box ref={docxRef} sx={{
            '& .docx-wrapper': { background: 'white', padding: '20px', minHeight: '200px' },
            '& .docx-wrapper section.docx': { boxShadow: '0 0 10px rgba(0,0,0,0.1)', marginBottom: '16px', padding: '40px 60px' },
          }} />
          <Box ref={pptxRef} sx={{
            '& .slide-wrapper': { marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', borderRadius: '4px', overflow: 'hidden' },
          }} />
          {xlsxHtml && (
            <Box dangerouslySetInnerHTML={{ __html: xlsxHtml }} sx={{
              '& table': { borderCollapse: 'collapse', width: '100%', fontSize: '13px' },
              '& td, & th': { border: '1px solid #ddd', padding: '4px 8px' },
              '& th': { background: '#f5f5f5', fontWeight: 'bold' },
              '& tr:nth-of-type(even)': { background: '#fafafa' },
            }} />
          )}
        </Box>
      )}
    </Box>
  )
}

export default function PreviewModal({ open, onClose, files, index, onIndexChange, isPending = false }) {
  const file = files[index]
  const [viewMode, setViewMode] = useState('render')

  const isRenderable = file && (file.previewType === 'markdown' || (file.previewType === 'text' && ['.html','.htm','.xml'].includes((file.ext || '').toLowerCase())))

  const getUrl = useCallback((f) => {
    if (isPending) return getAdminViewUrl(f.rel)
    if (f.isInZip) return getViewZipUrl(f.rel)
    return getViewUrl(f.rel)
  }, [isPending])

  // Determine which indices to prerender (prev, current, next)
  const renderIndices = useMemo(() => {
    const indices = [index]
    if (index > 0) indices.push(index - 1)
    if (index < files.length - 1) indices.push(index + 1)
    return indices
  }, [index, files.length])

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
        {isRenderable && (
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="render"><Article fontSize="small" /></ToggleButton>
            <ToggleButton value="plain"><Code fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        )}
        <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'center', wordBreak: 'break-all' }}>
          {file.name}
        </Typography>
        <Stack direction="row" gap={0.5}>
          {!isPending && (
            <Button size="small" variant="contained" startIcon={<Download />} href={getDownloadUrl(file.rel)}>
              Pobierz
            </Button>
          )}
          <IconButton onClick={onClose}><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ minHeight: 400, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderIndices.map((i) => (
          <PreviewSlide
            key={files[i]?.rel || i}
            file={files[i]}
            getUrl={getUrl}
            visible={i === index}
            viewMode={viewMode}
          />
        ))}
      </DialogContent>
      {!isPending && files.length > 1 && (
        <Typography variant="caption" textAlign="center" sx={{ pb: 1 }} color="text.secondary">
          {index + 1} / {files.length}
        </Typography>
      )}
    </Dialog>
  )
}
