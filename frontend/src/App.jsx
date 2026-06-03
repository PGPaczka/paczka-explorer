import React, { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Box, Typography, Link, IconButton, Tooltip } from '@mui/material'
import GitHub from '@mui/icons-material/GitHub'
import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import BrowsePage from './pages/BrowsePage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import MCPServerPage from './pages/MCPServerPage'
import HowToAddPage from './pages/HowToAddPage'
import Header from './components/Header'
import { useThemeMode } from './ThemeContext'
import { fetchFilesRootGit } from './api'

function Footer() {
  const [filesRootGit, setFilesRootGit] = useState(null)

  useEffect(() => {
    let cancelled = false
    const loadGitInfo = async () => {
      try {
        const data = await fetchFilesRootGit()
        if (!cancelled) setFilesRootGit(data.filesRootGit || null)
      } catch {
        if (!cancelled) setFilesRootGit(null)
      }
    }
    loadGitInfo()
    return () => { cancelled = true }
  }, [])

  return (
    <Box
      component="footer"
      sx={{
        mt: 4,
        py: 2,
        px: 2,
        textAlign: 'center',
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        Stworzone przez
        <Link
          href="https://github.com/dommilosz"
          target="_blank"
          rel="noopener"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          <GitHub sx={{ fontSize: 16 }} />
          dommilosz
        </Link>
        · Kontakt: milosz_123456 (Discord)
        {filesRootGit && (
          <>
            {' '}· Commit: <code>{filesRootGit.shortCommit}</code>
            {filesRootGit.committedAt ? ` (${new Date(filesRootGit.committedAt).toLocaleDateString()})` : ''}
          </>
        )}
      </Typography>
    </Box>
  )
}

export default function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Box sx={{ flex: 1 }}>
        <Routes>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/mcp-server" element={<MCPServerPage />} />
          <Route path="/how-to-add" element={<HowToAddPage />} />
          <Route path="/*" element={<BrowsePage />} />
        </Routes>
      </Box>
      <Footer />
    </Box>
  )
}
