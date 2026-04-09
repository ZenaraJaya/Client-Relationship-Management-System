import React, { useEffect, useState } from 'react'

export default function DashboardCards({
  totalLeads = 0,
  activeDeals = 0,
  followUpsToday = 0,
  upcomingAppointments = 0,
  upcomingAppointmentClients = [],
  totalLeadClients = [],
  activeDealClients = [],
  todayFollowUpClients = [],
  onOpenListing = () => {},
}) {
  const [appointmentPopupOpen, setAppointmentPopupOpen] = useState(false)
  const [activeMetricPopupId, setActiveMetricPopupId] = useState('')
  const conversionRate = totalLeads > 0 ? Math.round((activeDeals / totalLeads) * 100) : 0

  useEffect(() => {
    if (!appointmentPopupOpen && !activeMetricPopupId) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAppointmentPopupOpen(false)
        setActiveMetricPopupId('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [appointmentPopupOpen, activeMetricPopupId])

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

  const leadRows = totalLeadClients.map((entry) => ({
    key: `lead-${entry.id}`,
    title: entry.company_name || 'Unnamed Company',
    subtitle: entry.contact_person || 'No contact person set',
    badge: entry.status || 'No status',
  }))

  const activeDealRows = activeDealClients.map((entry) => ({
    key: `deal-${entry.id}`,
    title: entry.company_name || 'Unnamed Company',
    subtitle: entry.contact_person || 'No contact person set',
    badge: entry.status || 'No status',
  }))

  const followUpRows = [
    ...todayFollowUpClients.map((entry) => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date)
      const dateValue = Number.isNaN(date.getTime()) ? 0 : date.getTime()
      return {
        key: `followup-${entry.id}-${dateValue}`,
        title: entry.company_name || 'Unnamed Company',
        subtitle: entry.contact_person || 'No contact person set',
        badge: `Follow Up • ${formatAppointmentDate(date)}`,
        sortDate: dateValue,
      }
    }),
    ...upcomingAppointmentClients.map((entry) => {
      const date = entry.date instanceof Date ? entry.date : new Date(entry.date)
      const dateValue = Number.isNaN(date.getTime()) ? 0 : date.getTime()
      return {
        key: `appointment-${entry.id}-${dateValue}`,
        title: entry.company_name || 'Unnamed Company',
        subtitle: entry.contact_person || 'No contact person set',
        badge: `Appointment • ${formatAppointmentDate(date)}`,
        sortDate: dateValue,
      }
    }),
  ]
    .sort((a, b) => a.sortDate - b.sortDate)
    .map(({ sortDate, ...entry }) => entry)

  const metrics = [
    {
      id: 'total-leads',
      title: 'Total Leads',
      value: totalLeads,
      tone: 'soft-green',
      popupTitle: 'All Leads',
      popupSubtitle: `${totalLeads} lead(s) currently tracked in your CRM.`,
      popupRows: leadRows,
      emptyMessage: 'No leads available yet.',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'active-deals',
      title: 'Active Deals',
      value: activeDeals,
      tone: 'soft-blue',
      popupTitle: 'Active Deals',
      popupSubtitle: `${activeDeals} qualified deal(s) currently in progress.`,
      popupRows: activeDealRows,
      emptyMessage: 'No active deals yet.',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M4 12h4l2-5 4 10 2-5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'conversion-rate',
      title: 'Conversion Rate',
      value: `${conversionRate}%`,
      tone: 'soft-amber',
      popupTitle: 'Conversion Breakdown',
      popupSubtitle: `${activeDeals} qualified lead(s) from ${totalLeads} total lead(s).`,
      popupRows: activeDealRows,
      emptyMessage: 'No qualified leads available for conversion yet.',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M7 14l3-3 2 2 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 8h-3M17 8v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'follow-ups',
      title: 'Follow Ups Today',
      value: followUpsToday + upcomingAppointments,
      tone: 'soft-slate',
      popupTitle: 'Follow Ups and Appointments',
      popupSubtitle: `${followUpsToday} follow-up(s) due today and ${upcomingAppointments} appointment(s) in the next 7 days.`,
      popupRows: followUpRows,
      emptyMessage: 'No follow-ups due today and no upcoming appointments in the next 7 days.',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
  ]
  const activeMetricPopup = metrics.find((metric) => metric.id === activeMetricPopupId) || null

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
              onClick={() => {
                setActiveMetricPopupId('')
                setAppointmentPopupOpen(true)
              }}
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
          <button
            key={metric.id}
            type="button"
            className={`panel metric-card metric-card-button ${metric.tone}`}
            onClick={() => {
              setAppointmentPopupOpen(false)
              setActiveMetricPopupId(metric.id)
            }}
            aria-haspopup="dialog"
            aria-expanded={activeMetricPopupId === metric.id}
          >
            <div className="metric-icon">{metric.icon}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-label">{metric.title}</div>
          </button>
        ))}
      </div>

      {activeMetricPopup && (
        <div
          className="appointment-popup-overlay"
          role="presentation"
          onClick={() => setActiveMetricPopupId('')}
        >
          <div
            className="appointment-popup-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="metric-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="appointment-popup-head">
              <div className="appointment-popup-title-group">
                <h3 id="metric-popup-title">{activeMetricPopup.popupTitle}</h3>
                <p className="appointment-popup-subtitle">{activeMetricPopup.popupSubtitle}</p>
              </div>
              <button
                type="button"
                className="appointment-popup-close"
                onClick={() => setActiveMetricPopupId('')}
                aria-label="Close metrics popup"
              >
                &times;
              </button>
            </div>

            {activeMetricPopup.popupRows.length === 0 ? (
              <p className="appointment-popup-empty">{activeMetricPopup.emptyMessage}</p>
            ) : (
              <ul className="appointment-popup-list">
                {activeMetricPopup.popupRows.map((entry) => (
                  <li key={entry.key} className="appointment-popup-item">
                    <div className="appointment-popup-company">{entry.title}</div>
                    <div className="appointment-popup-meta">{entry.subtitle}</div>
                    <div className="appointment-popup-time">{entry.badge}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
