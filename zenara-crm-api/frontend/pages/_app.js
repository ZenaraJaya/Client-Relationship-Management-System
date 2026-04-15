import { useEffect, useState } from 'react'
import '../styles/globals.css'

const THEME_STORAGE_KEY = 'zenara_crm_theme'
const AUTH_TOKEN_KEY = 'zenara_crm_auth_token'

export default function App({ Component, pageProps }) {
  const [theme, setTheme] = useState('light')
  const [themeReady, setThemeReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncAuthState = () => {
      setIsAuthenticated(Boolean(window.sessionStorage.getItem(AUTH_TOKEN_KEY)))
    }

    const handleStorageChange = (event) => {
      if (event.key && event.key !== AUTH_TOKEN_KEY) return
      syncAuthState()
    }

    const handleThemeToggleVisibility = (event) => {
      const nextVisible = Boolean(event?.detail?.visible)
      setIsAuthenticated(nextVisible)
    }

    syncAuthState()
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('zenara:auth-token-changed', syncAuthState)
    window.addEventListener('zenara:theme-toggle-visibility', handleThemeToggleVisibility)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('zenara:auth-token-changed', syncAuthState)
      window.removeEventListener('zenara:theme-toggle-visibility', handleThemeToggleVisibility)
    }
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <>
      <Component {...pageProps} />
      {themeReady && isAuthenticated && (
        <button
          type="button"
          className={`theme-toggle-button ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to night mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to night mode'}
        >
          <span className="theme-toggle-icon theme-toggle-icon-sun" aria-hidden="true">{'\u2600\uFE0F'}</span>
          <span className="theme-toggle-icon theme-toggle-icon-moon" aria-hidden="true">{'\uD83C\uDF19\u2728'}</span>
          <span className="theme-toggle-thumb" aria-hidden="true" />
        </button>
      )}
    </>
  )
}

