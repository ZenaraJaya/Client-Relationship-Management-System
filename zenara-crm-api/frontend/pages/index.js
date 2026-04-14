import React, { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import DashboardCards from '../components/DashboardCards'
import CrmList from '../components/CrmList'
import AddCrmModal from '../components/AddCrmModal'
import AuthPanel from '../components/AuthPanel'
import ProfileModal from '../components/ProfileModal'

const AUTH_TOKEN_KEY = 'zenara_crm_auth_token'
const DEFAULT_ADVANCED_FILTERS = {
  locations: [],
  industries: [],
  sources: [],
  statuses: [],
  priorities: [],
  appointment: [],
  followUp: [],
}

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

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toDateKey = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_ADVANCED_FILTERS)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [collapsedFilterGroups, setCollapsedFilterGroups] = useState({
    locations: false,
    industries: false,
    priorities: false,
    statuses: false,
  })
  const [filterSearchTerm, setFilterSearchTerm] = useState('')
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
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [calendarMonthCursor, setCalendarMonthCursor] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [calendarSelectedDateKey, setCalendarSelectedDateKey] = useState('')
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
    const today = new Date()
    setData(null)
    setLoading(false)
    setError(null)
    setSelectedIds([])
    setSearchCompany('')
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS)
    setAdvancedFiltersOpen(false)
    setFilterSearchTerm('')
    setCurrentView('dashboard')
    setModalOpen(false)
    setCalendarModalOpen(false)
    setCalendarMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setCalendarSelectedDateKey('')
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

  const handleAuthSubmit = async ({ mode, name, email, password }) => {
    setAuthSubmitting(true)
    setAuthError('')

    try {
      const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login'
      const payload = mode === 'signup' ? { name, role: 'admin', email, password } : { email, password }

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

  const handleOutlookAuthStart = async ({ mode }) => {
    if (typeof window === 'undefined') return

    setAuthSubmitting(true)
    setAuthError('')

    try {
      const authMode = mode === 'signup' ? 'signup' : 'login'
      const authRole = authMode === 'signup' ? 'admin' : 'staff'
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

  const items = useMemo(() => {
    const rows = data?.data || (Array.isArray(data) ? data : [])
    return [...rows].sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''))
  }, [data])

  const normalizeFilterValue = (value) => String(value || '').trim().toLowerCase()
  const buildFilterOptions = (rows, field) => {
    const optionMap = new Map()

    rows.forEach((row) => {
      const rawLabel = String(row?.[field] || '').trim()
      if (!rawLabel) return

      const normalizedValue = normalizeFilterValue(rawLabel)
      if (!normalizedValue) return

      const existing = optionMap.get(normalizedValue)
      if (existing) {
        existing.count += 1
      } else {
        optionMap.set(normalizedValue, { label: rawLabel, count: 1 })
      }
    })

    return Array.from(optionMap.entries())
      .map(([value, payload]) => ({ value, label: payload.label, count: payload.count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  const toggleAdvancedFilterOption = (field, value) => {
    setAdvancedFilters((prev) => {
      const currentValues = Array.isArray(prev[field]) ? prev[field] : []
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value]

      return {
        ...prev,
        [field]: nextValues,
      }
    })
    setSelectedIds([])
  }

  const toggleAdvancedFilterGroup = (field, values) => {
    const nextGroupValues = Array.from(
      new Set((Array.isArray(values) ? values : []).filter((value) => value !== null && value !== undefined && value !== ''))
    )

    if (nextGroupValues.length === 0) return

    setAdvancedFilters((prev) => {
      const currentValues = Array.isArray(prev[field]) ? prev[field] : []
      const hasAllValues = nextGroupValues.every((value) => currentValues.includes(value))
      const nextValues = hasAllValues
        ? currentValues.filter((value) => !nextGroupValues.includes(value))
        : Array.from(new Set([...currentValues, ...nextGroupValues]))

      return {
        ...prev,
        [field]: nextValues,
      }
    })
    setSelectedIds([])
  }

  const removeAdvancedFilterChip = (field, value) => {
    setAdvancedFilters((prev) => ({
      ...prev,
      [field]: (Array.isArray(prev[field]) ? prev[field] : []).filter((entry) => entry !== value),
    }))
    setSelectedIds([])
  }

  const clearAdvancedFilters = () => {
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS)
    setFilterSearchTerm('')
    setSelectedIds([])
  }

  const filterOptions = useMemo(
    () => ({
      locations: buildFilterOptions(items, 'location'),
      industries: buildFilterOptions(items, 'industry'),
      sources: buildFilterOptions(items, 'source'),
      statuses: buildFilterOptions(items, 'status'),
      priorities: buildFilterOptions(items, 'priority'),
    }),
    [items]
  )

  const filterOptionLookup = useMemo(
    () => ({
      locations: Object.fromEntries(filterOptions.locations.map((option) => [option.value, option.label])),
      industries: Object.fromEntries(filterOptions.industries.map((option) => [option.value, option.label])),
      sources: Object.fromEntries(filterOptions.sources.map((option) => [option.value, option.label])),
      statuses: Object.fromEntries(filterOptions.statuses.map((option) => [option.value, option.label])),
      priorities: Object.fromEntries(filterOptions.priorities.map((option) => [option.value, option.label])),
    }),
    [filterOptions]
  )

  const normalizedFilterSearchTerm = filterSearchTerm.trim().toLowerCase()

  const visibleFilterOptions = useMemo(
    () => {
      const filterVisibleOptions = (field, options) => {
        if (!normalizedFilterSearchTerm) return options

        const selectedValues = Array.isArray(advancedFilters[field]) ? advancedFilters[field] : []
        return options.filter((option) => {
          const optionLabel = String(option?.label || '').toLowerCase()
          const optionValue = String(option?.value || '').toLowerCase()
          return (
            optionLabel.includes(normalizedFilterSearchTerm) ||
            optionValue.includes(normalizedFilterSearchTerm) ||
            selectedValues.includes(option.value)
          )
        })
      }

      return {
        locations: filterVisibleOptions('locations', filterOptions.locations),
        industries: filterVisibleOptions('industries', filterOptions.industries),
        priorities: filterVisibleOptions('priorities', filterOptions.priorities),
        statuses: filterVisibleOptions('statuses', filterOptions.statuses),
      }
    },
    [filterOptions, normalizedFilterSearchTerm, advancedFilters]
  )

  const doesItemMatchAdvancedFilters = (item) => {
    const itemLocation = normalizeFilterValue(item.location)
    const itemIndustry = normalizeFilterValue(item.industry)
    const itemSource = normalizeFilterValue(item.source)
    const itemStatus = normalizeFilterValue(item.status)
    const itemPriority = normalizeFilterValue(item.priority)

    if (advancedFilters.locations.length > 0 && !advancedFilters.locations.includes(itemLocation)) {
      return false
    }

    if (advancedFilters.industries.length > 0 && !advancedFilters.industries.includes(itemIndustry)) {
      return false
    }

    if (advancedFilters.sources.length > 0 && !advancedFilters.sources.includes(itemSource)) {
      return false
    }

    if (advancedFilters.statuses.length > 0 && !advancedFilters.statuses.includes(itemStatus)) {
      return false
    }

    if (advancedFilters.priorities.length > 0 && !advancedFilters.priorities.includes(itemPriority)) {
      return false
    }

    if (advancedFilters.appointment.length > 0) {
      const appointmentBucket = hasReminderDateValue(item.appointment) ? 'has' : 'none'
      if (!advancedFilters.appointment.includes(appointmentBucket)) {
        return false
      }
    }

    if (advancedFilters.followUp.length > 0) {
      const followUpBucket = hasReminderDateValue(item.follow_up) ? 'has' : 'none'
      if (!advancedFilters.followUp.includes(followUpBucket)) {
        return false
      }
    }

    return true
  }

  const searchKeyword = searchCompany.trim().toLowerCase()
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (searchKeyword && !matchesCrmSearch(item, searchKeyword)) return false
        return doesItemMatchAdvancedFilters(item)
      }),
    [items, searchKeyword, advancedFilters]
  )

  const activeFilterChips = useMemo(() => {
    const chips = []
    const pushChips = (field, values, prefix, lookup = null) => {
      values.forEach((value) => {
        const baseLabel = lookup ? lookup[value] || value : value
        chips.push({
          id: `${field}:${value}`,
          field,
          value,
          label: `${prefix}: ${baseLabel}`,
        })
      })
    }

    pushChips('locations', advancedFilters.locations, 'Location', filterOptionLookup.locations)
    pushChips('industries', advancedFilters.industries, 'Industry', filterOptionLookup.industries)
    pushChips('sources', advancedFilters.sources, 'Source', filterOptionLookup.sources)
    pushChips('statuses', advancedFilters.statuses, 'Status', filterOptionLookup.statuses)
    pushChips('priorities', advancedFilters.priorities, 'Priority', filterOptionLookup.priorities)
    pushChips('appointment', advancedFilters.appointment, 'Appointment', { has: 'Has', none: 'None' })
    pushChips('followUp', advancedFilters.followUp, 'Follow Up', { has: 'Has', none: 'None' })

    return chips
  }, [advancedFilters, filterOptionLookup])

  const activeAdvancedFilterCount = activeFilterChips.length
  const hasAnyAdvancedFilters = activeAdvancedFilterCount > 0
  const liveApplyResultsLabel = `${filteredItems.length} result${filteredItems.length === 1 ? '' : 's'}`
  const renderFilterGroupIcon = (iconClass) => {
    if (iconClass === 'location') {
      return (
        <svg
          className={`advanced-filter-group-icon-svg ${iconClass}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10z" />
          <circle cx="12" cy="11" r="2.3" />
        </svg>
      )
    }

    if (iconClass === 'industry') {
      return (
        <svg
          className={`advanced-filter-group-icon-svg ${iconClass}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
          <path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h8" />
        </svg>
      )
    }

    if (iconClass === 'priority') {
      return (
        <svg
          className={`advanced-filter-group-icon-svg ${iconClass}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13 2L6 14h5l-1 8 8-12h-5l0-8z" />
        </svg>
      )
    }

    return (
      <svg
        className={`advanced-filter-group-icon-svg ${iconClass}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12.5 2.2 2.2 4.8-4.8" />
      </svg>
    )
  }

  const filterPanelGroups = [
    {
      field: 'locations',
      title: 'Location',
      iconClass: 'location',
      options: visibleFilterOptions.locations,
      emptyLabel: 'No location options on this page.',
    },
    {
      field: 'industries',
      title: 'Industry',
      iconClass: 'industry',
      options: visibleFilterOptions.industries,
      emptyLabel: 'No industry options on this page.',
    },
    {
      field: 'priorities',
      title: 'Priority',
      iconClass: 'priority',
      options: visibleFilterOptions.priorities,
      emptyLabel: 'No priority options on this page.',
    },
    {
      field: 'statuses',
      title: 'Status',
      iconClass: 'status',
      options: visibleFilterOptions.statuses,
      emptyLabel: 'No status options on this page.',
    },
  ]

  const getFilterOptionToneClass = (field, value) => {
    if (field === 'priorities') {
      if (value === 'high') return 'priority-high'
      if (value === 'medium') return 'priority-medium'
      if (value === 'low') return 'priority-low'
    }

    if (field === 'statuses') {
      if (value === 'new') return 'status-new'
      if (value === 'contacted') return 'status-contacted'
      if (value === 'closed') return 'status-closed'
    }

    return ''
  }

  const renderFilterOptionList = (field, options, emptyLabel = 'No options available on this page.') => {
    if (!options.length) {
      return <div className="advanced-filter-empty">{emptyLabel}</div>
    }

    const selectedValues = Array.isArray(advancedFilters[field]) ? advancedFilters[field] : []
    const optionValues = options.map((option) => option.value)
    const selectedOptionCount = optionValues.filter((value) => selectedValues.includes(value)).length
    const areAllOptionsSelected = optionValues.length > 0 && selectedOptionCount === optionValues.length
    const hasSomeOptionsSelected = selectedOptionCount > 0 && !areAllOptionsSelected

    return (
      <div className="advanced-filter-options">
        <label className={`advanced-filter-option advanced-filter-option-select-all ${areAllOptionsSelected ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={areAllOptionsSelected}
            ref={(element) => {
              if (element) {
                element.indeterminate = hasSomeOptionsSelected
              }
            }}
            onChange={() => toggleAdvancedFilterGroup(field, optionValues)}
          />
          <span className="advanced-filter-option-label">Select all</span>
          <span className="advanced-filter-option-count">{optionValues.length}</span>
        </label>
        {options.map((option) => {
          const checked = selectedValues.includes(option.value)
          const toneClass = getFilterOptionToneClass(field, option.value)
          const optionCount = Number(option.count || 0)
          return (
            <label key={`${field}-${option.value}`} className={`advanced-filter-option ${checked ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleAdvancedFilterOption(field, option.value)}
              />
              {toneClass ? <span className={`advanced-filter-option-dot ${toneClass}`} aria-hidden="true" /> : null}
              <span className="advanced-filter-option-label">{option.label}</span>
              <span className="advanced-filter-option-count">{optionCount}</span>
            </label>
          )
        })}
      </div>
    )
  }

  const renderFilterGroup = ({ field, title, iconClass, options, emptyLabel }) => (
    <section key={field} className="advanced-filter-group">
      <button
        type="button"
        className="advanced-filter-group-head"
        onClick={() =>
          setCollapsedFilterGroups((prev) => ({
            ...prev,
            [field]: !prev[field],
          }))
        }
        aria-expanded={!collapsedFilterGroups[field]}
      >
        <span className="advanced-filter-group-title">
          <span className={`advanced-filter-group-icon ${iconClass}`} aria-hidden="true">
            {renderFilterGroupIcon(iconClass)}
          </span>
          <span>{title}</span>
        </span>
        <span className="advanced-filter-group-head-right">
          {advancedFilters[field].length > 0 ? (
            <span className="advanced-filter-group-meta active">{advancedFilters[field].length}</span>
          ) : null}
          <span className={`advanced-filter-group-chevron ${collapsedFilterGroups[field] ? '' : 'open'}`} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="m6 8 4 4 4-4" />
            </svg>
          </span>
        </span>
      </button>
      {!collapsedFilterGroups[field] ? renderFilterOptionList(field, options, emptyLabel) : null}
    </section>
  )

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id))
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visibleIds.has(id))
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev
      }
      return next
    })
  }, [filteredItems])

  const hasVisibleFilterOptions = filterPanelGroups.some((group) => group.options.length > 0)
  const showFilterSearchEmptyState = Boolean(normalizedFilterSearchTerm) && !hasVisibleFilterOptions

  useEffect(() => {
    if (!advancedFiltersOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAdvancedFiltersOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [advancedFiltersOpen])

  useEffect(() => {
    if (!calendarModalOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setCalendarModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [calendarModalOpen])

  const toDate = (value) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

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

  const dashboardUpcomingRows = useMemo(() => {
    return upcomingTouchpoints.slice(0, 4).map((entry) => {
      const type = entry.type === 'Follow Up' ? 'Call' : 'Meet'
      const day = entry.date.toLocaleDateString(undefined, { day: '2-digit' })
      const month = entry.date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
      const time = entry.date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      const duration = type === 'Call' ? '30 min' : '60 min'
      const contactName = entry.contact_person || entry.company_name || 'Upcoming client'
      const topic = type === 'Call' ? 'follow-up call' : 'meeting'

      return {
        id: `${entry.id}-${entry.type}-${entry.date.toISOString()}`,
        day,
        month,
        title: `${contactName} - ${topic}`,
        meta: `${time} | ${duration}`,
        type,
      }
    })
  }, [upcomingTouchpoints])

  const calendarReminderEntries = (() => {
    const rows = []

    items.forEach((item) => {
      const contactName = item.contact_person || item.company_name || 'Unnamed contact'
      const companyName = item.company_name || 'Unnamed company'

      const appointmentDate = toDate(item.appointment)
      if (appointmentDate) {
        rows.push({
          id: `${item.id}-appointment-${appointmentDate.toISOString()}`,
          date: appointmentDate,
          dateKey: toDateKey(appointmentDate),
          title: `${contactName} - appointment`,
          company: companyName,
          timeLabel: appointmentDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
          kind: 'Meet',
          kindClass: 'meet',
        })
      }

      const followUpDate = toDate(item.follow_up)
      if (followUpDate) {
        rows.push({
          id: `${item.id}-followup-${followUpDate.toISOString()}`,
          date: followUpDate,
          dateKey: toDateKey(followUpDate),
          title: `${contactName} - follow-up`,
          company: companyName,
          timeLabel: followUpDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
          kind: 'Call',
          kindClass: 'call',
        })
      }
    })

    return rows.sort((a, b) => a.date - b.date)
  })()

  const calendarEventsByDate = useMemo(() => {
    const grouped = new Map()

    calendarReminderEntries.forEach((entry) => {
      if (!entry.dateKey) return
      const currentEntries = grouped.get(entry.dateKey) || []
      currentEntries.push(entry)
      grouped.set(entry.dateKey, currentEntries)
    })

    return grouped
  }, [calendarReminderEntries])

  const calendarEventCountByDate = useMemo(() => {
    const counts = new Map()

    calendarEventsByDate.forEach((entries, key) => {
      counts.set(key, Array.isArray(entries) ? entries.length : 0)
    })

    return counts
  }, [calendarEventsByDate])

  const calendarSelectedEvents = useMemo(
    () => calendarEventsByDate.get(calendarSelectedDateKey) || [],
    [calendarEventsByDate, calendarSelectedDateKey]
  )

  const calendarSelectedDateLabel = useMemo(() => {
    if (!calendarSelectedDateKey) return ''
    const selectedDate = new Date(`${calendarSelectedDateKey}T00:00:00`)
    if (Number.isNaN(selectedDate.getTime())) return ''

    return selectedDate.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }, [calendarSelectedDateKey])

  const calendarMonthMeta = useMemo(() => {
    const year = calendarMonthCursor.getFullYear()
    const month = calendarMonthCursor.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const monthLabel = firstDayOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const leadingOffset = firstDayOfMonth.getDay()
    const totalCells = Math.ceil((leadingOffset + daysInMonth) / 7) * 7
    const todayKey = toDateKey(new Date())
    const cells = []

    for (let index = 0; index < totalCells; index += 1) {
      const day = index - leadingOffset + 1
      if (day < 1 || day > daysInMonth) {
        cells.push({ id: `empty-${index}`, isCurrentMonth: false })
        continue
      }

      const cellDate = new Date(year, month, day)
      const cellDateKey = toDateKey(cellDate)
      const reminderCount = calendarEventCountByDate.get(cellDateKey) || 0

      cells.push({
        id: cellDateKey,
        isCurrentMonth: true,
        dateKey: cellDateKey,
        day,
        reminderCount,
        isToday: cellDateKey === todayKey,
        isSelected: cellDateKey === calendarSelectedDateKey,
      })
    }

    return { monthLabel, cells }
  }, [calendarMonthCursor, calendarEventCountByDate, calendarSelectedDateKey])

  const openCalendarReminderModal = () => {
    const nextUpcomingEvent = calendarReminderEntries.find((entry) => entry.date >= now)
    const seedDate = nextUpcomingEvent?.date || calendarReminderEntries[0]?.date || now
    const seedDateKey = toDateKey(seedDate)

    setCalendarMonthCursor(new Date(seedDate.getFullYear(), seedDate.getMonth(), 1))
    setCalendarSelectedDateKey(seedDateKey)
    setCalendarModalOpen(true)
  }

  const closeCalendarReminderModal = () => {
    setCalendarModalOpen(false)
  }

  const goToPreviousCalendarMonth = () => {
    setCalendarMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextCalendarMonth = () => {
    setCalendarMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

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

  const renderAnimatedPreloader = ({ title, copy }) => (
    <div className="auth-success-preloader" role="status" aria-live="polite" aria-label={title}>
      <div className="auth-success-preloader-card">
        <div className="auth-success-orbit" aria-hidden="true">
          <span className="auth-success-orbit-ring auth-success-orbit-ring-one" />
          <span className="auth-success-orbit-ring auth-success-orbit-ring-two" />
          <span className="auth-success-orbit-core" />
        </div>
        <p className="auth-success-preloader-kicker">Zenara CRM</p>
        <h2 className="auth-success-preloader-title">{title}</h2>
        <p className="auth-success-preloader-copy">{copy}</p>
        <div className="auth-success-progress-track" aria-hidden="true">
          <span className="auth-success-progress-bar" />
        </div>
      </div>
    </div>
  )

  if (authChecking) {
    return renderAnimatedPreloader({
      title: 'Initializing CRM',
      copy: 'Checking your secure session and preparing your dashboard...',
    })
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
          if (v !== 'listing') {
            setSearchCompany('')
            setAdvancedFiltersOpen(false)
            setFilterSearchTerm('')
          }
        }}
        onLogout={handleLogout}
        onProfileClick={() => setProfileOpen(true)}
        onAddAdminClick={handleAddAdmin}
        onOtherUserClick={openSwitchUserLogin}
        userName={authUser?.name || 'User'}
        userRole={authUser?.role || ''}
        listingBadgeCount={items.length}
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
          showFilterToggle={false}
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
              userName={authUser?.name || ''}
              onOpenListing={() => setCurrentView('listing')}
            />

            <div className="dashboard-grid">
              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <h3>Today&apos;s Priorities</h3>
                  <span className="dashboard-count-chip">{todayFollowUps}</span>
                </div>
                {todayFollowUps === 0 ? (
                  <>
                    <p className="dashboard-empty">No follow-ups due today.</p>
                    <p className="dashboard-empty dashboard-empty-subtle">
                      Great time to plan ahead - add contacts or schedule reminders for your leads.
                    </p>
                  </>
                ) : (
                  <p className="dashboard-empty">{todayFollowUps} follow-up reminder(s) are due today.</p>
                )}
                <button type="button" className="panel-inline-action" onClick={() => setCurrentView('listing')}>
                  Review contact list
                </button>
              </section>

              <section className="panel dashboard-panel">
                <div className="dashboard-panel-head">
                  <h3>Upcoming touchpoints</h3>
                  <span className="dashboard-count-chip">{dashboardUpcomingRows.length}</span>
                </div>
                {dashboardUpcomingRows.length === 0 ? (
                  <p className="dashboard-empty">No upcoming touchpoints found in your listing yet.</p>
                ) : (
                  <ul className="touchpoint-list touchpoint-list-modern">
                    {dashboardUpcomingRows.map((entry) => (
                      <li key={entry.id} className="touchpoint-item touchpoint-item-modern">
                        <div className="touchpoint-date-chip" aria-hidden="true">
                          <span className="touchpoint-date-day">{entry.day}</span>
                          <span className="touchpoint-date-month">{entry.month}</span>
                        </div>
                        <div className="touchpoint-main">
                          <div className="touchpoint-company">{entry.title}</div>
                          <div className="touchpoint-meta">{entry.meta}</div>
                        </div>
                        <span className={`touchpoint-type-pill ${entry.type.toLowerCase()}`}>{entry.type}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="panel-inline-action panel-inline-action-secondary"
                  onClick={openCalendarReminderModal}
                >
                  View full calendar
                </button>
              </section>
            </div>
          </>
        )}

        {currentView === 'listing' && (
          <div className={`panel table-card ${advancedFiltersOpen ? 'with-filter-drawer' : ''}`}>
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

            <div className="advanced-filters-shell">
              <div className="advanced-filters-main">
                <div className="advanced-filters-bar">
                  <div className="advanced-filters-bar-top">
                    <div className="advanced-filters-toolbar-left">
                      <button
                        type="button"
                        className={`advanced-filters-toggle ${advancedFiltersOpen ? 'active' : ''}`}
                        onClick={() => setAdvancedFiltersOpen((prev) => !prev)}
                        aria-expanded={advancedFiltersOpen}
                        aria-controls="advanced-filters-drawer"
                      >
                        <span className="advanced-filters-toggle-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="5.5" />
                            <path d="m15.5 15.5 4 4" />
                          </svg>
                        </span>
                        <span>Filters</span>
                        <span className="advanced-filters-toggle-caret" aria-hidden="true">
                          {advancedFiltersOpen ? '^' : 'v'}
                        </span>
                        {activeAdvancedFilterCount > 0 && (
                          <span className="advanced-filters-toggle-count">{activeAdvancedFilterCount}</span>
                        )}
                      </button>
                      <button type="button" className="advanced-filters-sort" aria-label="Sort contacts">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M5 7h14M8 12h8M10 17h4" />
                        </svg>
                        <span>Sort</span>
                      </button>
                    </div>
                    <div className="advanced-filters-summary">
                      Showing {filteredItems.length} of {items.length} contacts
                    </div>
                  </div>

                  {hasAnyAdvancedFilters && (
                    <div className="advanced-filters-toolbar-chips" aria-label="Active filters">
                      {activeFilterChips.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          className="advanced-filter-chip"
                          onClick={() => removeAdvancedFilterChip(chip.field, chip.value)}
                        >
                          <span>{chip.label}</span>
                          <span className="advanced-filter-chip-close" aria-hidden="true">&times;</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {loading && <div style={{ marginTop: 12 }}>Loading contacts...</div>}
                {error && <div style={{ marginTop: 12, color: 'var(--table-action-delete-text)' }}>Data Sync Error: {String(error.message || error)}</div>}
                {!loading && (
                  <div style={{ marginTop: 12 }}>
                    <CrmList
                      items={filteredItems}
                      emptyMessage={
                        searchKeyword || hasAnyAdvancedFilters
                          ? 'No contacts match your current search and filters.'
                          : 'No CRM contacts found.'
                      }
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

              {advancedFiltersOpen && (
                <aside
                  id="advanced-filters-drawer"
                  className="advanced-filters-drawer"
                  role="dialog"
                  aria-modal="false"
                  aria-label="Filter contacts"
                >
                  <div className="advanced-filters-drawer-head">
                    <h4>Filter contacts</h4>
                    <button
                      type="button"
                      className="advanced-filters-drawer-close"
                      onClick={() => setAdvancedFiltersOpen(false)}
                      aria-label="Close filters drawer"
                    >
                      <svg viewBox="0 0 20 20" fill="none">
                        <path d="M5 5l10 10M15 5 5 15" />
                      </svg>
                    </button>
                  </div>

                  <div className="advanced-filters-drawer-body">
                    <div className="advanced-filters-search-wrap">
                      <div className="advanced-filters-search-input-wrap">
                        <span className="advanced-filters-search-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="5.5" />
                            <path d="m15.5 15.5 4 4" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          className="advanced-filters-search-input"
                          placeholder="Search filter options..."
                          value={filterSearchTerm}
                          onChange={(event) => setFilterSearchTerm(event.target.value)}
                          aria-label="Search filter options"
                        />
                      </div>
                    </div>

                    {showFilterSearchEmptyState ? (
                      <div className="advanced-filter-search-empty">
                        <p>No filter options matched "{filterSearchTerm.trim()}".</p>
                        <button
                          type="button"
                          className="advanced-filter-search-empty-action"
                          onClick={() => setFilterSearchTerm('')}
                        >
                          Clear search and try again
                        </button>
                      </div>
                    ) : (
                      <div className="advanced-filter-grid">
                        {filterPanelGroups.map((group) => renderFilterGroup(group))}
                      </div>
                    )}
                  </div>

                  <div className="advanced-filters-drawer-footer">
                    <button
                      type="button"
                      className="advanced-filters-reset"
                      onClick={clearAdvancedFilters}
                      disabled={!hasAnyAdvancedFilters}
                    >
                      Reset all
                    </button>
                    <button
                      type="button"
                      className="advanced-filters-apply"
                      onClick={() => setAdvancedFiltersOpen(false)}
                    >
                      <svg viewBox="0 0 20 20" fill="none">
                        <path d="m4.5 10 3.4 3.4 7.6-7.6" />
                      </svg>
                      {`Apply \u00b7 ${liveApplyResultsLabel}`}
                    </button>
                  </div>
                </aside>
              )}
            </div>
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

      {calendarModalOpen && (
        <div className="calendar-reminder-overlay" onClick={closeCalendarReminderModal}>
          <div
            className="calendar-reminder-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-reminder-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="calendar-reminder-head">
              <div className="calendar-reminder-title-wrap">
                <h3 id="calendar-reminder-title">Calendar reminders</h3>
                <p className="calendar-reminder-subtitle">
                  Fetched from Listing contacts: {calendarReminderEntries.length} reminder(s)
                </p>
              </div>
              <button
                type="button"
                className="calendar-reminder-close"
                onClick={closeCalendarReminderModal}
                aria-label="Close calendar reminder modal"
              >
                &times;
              </button>
            </div>

            <div className="calendar-reminder-body">
              <section className="calendar-month-panel">
                <div className="calendar-month-head">
                  <button
                    type="button"
                    className="calendar-month-nav"
                    onClick={goToPreviousCalendarMonth}
                    aria-label="Previous month"
                  >
                    &#8249;
                  </button>
                  <div className="calendar-month-label">{calendarMonthMeta.monthLabel}</div>
                  <button
                    type="button"
                    className="calendar-month-nav"
                    onClick={goToNextCalendarMonth}
                    aria-label="Next month"
                  >
                    &#8250;
                  </button>
                </div>

                <div className="calendar-weekday-row">
                  {CALENDAR_WEEKDAYS.map((weekday) => (
                    <span key={weekday} className="calendar-weekday-cell">
                      {weekday}
                    </span>
                  ))}
                </div>

                <div className="calendar-day-grid">
                  {calendarMonthMeta.cells.map((cell) => {
                    if (!cell.isCurrentMonth) {
                      return <span key={cell.id} className="calendar-day-filler" aria-hidden="true" />
                    }

                    return (
                      <button
                        key={cell.id}
                        type="button"
                        className={`calendar-day-button ${cell.isSelected ? 'selected' : ''} ${cell.isToday ? 'today' : ''} ${
                          cell.reminderCount > 0 ? 'has-reminders' : ''
                        }`.trim()}
                        onClick={() => setCalendarSelectedDateKey(cell.dateKey)}
                        aria-label={`${cell.day}, ${cell.reminderCount} reminder(s)`}
                      >
                        <span className="calendar-day-number">{cell.day}</span>
                        {cell.reminderCount > 0 && (
                          <span className="calendar-day-count">{cell.reminderCount}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="calendar-reminder-list-panel">
                <div className="calendar-reminder-list-head">
                  <h4>{calendarSelectedDateLabel || 'Select a date'}</h4>
                  <span className="calendar-reminder-list-count">{calendarSelectedEvents.length}</span>
                </div>

                {calendarSelectedEvents.length === 0 ? (
                  <p className="calendar-reminder-empty">No reminders for this date.</p>
                ) : (
                  <ul className="calendar-reminder-list">
                    {calendarSelectedEvents.map((entry) => (
                      <li key={entry.id} className="calendar-reminder-item">
                        <div className="calendar-reminder-item-main">
                          <div className="calendar-reminder-item-title">{entry.title}</div>
                          <div className="calendar-reminder-item-meta">
                            {entry.timeLabel} | {entry.company}
                          </div>
                        </div>
                        <span className={`calendar-reminder-item-kind ${entry.kindClass}`}>{entry.kind}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

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

      {authSuccessPreloader.visible &&
        renderAnimatedPreloader({
          title: authSuccessPreloader.title,
          copy: authSuccessPreloader.copy,
        })}
    </div>
  )
}

