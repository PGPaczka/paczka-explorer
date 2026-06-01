import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, Typography, Button, Stack, Alert, LinearProgress, Box,
} from '@mui/material'
import Logout from '@mui/icons-material/Logout'
import Assignment from '@mui/icons-material/Assignment'
import Autorenew from '@mui/icons-material/Autorenew'
import Sync from '@mui/icons-material/Sync'
import { fetchAuthStatus, fetchFilesRootGit, logout, adminReindex, adminGitPull } from '../api'

export default function AdminPage() {
  const navigate = useNavigate()
  const [filesRootGit, setFilesRootGit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reindexing, setReindexing] = useState(false)
  const [syncingGit, setSyncingGit] = useState(false)
  const [reindexAlert, setReindexAlert] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { isAdmin } = await fetchAuthStatus()
      if (!isAdmin) {
        navigate('/admin/login')
        return
      }
      loadGitStatus()
    } catch {
      navigate('/admin/login')
    }
  }

  const loadGitStatus = async () => {
    setLoading(true)
    try {
      const data = await fetchFilesRootGit()
      setFilesRootGit(data.filesRootGit || null)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  const handleReindex = async () => {
    setReindexing(true)
    setReindexAlert(null)
    try {
      const result = await adminReindex()
      setReindexAlert({
        severity: 'success',
        message: `Reindex zakończony. Pliki: ${result.fileCount}, katalogi: ${result.dirCount}`,
      })
    } catch (err) {
      setReindexAlert({
        severity: 'error',
        message: `Błąd reindexu: ${err.message}`,
      })
    } finally {
      setReindexing(false)
    }
  }

  const handleGitPull = async () => {
    setSyncingGit(true)
    setReindexAlert(null)
    try {
      const result = await adminGitPull()
      if (result.filesRootGit) {
        setFilesRootGit(result.filesRootGit)
      }
      setReindexAlert({
        severity: 'success',
        message: `Synchronizacja git zakończona. ${result.output || ''}`.trim(),
      })
      loadGitStatus()
    } catch (err) {
      setReindexAlert({
        severity: 'error',
        message: `Błąd synchronizacji git: ${err.message}`,
      })
    } finally {
      setSyncingGit(false)
    }
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, px: { xs: 1.5, sm: 3 } }}>
        <LinearProgress />
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 3, px: { xs: 1.5, sm: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={{ xs: 1.5, sm: 2 }}
        sx={{ mb: 3 }}
      >
        <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
          <Assignment sx={{ fontSize: 22, verticalAlign: 'text-bottom', mr: 0.5 }} />
          Panel administracyjny
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Sync />}
            onClick={handleGitPull}
            disabled={syncingGit || reindexing}
            fullWidth
          >
            {syncingGit ? 'Synchronizacja...' : 'Synchronizuj z gitem'}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Autorenew />}
            onClick={handleReindex}
            disabled={reindexing || syncingGit}
            fullWidth
          >
            {reindexing ? 'Reindexowanie...' : 'Reindex'}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/browse')} fullWidth>
            Przeglądaj pliki
          </Button>
          <Button variant="outlined" color="error" startIcon={<Logout />} onClick={handleLogout} fullWidth>
            Wyloguj
          </Button>
        </Stack>
      </Stack>

      {reindexAlert && (
        <Alert severity={reindexAlert.severity} sx={{ mb: 2, wordBreak: 'break-word' }}>
          {reindexAlert.message}
        </Alert>
      )}

      {filesRootGit && (
        <Alert severity="info" sx={{ mb: 2, wordBreak: 'break-word' }}>
          FILES_ROOT: <code>{filesRootGit.shortCommit}</code>
          {filesRootGit.branch ? ` (${filesRootGit.branch})` : ''}
          {filesRootGit.committedAt ? ` · commit: ${new Date(filesRootGit.committedAt).toLocaleString()}` : ''}
          {filesRootGit.upstream ? ` · upstream: ${filesRootGit.upstream}` : ' · brak upstream'}
          {filesRootGit.upstream ? ` · ahead: ${filesRootGit.ahead}, behind: ${filesRootGit.behind}` : ''}
          {filesRootGit.fetchedAt ? ` · fetch: ${new Date(filesRootGit.fetchedAt).toLocaleTimeString()}` : ''}
        </Alert>
      )}

    </Container>
  )
}
