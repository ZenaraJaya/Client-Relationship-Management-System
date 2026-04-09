import React, { useEffect, useState } from 'react'

export default function DashboardCards({
  totalLeads = 0,
  activeDeals = 0,
  followUpsToday = 0,
  upcomingAppointments = 0,
  upcomingAppointmentClients = [],
  onOpenListing = () => {},
}) {
  const [appointmentPopupOpen, setAppointmentPopupOpen] = useState(false)
  const conversionRate = totalLeads > 0 ? Math.round((activeDeals / totalLeads) * 100) : 0

  useEffect(() => {
    if (!appointmentPopupOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAppointmentPopupOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [appointmentPopupOpen])

  const formatAppointmentDate = (value) => {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return 'Date not available'

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const metrics = [
    {
      title: 'Total Leads',
      value: totalLeads,
      tone: 'soft-green',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: 'Active Deals',
      value: activeDeals,
      tone: 'soft-blue',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M4 12h4l2-5 4 10 2-5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'Conversion Rate',
      value: `${conversionRate}%`,
      tone: 'soft-amber',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7 14l3-3 2 2 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 8h-3M17 8v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: 'Follow Ups Today',
      value: followUpsToday + upcomingAppointments,
      tone: 'soft-slate',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  return (
    <section className="cards premium-cards">
      <div className="panel premium-hero">
        <div className="hero-left">
          <div className="hero-tag">Zenara Command Center</div>
          <h2>Welcome to Zenara CRM</h2>
          <p className="small hero-subtitle">
            Track leads, set appointments, and move every client to the next step with less friction and better signal.
          </p>
          <div className="hero-actions">
            <button type="button" className="hero-primary-btn" onClick={onOpenListing}>
              Open Listing
            </button>
            <button
              type="button"
              className="hero-meta-chip hero-meta-chip-button"
              onClick={() => setAppointmentPopupOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={appointmentPopupOpen}
            >
              {upcomingAppointments} upcoming appointment(s)
            </button>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <div key={metric.title} className={`panel metric-card ${metric.tone}`}>
            <div className="metric-icon">{metric.icon}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-label">{metric.title}</div>
          </div>
        ))}
      </div>

      {appointmentPopupOpen && (
        <div
          className="appointment-popup-overlay"
          role="presentation"
          onClick={() => setAppointmentPopupOpen(false)}
        >
          <div
            className="appointment-popup-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="appointment-popup-head">
              <h3 id="appointment-popup-title">Clients with upcoming appointments</h3>
              <button
                type="button"
                className="appointment-popup-close"
                onClick={() => setAppointmentPopupOpen(false)}
                aria-label="Close upcoming appointments popup"
              >
                &times;
              </button>
            </div>

            {upcomingAppointmentClients.length === 0 ? (
              <p className="appointment-popup-empty">No upcoming appointments in the next 7 days.</p>
            ) : (
              <ul className="appointment-popup-list">
                {upcomingAppointmentClients.map((entry) => (
                  <li
                    key={`${entry.id}-${entry.date instanceof Date ? entry.date.getTime() : String(entry.date)}`}
                    className="appointment-popup-item"
                  >
                    <div className="appointment-popup-company">{entry.company_name || 'Unnamed Company'}</div>
                    <div className="appointment-popup-meta">{entry.contact_person || 'No contact person set'}</div>
                    <div className="appointment-popup-time">{formatAppointmentDate(entry.date)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
