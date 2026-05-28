import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material'

const ThemeContext = createContext()

export function useThemeMode() {
  return useContext(ThemeContext)
}

function getInitialMode() {
  const saved = localStorage.getItem('themeMode')
  if (saved === 'light' || saved === 'dark') return saved
  // Default to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function ThemeContextProvider({ children }) {
  const [mode, setMode] = useState(getInitialMode)

  useEffect(() => {
    localStorage.setItem('themeMode', mode)
  }, [mode])

  const toggleMode = () => {
    setMode(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      ...(mode === 'dark' ? {
        primary: { main: '#90caf9' },
        secondary: { main: '#66bb6a' },
        background: { default: '#121212', paper: '#1e1e1e' },
      } : {
        primary: { main: '#1976d2' },
        secondary: { main: '#43a047' },
      }),
    },
    typography: {
      fontFamily: 'Roboto, sans-serif',
    },
  }), [mode])

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}
