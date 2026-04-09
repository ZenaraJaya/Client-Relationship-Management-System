import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function Sidebar({
  currentView,
  onViewChange,
  onLogout,
  onProfileClick = () => {},
  userName = 'User',
  userRole = '',
  profilePhotoUrl = '',
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [spinningNavId, setSpinningNavId] = useState('')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const spinTimerRef = useRef(null)
  const profileMenuRef = useRef(null)

  const navItems = useMemo(
    () => [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        ),
      },
      {
        id: 'listing',
        label: 'Listing',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
        ),
      },
      {
        id: 'clients',
        label: 'Clients',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        ),
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10"></line>
            <line x1="18" y1="20" x2="18" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="16"></line>
          </svg>
        ),
      },
    ],
    []
  )

  const initials = (userName || 'U')
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const roleLabel = (userRole || '').trim().toLowerCase() === 'admin' ? 'Admin' : 'Staff'

  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [profilePhotoUrl])

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!profileMenuOpen) return

    const handlePointerDown = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    if (isCollapsed && profileMenuOpen) {
      setProfileMenuOpen(false)
    }
  }, [isCollapsed, profileMenuOpen])

  const handleNavClick = (viewId) => {
    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current)
    }

    setProfileMenuOpen(false)
    setSpinningNavId(viewId)
    spinTimerRef.current = setTimeout(() => {
      setSpinningNavId('')
    }, 560)

    onViewChange(viewId)
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="brand profile-switcher" ref={profileMenuRef}>
        <button
          type="button"
          className={`profile-switcher-trigger ${profileMenuOpen ? 'open' : ''}`.trim()}
          onClick={() => setProfileMenuOpen((prev) => !prev)}
          title={`Account menu for ${userName}`}
          aria-label="Open account dropdown"
          aria-expanded={profileMenuOpen}
          aria-haspopup="menu"
        >
          <span className="profile-switcher-avatar" aria-hidden="true">
            {profilePhotoUrl && !avatarLoadFailed ? (
              <img
                src={profilePhotoUrl}
                alt={`${userName} profile`}
                className="profile-switcher-avatar-image"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <span className="profile-switcher-avatar-fallback">{initials}</span>
            )}
          </span>

          <span className="profile-switcher-name">{userName || 'User'}</span>

          <span className={`profile-switcher-caret ${profileMenuOpen ? 'open' : ''}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="8 15 12 19 16 15"></polyline>
              <polyline points="8 9 12 5 16 9"></polyline>
            </svg>
          </span>
        </button>

        {!isCollapsed && profileMenuOpen && (
          <div className="profile-switcher-menu" role="menu" aria-label="Account dropdown">
            <button
              type="button"
              className="profile-switcher-menu-item"
              onClick={() => {
                setProfileMenuOpen(false)
                onProfileClick()
              }}
            >
              Profile settings
            </button>
            <div className="profile-switcher-menu-role">{roleLabel}</div>
          </div>
        )}
      </div>

      <nav className="nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link ${currentView === item.id ? 'active' : ''} ${
              spinningNavId === item.id ? 'spin-active' : ''
            }`.trim()}
            onClick={() => handleNavClick(item.id)}
            title={isCollapsed ? item.label : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-ghost-btn"
          onClick={() => setIsCollapsed((prev) => !prev)}
          title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          <span className={`collapse-arrow ${isCollapsed ? 'rotate' : ''}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </span>
          {!isCollapsed && <span className="sidebar-label">Collapse Menu</span>}
        </button>

        <button type="button" className="sidebar-logout-btn" onClick={onLogout}>
          <span className="nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </span>
          {!isCollapsed && <span className="sidebar-label">Logout</span>}
        </button>
      </div>
    </aside>
  )
}
