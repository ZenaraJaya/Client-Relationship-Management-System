import React from 'react'

export default function TopBar({
  searchCompany = '',
  onSearchCompanyChange = () => {},
  onQuickAdd = () => {},
  userName = 'User',
  profilePhotoUrl = '',
  notificationCount = 0,
  outlookButtonLabel = 'Connect Outlook',
  outlookButtonState = 'idle',
  onOutlookButtonClick = () => {},
  reminderButtonLabel = 'Enable laptop reminders',
  reminderButtonState = 'idle',
  onReminderButtonClick = () => {},
  onProfileClick = () => {},
}) {
  const initials = (userName || 'U').trim().charAt(0).toUpperCase()
  const outlookButtonClassName = `outlook-connect-btn${outlookButtonState === 'active' ? ' active' : ''}${outlookButtonState === 'blocked' ? ' blocked' : ''}`
  const reminderButtonClassName = `reminder-toggle-btn${reminderButtonState === 'active' ? ' active' : ''}${reminderButtonState === 'blocked' ? ' blocked' : ''}`

  return (
    <header className="topbar premium-topbar">
      <div className="command-left">
        <div className="search command-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M21 21l-4.35-4.35" stroke="#7f8e89" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="11" cy="11" r="5" stroke="#7f8e89" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            className="command-search-input"
            placeholder="Search Company"
            value={searchCompany}
            onChange={(e) => onSearchCompanyChange(e.target.value)}
            aria-label="Search company"
          />
        </div>
        <button type="button" className="topbar-action-btn" onClick={onQuickAdd}>
          + New Contact
        </button>
      </div>

      <div className="command-right">
        <button type="button" className={outlookButtonClassName} onClick={onOutlookButtonClick}>
          {outlookButtonLabel}
        </button>
        <button type="button" className={reminderButtonClassName} onClick={onReminderButtonClick}>
          {reminderButtonLabel}
        </button>
        <button type="button" className="notify-pill">
          <span>Notifications</span>
          <strong>{notificationCount}</strong>
        </button>
        <button
          type="button"
          className="user-chip"
          title={`Open profile for ${userName}`}
          onClick={onProfileClick}
          aria-label="Open profile settings"
        >
          {profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt={`${userName} profile`} className="user-chip-image" />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  )
}
