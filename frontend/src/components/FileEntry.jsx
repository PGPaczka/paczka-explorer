import {
  ListItem, ListItemIcon, ListItemText, Checkbox, IconButton, Link, Tooltip, Chip, Typography,
} from '@mui/material'
import Download from '@mui/icons-material/Download'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import Visibility from '@mui/icons-material/Visibility'
import FolderOpen from '@mui/icons-material/FolderOpen'
import FileIcon from './FileIcon'
import { getDownloadUrl } from '../api'

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
 * - onNavigatePath: (path) => void (optional, for search results path click)
 * - isAdmin: boolean
 * - showPath: boolean (show folder path in secondary, for search results)
 */
export default function FileEntry({
  file, selected = false, onToggleSelect, onPreview, onRename, onDelete, onNavigatePath, isAdmin = false, showPath = false,
}) {
  return (
    <ListItem
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'inherit',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Checkbox
        size="small"
        checked={selected}
        onChange={() => onToggleSelect?.()}
        sx={{ mr: 1 }}
      />
      <ListItemIcon sx={{ minWidth: 40 }}>
        <FileIcon file={file} />
      </ListItemIcon>
      <ListItemText
        primary={
          file.previewable ? (
            <Link
              component="button"
              underline="hover"
              onClick={() => onPreview?.(file)}
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
            {showPath && (
              <>
                <Link
                  component="button"
                  variant="caption"
                  underline="hover"
                  color="text.secondary"
                  onClick={() => onNavigatePath?.(file.path || '')}
                  sx={{ verticalAlign: 'baseline' }}
                >
                  <FolderOpen sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.3 }} />{file.path || 'Główna'}
                </Link>
                {' — '}
              </>
            )}
            {file.sizeFormatted}
            {file.description && <> — {file.description}</>}
            {showPath && file.semester && file.semester !== 'Ogólne' && (
              <Chip label={file.semester} size="small" sx={{ ml: 1, height: 18, fontSize: '0.7rem' }} />
            )}
            {showPath && file.subject && file.subject !== 'Ogólne' && (
              <Chip label={file.subject} size="small" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: '0.7rem' }} />
            )}
          </span>
        }
      />
      {file.previewable && (
        <Tooltip title="Podgląd">
          <IconButton size="small" onClick={() => onPreview?.(file)}>
            <Visibility fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Pobierz">
        <IconButton size="small" href={getDownloadUrl(file.rel)}>
          <Download fontSize="small" />
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
    </ListItem>
  )
}
