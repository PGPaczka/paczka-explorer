import { memo } from 'react'
import {
  ListItem, ListItemIcon, ListItemText, Checkbox, IconButton, Link, Tooltip, Chip,
  Typography,
} from '@mui/material'
import Download from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import Visibility from '@mui/icons-material/Visibility'
import FolderOpen from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import FileIcon from './FileIcon'
import { getDownloadUrl, getViewUrl } from '../api'

/**
 * Unified file entry row used in both folder view and search results.
 *
 * Props:
 * - file: file object from API
 * - selected: boolean
 * - onToggleSelect: () => void
 * - onPreview: (file) => void
 * - onRename: (file) => void (optional, admin only)
 * - onDelete: (file) => void (optional, admin only)
 * - onCopyLink: (file) => void (optional, copy link handler)
 * - onNavigatePath: (path) => void (optional, for search results path click)
 * - isAdmin: boolean
 * - showPath: boolean (show folder path in secondary, for search results)
 * - extraActions: ReactNode (extra action buttons)
 * - hideDownload: boolean (hide download button)
 * - hideCheckbox: boolean (hide checkbox)
 */
const FileEntry = memo(function FileEntry({
  file, selected = false, onToggleSelect, onPreview, onRename, onDelete, onNavigatePath, onCopyLink,
  isAdmin = false, showPath = false, extraActions, hideDownload = false, hideCheckbox = false,
}) {
  const dlUrl = file.downloadUrl || getDownloadUrl(file.rel)
  const metadata = file.metadata || null

  const handleCopyLink = () => {
    const url = `${window.location.origin}/view/${file.rel.split('/').map(encodeURIComponent).join('/')}`
    navigator.clipboard.writeText(url).then(() => {
      onCopyLink?.(file)
    }).catch(() => {})
  }
  return (
    <ListItem
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'inherit',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {!hideCheckbox && (
        <Checkbox
          size="small"
          checked={selected}
          onChange={() => onToggleSelect?.()}
          sx={{ mr: 1 }}
        />
      )}
      <ListItemIcon sx={{ minWidth: 40 }}>
        <FileIcon file={file} />
      </ListItemIcon>
      <ListItemText
        sx={{ minWidth: 0 }}
        primary={
          file.previewable ? (
            <Link
              component="button"
              underline="hover"
              onClick={() => onPreview?.(file)}
              sx={{ textAlign: 'left', fontWeight: 500, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}
            >
              {file.name}
            </Link>
          ) : (
            <Link
              href={dlUrl}
              underline="hover"
              sx={{ fontWeight: 500, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }}
            >
              {file.name}
            </Link>
          )
        }
        secondary={
          <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {showPath && (
              <>
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  color="text.secondary"
                  onClick={() => onNavigatePath?.(file.path || '')}
                  sx={{ verticalAlign: 'baseline', overflowWrap: 'anywhere', wordBreak: 'break-word', textAlign: 'left' }}
                >
                  <FolderOpen sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.3 }} />{file.path || 'Główna'}
                </Link>
                {' — '}
              </>
            )}
            {file.sizeFormatted}
            {file.description && <> — {file.description}</>}
            {metadata?.content_kind_extended && (
              <Chip
                label={metadata.content_kind_extended}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
              />
            )}
            {showPath && file.semester && file.semester !== 'Ogólne' && (
              <Chip label={file.semester} size="small" sx={{ ml: 1, height: 18, fontSize: '0.7rem' }} />
            )}
            {showPath && file.subject && file.subject !== 'Ogólne' && (
              <Chip label={file.subject} size="small" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.7rem' }} />
            )}
            {metadata?.date && (
              <>
                <Chip
                  label={metadata.date}
                  size="small"
                  variant="outlined"
                  sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
                />
              </>
            )}
            {metadata?.short_summary && (
              <>
                <br />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                >
                  {metadata.short_summary}
                </Typography>
              </>
            )}
          </span>
        }
        primaryTypographyProps={{ component: 'div', sx: { whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' } }}
        secondaryTypographyProps={{ component: 'div', sx: { whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word' } }}
      />
      {file.previewable && (
        <Tooltip title="Podgląd">
          <IconButton size="small" onClick={() => onPreview?.(file)}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {!hideDownload && (
        <Tooltip title="Pobierz">
          <IconButton size="small" href={dlUrl}>
            <Download fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Kopiuj link">
        <IconButton size="small" onClick={handleCopyLink}>
          <LinkIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {isAdmin && onRename && (
        <Tooltip title="Zmień nazwę">
          <IconButton size="small" onClick={() => onRename(file)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {isAdmin && onDelete && (
        <Tooltip title="Usuń plik">
          <IconButton size="small" color="error" onClick={() => onDelete(file)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {extraActions}
    </ListItem>
  )
})

export default FileEntry
