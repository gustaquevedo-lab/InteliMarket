import { createContext, useContext, useEffect, useState, ReactNode } from "react"

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  dark: boolean
  setTheme: (theme: ThemeMode) => void
  toggle: () => void // Kept for legacy support, cycles themes
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  dark: false,
  setTheme: () => {},
  toggle: () => {}
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme") as ThemeMode) || "system"
  })

  // Derive dark mode boolean
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
      setDark(isDark)
      document.documentElement.classList.toggle("dark", isDark)
    }

    applyTheme()
    localStorage.setItem("theme", theme)

    const handler = () => {
      if (theme === 'system') applyTheme()
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [theme])

  const setTheme = (newTheme: ThemeMode) => setThemeState(newTheme)

  const toggle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <ThemeContext.Provider value={{ theme, dark, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
