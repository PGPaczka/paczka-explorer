import { memo } from 'react'
import { Box, Typography, IconButton, Tooltip, Paper, Checkbox } from '@mui/material'
import Download from '@mui/icons-material/Download'
import LinkIcon from '@mui/icons-material/Link'
import FolderIcon from '@mui/icons-material/Folder'
import FileIcon from './FileIcon'
import { getDownloadUrl, getViewUrl } from '../api'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'])

const FileGridEntry = memo(function FileGridEntry({
  file, selected = false, onToggleSelect, onPreview, onCopyLink, isDir = false, onNavigate,
  onDownload, fileCount,
}) {
  const dlUrl = !isDir ? (file.downloadUrl || getDownloadUrl(file.rel)) : null
  const isImage = !isDir && IMAGE_EXTS.has((file.ext || '').toLowerCase())
  const metadata = !isDir ? (file.metadata || null) : null

  const handleCopyLink = (e) => {
    e.stopPropagation()
    if (isDir) return
    const url = `${window.location.origin}/view/${file.rel.split('/').map(encodeURIComponent).join('/')}`
    navigator.clipboard.writeText(url).then(() => {
      onCopyLink?.(file)
    }).catch(() => {})
  }

  const handleClick = () => {
    if (isDir) {
      onNavigate?.(file.rel)
    } else if (file.previewable) {
      onPreview?.(file)
    }
  }

  return (
    <Paper
      variant="outlined"
      onClick={handleClick}
      sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        position: 'relative',
        minHeight: 100,
        transition: 'all 0.15s',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
      }}
    >
      {/* Checkbox */}
      <Checkbox
        size="small"
        checked={selected}
        onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
        sx={{ position: 'absolute', top: 2, left: 2, p: 0.3 }}
      />

      {/* Icon / Thumbnail */}
      <Box sx={{ mb: 0.5, mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 60 }}>
        {isDir ? (
          <FolderIcon sx={{ fontSize: 40 }} color="primary" />
        ) : isImage ? (
          <Box
            component="img"
            src={getViewUrl(file.rel)}
            alt={file.name}
            loading="lazy"
            sx={{
              maxWidth: '100%',
              maxHeight: 80,
              borderRadius: 1,
              objectFit: 'contain',
            }}
          />
        ) : (
          <FileIcon file={file} size={36} />
        )}
      </Box>

      {/* Name */}
      <Typography
        variant="caption"
        sx={{
          textAlign: 'center',
          wordBreak: 'break-word',
          lineHeight: 1.2,
          maxHeight: '2.4em',
          overflow: 'hidden',
          width: '100%',
          fontWeight: 500,
        }}
        title={file.name}
      >
        {file.name}
      </Typography>

      {/* Size / file count */}
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
        {isDir ? `${fileCount ?? 0} plików` : file.sizeFormatted}
      </Typography>
      {!isDir && metadata?.content_kind_extended && (
        <Typography variant="caption" color="primary" sx={{ fontSize: '0.65rem', mt: 0.3 }}>
          {metadata.content_kind_extended}
        </Typography>
      )}

      {/* Actions */}
      {!isDir && (
        <Box sx={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 0.2 }}>
          <Tooltip title="Kopiuj link">
            <IconButton size="small" onClick={handleCopyLink} sx={{ p: 0.3 }}>
              <LinkIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Pobierz">
            <IconButton size="small" href={dlUrl} onClick={(e) => e.stopPropagation()} sx={{ p: 0.3 }}>
              <Download sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      {isDir && onDownload && (
        <Box sx={{ position: 'absolute', top: 2, right: 2 }}>
          <Tooltip title="Pobierz ZIP">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDownload(file.rel) }} sx={{ p: 0.3 }}>
              <Download sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Paper>
  )
})

export default FileGridEntry
