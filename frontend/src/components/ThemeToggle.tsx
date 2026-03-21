import { useEffect, useState } from 'react'

type ThemeMode = 'auto' | 'light' | 'dark'

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) ?? 'auto'
  })

  useEffect(() => {
    applyTheme(mode)
    localStorage.setItem('theme', mode)

    if (mode === 'auto') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('auto')
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
  }, [mode])

  const cycle = () => {
    setMode(m => (m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto'))
  }

  return (
    <button
      onClick={cycle}
      className="p-2 rounded-xl hover-surface transition-all text-muted"
      title={mode === 'auto' ? '跟随系统' : mode === 'dark' ? '深色模式' : '浅色模式'}
    >
      {mode === 'auto' ? (
        /* Monitor — auto */
        <svg className="w-5 h-5 text-leaf-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ) : mode === 'dark' ? (
        /* Sun — in dark mode, click to go auto */
        <svg className="w-5 h-5 text-earth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        /* Moon — in light mode */
        <svg className="w-5 h-5 text-earth-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}
