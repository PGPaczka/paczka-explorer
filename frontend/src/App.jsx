import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Box, Typography, Link, IconButton, Tooltip } from '@mui/material'
import GitHub from '@mui/icons-material/GitHub'
import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import BrowsePage from './pages/BrowsePage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import { useThemeMode } from './ThemeContext'

function Footer() {
  const { mode, toggleMode } = useThemeMode()

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
      </Typography>
      <Tooltip title={mode === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}>
        <IconButton size="small" onClick={toggleMode} color="inherit">
          {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/browse/*" element={<BrowsePage />} />
        <Route path="*" element={<BrowsePage />} />
      </Routes>
      <Footer />
    </>
  )
}
