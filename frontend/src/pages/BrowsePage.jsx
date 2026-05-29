import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Container, Box, Breadcrumbs, Link, Typography, TextField, InputAdornment,
  List, ListItem, ListItemIcon, ListItemText, ListItemSecondaryAction,
  Checkbox, IconButton, Button, Chip, Paper, Snackbar, Alert, Tooltip,
  Fab, Divider, Stack, LinearProgress, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import Download from '@mui/icons-material/Download'
import Search from '@mui/icons-material/Search'
import TravelExplore from '@mui/icons-material/TravelExplore'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import CloudUpload from '@mui/icons-material/CloudUpload'
import CreateNewFolder from '@mui/icons-material/CreateNewFolder'
import SelectAll from '@mui/icons-material/SelectAll'
import GitHub from '@mui/icons-material/GitHub'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { fetchBrowse, searchFiles, getDownloadUrl, getViewUrl, downloadSelected, adminDeleteFile, adminDeleteFolder, adminRename, prepareZipFolder, prepareZipSelected } from '../api'
import UploadDialog from '../components/UploadDialog'
import CreateFolderDialog from '../components/CreateFolderDialog'
import PreviewModal from '../components/PreviewModal'
import PendingSection from '../components/PendingSection'
import ZipProgressDialog from '../components/ZipProgressDialog'

