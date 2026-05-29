import PictureAsPdf from '@mui/icons-material/PictureAsPdf'
import Image from '@mui/icons-material/Image'
import Description from '@mui/icons-material/Description'
import Code from '@mui/icons-material/Code'
import TableChart from '@mui/icons-material/TableChart'
import Slideshow from '@mui/icons-material/Slideshow'
import Archive from '@mui/icons-material/Archive'
import TextSnippet from '@mui/icons-material/TextSnippet'
import DataObject from '@mui/icons-material/DataObject'
import Link from '@mui/icons-material/Link'
import YouTube from '@mui/icons-material/YouTube'
import GitHub from '@mui/icons-material/GitHub'
import Forum from '@mui/icons-material/Forum'
import School from '@mui/icons-material/School'
import Cloud from '@mui/icons-material/Cloud'
import InsertDriveFile from '@mui/icons-material/InsertDriveFile'

const EXT_ICON_MAP = {
  // PDF
  '.pdf': { icon: PictureAsPdf, color: '#e53935' },
  // Images
  '.jpg': { icon: Image, color: '#43a047' },
  '.jpeg': { icon: Image, color: '#43a047' },
  '.png': { icon: Image, color: '#43a047' },
  '.gif': { icon: Image, color: '#43a047' },
  '.bmp': { icon: Image, color: '#43a047' },
  '.webp': { icon: Image, color: '#43a047' },
  '.svg': { icon: Image, color: '#43a047' },
  // Office - docs
  '.docx': { icon: Description, color: '#1565c0' },
  '.doc': { icon: Description, color: '#1565c0' },
  '.odt': { icon: Description, color: '#1565c0' },
  // Office - spreadsheets
  '.xlsx': { icon: TableChart, color: '#2e7d32' },
  '.xls': { icon: TableChart, color: '#2e7d32' },
  '.ods': { icon: TableChart, color: '#2e7d32' },
  '.csv': { icon: TableChart, color: '#2e7d32' },
  // Office - presentations
  '.pptx': { icon: Slideshow, color: '#e65100' },
  '.ppt': { icon: Slideshow, color: '#e65100' },
  '.odp': { icon: Slideshow, color: '#e65100' },
  // Archives
  '.zip': { icon: Archive, color: '#6d4c41' },
  '.rar': { icon: Archive, color: '#6d4c41' },
  '.7z': { icon: Archive, color: '#6d4c41' },
  '.tar': { icon: Archive, color: '#6d4c41' },
  '.gz': { icon: Archive, color: '#6d4c41' },
  // Code
  '.py': { icon: Code, color: '#fbc02d' },
  '.java': { icon: Code, color: '#f44336' },
  '.c': { icon: Code, color: '#5c6bc0' },
  '.cpp': { icon: Code, color: '#5c6bc0' },
  '.cs': { icon: Code, color: '#7b1fa2' },
  '.js': { icon: Code, color: '#fbc02d' },
  '.ts': { icon: Code, color: '#1976d2' },
  '.html': { icon: Code, color: '#e65100' },
  '.css': { icon: Code, color: '#1565c0' },
  '.go': { icon: Code, color: '#00acc1' },
  '.rs': { icon: Code, color: '#e65100' },
  '.rb': { icon: Code, color: '#c62828' },
  '.php': { icon: Code, color: '#5c6bc0' },
  '.swift': { icon: Code, color: '#e65100' },
  '.kt': { icon: Code, color: '#7b1fa2' },
  '.asm': { icon: Code, color: '#455a64' },
  '.h': { icon: Code, color: '#5c6bc0' },
  '.sql': { icon: DataObject, color: '#00838f' },
  // Text/data
  '.txt': { icon: TextSnippet, color: '#546e7a' },
  '.md': { icon: Description, color: '#37474f' },
  '.json': { icon: DataObject, color: '#fbc02d' },
  '.xml': { icon: DataObject, color: '#e65100' },
  '.yml': { icon: DataObject, color: '#c62828' },
  '.yaml': { icon: DataObject, color: '#c62828' },
  // Links
  '.url': { icon: Link, color: '#1565c0' },
  '.webloc': { icon: Link, color: '#1565c0' },
}

const SERVICE_ICON_MAP = {
  youtube: { icon: YouTube, color: '#f44336' },
  github: { icon: GitHub, color: '#333' },
  discord: { icon: Forum, color: '#5865f2' },
  gdrive: { icon: Cloud, color: '#1976d2' },
  gdocs: { icon: Description, color: '#1976d2' },
  stackoverflow: { icon: School, color: '#f48024' },
  wikipedia: { icon: School, color: '#333' },
  facebook: { icon: Forum, color: '#1877f2' },
  web: { icon: Link, color: '#1565c0' },
}

export default function FileIcon({ file, sx = {} }) {
  // Link files — use service-specific icon
  if (file.previewType === 'link' && file.linkService) {
    const service = SERVICE_ICON_MAP[file.linkService] || SERVICE_ICON_MAP.web
    const Icon = service.icon
    return <Icon sx={{ color: service.color, fontSize: 22, ...sx }} />
  }

  // Regular files — use extension-based icon
  const ext = (file.ext || '').toLowerCase()
  const mapping = EXT_ICON_MAP[ext]
  if (mapping) {
    const Icon = mapping.icon
    return <Icon sx={{ color: mapping.color, fontSize: 22, ...sx }} />
  }

  return <InsertDriveFile sx={{ color: '#78909c', fontSize: 22, ...sx }} />
}
