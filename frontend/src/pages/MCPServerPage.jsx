import React, { useState, useEffect } from 'react'
import { 
  Container, Box, Typography, Paper, Stack, Divider, Alert, Button, Card, CardContent
} from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RobotIcon from '@mui/icons-material/SmartToy'

export default function MCPServerPage() {
  const [copied, setCopied] = useState(null)
  const [promptContent, setPromptContent] = useState('')
  const [promptLoading, setPromptLoading] = useState(true)

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const response = await fetch('https://paczka-mcp.atos-iks.de/install.md')
        if (response.ok) {
          const text = await response.text()
          setPromptContent(text)
        } else {
          setPromptContent('Błąd: nie udało się pobrać instrukcji')
        }
      } catch (error) {
        setPromptContent('Błąd: ' + error.message)
      } finally {
        setPromptLoading(false)
      }
    }
    fetchPrompt()
  }, [])

  const CodeBlock = ({ children, copyable = false }) => {
    const handleCopy = () => {
      navigator.clipboard.writeText(children)
      setCopied(children)
      setTimeout(() => setCopied(null), 2000)
    }
    return (
      <Box sx={{ position: 'relative', bgcolor: 'background.default', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
        {children}
        {copyable && (
          <Button
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopy}
            sx={{ position: 'absolute', top: 8, right: 8 }}
          >
            {copied === children ? 'Skopiowano!' : 'Kopiuj'}
          </Button>
        )}
      </Box>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <RobotIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              MCP Server Paczka
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Model Context Protocol Server dla AI - dostęp do materiałów studenckich
            </Typography>
          </Box>
        </Box>
      </Box>

      <Alert severity="success" sx={{ mb: 3 }}>
        <InfoIcon sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
        <strong>MCP Server umożliwia AI (Claude, etc.) przeszukiwanie i odczytywanie materiałów studenckich.</strong>
      </Alert>

      <Stack spacing={3}>
        <Paper sx={{ p: 3, bgcolor: 'success.light' }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            🎯 Szybki Start
          </Typography>
          <Typography variant="body2" paragraph>
            Skopiuj cały tekst poniżej i wklej do edytora AI (Claude, itp.):
          </Typography>
        </Paper>

        <Paper sx={{ p: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Prompt do Wklejenia
            </Typography>
            <Button
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={() => {
                navigator.clipboard.writeText(promptContent)
                setCopied('prompt')
                setTimeout(() => setCopied(null), 2000)
              }}
              disabled={promptLoading}
            >
              {copied === 'prompt' ? 'Skopiowano!' : 'Kopiuj'}
            </Button>
          </Box>
          <CodeBlock>
{promptLoading ? 'Ładowanie instrukcji...' : promptContent}
          </CodeBlock>
        </Paper>

        <Stack spacing={2}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            📋 Kroki
          </Typography>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                1️⃣ Skopiuj prompt powyżej
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Użyj przycisku "Kopiuj" aby skopiować całą instrukcję
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                2️⃣ Otwórz edytor AI
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Otwórz Claude, ChatGPT, Cursor lub inny edytor z obsługą MCP
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                3️⃣ Wklej prompt
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Wklej całą instrukcję w chat/prompt edytora AI
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                4️⃣ Wykonaj instrukcje
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Edytor AI zastosuje konfigurację MCP Server
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                5️⃣ Gotowe! 🎉
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Możesz teraz pytać o materiały studenckie
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Stack>
    </Container>
  )
}
