import { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Container, Box, Breadcrumbs, Link, Typography, TextField, InputAdornment,
  List, ListItem, ListItemIcon, ListItemText, Menu, MenuItem,
  Checkbox, IconButton, Button, Paper, Snackbar, Alert, Tooltip,
  Fab, Divider, Stack, LinearProgress, ToggleButton, ToggleButtonGroup,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFile from '@mui/icons-material/InsertDriveFile'
import Download from '@mui/icons-material/Download'
import Search from '@mui/icons-material/Search'
import TravelExplore from '@mui/icons-material/TravelExplore'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import CloudUpload from '@mui/icons-material/CloudUpload'
import GitHub from '@mui/icons-material/GitHub'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMore from '@mui/icons-material/ExpandMore'
import ViewList from '@mui/icons-material/ViewList'
import GridView from '@mui/icons-material/GridView'
import Login from '@mui/icons-material/Login'
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined'
import SwapVert from '@mui/icons-material/SwapVert'
import Home from '@mui/icons-material/Home'
import { fetchBrowse, fetchBrowseZip, fetchAuthStatus, searchFiles, getDownloadUrl, getViewUrl, adminDeleteFile, adminDeleteFolder, adminRename, prepareZipFolder, prepareZipSelected } from '../api'
import UploadDialog from '../components/UploadDialog'
import PreviewModal from '../components/PreviewModal'
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
  const [isAdminLogged, setIsAdminLogged] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewFiles, setPreviewFiles] = useState([])
  const [zipDialogOpen, setZipDialogOpen] = useState(false)
  const [zipJobId, setZipJobId] = useState(null)
  const [zipTotalFiles, setZipTotalFiles] = useState(0)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success', link: '' })
  const [searchMode, setSearchMode] = useState('local') // 'local' or 'global'
  const [globalResults, setGlobalResults] = useState(null)
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [filteredDirs, setFilteredDirs] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [visibleCount, setVisibleCount] = useState(20)
  const [typeFilters, setTypeFilters] = useState(() => FILE_TYPE_FILTERS.filter(f => f.key !== 'all').map(f => f.key))
  const [breadcrumbAnchor, setBreadcrumbAnchor] = useState(null)
  const [breadcrumbMenuPath, setBreadcrumbMenuPath] = useState('')
  const [breadcrumbSubdirs, setBreadcrumbSubdirs] = useState([])
  const [dragging, setDragging] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('paczka-view-mode') || 'list')
  const [sortBy, setSortBy] = useState('name') // 'name' | 'size' | 'type'
  const [sortDir, setSortDir] = useState('asc') // 'asc' | 'desc'
  const [filterAnchor, setFilterAnchor] = useState(null)
  const [sortAnchor, setSortAnchor] = useState(null)
  const [breadcrumbMaxItems, setBreadcrumbMaxItems] = useState(3)
  const dragCounter = useRef(0)
  const abortRef = useRef(null)
  const breadcrumbContainerRef = useRef(null)
  const pathHistoryRef = useRef([currentPath])
  const historyIndexRef = useRef(0)
  const historyActionRef = useRef(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const filterDefinitions = useMemo(() => FILE_TYPE_FILTERS.filter(f => f.key !== 'all'), [])
  const allFilterKeys = useMemo(() => filterDefinitions.map(f => f.key), [filterDefinitions])
  const filterExtByKey = useMemo(
    () => new Map(filterDefinitions.map(f => [f.key, f.exts || []])),
    [filterDefinitions],
  )
  const filterLabelByKey = useMemo(
    () => new Map(filterDefinitions.map(f => [f.key, f.label])),
    [filterDefinitions],
  )

  // Debounce: inputValue -> search (keeps typing instant, delays filtering)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputValue), 200)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Deferred values — React can interrupt rendering these to keep input responsive
  const deferredDirs = useDeferredValue(filteredDirs)
  const deferredFiles = useDeferredValue(filteredFiles)

  const isZipPath = currentPath.match(/\.zip(\/|$)/i)
  const getZipRootPath = (p) => {
    if (!p) return null
    const m = p.match(/^(.+\.zip)(\/.*)?$/i)
    return m ? m[1] : null
  }

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

  const syncHistoryButtons = () => {
    setCanGoBack(historyIndexRef.current > 0)
    setCanGoForward(historyIndexRef.current < pathHistoryRef.current.length - 1)
  }

  useEffect(() => {
    const action = historyActionRef.current
    if (action === 'back' || action === 'forward') {
      historyActionRef.current = null
      syncHistoryButtons()
      return
    }

    const stack = pathHistoryRef.current
    const idx = historyIndexRef.current
    if (stack[idx] === currentPath) {
      syncHistoryButtons()
      return
    }

    const nextStack = stack.slice(0, idx + 1)
    if (nextStack[nextStack.length - 1] !== currentPath) {
      nextStack.push(currentPath)
    }
    pathHistoryRef.current = nextStack
    historyIndexRef.current = nextStack.length - 1
    syncHistoryButtons()
  }, [currentPath])

  useEffect(() => {
    let cancelled = false
    const loadAuthStatus = async () => {
      try {
        const { isAdmin } = await fetchAuthStatus()
        if (!cancelled) setIsAdminLogged(Boolean(isAdmin))
      } catch {
        if (!cancelled) setIsAdminLogged(false)
      }
    }
    loadAuthStatus()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = breadcrumbContainerRef.current
    if (!el || !data?.breadcrumb) return

    const updateBreadcrumbLayout = () => {
      const width = el.clientWidth || 0
      const totalChars = data.breadcrumb.reduce((acc, seg) => acc + (seg.name?.length || 0), 0)
      const segments = data.breadcrumb.length
      // Rough text+separator estimate good enough for responsive collapse decision.
      const estimatedWidth = totalChars * 7 + segments * 42
      setBreadcrumbMaxItems(estimatedWidth > width ? 3 : segments)
    }

    updateBreadcrumbLayout()
    const observer = new ResizeObserver(updateBreadcrumbLayout)
    observer.observe(el)
    window.addEventListener('resize', updateBreadcrumbLayout)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateBreadcrumbLayout)
    }
  }, [data?.breadcrumb])

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

    const sortFiles = (files) => {
      const sorted = [...files]
      sorted.sort((a, b) => {
        let cmp = 0
        if (sortBy === 'name') {
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        } else if (sortBy === 'size') {
          cmp = (a.size || 0) - (b.size || 0)
        } else if (sortBy === 'type') {
          cmp = (a.ext || '').localeCompare(b.ext || '') || a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        }
        return sortDir === 'desc' ? -cmp : cmp
      })
      return sorted
    }

    const sortDirs = (dirs) => {
      if (sortBy === 'name') {
        const sorted = [...dirs]
        sorted.sort((a, b) => {
          const cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          return sortDir === 'desc' ? -cmp : cmp
        })
        return sorted
      }
      return dirs
    }

    const filterFilesByType = (files) => {
      if (typeFilters.length === filterDefinitions.length) return files
      if (typeFilters.length === 0) return []
      const allowedExts = new Set(typeFilters.flatMap(key => filterExtByKey.get(key) || []))
      return files.filter(f => allowedExts.has((f.ext || '').toLowerCase()))
    }

    if (!search || searchMode === 'global') {
      setFilteredDirs(sortDirs(data.dirs))
      setFilteredFiles(sortFiles(filterFilesByType(data.files)))
      return
    }
    const timer = setTimeout(() => {
      const q = search.toLowerCase()
      let dirs = data.dirs.filter(d => d.name.toLowerCase().includes(q))
      let files = data.files.filter(f => f.name.toLowerCase().includes(q))
      files = filterFilesByType(files)
      setFilteredDirs(sortDirs(dirs))
      setFilteredFiles(sortFiles(files))
    }, 150)
    return () => clearTimeout(timer)
  }, [data, search, searchMode, typeFilters, sortBy, sortDir, filterExtByKey, filterDefinitions.length])

  // Reset visible count when search changes
  useEffect(() => { setVisibleCount(20) }, [search, searchMode])

  const currentFolderRels = useMemo(() => {
    if (!data) return []
    return [...data.dirs.map(d => d.rel), ...data.files.map(f => f.rel)]
  }, [data])

  const currentFolderSelectedCount = useMemo(
    () => currentFolderRels.reduce((acc, rel) => acc + (selected.has(rel) ? 1 : 0), 0),
    [currentFolderRels, selected],
  )
  const hasActiveTypeFilter = typeFilters.length !== filterDefinitions.length
  const hasActiveSearchOrFilter = hasActiveTypeFilter || (searchMode === 'local' && search.trim().length > 0)
  const emptyStateText = hasActiveSearchOrFilter
    ? 'Nie ma plików spełniających kryteria wyszukiwania'
    : 'Folder jest pusty'
  const activeFilterLabel = useMemo(() => {
    if (typeFilters.length === filterDefinitions.length) return 'Wszystkie'
    if (typeFilters.length === 0) return 'Brak'
    if (typeFilters.length === 1) return filterLabelByKey.get(typeFilters[0]) || 'Wszystkie'
    return `${typeFilters.length} typy`
  }, [typeFilters, filterLabelByKey, filterDefinitions.length])
  const sortByLabel = sortBy === 'size' ? 'Rozmiar' : sortBy === 'type' ? 'Typ' : 'Nazwa'

  const handleNavigate = (path) => {
    const encodedPath = path ? path.split('/').map(encodeURIComponent).join('/') : ''
    navigate(encodedPath ? `/browse/${encodedPath}` : '/browse')
  }

  const handleNavigateUp = () => {
    const segments = currentPath.split('/').filter(Boolean)
    if (!segments.length) return
    handleNavigate(segments.slice(0, -1).join('/'))
  }

  const handleHistoryBack = () => {
    if (historyIndexRef.current <= 0) return
    historyActionRef.current = 'back'
    historyIndexRef.current -= 1
    syncHistoryButtons()
    handleNavigate(pathHistoryRef.current[historyIndexRef.current] || '')
  }

  const handleHistoryForward = () => {
    if (historyIndexRef.current >= pathHistoryRef.current.length - 1) return
    historyActionRef.current = 'forward'
    historyIndexRef.current += 1
    syncHistoryButtons()
    handleNavigate(pathHistoryRef.current[historyIndexRef.current] || '')
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
    if (!currentFolderRels.length) return
    setSelected(prev => {
      const next = new Set(prev)
      const allSelectedInCurrentFolder = currentFolderRels.every(rel => next.has(rel))
      if (allSelectedInCurrentFolder) {
        for (const rel of currentFolderRels) next.delete(rel)
      } else {
        for (const rel of currentFolderRels) next.add(rel)
      }
      return next
    })
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
    const zipRootPath = getZipRootPath(folderPath)
    if (zipRootPath) {
      window.location.href = getDownloadUrl(zipRootPath)
      return
    }
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

  const showSnackbar = (message, severity = 'success', link = '') => {
    setSnackbar({ open: true, message, severity, link })
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

  const handleFilterClick = (e) => {
    setFilterAnchor(e.currentTarget)
  }

  const handleFilterClose = () => {
    setFilterAnchor(null)
  }

  const handleSortClick = (e) => {
    setSortAnchor(e.currentTarget)
  }

  const handleSortClose = () => {
    setSortAnchor(null)
  }

  const handleFilterSelect = (key) => {
    const allChecked = typeFilters.length === filterDefinitions.length
    if (key === 'all') {
      setTypeFilters(allChecked ? [] : allFilterKeys)
      return
    }
    setTypeFilters(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      return [...prev, key]
    })
  }

  const handleSortBySelect = (key) => {
    setSortBy(key)
    handleSortClose()
  }

  const handleSortDirSelect = (dir) => {
    setSortDir(dir)
    handleSortClose()
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

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h5" fontWeight={600}>Paczka INFA</Typography>
        <Button
          variant="outlined"
          startIcon={<Login />}
          onClick={() => navigate('/admin')}
        >
          {isAdminLogged ? 'Panel admina' : 'Zaloguj się'}
        </Button>
      </Stack>

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
                  onNavigatePath={handleNavigate}
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
          <Tooltip title={activeFilterLabel === 'Wszystkie' ? 'Filtry' : `Filtry: ${activeFilterLabel}`}>
            <IconButton
              size="small"
              onClick={handleFilterClick}
              color={hasActiveTypeFilter ? 'primary' : 'default'}
            >
              <FilterAltOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={`Sortowanie: ${sortByLabel} (${sortDir === 'asc' ? 'rosnąco' : 'malejąco'})`}>
            <IconButton
              size="small"
              onClick={handleSortClick}
              color={sortBy !== 'name' || sortDir !== 'asc' ? 'primary' : 'default'}
            >
              <SwapVert fontSize="small" />
            </IconButton>
          </Tooltip>

          <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
            <ToggleButton value="list"><Tooltip title="Widok listy"><ViewList /></Tooltip></ToggleButton>
            <ToggleButton value="grid"><Tooltip title="Widok siatki"><GridView /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
          {selected.size > 0 && (
            <Button size="small" variant="contained" startIcon={<Download />} onClick={handleDownloadSelected}>
              Pobierz ({selected.size})
            </Button>
          )}
        </Stack>
      </Stack>

      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={handleFilterClose}
        disableScrollLock
        PaperProps={{ sx: { minWidth: 220 } }}
      >
        {(() => {
          const allChecked = typeFilters.length === filterDefinitions.length
          return (
            <>
        {FILE_TYPE_FILTERS.map(ft => (
          <MenuItem
            key={ft.key}
            selected={ft.key === 'all' ? allChecked : typeFilters.includes(ft.key)}
            onClick={() => handleFilterSelect(ft.key)}
          >
            <Checkbox
              size="small"
              checked={ft.key === 'all' ? allChecked : typeFilters.includes(ft.key)}
              sx={{ mr: 1 }}
            />
            {ft.label}
          </MenuItem>
        ))}
            </>
          )
        })()}
      </Menu>

      <Menu
        anchorEl={sortAnchor}
        open={Boolean(sortAnchor)}
        onClose={handleSortClose}
        disableScrollLock
        PaperProps={{ sx: { minWidth: 220 } }}
      >
        <MenuItem selected={sortBy === 'name'} onClick={() => handleSortBySelect('name')}>
          <Checkbox size="small" checked={sortBy === 'name'} sx={{ mr: 1 }} />
          Nazwa
        </MenuItem>
        <MenuItem selected={sortBy === 'size'} onClick={() => handleSortBySelect('size')}>
          <Checkbox size="small" checked={sortBy === 'size'} sx={{ mr: 1 }} />
          Rozmiar
        </MenuItem>
        <MenuItem selected={sortBy === 'type'} onClick={() => handleSortBySelect('type')}>
          <Checkbox size="small" checked={sortBy === 'type'} sx={{ mr: 1 }} />
          Typ
        </MenuItem>
        <Divider />
        <MenuItem selected={sortDir === 'asc'} onClick={() => handleSortDirSelect('asc')}>
          <Checkbox size="small" checked={sortDir === 'asc'} sx={{ mr: 1 }} />
          Rosnąco
        </MenuItem>
        <MenuItem selected={sortDir === 'desc'} onClick={() => handleSortDirSelect('desc')}>
          <Checkbox size="small" checked={sortDir === 'desc'} sx={{ mr: 1 }} />
          Malejąco
        </MenuItem>
      </Menu>

      {/* Navigation arrows + breadcrumb inline */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Tooltip title="Wstecz">
            <span>
              <IconButton size="small" onClick={handleHistoryBack} disabled={!canGoBack}>
                <ArrowBack fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Dalej">
            <span>
              <IconButton size="small" onClick={handleHistoryForward} disabled={!canGoForward}>
                <ArrowForward fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Katalog wyżej">
            <span>
              <IconButton size="small" onClick={handleNavigateUp} disabled={!currentPath}>
                <ArrowUpward fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Box ref={breadcrumbContainerRef} sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <Breadcrumbs
            maxItems={breadcrumbMaxItems}
            itemsBeforeCollapse={1}
            itemsAfterCollapse={1}
            sx={{
              whiteSpace: 'nowrap',
              '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
            }}
          >
            {data.breadcrumb.map((bc, i) => (
              i === data.breadcrumb.length - 1 ? (
                <Typography
                  key={i}
                  color="text.primary"
                  fontWeight={500}
                  noWrap
                  title={bc.name}
                  sx={{ maxWidth: { xs: 120, sm: 240 } }}
                >
                  {bc.name}
                </Typography>
              ) : (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <Link
                    component="button"
                    underline="hover"
                    onClick={() => handleNavigate(bc.path)}
                    sx={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      minWidth: 0,
                      maxWidth: { xs: 80, sm: 160 },
                    }}
                    title={bc.name}
                  >
                    {i === 0 ? <Home sx={{ fontSize: 18 }} /> : (
                      <Box
                        component="span"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {bc.name}
                      </Box>
                    )}
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
        </Box>
      </Stack>

      {/* Current folder header with actions */}
      <Paper variant="outlined" sx={{ mb: 1 }}>
        <List disablePadding>
          <ListItem
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Checkbox
              size="small"
              checked={currentFolderRels.length > 0 && currentFolderSelectedCount === currentFolderRels.length}
              indeterminate={currentFolderSelectedCount > 0 && currentFolderSelectedCount < currentFolderRels.length}
              onChange={handleSelectAll}
              sx={{ mr: 1 }}
            />
            <ListItemIcon sx={{ minWidth: 40 }}>
              <FolderIcon color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={currentPath ? currentPath.split('/').filter(Boolean).slice(-1)[0] : 'Główna'}
              secondary={`${data.dirs.length} folderów, ${data.files.length} plików`}
            />
            <Tooltip title="Pobierz">
              <IconButton
                size="small"
                onClick={() => handleDownloadFolder(currentPath || '')}
              >
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
          </ListItem>
        </List>
      </Paper>

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
                  primary={emptyStateText}
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
                onDownload={handleDownloadFolder}
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
              {emptyStateText}
            </Typography>
          )}
        </Box>
      )}

      {/* Upload section */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Box flex={1}>
            <Typography variant="h6" gutterBottom><CloudUpload sx={{ fontSize: 20, verticalAlign: 'text-bottom', mr: 0.5 }} />Wrzuć pliki</Typography>
            <Button variant="contained" startIcon={<CloudUpload />} onClick={() => setUploadOpen(true)}>
              Wybierz pliki
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
              Maks. 10 plików, 10 MB/plik. Dla uploadu tworzony jest Pull Request.
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
        </Stack>
      </Paper>

      {/* Dialogs */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        targetPath={currentPath}
        onSuccess={(result) => {
          loadData(true)
          if (result?.pr_url) {
            showSnackbar('Utworzono pull request dla uploadu.', 'success', result.pr_url)
          } else {
            showSnackbar(result?.message || 'Pliki wysłane pomyślnie')
          }
        }}
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
          <Box>
            <Typography variant="body2">{snackbar.message}</Typography>
            {snackbar.link ? (
              <Link href={snackbar.link} target="_blank" rel="noopener" underline="hover">
                Otwórz PR
              </Link>
            ) : null}
          </Box>
        </Alert>
      </Snackbar>
    </Container>
  )
}
