import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Paper, TextField, Button, Typography, Alert, Box,
} from '@mui/material'
import Lock from '@mui/icons-material/Lock'
import { login } from '../api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(password)
      navigate('/admin')
    } catch (err) {
      setError('Nieprawidłowe hasło')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="xs" sx={{ mt: 10 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" gutterBottom>Panel admina</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type="password"
            label="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            sx={{ mb: 2 }}
          />
          <Button
            fullWidth
            variant="contained"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logowanie...' : 'Zaloguj'}
          </Button>
        </Box>
      </Paper>
    </Container>
  )
}
