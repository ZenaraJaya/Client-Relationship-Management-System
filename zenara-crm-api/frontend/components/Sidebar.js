import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function Sidebar({
  currentView,
  onViewChange,
  onLogout,
  onProfileClick = () => {},
  onAddAdminClick = () => {},
  userName = 'User',
  profilePhotoUrl = '',
  teamUsers = [],
  currentUserId = null,
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

  const getInitials = (value) =>
    (String(value || 'U')
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U')

  const initials = getInitials(userName)
  const normalizedCurrentUserId = currentUserId === null || currentUserId === undefined ? '' : String(currentUserId)

  const teamMembers = useMemo(() => {
    const source = Array.isArray(teamUsers) ? teamUsers : []
    const seen = new Set()
    const deduped = []
    const currentUserFallback = {
      id: currentUserId,
      name: userName || 'User',
      profile_photo_url: profilePhotoUrl || '',
    }

    source.forEach((member) => {
      if (!member || typeof member !== 'object') return

      const idKey = member.id === null || member.id === undefined ? '' : String(member.id)
      const emailKey = String(member.email || '').trim().toLowerCase()
      const nameKey = String(member.name || '').trim().toLowerCase()
      const uniqueKey = idKey || emailKey || nameKey
      if (!uniqueKey || seen.has(uniqueKey)) return

      seen.add(uniqueKey)
      deduped.push(member)
    })

    if (!deduped.length) {
      return [currentUserFallback]
    }

    if (normalizedCurrentUserId) {
      const currentIndex = deduped.findIndex((member) => String(member?.id ?? '') === normalizedCurrentUserId)

      if (currentIndex > 0) {
        return [
          deduped[currentIndex],
          ...deduped.slice(0, currentIndex),
          ...deduped.slice(currentIndex + 1),
        ]
      }

      if (currentIndex < 0) {
        return [currentUserFallback, ...deduped]
      }
    }

    return deduped
  }, [teamUsers, currentUserId, userName, profilePhotoUrl, normalizedCurrentUserId])

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
            <div className="profile-switcher-menu-title">Teams</div>
            <div className="profile-switcher-team-list" role="none">
              {teamMembers.map((member, index) => {
                const memberId = member?.id
                const memberName = String(member?.name || 'User')
                const memberAvatarUrl = String(member?.profile_photo_url || '').trim()
                const memberInitials = getInitials(memberName)
                const memberKey = `${String(memberId ?? memberName)}-${index}`
                const isCurrentUser = normalizedCurrentUserId
                  ? String(memberId ?? '') === normalizedCurrentUserId
                  : index === 0

                return (
                  <button
                    key={memberKey}
                    type="button"
                    className="profile-switcher-team-row"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      if (isCurrentUser) {
                        onProfileClick()
                      }
                    }}
                  >
                    <span className="profile-switcher-team-avatar" aria-hidden="true">
                      {memberAvatarUrl ? (
                        <img
                          src={memberAvatarUrl}
                          alt={`${memberName} team avatar`}
                          className="profile-switcher-avatar-image"
                        />
                      ) : (
                        <span className="profile-switcher-avatar-fallback">{memberInitials}</span>
                      )}
                    </span>
                    <span className="profile-switcher-team-name">{memberName}</span>
                    {isCurrentUser && (
                      <span className="profile-switcher-team-check" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="profile-switcher-create-team-btn"
              onClick={() => {
                setProfileMenuOpen(false)
                onAddAdminClick()
              }}
            >
              <span className="profile-switcher-create-team-icon" aria-hidden="true">+</span>
              <span>Add Admin</span>
            </button>
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
