import React from 'react'

const getFirstName = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return 'there'
  return raw.split(/\s+/)[0]
}

export default function DashboardCards({
  totalLeads = 0,
  activeDeals = 0,
  followUpsToday = 0,
  upcomingAppointments = 0,
  onOpenListing = () => {},
  userName = '',
}) {
  const firstName = getFirstName(userName)
  const conversionRate = totalLeads > 0 ? Math.round((activeDeals / totalLeads) * 100) : 0

  const metrics = [
    {
      id: 'total-leads',
      title: 'Total leads',
      value: totalLeads,
      helper: 'Added this week: -',
      tone: 'soft-neutral',
      trend: '-',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M18.5 8.5h4M20.5 6.5v4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      id: 'active-deals',
      title: 'Active deals',
      value: activeDeals,
      helper: activeDeals > 0 ? `${activeDeals} open in pipeline` : 'No deals in pipeline',
      tone: 'soft-neutral',
      trend: '-',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="7" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 12h17" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      id: 'conversion-rate',
      title: 'Conversion rate',
      value: `${conversionRate}%`,
      helper: 'Target: 15%',
      tone: 'soft-amber',
      trend: '-',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 14l3-3 2 2 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 8h-3M17 8v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'follow-ups',
      title: 'Follow-ups today',
      value: followUpsToday,
      helper: `Next: ${upcomingAppointments > 0 ? `${upcomingAppointments} scheduled` : 'none scheduled'}`,
      tone: 'soft-green',
      trend: '-',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <section className="cards premium-cards">
      <div className="panel premium-hero">
        <div className="hero-left">
          <div className="hero-tag">Zenara Command Center</div>
          <h2>Welcome back, {firstName}</h2>
          <p className="small hero-subtitle">Track leads, appointments, and next actions with less friction and clearer visibility.</p>
          <div className="hero-actions">
            <button type="button" className="hero-primary-btn" onClick={onOpenListing}>
              <span aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span>Open listing</span>
            </button>
            <span className="hero-meta-chip">
              <span className="hero-meta-dot" aria-hidden="true" />
              <span>{upcomingAppointments} upcoming appointments</span>
            </span>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article key={metric.id} className={`panel metric-card ${metric.tone}`}>
            <div className="metric-top-row">
              <div className="metric-icon">{metric.icon}</div>
              <div className="metric-trend">{metric.trend}</div>
            </div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-label">{metric.title}</div>
            <div className="metric-helper">{metric.helper}</div>
          </article>
        ))}
      </div>
    </section>
  )
}
