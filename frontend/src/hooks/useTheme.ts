import { useState, useEffect } from 'react'

type Theme = 'auto' | 'light' | 'dark'

function applyTheme(mode: Theme) {
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) ?? 'auto'
  )

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => {
    const isDark = document.documentElement.classList.contains('dark')
    setThemeState(isDark ? 'light' : 'dark')
  }

  return { theme, toggle }
}
