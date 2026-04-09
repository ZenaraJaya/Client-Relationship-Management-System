import { useEffect, useState } from 'react'
import '../styles/globals.css'

const THEME_STORAGE_KEY = 'zenara_crm_theme'

export default function App({ Component, pageProps }) {
  const [theme, setTheme] = useState('light')
  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const normalizedTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'light'
    setTheme(normalizedTheme)
    setThemeReady(true)
  }, [])

  useEffect(() => {
    if (!themeReady || typeof document === 'undefined' || typeof window === 'undefined') return

    document.documentElement.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme, themeReady])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <>
      <Component {...pageProps} />
      {themeReady && (
        <button
          type="button"
          className="theme-toggle-button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to night mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to night mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      )}
    </>
  )
}
