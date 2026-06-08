import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppBar, Toolbar, Tabs, Tab, Box, Container, IconButton, Tooltip, Typography } from '@mui/material'
import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import FolderIcon from '@mui/icons-material/Folder'
import SearchIcon from '@mui/icons-material/Search'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import InstallMobileIcon from '@mui/icons-material/InstallMobile'
import { useThemeMode } from '../ThemeContext'

let deferredPrompt = null

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, toggleMode } = useThemeMode()
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      deferredPrompt = e
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Hide button if app is already installed
    window.addEventListener('appinstalled', () => {
      setCanInstall(false)
      deferredPrompt = null
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setCanInstall(false)
    }
    deferredPrompt = null
  }

  const tabs = [
    { label: 'Przeglądaj', path: '/', icon: SearchIcon },
    { label: 'MCP Server', path: '/mcp-server', icon: SmartToyIcon },
    { label: 'Jak dodawać', path: '/how-to-add', icon: CloudUploadIcon },
    { label: 'Admin', path: '/admin', icon: AdminPanelSettingsIcon },
  ]

  // Determine current tab based on location
  const getTabValue = () => {
    const pathname = location.pathname
    if (pathname === '/mcp-server') return 1
    if (pathname === '/how-to-add') return 2
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return 3
    return 0  // Przeglądaj (/ lub /browse/...)
  }

  const handleTabChange = (event, newValue) => {
    navigate(tabs[newValue].path)
  }

  return (
    <AppBar 
      position="sticky" 
      color="default" 
      elevation={2}
      sx={{ 
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderBottomColor: 'divider'
      }}
    >
      <Container maxWidth="lg" disableGutters>
        <Toolbar 
          disableGutters 
          sx={{ 
            justifyContent: 'space-between', 
            minHeight: { xs: 48, sm: 56 },
            px: { xs: 1, sm: 2 },
            gap: 2
          }}
        >
          {/* Logo/Branding Section */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 },
              transition: 'opacity 0.2s'
            }}
            onClick={() => navigate('/')}
          >
            <FolderIcon sx={{ fontSize: { xs: 20, sm: 24 }, color: 'primary.main' }} />
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 700,
                fontSize: { xs: '0.9rem', sm: '1.1rem' },
                color: 'primary.main',
                display: { xs: 'none', sm: 'block' }
              }}
            >
              Paczka
            </Typography>
          </Box>

          {/* Navigation Tabs */}
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
            <Tabs
              value={getTabValue()}
              onChange={handleTabChange}
              sx={{ 
                minHeight: { xs: 48, sm: 56 },
                '& .MuiTabScrollButton-root': {
                  display: 'none'
                },
                '& .MuiTabs-indicator': {
                  height: 3,
                  backgroundColor: 'primary.main'
                }
              }}
              variant="fullWidth"
              scrollButtons="auto"
            >
              {tabs.map(tab => {
                const TabIcon = tab.icon
                return (
                  <Tab
                    key={tab.path}
                    icon={<TabIcon sx={{ fontSize: { xs: 22, sm: 20 } }} />}
                    label={
                      <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        {tab.label}
                      </Box>
                    }
                    iconPosition="top"
                    title={tab.label}
                    sx={{
                      textTransform: 'none',
                      fontSize: { xs: '0.65rem', sm: '0.9rem' },
                      fontWeight: 500,
                      px: { xs: 0.3, sm: 2 },
                      py: { xs: 0.5, sm: 1 },
                      minWidth: { xs: '45px', sm: 'auto' },
                      minHeight: { xs: 48, sm: 56 },
                      color: 'text.secondary',
                      gap: { xs: 0.2, sm: 0.5 },
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      '&.Mui-selected': {
                        color: 'primary.main',
                        fontWeight: 600
                      },
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        transition: 'all 0.2s'
                      }
                    }}
                  />
                )
              })}
            </Tabs>
          </Box>

          {/* Install PWA & Theme Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {canInstall && (
              <Tooltip title="Zainstaluj aplikację">
                <IconButton
                  onClick={handleInstall}
                  color="inherit"
                  sx={{
                    color: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  <InstallMobileIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={mode === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}>
              <IconButton 
                onClick={toggleMode} 
                color="inherit" 
                sx={{ 
                  color: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                {mode === 'dark' ? <LightMode /> : <DarkMode />}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
