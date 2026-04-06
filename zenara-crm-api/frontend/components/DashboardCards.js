import React from 'react'

export default function DashboardCards({
  totalLeads = 0,
  activeDeals = 0,
  followUpsToday = 0,
  upcomingAppointments = 0,
  onOpenListing = () => {},
}) {
  const conversionRate = totalLeads > 0 ? Math.round((activeDeals / totalLeads) * 100) : 0

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
            <div className="hero-meta-chip">{upcomingAppointments} upcoming appointment(s)</div>
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
    </section>
  )
}
