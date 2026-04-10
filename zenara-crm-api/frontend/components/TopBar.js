import React from 'react'

export default function TopBar({
  searchCompany = '',
  onSearchCompanyChange = () => {},
  onQuickAdd = () => {},
  canQuickAdd = true,
}) {
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
            placeholder="Search all fields"
            value={searchCompany}
            onChange={(e) => onSearchCompanyChange(e.target.value)}
            aria-label="Search records"
          />
        </div>
        {canQuickAdd && (
          <button type="button" className="topbar-action-btn" onClick={onQuickAdd}>
            + New Contact
          </button>
        )}
      </div>
    </header>
  )
}
