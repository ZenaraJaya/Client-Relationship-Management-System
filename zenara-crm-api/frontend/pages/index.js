import React, { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import DashboardCards from '../components/DashboardCards'
import CrmList from '../components/CrmList'
import AddCrmModal from '../components/AddCrmModal'
import AuthPanel from '../components/AuthPanel'
import ProfileModal from '../components/ProfileModal'

const AUTH_TOKEN_KEY = 'zenara_crm_auth_token'

const getSwitchUserLoginState = (overrides = {}) => ({
  open: false,
  targetName: '',
  email: '',
  password: '',
  isSubmitting: false,
  error: '',
  ...overrides,
})

const getDefaultApiBase = () => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8000/api`
  }

  return 'http://localhost:8000/api'
}

const normalizeProfilePhotoUrl = (value, apiBase, userId, updatedAt) => {
  if (!value) return ''

  const numericUserId = Number(userId)
  const hasUserId = Number.isInteger(numericUserId) && numericUserId > 0

  let apiOrigin = ''
  try {
    apiOrigin = new URL(apiBase).origin
  } catch {
    apiOrigin = ''
  }

  const buildApiProfilePhotoUrl = () => {
    if (!hasUserId || !apiOrigin) return ''

    let version = ''
    const updatedAtTimestampMs = Date.parse(String(updatedAt || ''))
    if (!Number.isNaN(updatedAtTimestampMs)) {
      version = `?v=${Math.floor(updatedAtTimestampMs / 1000)}`
    }

    return `${apiOrigin}/api/auth/profile-photo/${numericUserId}${version}`
  }

  const rawValue = String(value).trim()
  const looksLikeMalformedIdUrl = /^\d+(\?.*)?$/.test(rawValue)

  if (looksLikeMalformedIdUrl) {
    const fallback = buildApiProfilePhotoUrl()
    if (fallback) return fallback
  }

  try {
    const resolved = new URL(rawValue, apiOrigin || undefined)

    if (resolved.pathname.startsWith('/api/auth/profile-photo/') && apiOrigin) {
      const apiUrl = new URL(apiOrigin)
      resolved.protocol = apiUrl.protocol
      resolved.host = apiUrl.host
    }

    const isStoragePath = resolved.pathname.startsWith('/storage/')
    if (isStoragePath) {
      const fallback = buildApiProfilePhotoUrl()
      if (fallback) return fallback
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && resolved.protocol === 'http:') {
      resolved.protocol = 'https:'
    }

    return resolved.toString()
  } catch {
    const fallback = buildApiProfilePhotoUrl()
    if (fallback) return fallback

    if (rawValue.startsWith('http://') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
      return rawValue.replace(/^http:\/\//i, 'https://')
    }

    return rawValue
  }
}

const CRM_SEARCH_FIELDS = [
  'company_name',
  'industry',
  'location',
  'contact_person',
  'role',
  'phone',
  'email',
  'source',
  'pain_point',
  'remarks',
  'priority',
  'status',
  'last_contact',
  'next_action',
  'appointment',
  'follow_up',
  'created_at',
  'updated_at',
]

const matchesCrmSearch = (item, rawKeyword) => {
  const keyword = String(rawKeyword || '').trim().toLowerCase()
  if (!keyword) return true
  if (!item || typeof item !== 'object') return false

  const searchableValues = [item.id, ...CRM_SEARCH_FIELDS.map((field) => item[field])]
  return searchableValues.some((value) => {
    if (value === null || value === undefined) return false
    return String(value).toLowerCase().includes(keyword)
  })
}

export default function Home() {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || getDefaultApiBase()).replace(/\/+$/, '')

  const [currentView, setCurrentView] = useState('dashboard')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [searchCompany, setSearchCompany] = useState('')
  const [serverPage, setServerPage] = useState(1)
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' })
  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    mode: 'single',
    ids: [],
    count: 0,
    isDeleting: false,
  })

  const [authToken, setAuthToken] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authPanelInitialMode, setAuthPanelInitialMode] = useState('login')
  const [authPanelInitialRole, setAuthPanelInitialRole] = useState('')
  const [authSuccessPreloader, setAuthSuccessPreloader] = useState({
    visible: false,
    title: '',
    copy: '',
  })
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [switchUserLogin, setSwitchUserLogin] = useState(getSwitchUserLoginState())
  const [outlookConnectPromptOpen, setOutlookConnectPromptOpen] = useState(false)
  const [teamUsers, setTeamUsers] = useState([])
  const isAdmin = (authUser?.role || '').toLowerCase() === 'admin'
  const normalizedProfilePhotoUrl = normalizeProfilePhotoUrl(
    authUser?.profile_photo_url || '',
    apiBase,
    authUser?.id,
    authUser?.updated_at
  )
  const normalizedTeamUsers = Array.isArray(teamUsers)
    ? teamUsers.map((member) => ({
        ...member,
        profile_photo_url: normalizeProfilePhotoUrl(
          member?.profile_photo_url || '',
          apiBase,
          member?.id,
          member?.updated_at
        ),
      }))
    : []

  const toastTimerRef = useRef(null)
  const authSuccessPreloaderTimerRef = useRef(null)
  const outlookPopupRef = useRef(null)
  const outlookPromptResolveRef = useRef(null)
  const dateFields = ['last_contact', 'appointment', 'follow_up']

  const notifyAuthTokenChanged = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('zenara:auth-token-changed'))
  }

  const saveAuthTokenToSession = (token) => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(AUTH_TOKEN_KEY, token)
    notifyAuthTokenChanged()
  }

  const clearAuthTokenFromSession = () => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(AUTH_TOKEN_KEY)
    notifyAuthTokenChanged()
  }

  const publishThemeToggleVisibility = (visible) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent('zenara:theme-toggle-visibility', {
        detail: { visible: Boolean(visible) },
      })
    )
  }

  const resolveLandingViewForUser = (user) => {
    return 'dashboard'
  }

  const extractOutlookAuthPayloadFromHash = () => {
    if (typeof window === 'undefined') return null

    const prefix = '#zenara_oauth_payload='
    const { hash } = window.location
    if (!hash || !hash.startsWith(prefix)) return null

    const encodedPayload = hash.slice(prefix.length)
    if (!encodedPayload) return null

    try {
      return JSON.parse(decodeURIComponent(encodedPayload))
    } catch {
      return null
    }
  }

  const clearOutlookAuthPayloadHash = () => {
    if (typeof window === 'undefined') return
    const prefix = '#zenara_oauth_payload='
    if (!window.location.hash.startsWith(prefix)) return

    const cleanUrl = `${window.location.pathname}${window.location.search}`
    window.history.replaceState(null, '', cleanUrl)
  }

  const applyOutlookAuthPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || payload.type !== 'zenara:outlook-auth') {
      return false
    }

    if (!payload.ok) {
      setAuthError(payload.message || 'Outlook sign-in failed.')
      showToast(payload.message || 'Outlook sign-in failed.', 'error')
      return true
    }

    const token = payload.token
    const user = payload.user
    if (!token || !user) {
      setAuthError('Outlook sign-in response is invalid.')
      showToast('Outlook sign-in response is invalid.', 'error')
      return true
    }

    saveAuthTokenToSession(token)
    showAuthSuccessPreloader(payload?.mode)

    setAuthToken(token)
    setAuthUser(user)
    setCurrentView(resolveLandingViewForUser(user))
    setAuthError('')
    showToast(payload.message || 'Outlook sign-in successful.', 'success')
    return true
  }

  const applyOutlookCalendarPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || payload.type !== 'zenara:outlook-calendar-auth') {
      return false
    }

    showToast(
      payload.message || (payload.ok ? 'Outlook calendar connected.' : 'Outlook calendar connection failed.'),
      payload.ok ? 'success' : 'error'
    )
    return true
  }

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ visible: true, message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 2600)
  }

  const clearAuthSuccessPreloaderTimer = () => {
    if (authSuccessPreloaderTimerRef.current) {
      clearTimeout(authSuccessPreloaderTimerRef.current)
      authSuccessPreloaderTimerRef.current = null
    }
  }

  const showAuthSuccessPreloader = (mode) => {
    const isSignup = mode === 'signup'

    clearAuthSuccessPreloaderTimer()
    setAuthSuccessPreloader({
      visible: true,
      title: isSignup ? 'Creating your workspace' : 'Welcome back',
      copy: isSignup
        ? 'Finalizing your account and preparing your CRM dashboard...'
        : 'Signing you in and restoring your CRM dashboard...',
    })

    authSuccessPreloaderTimerRef.current = setTimeout(() => {
      setAuthSuccessPreloader((prev) => ({ ...prev, visible: false }))
      authSuccessPreloaderTimerRef.current = null
    }, 1700)
  }

  const resetCrmUiState = () => {
    setData(null)
    setLoading(false)
    setError(null)
    setSelectedIds([])
    setSearchCompany('')
    setCurrentView('dashboard')
    setModalOpen(false)
    setEditingItem(null)
    setProfileOpen(false)
    setServerPage(1)
    setDeleteConfirm({ open: false, mode: 'single', ids: [], count: 0, isDeleting: false })
  }

  const handleUnauthorized = () => {
    clearAuthSuccessPreloaderTimer()
    setAuthSuccessPreloader((prev) => ({ ...prev, visible: false }))
    clearAuthTokenFromSession()
    setAuthToken('')
    setAuthUser(null)
    setTeamUsers([])
    setSwitchUserLogin(getSwitchUserLoginState())
    setAuthPanelInitialMode('login')
    setAuthPanelInitialRole('')
    setAuthError('Your session has expired. Please login again.')
    resetCrmUiState()
  }

  const normalizeDateFields = (payload) => {
    const normalized = { ...payload }
    dateFields.forEach((field) => {
      if (normalized[field] === '') {
        normalized[field] = null
      }
    })
    return normalized
  }

  const extractErrorMessage = (json, fallback) => {
    if (!json) return fallback
    if (json.message) return json.message

    if (json.errors && typeof json.errors === 'object') {
      const firstError = Object.values(json.errors).flat().find(Boolean)
      if (firstError) return firstError
    }

    return fallback
  }

  const extractCalendarSyncWarning = (json) => {
    if (!json || typeof json !== 'object') return ''
    if (typeof json.calendar_sync_warning === 'string' && json.calendar_sync_warning.trim()) {
      return json.calendar_sync_warning.trim()
    }

    if (Array.isArray(json.calendar_sync_warnings)) {
      const firstWarning = json.calendar_sync_warnings.find((warning) => typeof warning === 'string' && warning.trim())
      return firstWarning ? firstWarning.trim() : ''
    }

    return ''
  }

  const hasReminderDateValue = (value) => {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim().length > 0
    return true
  }

  const hasOutlookReminderDate = (payload) =>
    hasReminderDateValue(payload?.appointment) || hasReminderDateValue(payload?.follow_up)

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) }
    if (authToken) headers.Authorization = `Bearer ${authToken}`
    return fetch(url, { ...options, headers })
  }

  const fetchCurrentUser = async (token) => {
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Invalid session')
    return res.json()
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      clearAuthSuccessPreloaderTimer()
      if (outlookPopupRef.current && !outlookPopupRef.current.closed) {
        outlookPopupRef.current.close()
      }
      if (outlookPromptResolveRef.current) {
        outlookPromptResolveRef.current(false)
        outlookPromptResolveRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!outlookConnectPromptOpen || typeof window === 'undefined') return undefined

    const handleEscape = (event) => {
      if (event.key !== 'Escape') return
      setOutlookConnectPromptOpen(false)
      if (outlookPromptResolveRef.current) {
        outlookPromptResolveRef.current(false)
        outlookPromptResolveRef.current = null
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [outlookConnectPromptOpen])

  useEffect(() => {
    if (!isAdmin && selectedIds.length > 0) {
      setSelectedIds([])
    }
  }, [isAdmin, selectedIds.length])

  useEffect(() => {
    publishThemeToggleVisibility(Boolean(authToken) && !authChecking)
  }, [authToken, authChecking])

  useEffect(() => {
    let mounted = true

    const bootstrapAuth = async () => {
      if (typeof window === 'undefined') {
        if (mounted) setAuthChecking(false)
        return
      }

      const hashPayload = extractOutlookAuthPayloadFromHash()
      if (hashPayload) {
        clearOutlookAuthPayloadHash()
        if (!mounted) return
        if (applyOutlookAuthPayload(hashPayload)) {
          setAuthChecking(false)
          return
        }
        applyOutlookCalendarPayload(hashPayload)
      }

      const savedToken = sessionStorage.getItem(AUTH_TOKEN_KEY)
      if (!savedToken) {
        if (mounted) setAuthChecking(false)
        return
      }

      try {
        const user = await fetchCurrentUser(savedToken)

        if (!mounted) return
        setAuthToken(savedToken)
        setAuthUser(user)
        setCurrentView(resolveLandingViewForUser(user))
        setAuthError('')
      } catch (err) {
        clearAuthTokenFromSession()
      } finally {
        if (mounted) setAuthChecking(false)
      }
    }

    bootstrapAuth()
    return () => {
      mounted = false
    }
  }, [apiBase])

  const fetchCrms = async ({ showLoader = true, page = serverPage, searchTerm = searchCompany } = {}) => {
    if (!authToken) return

    if (showLoader) setLoading(true)
    try {
      const pageNumber = Math.max(1, Number(page) || 1)
      const params = new URLSearchParams({ page: String(pageNumber) })
      const trimmedSearch = String(searchTerm || '').trim()
      if (trimmedSearch) {
        params.set('search', trimmedSearch)
      }

      const res = await authFetch(`${apiBase}/crms?${params.toString()}`)
      if (res.status === 401) {
        handleUnauthorized()
        return
      }
      if (!res.ok) throw new Error(res.statusText)
      const json = await res.json()
      setData(json)
      setError(null)

      const currentPageFromApi = Number(json?.current_page) || pageNumber
      if (currentPageFromApi !== serverPage) {
        setServerPage(currentPageFromApi)
      }
    } catch (err) {
      console.error('CRM fetch failed:', err)
      setError(err)
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    if (!authToken) {
      setLoading(false)
      return
    }

    fetchCrms({ showLoader: true, page: serverPage, searchTerm: searchCompany })
    const intervalId = setInterval(() => {
      fetchCrms({ showLoader: false, page: serverPage, searchTerm: searchCompany })
    }, 30000)
    return () => clearInterval(intervalId)
  }, [apiBase, authToken, serverPage, searchCompany])

  useEffect(() => {
    let mounted = true

    const fetchRegisteredUsers = async () => {
      if (!authToken) {
        if (mounted) setTeamUsers([])
        return
      }

      try {
        const res = await fetch(`${apiBase}/auth/users`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })

        if (!mounted) return

        if (res.status === 401) {
          handleUnauthorized()
          return
        }

        const json = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(extractErrorMessage(json, 'Unable to load users.'))
        }

        setTeamUsers(Array.isArray(json?.users) ? json.users : [])
      } catch (err) {
        console.error('Users fetch failed:', err)
      }
    }

    fetchRegisteredUsers()
    const intervalId = setInterval(fetchRegisteredUsers, 30000)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [apiBase, authToken])

  useEffect(() => {
    if (!switchUserLogin.open) return

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || switchUserLogin.isSubmitting) return
      setSwitchUserLogin(getSwitchUserLoginState())
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [switchUserLogin.open, switchUserLogin.isSubmitting])

  const handleAuthSubmit = async ({ mode, name, role, email, password }) => {
    setAuthSubmitting(true)
    setAuthError('')

    try {
      const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login'
      const payload = mode === 'signup' ? { name, role, email, password } : { email, password }

      const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setAuthError(extractErrorMessage(json, 'Authentication failed.'))
        return
      }

      const token = json?.token
      const user = json?.user
      if (!token || !user) {
        setAuthError('Authentication response is invalid.')
        return
      }

      saveAuthTokenToSession(token)
      showAuthSuccessPreloader(mode)

      setAuthToken(token)
      setAuthUser(user)
      setCurrentView(resolveLandingViewForUser(user))
      setAuthError('')
      showToast(mode === 'signup' ? 'Account created. Welcome!' : 'Login successful.')
    } catch (err) {
      setAuthError(`Unable to connect to server at ${apiBase}.`)
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleOutlookAuthStart = async ({ mode, role }) => {
    if (typeof window === 'undefined') return

    setAuthSubmitting(true)
    setAuthError('')

    try {
      const authMode = mode === 'signup' ? 'signup' : 'login'
      const authRole = authMode === 'signup' && role === 'admin' ? 'admin' : 'staff'
      const origin = encodeURIComponent(window.location.origin)

      const res = await fetch(`${apiBase}/auth/microsoft/auth-url?origin=${origin}&mode=${authMode}&role=${authRole}`)
      const json = await res.json().catch(() => null)

      if (!res.ok || !json?.url) {
        setAuthError(extractErrorMessage(json, 'Unable to start Outlook sign-in.'))
        return
      }

      window.location.assign(json.url)
      return
    } catch (err) {
      setAuthError(`Unable to connect to server at ${apiBase}.`)
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleOutlookCalendarConnect = async () => {
    if (typeof window === 'undefined' || !authToken) return false

    try {
      const origin = encodeURIComponent(window.location.origin)
      const res = await authFetch(`${apiBase}/auth/microsoft/connect-url?origin=${origin}`)
      const json = await res.json().catch(() => null)

      if (res.status === 401) {
        handleUnauthorized()
        return false
      }

      if (!res.ok || !json?.url) {
        throw new Error(extractErrorMessage(json, 'Unable to start Outlook connection.'))
      }

      window.location.assign(json.url)
      return true
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
      return false
    }
  }

  const promptOutlookCalendarConnectIfNeeded = async (payload) => {
    if (typeof window === 'undefined' || !authToken) return
    if (authUser?.microsoft_calendar_connected) return
    if (!hasOutlookReminderDate(payload)) return

    const confirmed = await new Promise((resolve) => {
      outlookPromptResolveRef.current = resolve
      setOutlookConnectPromptOpen(true)
    })
    if (!confirmed) return

    await handleOutlookCalendarConnect()
  }

  const resolveOutlookConnectPrompt = (shouldConnect) => {
    setOutlookConnectPromptOpen(false)
    if (outlookPromptResolveRef.current) {
      const resolve = outlookPromptResolveRef.current
      outlookPromptResolveRef.current = null
      resolve(Boolean(shouldConnect))
    }
  }

  const handleLogout = async () => {
    try {
      if (authToken) {
        await authFetch(`${apiBase}/auth/logout`, { method: 'POST' })
      }
    } catch (err) {
      // Ignore logout request failures and still clear local auth state.
    } finally {
      clearAuthSuccessPreloaderTimer()
      setAuthSuccessPreloader((prev) => ({ ...prev, visible: false }))
      clearAuthTokenFromSession()
      setAuthToken('')
      setAuthUser(null)
      setTeamUsers([])
      setSwitchUserLogin(getSwitchUserLoginState())
      setAuthPanelInitialMode('login')
      setAuthPanelInitialRole('')
      resetCrmUiState()
      showToast('Logged out successfully.')
    }
  }

  const openSwitchUserLogin = (member) => {
    const targetName = String(member?.name || 'User')
    const targetEmail = String(member?.email || '').trim()

    setSwitchUserLogin(getSwitchUserLoginState({
      open: true,
      targetName,
      email: targetEmail,
    }))
  }

  const closeSwitchUserLogin = () => {
    setSwitchUserLogin((prev) => {
      if (prev.isSubmitting) return prev
      return getSwitchUserLoginState()
    })
  }

  const submitSwitchUserLogin = async () => {
    const email = String(switchUserLogin.email || '').trim()
    const password = String(switchUserLogin.password || '')

    if (!email) {
      setSwitchUserLogin((prev) => ({ ...prev, error: 'Email is required.' }))
      return
    }

    if (!password) {
      setSwitchUserLogin((prev) => ({ ...prev, error: 'Password is required.' }))
      return
    }

    setSwitchUserLogin((prev) => ({ ...prev, isSubmitting: true, error: '' }))

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setSwitchUserLogin((prev) => ({
          ...prev,
          isSubmitting: false,
          error: extractErrorMessage(json, 'Login failed.'),
        }))
        return
      }

      const token = json?.token
      const user = json?.user
      if (!token || !user) {
        setSwitchUserLogin((prev) => ({
          ...prev,
          isSubmitting: false,
          error: 'Authentication response is invalid.',
        }))
        return
      }

      saveAuthTokenToSession(token)
      showAuthSuccessPreloader('login')

      setAuthToken(token)
      setAuthUser(user)
      setCurrentView(resolveLandingViewForUser(user))
      setAuthError('')
      setSwitchUserLogin(getSwitchUserLoginState())
      showToast('Login successful.')
    } catch (err) {
      setSwitchUserLogin((prev) => ({
        ...prev,
        isSubmitting: false,
        error: `Unable to connect to server at ${apiBase}.`,
      }))
    }
  }

  const handleAddAdmin = () => {
    clearAuthTokenFromSession()

    setAuthToken('')
    setAuthUser(null)
    setTeamUsers([])
    setAuthError('')
    setAuthPanelInitialMode('signup')
    setAuthPanelInitialRole('admin')
    resetCrmUiState()
  }

  const handleProfileSubmit = async ({ name, profilePhotoFile }) => {
    setProfileSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('_method', 'PUT')
      formData.append('name', name)
      if (profilePhotoFile) {
        formData.append('profile_photo', profilePhotoFile)
      }

      const res = await authFetch(`${apiBase}/auth/profile`, {
        method: 'POST',
        body: formData,
      })

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractErrorMessage(json, 'Unable to update profile.'))
      }

      if (json?.user) {
        setAuthUser(json.user)
        setTeamUsers((prev) =>
          prev.map((member) =>
            String(member?.id ?? '') === String(json.user?.id ?? '')
              ? { ...member, ...json.user }
              : member
          )
        )
      }

      setProfileOpen(false)
      showToast(json?.message || 'Profile updated successfully.')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setProfileSubmitting(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let active = true
    let apiOrigin = ''

    try {
      apiOrigin = new URL(apiBase).origin
    } catch (err) {
      apiOrigin = ''
    }

    const handleMicrosoftOauthMessage = async (event) => {
      if (!apiOrigin || event.origin !== apiOrigin) return

      const payload = event.data
      if (!payload || typeof payload !== 'object') return

      if (payload.type === 'zenara:outlook-auth') {
        if (outlookPopupRef.current && !outlookPopupRef.current.closed) {
          outlookPopupRef.current.close()
        }

        if (!active) return
        applyOutlookAuthPayload(payload)
        return
      }

      if (payload.type !== 'zenara:outlook-calendar-auth') return

      if (outlookPopupRef.current && !outlookPopupRef.current.closed) {
        outlookPopupRef.current.close()
      }

      showToast(payload.message || (payload.ok ? 'Outlook calendar connected.' : 'Outlook calendar connection failed.'), payload.ok ? 'success' : 'error')

      if (payload.ok && authToken && active) {
        try {
          const refreshedUser = await fetchCurrentUser(authToken)
          if (active) setAuthUser(refreshedUser)
        } catch (err) {
          console.error('Failed to refresh auth user after Outlook connect:', err)
        }
      }
    }

    window.addEventListener('message', handleMicrosoftOauthMessage)

    return () => {
      active = false
      window.removeEventListener('message', handleMicrosoftOauthMessage)
    }
  }, [apiBase, authToken])

  const handleAddCrm = async (formData) => {
    if (editingItem && !isAdmin) {
      showToast('Only admin users can edit contacts.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const method = editingItem ? 'PUT' : 'POST'
      const url = editingItem ? `${apiBase}/crms/${editingItem.id}` : `${apiBase}/crms`
      const payload = normalizeDateFields(formData)

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      if (!res.ok) {
        throw new Error(extractErrorMessage(json, `Failed to ${editingItem ? 'update' : 'create'} CRM`))
      }

      const calendarSyncWarning = extractCalendarSyncWarning(json)
      setModalOpen(false)
      setEditingItem(null)
      fetchCrms({ page: serverPage })
      showToast(
        calendarSyncWarning || `CRM contact ${editingItem ? 'updated' : 'added'} successfully.`,
        calendarSyncWarning ? 'error' : 'success'
      )

      await promptOutlookCalendarConnectIfNeeded(payload)
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const closeDeleteConfirm = () => {
    setDeleteConfirm((prev) => (prev.isDeleting ? prev : { open: false, mode: 'single', ids: [], count: 0, isDeleting: false }))
  }

  const handleDeleteCrm = (id) => {
    if (!isAdmin) {
      showToast('Only admin users can delete contacts.', 'error')
      return
    }

    setDeleteConfirm({ open: true, mode: 'single', ids: [id], count: 1, isDeleting: false })
  }

  const handleBulkDelete = () => {
    if (!isAdmin) {
      showToast('Only admin users can delete contacts.', 'error')
      return
    }

    if (selectedIds.length === 0) return
    setDeleteConfirm({
      open: true,
      mode: 'bulk',
      ids: [...selectedIds],
      count: selectedIds.length,
      isDeleting: false,
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.open || deleteConfirm.ids.length === 0) return

    const { mode, ids, count } = deleteConfirm
    if (!isAdmin) {
      showToast('Only admin users can delete contacts.', 'error')
      setDeleteConfirm({ open: false, mode: 'single', ids: [], count: 0, isDeleting: false })
      return
    }
    setDeleteConfirm((prev) => ({ ...prev, isDeleting: true }))
    if (mode === 'bulk') setLoading(true)

    try {
      if (mode === 'single') {
        const res = await authFetch(`${apiBase}/crms/${ids[0]}`, { method: 'DELETE' })
        if (res.status === 401) {
          handleUnauthorized()
          return
        }
        if (!res.ok) {
          const json = await res.json().catch(() => null)
          throw new Error(extractErrorMessage(json, 'Failed to delete CRM'))
        }
      } else {
        const res = await authFetch(`${apiBase}/crms/bulk-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        if (res.status === 401) {
          handleUnauthorized()
          return
        }
        if (!res.ok) {
          const json = await res.json().catch(() => null)
          throw new Error(extractErrorMessage(json, 'Bulk delete failed'))
        }
        setSelectedIds([])
      }

      fetchCrms({ page: serverPage })
      setDeleteConfirm({ open: false, mode: 'single', ids: [], count: 0, isDeleting: false })
      showToast(mode === 'single' ? 'Contact deleted successfully.' : `Successfully deleted ${count} contacts.`)
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
      setDeleteConfirm((prev) => ({ ...prev, isDeleting: false }))
    } finally {
      if (mode === 'bulk') setLoading(false)
    }
  }

  const handleEditCrm = (item) => {
    if (!isAdmin) {
      showToast('Only admin users can edit contacts.', 'error')
      return
    }

    setEditingItem(item)
    setModalOpen(true)
  }

  const handleUpdateField = async (item, field, value) => {
    if (!isAdmin) {
      showToast('Only admin users can edit contacts.', 'error')
      return false
    }

    const normalizedValue = dateFields.includes(field) && value === '' ? null : value
    const previousValue = item[field]

    setData((prev) => {
      if (!prev || !prev.data) return prev
      return {
        ...prev,
        data: prev.data.map((i) => (i.id === item.id ? { ...i, [field]: normalizedValue } : i)),
      }
    })

    try {
      const updatedItem = { ...item, [field]: normalizedValue }
      const res = await authFetch(`${apiBase}/crms/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeDateFields(updatedItem)),
      })
      const json = await res.json().catch(() => null)

      if (res.status === 401) {
        handleUnauthorized()
        return false
      }
      if (!res.ok) {
        throw new Error(extractErrorMessage(json, `Failed to update ${field}`))
      }

      const calendarSyncWarning = extractCalendarSyncWarning(json)
      showToast(calendarSyncWarning || 'Changes have been made.', calendarSyncWarning ? 'error' : 'success')

      if ((field === 'appointment' || field === 'follow_up') && hasReminderDateValue(normalizedValue)) {
        await promptOutlookCalendarConnectIfNeeded({ [field]: normalizedValue })
      }

      return true
    } catch (err) {
      setData((prev) => {
        if (!prev || !prev.data) return prev
        return {
          ...prev,
          data: prev.data.map((i) => (i.id === item.id ? { ...i, [field]: previousValue } : i)),
        }
      })
      showToast(`Error updating ${field}: ${err.message}`, 'error')
      return false
    }
  }

  const getMergedItems = () => {
    const items = data?.data || (Array.isArray(data) ? data : [])
    return [...items].sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''))
  }

  const items = getMergedItems()
  const searchKeyword = searchCompany.trim().toLowerCase()
  const filteredItems = searchKeyword
    ? items.filter((item) => matchesCrmSearch(item, searchKeyword))
    : items

  const toDate = (value) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const totalLeadClients = items.map((item) => ({
    id: item.id,
    company_name: item.company_name || 'Unnamed Company',
    contact_person: item.contact_person || 'No contact person set',
    status: item.status || 'No status',
  }))

  const activeDealClients = items
    .filter((item) => item.status === 'Qualified')
    .map((item) => ({
      id: item.id,
      company_name: item.company_name || 'Unnamed Company',
      contact_person: item.contact_person || 'No contact person set',
      status: item.status || 'No status',
    }))

  const totalLeads = Number(data?.total) || items.length
  const activeDeals = activeDealClients.length

  const todayFollowUpClients = items
    .map((item) => {
      const followUpDate = toDate(item.follow_up)
      if (!followUpDate || followUpDate < startOfToday || followUpDate > endOfToday) {
        return null
      }

      return {
        id: item.id,
        company_name: item.company_name || 'Unnamed Company',
        contact_person: item.contact_person || 'No contact person set',
        date: followUpDate,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)

  const todayFollowUps = todayFollowUpClients.length

  const upcomingTouchpoints = items
    .map((item) => {
      const appointmentDate = toDate(item.appointment)
      const followUpDate = toDate(item.follow_up)
      const upcomingDates = [
        appointmentDate ? { type: 'Appointment', date: appointmentDate } : null,
        followUpDate ? { type: 'Follow Up', date: followUpDate } : null,
      ]
        .filter(Boolean)
        .filter((entry) => entry.date >= now)
        .sort((a, b) => a.date - b.date)

      if (upcomingDates.length === 0) return null
      return {
        id: item.id,
        company_name: item.company_name || 'Unnamed Company',
        contact_person: item.contact_person || 'No contact name',
        ...upcomingDates[0],
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)

  const sevenDayAppointments = upcomingTouchpoints.filter((entry) => entry.date <= nextSevenDays)
  const upcomingAppointmentClients = items
    .map((item) => {
      const appointmentDate = toDate(item.appointment)
      if (!appointmentDate || appointmentDate < now || appointmentDate > nextSevenDays) {
        return null
      }

      return {
        id: item.id,
        company_name: item.company_name || 'Unnamed Company',
        contact_person: item.contact_person || '',
        date: appointmentDate,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)

  const formatTouchpointDate = (date) =>
    date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

  const currentPage = Math.max(1, Number(data?.current_page) || serverPage || 1)
  const lastPage = Math.max(1, Number(data?.last_page) || 1)
  const perPage = Math.max(1, Number(data?.per_page) || 10)
  const rowOffset = (currentPage - 1) * perPage
  const hasPrevPage = currentPage > 1
  const hasNextPage = currentPage < lastPage
  const goToPreviousPage = () => {
    if (!hasPrevPage || loading) return
    setSelectedIds([])
    setServerPage((prev) => Math.max(1, prev - 1))
  }

  const goToNextPage = () => {
    if (!hasNextPage || loading) return
    setSelectedIds([])
    setServerPage((prev) => prev + 1)
  }

  if (authChecking) {
    return (
      <div className="session-loader">
        <div className="session-loader-track" role="progressbar" aria-label="Initializing CRM">
          <div className="session-loader-bar" />
        </div>
        <p className="session-loader-text">Initializing CRM...</p>
      </div>
    )
  }

  if (!authToken) {
    return (
      <AuthPanel
        onSubmit={handleAuthSubmit}
        onOutlookAuth={handleOutlookAuthStart}
        isLoading={authSubmitting}
        error={authError}
        initialMode={authPanelInitialMode}
        initialRole={authPanelInitialRole}
      />
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentView={currentView}
        onViewChange={(v) => {
          setCurrentView(v)
          setSelectedIds([])
          if (v !== 'listing') setSearchCompany('')
        }}
        onLogout={handleLogout}
        onProfileClick={() => setProfileOpen(true)}
        onAddAdminClick={handleAddAdmin}
        onOtherUserClick={openSwitchUserLogin}
        userName={authUser?.name || 'User'}
        userRole={authUser?.role || ''}
        profilePhotoUrl={normalizedProfilePhotoUrl}
        teamUsers={normalizedTeamUsers}
        currentUserId={authUser?.id ?? null}
      />
      <main className="main">
        <TopBar
          searchCompany={searchCompany}
          onSearchCompanyChange={(value) => {
            setSearchCompany(value)
            setSelectedIds([])
            setServerPage(1)
          }}
          canQuickAdd={isAdmin}
          onQuickAdd={() => {
            setEditingItem(null)
            setModalOpen(true)
            if (currentView !== 'listing') setCurrentView('listing')
          }}
        />

        {currentView === 'dashboard' && (
          <>
            <DashboardCards
              totalLeads={totalLeads}
              activeDeals={activeDeals}
              followUpsToday={todayFollowUps}
              upcomingAppointments={upcomingAppointmentClients.length}
              upcomingAppointmentClients={upcomingAppointmentClients}
              totalLeadClients={totalLeadClients}
              activeDealClients={activeDealClients}
              todayFollowUpClients={todayFollowUpClients}
              onOpenListing={() => setCurrentView('listing')}
            />

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <h3>Today&apos;s Priorities</h3>
                  <span className="dashboard-count-chip">{todayFollowUps}</span>
                </div>
                {todayFollowUps === 0 ? (
                  <p className="dashboard-empty">No follow ups due today. Great time to plan ahead.</p>
                ) : (
                  <p className="dashboard-empty">{todayFollowUps} follow-up reminder(s) are due today.</p>
                )}
                <button type="button" className="panel-inline-action" onClick={() => setCurrentView('listing')}>
                  Review Contact List
                </button>
              </section>

              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <h3>Upcoming Touchpoints</h3>
                  <span className="dashboard-count-chip">{sevenDayAppointments.length}</span>
                </div>
                {sevenDayAppointments.length === 0 ? (
                  <p className="dashboard-empty">No appointments in the next 7 days.</p>
                ) : (
                  <ul className="touchpoint-list">
                    {sevenDayAppointments.slice(0, 4).map((entry) => (
                      <li key={`${entry.id}-${entry.type}-${entry.date.toISOString()}`} className="touchpoint-item">
                        <div>
                          <div className="touchpoint-company">{entry.company_name}</div>
                          <div className="touchpoint-meta">{entry.contact_person}</div>
                        </div>
                        <div className="touchpoint-right">
                          <span className="touchpoint-type">{entry.type}</span>
                          <span className="touchpoint-date">{formatTouchpointDate(entry.date)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}

        {currentView === 'listing' && (
          <div className="panel table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ marginTop: 0 }}>CRM Contacts</h3>
                <div className="small">Manage all your leads and clients (Real-time)</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && selectedIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    style={{
                      background: 'var(--table-action-delete-bg)',
                      color: 'var(--table-action-delete-text)',
                      padding: '8px 16px',
                      border: '1px solid var(--table-head-border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Delete Selected ({selectedIds.length})
                  </button>
                )}
              </div>
            </div>

            {loading && <div style={{ marginTop: 12 }}>Loading contacts...</div>}
            {error && <div style={{ marginTop: 12, color: 'var(--table-action-delete-text)' }}>Data Sync Error: {String(error.message || error)}</div>}
            {!loading && (
              <div style={{ marginTop: 12 }}>
                <CrmList
                  items={filteredItems}
                  onEdit={handleEditCrm}
                  onDelete={handleDeleteCrm}
                  onUpdate={handleUpdateField}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  canEdit={isAdmin}
                  canDelete={isAdmin}
                  rowOffset={rowOffset}
                />
                {data && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--table-cell-muted)' }}>
                      Showing page {currentPage} of {lastPage}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={goToPreviousPage}
                        disabled={!hasPrevPage || loading}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--modal-btn-secondary-border)',
                          background: 'var(--modal-btn-secondary-bg)',
                          color: 'var(--modal-btn-secondary-text)',
                          cursor: !hasPrevPage || loading ? 'not-allowed' : 'pointer',
                          opacity: !hasPrevPage || loading ? 0.5 : 1,
                        }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={goToNextPage}
                        disabled={!hasNextPage || loading}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--modal-btn-secondary-border)',
                          background: 'var(--modal-btn-secondary-bg)',
                          color: 'var(--modal-btn-secondary-text)',
                          cursor: !hasNextPage || loading ? 'not-allowed' : 'pointer',
                          opacity: !hasNextPage || loading ? 0.5 : 1,
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentView !== 'dashboard' && currentView !== 'listing' && (
          <section className="panel dashboard-panel">
            <div className="dashboard-panel-head">
              <h3>{currentView.charAt(0).toUpperCase() + currentView.slice(1)} Module</h3>
              <span className="dashboard-count-chip">Coming Soon</span>
            </div>
            <p className="dashboard-empty">
              This workspace section is reserved for the next UI phase. You can continue managing data in the Listing module.
            </p>
            <button type="button" className="panel-inline-action" onClick={() => setCurrentView('listing')}>
              Go To Listing
            </button>
          </section>
        )}
      </main>

      <AddCrmModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingItem(null)
        }}
        onSubmit={handleAddCrm}
        isLoading={submitting}
        editingItem={editingItem}
      />

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSubmit={handleProfileSubmit}
        isLoading={profileSubmitting}
        user={authUser ? { ...authUser, profile_photo_url: normalizedProfilePhotoUrl } : null}
      />

      {switchUserLogin.open && (
        <div
          className="switch-login-overlay"
          onClick={() => {
            if (switchUserLogin.isSubmitting) return
            closeSwitchUserLogin()
          }}
        >
          <div
            className="switch-login-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-login-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="switch-login-header">
              <h3 id="switch-login-title" className="switch-login-title">Login Required</h3>
              <p className="switch-login-subtitle">
                Login as <span className="switch-login-target">{switchUserLogin.targetName || 'this user'}</span> to continue.
              </p>
            </div>

            <div className="switch-login-fields">
              <label className="switch-login-field" htmlFor="switch-login-email">
                <span className="switch-login-label">Email</span>
                <input
                  id="switch-login-email"
                  className="switch-login-input"
                  type="email"
                  value={switchUserLogin.email}
                  onChange={(event) =>
                    setSwitchUserLogin((prev) => ({ ...prev, email: event.target.value, error: '' }))
                  }
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                />
              </label>

              <label className="switch-login-field" htmlFor="switch-login-password">
                <span className="switch-login-label">Password</span>
                <input
                  id="switch-login-password"
                  className="switch-login-input"
                  type="password"
                  value={switchUserLogin.password}
                  onChange={(event) =>
                    setSwitchUserLogin((prev) => ({ ...prev, password: event.target.value, error: '' }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      submitSwitchUserLogin()
                    }
                  }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </label>
            </div>

            {switchUserLogin.error ? (
              <div className="switch-login-error" role="alert">
                {switchUserLogin.error}
              </div>
            ) : null}

            <div className="switch-login-actions">
              <button
                type="button"
                onClick={closeSwitchUserLogin}
                disabled={switchUserLogin.isSubmitting}
                className="switch-login-btn switch-login-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitSwitchUserLogin}
                disabled={switchUserLogin.isSubmitting}
                className="switch-login-btn switch-login-btn-primary"
              >
                {switchUserLogin.isSubmitting ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {outlookConnectPromptOpen && (
        <div
          className="outlook-connect-overlay"
          onClick={() => resolveOutlookConnectPrompt(false)}
        >
          <div
            className="outlook-connect-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="outlook-connect-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="outlook-connect-head">
              <div className="outlook-connect-icon" aria-hidden="true">
                <span className="outlook-connect-icon-glyph">@</span>
              </div>
              <h3 id="outlook-connect-title" className="outlook-connect-title">
                Connect to Outlook
              </h3>
            </div>
            <p className="outlook-connect-copy">
              Sync your appointments and get automatic reminders for upcoming meetings.
            </p>

            <div className="outlook-connect-actions">
              <button
                type="button"
                className="outlook-prompt-btn outlook-prompt-btn-primary"
                onClick={() => resolveOutlookConnectPrompt(true)}
              >
                Yes, Connect
              </button>
              <button
                type="button"
                className="outlook-prompt-btn outlook-prompt-btn-secondary"
                onClick={() => resolveOutlookConnectPrompt(false)}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--modal-overlay-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--modal-card-bg)',
              borderRadius: 12,
              boxShadow: 'var(--modal-card-shadow)',
              padding: 20,
              border: '1px solid var(--modal-card-border)',
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8, color: 'var(--modal-heading)' }}>Confirm Delete</h3>
            <p style={{ margin: 0, marginBottom: 18, color: 'var(--modal-copy)', lineHeight: 1.5, fontSize: 14 }}>
              {deleteConfirm.mode === 'single'
                ? 'Are you sure you want to delete this contact?'
                : `Are you sure you want to delete ${deleteConfirm.count} selected contacts?`}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deleteConfirm.isDeleting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--modal-btn-secondary-border)',
                  background: 'var(--modal-btn-secondary-bg)',
                  color: 'var(--modal-btn-secondary-text)',
                  cursor: deleteConfirm.isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  opacity: deleteConfirm.isDeleting ? 0.7 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteConfirm.isDeleting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--table-action-delete-text)',
                  background: 'var(--table-action-delete-text)',
                  color: '#fff',
                  cursor: deleteConfirm.isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: deleteConfirm.isDeleting ? 0.8 : 1,
                }}
              >
                {deleteConfirm.isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.visible && (
        <div className={`toast-notification ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}

      {authSuccessPreloader.visible && (
        <div className="auth-success-preloader" role="status" aria-live="polite" aria-label={authSuccessPreloader.title}>
          <div className="auth-success-preloader-card">
            <div className="auth-success-orbit" aria-hidden="true">
              <span className="auth-success-orbit-ring auth-success-orbit-ring-one" />
              <span className="auth-success-orbit-ring auth-success-orbit-ring-two" />
              <span className="auth-success-orbit-core" />
            </div>
            <p className="auth-success-preloader-kicker">Zenara CRM</p>
            <h2 className="auth-success-preloader-title">{authSuccessPreloader.title}</h2>
            <p className="auth-success-preloader-copy">{authSuccessPreloader.copy}</p>
            <div className="auth-success-progress-track" aria-hidden="true">
              <span className="auth-success-progress-bar" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
