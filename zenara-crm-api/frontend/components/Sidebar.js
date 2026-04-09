import React, { useEffect, useMemo, useRef, useState } from 'react'

const getInitials = (value) => {
  const text = String(value || '').trim()
  if (!text) return 'U'

  const initials = text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)

  if (initials) return initials

  return text.slice(0, 2).toUpperCase() || 'U'
}

export default function Sidebar({
  currentView,
  onViewChange,
  onLogout,
  onProfileClick = () => {},
  userId = null,
  userName = 'User',
  userRole = '',
  profilePhotoUrl = '',
  teamMembers = [],
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [spinningNavId, setSpinningNavId] = useState('')
  const [teamMenuOpen, setTeamMenuOpen] = useState(false)
  const spinTimerRef = useRef(null)
  const teamMenuRef = useRef(null)

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

  const initials = getInitials(userName || 'U')
  const firstName = (userName || 'User').trim().split(' ')[0]
  const role = (userRole || '').trim().toLowerCase()
  const isAdmin = role === 'admin'
  const roleLabel = isAdmin ? 'Admin' : 'Staff'

  const normalizedTeamMembers = useMemo(() => {
    const source = Array.isArray(teamMembers) ? teamMembers : []
    const seen = new Set()
    const normalized = []

    source.forEach((member, index) => {
      if (!member || typeof member !== 'object') return

      const rawId = member.id ?? member.email ?? member.name ?? `member-${index}`
      const key = String(rawId)
      if (seen.has(key)) return
      seen.add(key)

      const resolvedName =
        String(member.name || '').trim() ||
        String(member.email || '').trim().split('@')[0] ||
        'Team Member'

      normalized.push({
        id: rawId,
        name: resolvedName,
        email: String(member.email || '').trim(),
        role: String(member.role || 'staff').trim().toLowerCase() || 'staff',
        initials: String(member.initials || '').trim() || getInitials(resolvedName),
        profilePhotoUrl: String(member.profile_photo_url || '').trim(),
        isSessionActive: Boolean(member.is_session_active),
      })
    })

    if (normalized.length === 0) {
      normalized.push({
        id: userId || 'current-user',
        name: userName || 'User',
        email: '',
        role: role || 'staff',
        initials: getInitials(userName || 'U'),
        profilePhotoUrl: profilePhotoUrl || '',
        isSessionActive: true,
      })
    }

    return normalized
  }, [teamMembers, userId, userName, role, profilePhotoUrl])

  const selectedTeam = useMemo(() => {
    if (normalizedTeamMembers.length === 0) return null

    const currentMember = normalizedTeamMembers.find((member) => String(member.id) === String(userId))
    return currentMember || normalizedTeamMembers[0]
  }, [normalizedTeamMembers, userId])

  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [profilePhotoUrl])

  useEffect(() => {
    if (!teamMenuOpen) return

    const handlePointerDown = (event) => {
      if (teamMenuRef.current && !teamMenuRef.current.contains(event.target)) {
        setTeamMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setTeamMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [teamMenuOpen])

  useEffect(() => {
    if (isCollapsed || !isAdmin) {
      setTeamMenuOpen(false)
    }
  }, [isCollapsed, isAdmin])

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) {
        clearTimeout(spinTimerRef.current)
      }
    }
  }, [])

  const handleNavClick = (viewId) => {
    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current)
    }

    setTeamMenuOpen(false)
    setSpinningNavId(viewId)
    spinTimerRef.current = setTimeout(() => {
      setSpinningNavId('')
    }, 560)

    onViewChange(viewId)
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <button
          type="button"
          className="avatar profile-avatar-button"
          onClick={onProfileClick}
          title={`Open profile for ${userName}`}
          aria-label="Open profile settings"
        >
          {profilePhotoUrl && !avatarLoadFailed ? (
            <img
              src={profilePhotoUrl}
              alt={`${userName} profile`}
              className="avatar-image"
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            initials
          )}
        </button>
        <div className="brand-copy">
          <div className="brand-title">{roleLabel} Dashboard</div>
          <div className="small">Welcome back, {firstName}</div>
        </div>
      </div>

      {isAdmin && (
        <div className="team-switcher-wrap" ref={teamMenuRef}>
          <button
            type="button"
            className={`team-switcher-trigger ${teamMenuOpen ? 'open' : ''}`.trim()}
            onClick={() => setTeamMenuOpen((prev) => !prev)}
            aria-expanded={teamMenuOpen}
            aria-haspopup="dialog"
          >
            <span className="team-switcher-avatar">
              <span className="team-switcher-avatar-fallback">{selectedTeam?.initials || initials}</span>
              {selectedTeam?.profilePhotoUrl ? (
                <img
                  src={selectedTeam.profilePhotoUrl}
                  alt={`${selectedTeam.name} avatar`}
                  className="team-switcher-avatar-image"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}
            </span>
            <span className="team-switcher-name">{selectedTeam?.name || userName}</span>
            <span className={`team-switcher-caret ${teamMenuOpen ? 'open' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8 15 12 19 16 15"></polyline>
                <polyline points="8 9 12 5 16 9"></polyline>
              </svg>
            </span>
          </button>

          {!isCollapsed && teamMenuOpen && (
            <div className="team-switcher-popover" role="dialog" aria-label="Teams list">
              <div className="team-switcher-popover-title">Teams</div>
              <ul className="team-switcher-list">
                {normalizedTeamMembers.map((member) => {
                  const isCurrent = String(member.id) === String(userId)
                  return (
                    <li key={`team-member-${member.id}`} className={`team-switcher-item ${isCurrent ? 'active' : ''}`.trim()}>
                      <span className="team-member-avatar">
                        <span className="team-member-avatar-fallback">{member.initials}</span>
                        {member.profilePhotoUrl ? (
                          <img
                            src={member.profilePhotoUrl}
                            alt={`${member.name} avatar`}
                            className="team-member-avatar-image"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                      </span>
                      <span className="team-member-name">{member.name}</span>
                      {isCurrent && <span className="team-member-check">✓</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

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
