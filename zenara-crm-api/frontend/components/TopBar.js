import React, { useEffect, useRef, useState } from 'react'

const NOTIFICATION_READS_STORAGE_KEY = 'zenara_crm_notification_reads'

const formatRelativeTime = (value) => {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const deltaMs = date.getTime() - Date.now()
  const absoluteMs = Math.abs(deltaMs)
  if (absoluteMs < 60 * 1000) return 'just now'

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const units = [
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'minute', ms: 60 * 1000 },
  ]

  for (const entry of units) {
    if (absoluteMs >= entry.ms) {
      return rtf.format(Math.round(deltaMs / entry.ms), entry.unit)
    }
  }

  return 'just now'
}

const NotificationTypeIcon = ({ type }) => {
  if (type === 'follow-up-due') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
      </svg>
    )
  }

  if (type === 'status-change') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12a8 8 0 0 1 13.66-5.66L20 9"></path>
        <path d="M20 4v5h-5"></path>
        <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15"></path>
        <path d="M4 20v-5h5"></path>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  )
}

export default function TopBar({
  searchCompany = '',
  onSearchCompanyChange = () => {},
  onQuickAdd = () => {},
  canQuickAdd = true,
  showFilterToggle = false,
  onToggleFilters = () => {},
  filtersOpen = false,
  activeFilterCount = 0,
  notifications = [],
}) {
  const [theme, setTheme] = useState('light')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState({})
  const notificationsRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined

    const syncTheme = (event) => {
      const nextTheme = event?.detail?.theme
      if (nextTheme === 'dark' || nextTheme === 'light') {
        setTheme(nextTheme)
        return
      }

      const currentTheme = document.documentElement.getAttribute('data-theme')
      setTheme(currentTheme === 'dark' ? 'dark' : 'light')
    }

    syncTheme()
    window.addEventListener('zenara:theme-changed', syncTheme)

    return () => {
      window.removeEventListener('zenara:theme-changed', syncTheme)
    }
  }, [])

  useEffect(() => {
    if (!notificationsOpen) return undefined

    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(NOTIFICATION_READS_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return

      setReadNotificationIds(parsed)
    } catch {
      // Ignore parse/storage errors and continue with in-memory state.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(NOTIFICATION_READS_STORAGE_KEY, JSON.stringify(readNotificationIds))
    } catch {
      // Ignore storage write errors.
    }
  }, [readNotificationIds])

  useEffect(() => {
    const validIds = new Set(notifications.map((notification) => String(notification.id)))

    setReadNotificationIds((prev) => {
      if (Object.keys(prev).length === 0) return prev

      let changed = false
      const next = {}

      Object.entries(prev).forEach(([id, value]) => {
        if (validIds.has(id)) {
          next[id] = value
        } else {
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [notifications, readNotificationIds])

  const handleThemeToggle = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new Event('zenara:theme-toggle-request'))
  }

  const handleNotificationsToggle = () => {
    setNotificationsOpen((prev) => !prev)
  }

  const handleMarkAllRead = () => {
    if (!Array.isArray(notifications) || notifications.length === 0) return

    setReadNotificationIds((prev) => {
      const next = { ...prev }
      notifications.forEach((notification) => {
        next[String(notification.id)] = true
      })
      return next
    })
  }

  const unreadNotifications = notifications.filter((notification) => !readNotificationIds[String(notification.id)])
  const unreadCount = unreadNotifications.length

  return (
    <header className="topbar premium-topbar">
      <div className="command-left">
        <div className="search command-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21 21l-4.35-4.35" stroke="var(--search-icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="11" cy="11" r="5" stroke="var(--search-icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            className="command-search-input"
            placeholder="Search contacts, deals, notes..."
            value={searchCompany}
            onChange={(e) => onSearchCompanyChange(e.target.value)}
            aria-label="Search records"
          />
        </div>

        {showFilterToggle && (
          <button
            type="button"
            className={`topbar-filter-btn ${filtersOpen ? 'active' : ''}`}
            onClick={onToggleFilters}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="topbar-filter-count">{activeFilterCount}</span>
            )}
          </button>
        )}
      </div>

      <div className="command-right">
        <div className="topbar-notifications" ref={notificationsRef}>
          <button
            type="button"
            className="topbar-icon-btn"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            onClick={handleNotificationsToggle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M9.8 20a2.2 2.2 0 0 0 4.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {unreadCount > 0 ? <span className="topbar-icon-alert" aria-hidden="true" /> : null}
          </button>

          {notificationsOpen ? (
            <div className="topbar-notification-panel" role="dialog" aria-label="Notifications panel">
              <div className="topbar-notification-head">
                <h4>Notifications</h4>
                <button
                  type="button"
                  className="topbar-notification-mark-read"
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                >
                  Mark all read
                </button>
              </div>

              {unreadNotifications.length === 0 ? (
                <p className="topbar-notification-empty">No new notifications right now.</p>
              ) : (
                <ul className="topbar-notification-list">
                  {unreadNotifications.map((notification) => {
                    const notificationId = String(notification.id)

                    return (
                      <li key={notificationId} className="topbar-notification-item is-unread">
                        <span className={`topbar-notification-type-icon type-${notification.type}`.trim()}>
                          <NotificationTypeIcon type={notification.type} />
                        </span>

                        <div className="topbar-notification-copy">
                          <div className="topbar-notification-title">{notification.title}</div>
                          <div className="topbar-notification-meta">
                            <span className="topbar-notification-subtitle">{notification.subtitle}</span>
                            <span className="topbar-notification-sep">|</span>
                            <span className="topbar-notification-time">{formatRelativeTime(notification.timestamp)}</span>
                          </div>
                        </div>

                        <span className="topbar-notification-unread-dot" aria-hidden="true" />
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="topbar-icon-btn"
          onClick={handleThemeToggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to night mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to night mode'}
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 2.8v2.3M12 18.9v2.3M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.8 12h2.3M18.9 12h2.3M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {canQuickAdd && (
          <button type="button" className="topbar-action-btn" onClick={onQuickAdd}>
            + New contact
          </button>
        )}
      </div>
    </header>
  )
}
