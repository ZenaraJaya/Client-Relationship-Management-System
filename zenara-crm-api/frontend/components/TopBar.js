import React from 'react'

export default function TopBar({
  searchCompany = '',
  onSearchCompanyChange = () => {},
  onQuickAdd = () => {},
  canQuickAdd = true,
  showFilterToggle = false,
  onToggleFilters = () => {},
  filtersOpen = false,
  activeFilterCount = 0,
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
        <button type="button" className="topbar-icon-btn" aria-label="Notifications">
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
          <span className="topbar-icon-alert" aria-hidden="true" />
        </button>

        <button type="button" className="topbar-icon-btn" aria-label="Display settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 2.8v2.3M12 18.9v2.3M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.8 12h2.3M18.9 12h2.3M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
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
