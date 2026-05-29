import { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Container, Box, Breadcrumbs, Link, Typography, TextField, InputAdornment,
  List, ListItem, ListItemIcon, ListItemText, Menu, MenuItem,
  Checkbox, IconButton, Button, Paper, Snackbar, Alert, Tooltip, Chip,
  Fab, Divider, Stack, LinearProgress, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFile from '@mui/icons-material/InsertDriveFile'
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
import ExpandMore from '@mui/icons-material/ExpandMore'
import ViewList from '@mui/icons-material/ViewList'
import GridView from '@mui/icons-material/GridView'
import { fetchBrowse, fetchBrowseZip, searchFiles, getDownloadUrl, getViewUrl, adminDeleteFile, adminDeleteFolder, adminRename, prepareZipFolder, prepareZipSelected } from '../api'
import UploadDialog from '../components/UploadDialog'
import CreateFolderDialog from '../components/CreateFolderDialog'
import PreviewModal from '../components/PreviewModal'
import PendingSection from '../components/PendingSection'
import ZipProgressDialog from '../components/ZipProgressDialog'
import FileEntry from '../components/FileEntry'
import FileGridEntry from '../components/FileGridEntry'

// File type filter definitions
const FILE_TYPE_FILTERS = [
  { key: 'all', label: 'Wszystkie', exts: null },
  { key: 'pdf', label: '📄 PDF', exts: ['.pdf'] },
  { key: 'code', label: '💻 Kod', exts: ['.py','.java','.c','.cpp','.cs','.js','.ts','.html','.css','.h','.hpp','.asm','.s','.m','.sql','.rb','.php','.r','.kt','.swift','.go','.rs','.hs','.pl','.pro'] },
  { key: 'office', label: '📝 Office', exts: ['.docx','.doc','.pptx','.ppt','.xlsx','.xls','.odt','.odp','.ods'] },
  { key: 'image', label: '🖼️ Obrazy', exts: ['.jpg','.jpeg','.png','.gif','.bmp','.webp','.svg'] },
  { key: 'archive', label: '📦 Archiwa', exts: ['.zip','.rar','.7z'] },
  { key: 'text', label: '📋 Tekst', exts: ['.txt','.md','.csv','.log','.cfg','.ini'] },
  { key: 'media', label: '🎬 Media', exts: ['.mp4','.webm','.mov','.wav','.mp3','.ogg','.flac'] },
]

export default function BrowsePage() {
  const location = useLocation()
  const navigate = useNavigate()

  const currentPath = useMemo(() => {
    const p = location.pathname.replace(/^\/browse\/?/, '').replace(/^\//, '')
    return decodeURIComponent(p)
  }, [location.pathname])

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewFiles, setPreviewFiles] = useState([])
  const [zipDialogOpen, setZipDialogOpen] = useState(false)
  const [zipJobId, setZipJobId] = useState(null)
  const [zipTotalFiles, setZipTotalFiles] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [searchMode, setSearchMode] = useState('local') // 'local' or 'global'
  const [globalResults, setGlobalResults] = useState(null)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [filteredDirs, setFilteredDirs] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [visibleCount, setVisibleCount] = useState(20)
  const [typeFilter, setTypeFilter] = useState('all')
  const [breadcrumbAnchor, setBreadcrumbAnchor] = useState(null)
  const [breadcrumbMenuPath, setBreadcrumbMenuPath] = useState('')
  const [breadcrumbSubdirs, setBreadcrumbSubdirs] = useState([])
  const [dragging, setDragging] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('paczka-view-mode') || 'list')
  const dragCounter = useRef(0)
  const abortRef = useRef(null)

  // Debounce: inputValue -> search (keeps typing instant, delays filtering)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputValue), 200)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Deferred values — React can interrupt rendering these to keep input responsive
  const deferredDirs = useDeferredValue(filteredDirs)
  const deferredFiles = useDeferredValue(filteredFiles)

  const isZipPath = currentPath.match(/\.zip(\/|$)/i)

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const result = isZipPath ? await fetchBrowseZip(currentPath) : await fetchBrowse(currentPath)
      setData(result)
      if (!isRefresh) setSelected(new Set())
    } catch (err) {
      setSnackbar({ open: true, message: 'Błąd ładowania: ' + err.message, severity: 'error' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadData(false) }, [currentPath])

  // Global search with debounce + AbortController
  useEffect(() => {
    if (searchMode !== 'global' || !search || search.length < 2) {
      setGlobalResults(null)
      return
    }
    // Abort previous request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const timer = setTimeout(async () => {
      setGlobalSearchLoading(true)
      try {
        const result = await searchFiles(search, controller.signal)
        if (!controller.signal.aborted) {
          setGlobalResults(result)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSnackbar({ open: true, message: 'Błąd wyszukiwania: ' + err.message, severity: 'error' })
        }
      } finally {
        if (!controller.signal.aborted) {
          setGlobalSearchLoading(false)
        }
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, searchMode])

  // Local filtering with debounce (async, non-blocking)
  useEffect(() => {
    if (!data) { setFilteredDirs([]); setFilteredFiles([]); return }
    if (!search || searchMode === 'global') {
      setFilteredDirs(data.dirs)
      const filterExts = FILE_TYPE_FILTERS.find(f => f.key === typeFilter)?.exts
      if (filterExts) {
        setFilteredFiles(data.files.filter(f => filterExts.includes(f.ext?.toLowerCase())))
      } else {
        setFilteredFiles(data.files)
      }
      return
    }
    const timer = setTimeout(() => {
      const q = search.toLowerCase()
      setFilteredDirs(data.dirs.filter(d => d.name.toLowerCase().includes(q)))
      let files = data.files.filter(f => f.name.toLowerCase().includes(q))
      const filterExts = FILE_TYPE_FILTERS.find(f => f.key === typeFilter)?.exts
      if (filterExts) files = files.filter(f => filterExts.includes(f.ext?.toLowerCase()))
      setFilteredFiles(files)
    }, 150)
    return () => clearTimeout(timer)
  }, [data, search, searchMode, typeFilter])

  // Reset visible count when search changes
  useEffect(() => { setVisibleCount(20) }, [search, searchMode])

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

    // Determine which file list to use for the preview modal
    let fileList
    if (searchMode === 'global' && globalResults?.results) {
      fileList = globalResults.results.filter(f => f.previewable)
    } else if (data?.files) {
      fileList = data.files.filter(f => f.previewable)
    } else {
      fileList = []
    }

    const idx = fileList.findIndex(f => f.rel === file.rel)
    if (idx >= 0) {
      setPreviewFiles(fileList)
      setPreviewIndex(idx)
      setPreviewOpen(true)
    } else {
      // File not in current list — open as single file preview
      setPreviewFiles([file])
      setPreviewIndex(0)
      setPreviewOpen(true)
    }
  }

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Usunąć plik "${file.name}"?`)) return
    try {
      await adminDeleteFile(file.rel)
      showSnackbar('Plik usunięty')
      loadData(true)
    } catch (err) {
      showSnackbar('Błąd usuwania: ' + err.message, 'error')
    }
  }

  const handleDeleteFolder = async (dir) => {
    if (!window.confirm(`Usunąć folder "${dir.name}" i całą jego zawartość?`)) return
    try {
      await adminDeleteFolder(dir.rel)
      showSnackbar('Folder usunięty')
      loadData(true)
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
      loadData(true)
    } catch (err) {
      showSnackbar('Błąd zmiany nazwy: ' + err.message, 'error')
    }
  }

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }

  const handleCopyLink = () => {
    showSnackbar('Link skopiowany do schowka')
  }

  const handleViewModeChange = (_, val) => {
    if (val) {
      setViewMode(val)
      localStorage.setItem('paczka-view-mode', val)
    }
  }

  // Breadcrumb autocomplete: show subdirectories on click
  const handleBreadcrumbClick = async (e, bc) => {
    e.preventDefault()
    setBreadcrumbAnchor(e.currentTarget)
    setBreadcrumbMenuPath(bc.path)
    try {
      const result = await fetchBrowse(bc.path)
      setBreadcrumbSubdirs(result.dirs || [])
    } catch {
      setBreadcrumbSubdirs([])
    }
  }

  const handleBreadcrumbMenuClose = () => {
    setBreadcrumbAnchor(null)
    setBreadcrumbSubdirs([])
  }

  const handleBreadcrumbNavigate = (dirPath) => {
    handleBreadcrumbMenuClose()
    handleNavigate(dirPath)
  }

  // Drag & drop on page
  const handlePageDragEnter = (e) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true)
    }
  }

  const handlePageDragLeave = (e) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragging(false)
    }
  }

  const handlePageDragOver = (e) => {
    e.preventDefault()
  }

  const handlePageDrop = (e) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      setUploadOpen(true)
      // Pass files to upload dialog via a small delay to let it mount
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('paczka-drop-files', { detail: droppedFiles }))
      }, 100)
    }
  }

  if (loading && !data) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <LinearProgress />
      </Container>
    )
  }

  if (!data) return null

  return (
    <Container
      maxWidth="lg"
      sx={{ py: 3, position: 'relative' }}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <Box sx={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          bgcolor: 'rgba(25, 118, 210, 0.08)', border: '3px dashed',
          borderColor: 'primary.main', zIndex: 1200, display: 'flex',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 1 }} />
            <Typography variant="h6">Upuść pliki aby wrzucić</Typography>
          </Paper>
        </Box>
      )}

      {/* Refreshing indicator (non-blocking) */}
      {refreshing && <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1300 }} />}

      {/* Breadcrumb with autocomplete */}
      <Breadcrumbs sx={{ mb: 2 }}>
        {data.breadcrumb.map((bc, i) => (
          i === data.breadcrumb.length - 1 ? (
            <Typography key={i} color="text.primary" fontWeight={500}>
              {bc.name}
            </Typography>
          ) : (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
              <Link
                component="button"
                underline="hover"
                onClick={() => handleNavigate(bc.path)}
                sx={{ cursor: 'pointer' }}
              >
                {i === 0 ? '🏠 ' : ''}{bc.name}
              </Link>
              <IconButton
                size="small"
                onClick={(e) => handleBreadcrumbClick(e, bc)}
                sx={{ ml: 0.2, p: 0.2 }}
              >
                <ExpandMore sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          )
        ))}
      </Breadcrumbs>

      {/* Breadcrumb subdirectory menu */}
      <Menu
        anchorEl={breadcrumbAnchor}
        open={Boolean(breadcrumbAnchor)}
        onClose={handleBreadcrumbMenuClose}
        PaperProps={{ sx: { maxHeight: 300, minWidth: 200 } }}
      >
        <MenuItem onClick={() => handleBreadcrumbNavigate(breadcrumbMenuPath)}>
          <ListItemIcon><FolderIcon fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText primary="Otwórz ten folder" primaryTypographyProps={{ fontWeight: 500 }} />
        </MenuItem>
        <Divider />
        {breadcrumbSubdirs.length === 0 && (
          <MenuItem disabled><ListItemText primary="Brak podfolderów" /></MenuItem>
        )}
        {breadcrumbSubdirs.map(dir => (
          <MenuItem key={dir.rel} onClick={() => handleBreadcrumbNavigate(dir.rel)}>
            <ListItemIcon><FolderIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary={dir.name} />
          </MenuItem>
        ))}
      </Menu>

      {/* Search */}
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
        <ToggleButtonGroup
          value={searchMode}
          exclusive
          onChange={(e, val) => { if (val) { setSearchMode(val); setInputValue(''); setSearch(''); setGlobalResults(null) } }}
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
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
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

      {/* File type filter */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
        {FILE_TYPE_FILTERS.map(ft => (
          <Chip
            key={ft.key}
            label={ft.label}
            size="small"
            variant={typeFilter === ft.key ? 'filled' : 'outlined'}
            color={typeFilter === ft.key ? 'primary' : 'default'}
            onClick={() => setTypeFilter(ft.key === typeFilter ? 'all' : ft.key)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>

      {/* Global search results */}
      {searchMode === 'global' && search.length >= 2 && (
        <Paper variant="outlined" sx={{ mb: 3, maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
          {globalSearchLoading && <LinearProgress />}
          {globalResults && (
            <>
              <Box sx={{ p: 1.5, bgcolor: 'action.hover', flexShrink: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  <Search sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }} />Znaleziono <strong>{globalResults.total}</strong> wyników dla „{globalResults.query}"
                </Typography>
              </Box>
              <List disablePadding sx={{ overflow: 'auto', flexGrow: 1 }}>
                {globalResults.results.slice(0, visibleCount).map((file) => (
                  <FileEntry
                    key={file.rel}
                    file={file}
                    selected={selected.has(file.rel)}
                    onToggleSelect={() => handleToggleSelect(file.rel)}
                    onPreview={handlePreview}
                    onRename={handleRename}
                    onDelete={handleDeleteFile}
                    onCopyLink={handleCopyLink}
                    onNavigatePath={(p) => navigate(p ? `/browse/${p}` : '/browse')}
                    isAdmin={data?.isAdmin}
                    showPath
                  />
                ))}
                {globalResults.results.length > visibleCount && (
                  <ListItem sx={{ justifyContent: 'center' }}>
                    <Button onClick={() => setVisibleCount(v => v + 50)}>
                      Pokaż więcej ({globalResults.results.length - visibleCount} pozostało)
                    </Button>
                  </ListItem>
                )}
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
          <FolderIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }} />{data.dirs.length} folderów, <InsertDriveFile sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.5 }} />{data.files.length} plików
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
            <ToggleButton value="list"><Tooltip title="Widok listy"><ViewList /></Tooltip></ToggleButton>
            <ToggleButton value="grid"><Tooltip title="Widok siatki"><GridView /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
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
        <PendingSection path={currentPath} onRefresh={() => loadData(true)} />
      )}

      {/* File list / grid */}
      {viewMode === 'list' ? (
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <List disablePadding>
            {deferredDirs.map((dir) => (
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
                  secondary={dir.isZip || dir.isInZip ? (dir.isZip ? 'archiwum ZIP' : '') : `${dir.fileCount} plików`}
                />
                <Tooltip title="Pobierz ZIP">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); dir.isZip ? window.location.href = getDownloadUrl(dir.rel) : handleDownloadFolder(dir.rel) }}
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

            {deferredFiles.slice(0, visibleCount).map((file) => (
              <FileEntry
                key={file.rel}
                file={file}
                selected={selected.has(file.rel)}
                onToggleSelect={() => handleToggleSelect(file.rel)}
                onPreview={handlePreview}
                onRename={handleRename}
                onDelete={handleDeleteFile}
                onCopyLink={handleCopyLink}
                isAdmin={data.isAdmin}
              />
            ))}

            {deferredFiles.length > visibleCount && (
              <ListItem sx={{ justifyContent: 'center' }}>
                <Button onClick={() => setVisibleCount(v => v + 50)}>
                  Pokaż więcej ({deferredFiles.length - visibleCount} pozostało)
                </Button>
              </ListItem>
            )}

            {deferredDirs.length === 0 && deferredFiles.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="Folder jest pusty"
                  sx={{ textAlign: 'center', color: 'text.secondary' }}
                />
              </ListItem>
            )}
          </List>
        </Paper>
      ) : (
        /* Grid view */
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.5 }}>
            {deferredDirs.map((dir) => (
              <FileGridEntry
                key={dir.rel}
                file={dir}
                isDir
                selected={selected.has(dir.rel)}
                onToggleSelect={() => handleToggleSelect(dir.rel)}
                onNavigate={handleNavigate}
                onDownload={dir.isZip ? null : handleDownloadFolder}
                fileCount={dir.fileCount}
              />
            ))}
            {deferredFiles.slice(0, visibleCount).map((file) => (
              <FileGridEntry
                key={file.rel}
                file={file}
                selected={selected.has(file.rel)}
                onToggleSelect={() => handleToggleSelect(file.rel)}
                onPreview={handlePreview}
                onCopyLink={handleCopyLink}
              />
            ))}
          </Box>
          {deferredFiles.length > visibleCount && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button onClick={() => setVisibleCount(v => v + 50)}>
                Pokaż więcej ({deferredFiles.length - visibleCount} pozostało)
              </Button>
            </Box>
          )}
          {deferredDirs.length === 0 && deferredFiles.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Folder jest pusty
            </Typography>
          )}
        </Box>
      )}

      {/* Upload & Create Folder section */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} divider={<Divider orientation="vertical" flexItem />}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom><CloudUpload sx={{ fontSize: 20, verticalAlign: 'text-bottom', mr: 0.5 }} />Wrzuć pliki</Typography>
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
            <Typography variant="h6" gutterBottom><CreateNewFolder sx={{ fontSize: 20, verticalAlign: 'text-bottom', mr: 0.5 }} />Nowy folder</Typography>
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
        onSuccess={() => { loadData(true); showSnackbar('Pliki wysłane do zatwierdzenia') }}
      />
      <CreateFolderDialog
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        targetPath={currentPath}
        onSuccess={() => { loadData(true); showSnackbar('Folder wysłany do zatwierdzenia') }}
      />
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        files={previewFiles}
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
