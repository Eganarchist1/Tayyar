'use client'
import React, { useState, useEffect } from 'react'
import { createContext, useContext } from 'react'

type Theme = 'midnight' | 'fajr'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function applyThemeClass(nextTheme: Theme) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.classList.remove('theme-midnight', 'theme-fajr')
  document.documentElement.classList.add(`theme-${nextTheme}`)
  document.documentElement.dataset.theme = nextTheme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('midnight')

  useEffect(() => {
    const saved = localStorage.getItem('tayyar-theme') as Theme
    const nextTheme = saved === 'fajr' || saved === 'midnight' ? saved : 'midnight'
    setThemeState(nextTheme)
    applyThemeClass(nextTheme)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('tayyar-theme', newTheme)
    applyThemeClass(newTheme)
  }

  const toggleTheme = () => {
    const next = theme === 'midnight' ? 'fajr' : 'midnight'
    setTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
