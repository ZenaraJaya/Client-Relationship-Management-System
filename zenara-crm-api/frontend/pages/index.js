import React, { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import DashboardCards from '../components/DashboardCards'
import CrmList from '../components/CrmList'
import AddCrmModal from '../components/AddCrmModal'
import AuthPanel from '../components/AuthPanel'

const AUTH_TOKEN_KEY = 'zenara_crm_auth_token'

const getDefaultApiBase = () => {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8000/api`
  }

  return 'http://localhost:8000/api'
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
  const isAdmin = (authUser?.role || '').toLowerCase() === 'admin'

  const toastTimerRef = useRef(null)
  const dateFields = ['last_contact', 'appointment', 'follow_up']

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ visible: true, message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 2600)
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
    setServerPage(1)
    setDeleteConfirm({ open: false, mode: 'single', ids: [], count: 0, isDeleting: false })
  }

  const handleUnauthorized = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(AUTH_TOKEN_KEY)
    }
    setAuthToken('')
    setAuthUser(null)
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

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) }
    if (authToken) headers.Authorization = `Bearer ${authToken}`
    return fetch(url, { ...options, headers })
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin && selectedIds.length > 0) {
      setSelectedIds([])
    }
  }, [isAdmin, selectedIds.length])

  useEffect(() => {
    let mounted = true

    const bootstrapAuth = async () => {
      if (typeof window === 'undefined') {
        if (mounted) setAuthChecking(false)
        return
      }

      const savedToken = sessionStorage.getItem(AUTH_TOKEN_KEY)
      if (!savedToken) {
        if (mounted) setAuthChecking(false)
        return
      }

      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
        if (!res.ok) throw new Error('Invalid session')
        const user = await res.json()

        if (!mounted) return
        setAuthToken(savedToken)
        setAuthUser(user)
        setAuthError('')
      } catch (err) {
        sessionStorage.removeItem(AUTH_TOKEN_KEY)
      } finally {
        if (mounted) setAuthChecking(false)
      }
    }

    bootstrapAuth()
    return () => {
      mounted = false
    }
  }, [apiBase])

  const fetchCrms = async ({ showLoader = true, page = serverPage } = {}) => {
    if (!authToken) return

    if (showLoader) setLoading(true)
    try {
      const pageNumber = Math.max(1, Number(page) || 1)
      const res = await authFetch(`${apiBase}/crms?page=${pageNumber}`)
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

    fetchCrms({ showLoader: true, page: serverPage })
    const intervalId = setInterval(() => {
      fetchCrms({ showLoader: false, page: serverPage })
    }, 30000)
    return () => clearInterval(intervalId)
  }, [apiBase, authToken, serverPage])

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

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token)
      }

      setAuthToken(token)
      setAuthUser(user)
      setAuthError('')
      showToast(mode === 'signup' ? 'Account created. Welcome!' : 'Login successful.')
    } catch (err) {
      setAuthError(`Unable to connect to server at ${apiBase}.`)
    } finally {
      setAuthSubmitting(false)
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
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(AUTH_TOKEN_KEY)
      }
      setAuthToken('')
      setAuthUser(null)
      resetCrmUiState()
      showToast('Logged out successfully.')
    }
  }

  const handleAddCrm = async (formData) => {
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

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(extractErrorMessage(json, `Failed to ${editingItem ? 'update' : 'create'} CRM`))
      }

      setModalOpen(false)
      setEditingItem(null)
      fetchCrms({ page: serverPage })
      showToast(`CRM contact ${editingItem ? 'updated' : 'added'} successfully.`)
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
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleUpdateField = async (item, field, value) => {
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

      if (res.status === 401) {
        handleUnauthorized()
        return
      }
      if (!res.ok) throw new Error(`Failed to update ${field}`)

      showToast('Changes have been made.')
    } catch (err) {
      setData((prev) => {
        if (!prev || !prev.data) return prev
        return {
          ...prev,
          data: prev.data.map((i) => (i.id === item.id ? { ...i, [field]: previousValue } : i)),
        }
      })
      showToast(`Error updating ${field}: ${err.message}`, 'error')
    }
  }

  const getMergedItems = () => {
    const items = data?.data || (Array.isArray(data) ? data : [])
    return [...items].sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''))
  }

  const items = getMergedItems()
  const companyKeyword = searchCompany.trim().toLowerCase()
  const filteredItems = companyKeyword
    ? items.filter((item) => (item.company_name || '').toLowerCase().includes(companyKeyword))
    : items
  const totalLeads = Number(data?.total) || items.length
  const activeDeals = items.filter((item) => item.status === 'Qualified').length

  const toDate = (value) => {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const todayFollowUps = items.filter((item) => {
    const followUpDate = toDate(item.follow_up)
    return followUpDate && followUpDate >= startOfToday && followUpDate <= endOfToday
  }).length

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
  const recentContacts = [...items]
    .filter((item) => toDate(item.updated_at))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 4)

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
        Checking session...
      </div>
    )
  }

  if (!authToken) {
    return <AuthPanel onSubmit={handleAuthSubmit} isLoading={authSubmitting} error={authError} />
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
        userName={authUser?.name || 'User'}
      />
      <main className="main">
        <TopBar
          searchCompany={searchCompany}
          onSearchCompanyChange={setSearchCompany}
          onQuickAdd={() => {
            setEditingItem(null)
            setModalOpen(true)
            if (currentView !== 'listing') setCurrentView('listing')
          }}
          userName={authUser?.name || 'User'}
          notificationCount={todayFollowUps + sevenDayAppointments.length}
        />

        {currentView === 'dashboard' && (
          <>
            <DashboardCards
              totalLeads={totalLeads}
              activeDeals={activeDeals}
              followUpsToday={todayFollowUps}
              upcomingAppointments={sevenDayAppointments.length}
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

              <section className="panel dashboard-panel dashboard-panel-wide">
                <div className="dashboard-panel-head">
                  <h3>Pipeline Snapshot</h3>
                  <span className="dashboard-count-chip">{totalLeads} tracked</span>
                </div>
                <div className="pipeline-track">
                  <div
                    className="pipeline-bar"
                    style={{ width: `${totalLeads ? Math.max(8, Math.round((activeDeals / totalLeads) * 100)) : 8}%` }}
                  ></div>
                </div>
                <div className="pipeline-meta">
                  <span>{activeDeals} active deals</span>
                  <span>{totalLeads > 0 ? Math.round((activeDeals / totalLeads) * 100) : 0}% conversion</span>
                </div>

                <div className="recent-grid">
                  {recentContacts.length === 0 ? (
                    <p className="dashboard-empty">No recent contact updates yet.</p>
                  ) : (
                    recentContacts.map((contact) => (
                      <article key={contact.id} className="recent-card">
                        <h4>{contact.company_name || 'Unnamed Company'}</h4>
                        <p>{contact.contact_person || 'No contact person set'}</p>
                      </article>
                    ))
                  )}
                </div>
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
                      background: '#fee2e2',
                      color: '#991b1b',
                      padding: '8px 16px',
                      border: '1px solid #fecaca',
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
            {error && <div style={{ marginTop: 12, color: '#dc2626' }}>Data Sync Error: {String(error.message || error)}</div>}
            {!loading && (
              <div style={{ marginTop: 12 }}>
                <CrmList
                  items={filteredItems}
                  onEdit={handleEditCrm}
                  onDelete={handleDeleteCrm}
                  onUpdate={handleUpdateField}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  canDelete={isAdmin}
                  rowOffset={rowOffset}
                />
                {data && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
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
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#374151',
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
                          border: '1px solid #d1d5db',
                          background: '#fff',
                          color: '#374151',
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

      {deleteConfirm.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(2, 6, 23, 0.45)',
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
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 20px 30px rgba(15,23,42,0.2)',
              padding: 20,
              border: '1px solid #e5e7eb',
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8, color: '#0f172a' }}>Confirm Delete</h3>
            <p style={{ margin: 0, marginBottom: 18, color: '#475569', lineHeight: 1.5, fontSize: 14 }}>
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
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
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
                  border: '1px solid #dc2626',
                  background: '#dc2626',
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
    </div>
  )
}