export default function BrowsePage() {
  const location = useLocation()
  const navigate = useNavigate()

  const currentPath = useMemo(() => {
    const p = location.pathname.replace(/^\/browse\/?/, '').replace(/^\//, '')
    return decodeURIComponent(p)
  }, [location.pathname])

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [zipDialogOpen, setZipDialogOpen] = useState(false)
  const [zipJobId, setZipJobId] = useState(null)
  const [zipTotalFiles, setZipTotalFiles] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [searchMode, setSearchMode] = useState('local') // 'local' or 'global'
  const [globalResults, setGlobalResults] = useState(null)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await fetchBrowse(currentPath)
      setData(result)
      setSelected(new Set())
    } catch (err) {
      setSnackbar({ open: true, message: 'Błąd ładowania: ' + err.message, severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [currentPath])

  // Global search with debounce
  useEffect(() => {
    if (searchMode !== 'global' || !search || search.length < 2) {
      setGlobalResults(null)
      return
    }
    const timer = setTimeout(async () => {
      setGlobalSearchLoading(true)
      try {
        const result = await searchFiles(search)
        setGlobalResults(result)
      } catch (err) {
        setSnackbar({ open: true, message: 'Błąd wyszukiwania: ' + err.message, severity: 'error' })
      } finally {
        setGlobalSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, searchMode])

  const filteredDirs = useMemo(() => {
    if (!data) return []
    if (!search || searchMode === 'global') return data.dirs
    return data.dirs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
  }, [data, search, searchMode])

  const filteredFiles = useMemo(() => {
    if (!data) return []
    if (!search || searchMode === 'global') return data.files
    return data.files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  }, [data, search, searchMode])

  const previewableFiles = useMemo(() => {
    if (!data) return []
    return data.files.filter(f => f.previewable)
  }, [data])

  const handleNavigate = (path) => {
    navigate(path ? `/browse/${path}` : '/browse')
  }

  const handleToggleSelect = (rel) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(rel)) next.delete(rel)
      else next.add(rel)
      return next
    })
  }

  const handleSelectAll = () => {
    if (!data) return
    const allRels = [...data.dirs.map(d => d.rel), ...data.files.map(f => f.rel)]
    if (selected.size === allRels.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allRels))
    }
  }

  const handleDownloadSelected = async () => {
    try {
      const { jobId, totalFiles } = await prepareZipSelected([...selected])
      setZipJobId(jobId)
      setZipTotalFiles(totalFiles)
      setZipDialogOpen(true)
    } catch (err) {
      setSnackbar({ open: true, message: 'Błąd pobierania: ' + err.message, severity: 'error' })
    }
  }

  const handleDownloadFolder = async (folderPath) => {
    try {
      const { jobId, totalFiles } = await prepareZipFolder(folderPath)
      setZipJobId(jobId)
      setZipTotalFiles(totalFiles)
      setZipDialogOpen(true)
    } catch (err) {
      setSnackbar({ open: true, message: 'Błąd pobierania: ' + err.message, severity: 'error' })
    }
  }

  const handlePreview = (file) => {
    // For link files (.url, .webloc), open directly in new tab
    if (file.previewType === 'link') {
      if (file.linkUrl) {
        window.open(file.linkUrl, '_blank', 'noopener')
      } else {
        fetch(getViewUrl(file.rel))
          .then(r => r.text())
          .then(text => {
            let url = ''
            const urlMatch = text.match(/URL=(.+)/i)
            if (urlMatch) url = urlMatch[1].trim()
            else {
              const hrefMatch = text.match(/<string>(https?:\/\/[^<]+)<\/string>/i)
              if (hrefMatch) url = hrefMatch[1].trim()
            }
            if (url) window.open(url, '_blank', 'noopener')
            else showSnackbar('Nie udało się odczytać linku z pliku')
          })
          .catch(() => showSnackbar('Nie udało się otworzyć linku'))
      }
      return
    }
    const idx = previewableFiles.findIndex(f => f.rel === file.rel)
    if (idx >= 0) {
      setPreviewIndex(idx)
      setPreviewOpen(true)
    }
  }

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Usunąć plik "${file.name}"?`)) return
    try {
      await adminDeleteFile(file.rel)
      showSnackbar('Plik usunięty')
      loadData()
    } catch (err) {
      showSnackbar('Błąd usuwania: ' + err.message, 'error')
    }
  }

  const handleDeleteFolder = async (dir) => {
    if (!window.confirm(`Usunąć folder "${dir.name}" i całą jego zawartość?`)) return
    try {
      await adminDeleteFolder(dir.rel)
      showSnackbar('Folder usunięty')
      loadData()
    } catch (err) {
      showSnackbar('Błąd usuwania: ' + err.message, 'error')
    }
  }

  const handleRename = async (item) => {
    const newName = window.prompt('Nowa nazwa:', item.name)
    if (!newName || newName === item.name) return
    try {
      await adminRename(item.rel, newName)
      showSnackbar('Nazwa zmieniona')
      loadData()
    } catch (err) {
      showSnackbar('Błąd zmiany nazwy: ' + err.message, 'error')
    }
  }

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <LinearProgress />
      </Container>
    )
  }

  if (!data) return null

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Breadcrumb */}
      <Breadcrumbs sx={{ mb: 2 }}>
        {data.breadcrumb.map((bc, i) => (
          i === data.breadcrumb.length - 1 ? (
            <Typography key={i} color="text.primary" fontWeight={500}>
              {bc.name}
            </Typography>
          ) : (
            <Link
              key={i}
              component="button"
              underline="hover"
              onClick={() => handleNavigate(bc.path)}
              sx={{ cursor: 'pointer' }}
            >
              {i === 0 ? '🏠 ' : ''}{bc.name}
            </Link>
          )
        ))}
      </Breadcrumbs>

      {/* Search */}
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
        <ToggleButtonGroup
          value={searchMode}
          exclusive
          onChange={(e, val) => { if (val) { setSearchMode(val); setSearch(''); setGlobalResults(null) } }}
          size="small"
        >
          <ToggleButton value="local">
            <Tooltip title="Szukaj w bieżącym folderze">
              <Search />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="global">
            <Tooltip title="Szukaj rekurencyjnie (wszystkie pliki)">
              <TravelExplore />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        <TextField
          fullWidth
          size="small"
          placeholder={searchMode === 'global' ? "np: .png AND matematyka dyskretna | kolokwium NOT poprawka" : "Szukaj w bieżącym folderze..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {searchMode === 'global' ? <TravelExplore color="primary" /> : <Search />}
              </InputAdornment>
            ),
          }}
        />
      </Stack>
      {searchMode === 'global' && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Operatory: <strong>AND</strong> (lub &amp;) — oba warunki · <strong>OR</strong> (lub |) — jeden z warunków · <strong>NOT</strong> (lub !) — wyklucz. Przykład: <em>.pdf AND algebra NOT poprawka</em>
        </Typography>
      )}

      {/* Global search results */}
      {searchMode === 'global' && search.length >= 2 && (
        <Paper variant="outlined" sx={{ mb: 3, maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
          {globalSearchLoading && <LinearProgress />}
          {globalResults && (
            <>
              <Box sx={{ p: 1.5, bgcolor: 'action.hover', flexShrink: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  🔍 Znaleziono <strong>{globalResults.total}</strong> wyników dla „{globalResults.query}"
                </Typography>
              </Box>
              <List disablePadding sx={{ overflow: 'auto', flexGrow: 1 }}>
                {globalResults.results.map((file) => (
                  <ListItem
                    key={file.rel}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, fontSize: 20 }}>
                      {file.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        file.previewable ? (
                          <Link
                            component="button"
                            underline="hover"
                            onClick={() => {
                              // Navigate to the file's folder and preview
                              const folderPath = file.path
                              navigate(folderPath ? `/browse/${folderPath}` : '/browse')
                            }}
                            sx={{ textAlign: 'left', fontWeight: 500 }}
                          >
                            {file.name}
                          </Link>
                        ) : (
                          <Link href={getDownloadUrl(file.rel)} underline="hover" sx={{ fontWeight: 500 }}>
                            {file.name}
                          </Link>
                        )
                      }
                      secondary={
                        <span>
                          <Typography component="span" variant="caption" color="text.secondary">
                            📂 {file.path || 'Główna'}
                          </Typography>
                          {' — '}{file.sizeFormatted}
                          {file.description && <> — {file.description}</>}
                          {file.semester && file.semester !== 'Ogólne' && (
                            <Chip label={file.semester} size="small" sx={{ ml: 1, height: 18, fontSize: '0.7rem' }} />
                          )}
                          {file.subject && file.subject !== 'Ogólne' && (
                            <Chip label={file.subject} size="small" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.7rem' }} />
                          )}
                        </span>
                      }
                    />
                    <Tooltip title="Pobierz">
                      <IconButton size="small" href={getDownloadUrl(file.rel)}>
                        <Download fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItem>
                ))}
                {globalResults.results.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="Brak wyników"
                      sx={{ textAlign: 'center', color: 'text.secondary' }}
                    />
                  </ListItem>
                )}
              </List>
            </>
          )}
          {!globalResults && !globalSearchLoading && search.length >= 2 && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Wpisz co najmniej 2 znaki aby wyszukać...
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Stats & Toolbar */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" gap={1}>
        <Typography variant="body2" color="text.secondary">
          📁 {data.dirs.length} folderów, 📄 {data.files.length} plików
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button size="small" startIcon={<SelectAll />} onClick={handleSelectAll}>
            {selected.size > 0 ? 'Odznacz' : 'Zaznacz'} wszystkie
          </Button>
          {selected.size > 0 && (
            <Button size="small" variant="contained" startIcon={<Download />} onClick={handleDownloadSelected}>
              Pobierz zaznaczone ({selected.size})
            </Button>
          )}
          {currentPath && (
            <Button
              size="small"
              variant="contained"
              color="secondary"
              startIcon={<Download />}
              onClick={() => handleDownloadFolder(currentPath)}
            >
              Pobierz folder (ZIP)
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Pending section (admin only) */}
      {data.isAdmin && (
        <PendingSection path={currentPath} onRefresh={loadData} />
      )}

      {/* File list */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <List disablePadding>
          {filteredDirs.map((dir) => (
            <ListItem
              key={dir.rel}
              button
              onClick={() => handleNavigate(dir.rel)}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: selected.has(dir.rel) ? 'action.selected' : 'inherit',
              }}
            >
              <Checkbox
                size="small"
                checked={selected.has(dir.rel)}
                onClick={(e) => { e.stopPropagation(); handleToggleSelect(dir.rel) }}
                sx={{ mr: 1 }}
              />
              <ListItemIcon sx={{ minWidth: 40 }}>
                <FolderIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={dir.name}
                secondary={`${dir.fileCount} plików`}
              />
              <Tooltip title="Pobierz ZIP">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleDownloadFolder(dir.rel) }}
                >
                  <Download fontSize="small" />
                </IconButton>
              </Tooltip>
              {data.isAdmin && (
                <Tooltip title="Zmień nazwę">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleRename(dir) }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {data.isAdmin && (
                <Tooltip title="Usuń folder">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(dir) }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </ListItem>
          ))}

          {filteredFiles.map((file) => (
            <ListItem
              key={file.rel}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: selected.has(file.rel) ? 'action.selected' : 'inherit',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Checkbox
                size="small"
                checked={selected.has(file.rel)}
                onChange={() => handleToggleSelect(file.rel)}
                sx={{ mr: 1 }}
              />
              <ListItemIcon sx={{ minWidth: 40, fontSize: 20 }}>
                {file.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  file.previewable ? (
                    <Link
                      component="button"
                      underline="hover"
                      onClick={() => handlePreview(file)}
                      sx={{ textAlign: 'left', fontWeight: 500 }}
                    >
                      {file.name}
                    </Link>
                  ) : (
                    <Link href={getDownloadUrl(file.rel)} underline="hover" sx={{ fontWeight: 500 }}>
                      {file.name}
                    </Link>
                  )
                }
                secondary={
                  <span>
                    {file.sizeFormatted}
                    {file.description && <> — {file.description}</>}
                  </span>
                }
              />
              <Tooltip title="Pobierz">
                <IconButton size="small" href={getDownloadUrl(file.rel)}>
                  <Download fontSize="small" />
                </IconButton>
              </Tooltip>
              {data.isAdmin && (
                <Tooltip title="Zmień nazwę">
                  <IconButton
                    size="small"
                    onClick={() => handleRename(file)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {data.isAdmin && (
                <Tooltip title="Usuń plik">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteFile(file)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </ListItem>
          ))}

          {filteredDirs.length === 0 && filteredFiles.length === 0 && (
            <ListItem>
              <ListItemText
                primary="Folder jest pusty"
                sx={{ textAlign: 'center', color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
      </Paper>

      {/* Upload & Create Folder section */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} divider={<Divider orientation="vertical" flexItem />}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>📤 Wrzuć pliki</Typography>
            <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setUploadOpen(true)}>
              Wybierz pliki
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
              Maks. 10 plików, 10 MB/plik. Pojawią się po zatwierdzeniu.
            </Typography>
            {data.githubPrUrl && (
              <Typography variant="caption" display="block" color="text.secondary">
                Możesz też dodać przez{' '}
                <Link href={data.githubPrUrl} target="_blank" rel="noopener">
                  <GitHub sx={{ fontSize: 14, verticalAlign: 'middle' }} /> Pull Request
                </Link>
              </Typography>
            )}
          </Box>
          <Box>
            <Typography variant="h6" gutterBottom>📁 Nowy folder</Typography>
            <Button variant="contained" color="secondary" startIcon={<CreateNewFolder />} onClick={() => setFolderOpen(true)}>
              Utwórz folder
            </Button>
          </Box>
        </Stack>
      </Paper>

      {/* Dialogs */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        targetPath={currentPath}
        onSuccess={() => { loadData(); showSnackbar('Pliki wysłane do zatwierdzenia') }}
      />
      <CreateFolderDialog
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        targetPath={currentPath}
        onSuccess={() => { loadData(); showSnackbar('Folder wysłany do zatwierdzenia') }}
      />
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        files={previewableFiles}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
      />
      <ZipProgressDialog
        open={zipDialogOpen}
        onClose={() => setZipDialogOpen(false)}
        jobId={zipJobId}
        totalFiles={zipTotalFiles}
      />

      {/* Back to top */}
      <Fab
        size="small"
        color="primary"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUpward />
      </Fab>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}
