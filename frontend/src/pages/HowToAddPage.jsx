import React from 'react'
import { Container, Box, Typography, Paper, Stack, List, ListItem, ListItemIcon, ListItemText, Divider, Alert, Card, CardContent } from '@mui/material'
import HelpIcon from '@mui/icons-material/Help'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import NumbersIcon from '@mui/icons-material/Numbers'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import InfoIcon from '@mui/icons-material/Info'
import ApprovalIcon from '@mui/icons-material/AssignmentTurnedIn'
import GitHubIcon from '@mui/icons-material/GitHub'
import LinkIcon from '@mui/icons-material/Link'

export default function HowToAddPage() {
  const CodeBlock = ({ children }) => (
    <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem', overflow: 'auto' }}>
      {children}
    </Box>
  )
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <HelpIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Jak Dodawać Pliki
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Wgraj materiały do systemu Paczka - dwie metody: przeglądarka lub GitHub PR
            </Typography>
          </Box>
        </Box>
      </Box>

      <Stack spacing={3}>
        <Alert severity="warning" icon={<ApprovalIcon />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            ⚠️ Ważne: Zatwierdzenie przez Administratora
          </Typography>
          <Typography variant="body2" paragraph>
            Wszystkie wgrywane pliki wymagają zatwierdzenia przez administratora przed opublikowaniem. Zapewnia to jakość i bezpieczeństwo materiałów w repozytorium.
          </Typography>
        </Alert>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            ✨ Metoda 1: Za Pośrednictwem Przeglądarki
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <NumbersIcon sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Przejdź do zakładki 'Przeglądaj'"
                secondary="Otwórz stronę główną przeglądarki plików"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <NumbersIcon sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Nawiguj do folderu docelowego"
                secondary="Wejdź do folderu, w którym chcesz umieścić pliki"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CloudUploadIcon sx={{ color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Kliknij przycisk 'Wgraj pliki'"
                secondary="Otwórz dialog wgrywania i wybierz pliki ze swojego komputera"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Czekaj na potwierdzenie"
                secondary="System wyświetli komunikat o sukcesie po zakończeniu wgrywania"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <InfoIcon sx={{ color: 'info.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Dodaj opcjonalny opis"
                secondary="Możesz wpisać opis swoich materiałów - będzie widoczny dla użytkowników i w Pull Request"
              />
            </ListItem>
          </List>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Metoda 2: Pull Request do GitHub
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <NumbersIcon sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Utwórz fork repozytorium Paczka"
                secondary="Przejdź do GitHub i kliknij 'Fork' na głównym repozytorium projektu"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <NumbersIcon sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Sklonuj swój fork lokalnie"
                secondary="git clone https://github.com/TWOJA_NAZWA/Paczka.git"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <NumbersIcon sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Dodaj swoje pliki i stwórz commit"
                secondary="git add . && git commit -m 'Dodane materiały z [nazwa przedmiotu]'"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <NumbersIcon sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Wyślij pull request"
                secondary="Przejdź do głównego repozytorium i otwórz PR z opisem zmian"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Czekaj na recenzję i merge"
                secondary="Administrator sprawdzi Twój PR i doda pliki do projektu"
              />
            </ListItem>
          </List>

          <Alert severity="success" sx={{ mt: 2 }} icon={<LinkIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              🔗 Aby uzyskać dostęp do GitHub i Discord
            </Typography>
            <Typography variant="body2" paragraph>
              Dołącz do naszego serwera Discord gdzie znajdziesz link do repozytorium. Server Discord jest dostępny dla wszystkich zainteresowanych wsparciem projektu.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <LinkIcon sx={{ fontSize: 18 }} />
              <Typography
                component="a"
                href="https://discord.gg/8MVeYzChkT"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'primary.main',
                  textDecoration: 'none',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Dołącz do Discord
              </Typography>
            </Box>
          </Alert>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            ✅ Dobre Praktyki
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Używaj spójnego nazewnictwa"
                secondary="Wszystkie pliki danego przedmiotu powinny mieć taki sam format nazwy"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Organizuj w foldery tematyczne"
                secondary="Oddziel notatki od zadań, kolokwia od egzaminów"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Kompresuj duże foldery np. projekty"
                secondary="Dla projetków utwórz archiwum ZIP"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Uwzględnij metadane"
                secondary="Wpisz rok akademicki, prowadzącego, grupę (jeśli istotne)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Unikaj duplikatów"
                secondary="Przed wgraniem sprawdź czy materiał już istnieje w systemie"
              />
            </ListItem>
          </List>
        </Paper>

        <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 0 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              💡 Wskazówka
            </Typography>
            <Typography variant="body2">
              Jeśli masz pytania dotyczące struktury czy formatów, skontaktuj się z administratorem na serwerze Discord lub sprawdź przykłady już istniejących materiałów w systemie.
            </Typography>
          </Box>
        </Alert>
      </Stack>
    </Container>
  )
}
