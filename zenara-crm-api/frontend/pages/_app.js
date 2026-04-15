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
    window.dispatchEvent(
      new CustomEvent('zenara:theme-changed', {
        detail: { theme },
      })
    )
  }, [theme, themeReady])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleThemeToggleRequest = () => {
      setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
    }

    window.addEventListener('zenara:theme-toggle-request', handleThemeToggleRequest)

    return () => {
      window.removeEventListener('zenara:theme-toggle-request', handleThemeToggleRequest)
    }
  }, [])

  return <Component {...pageProps} />
}

