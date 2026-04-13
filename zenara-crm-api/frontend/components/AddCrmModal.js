import React, { useEffect, useMemo, useState } from 'react'

const INITIAL_STATE = {
  company_name: '',
  industry: '',
  location: '',
  contact_person: '',
  role: '',
  phone: '',
  email: '',
  source: '',
  pain_point: '',
  remarks: '',
  priority: 'Medium',
  status: 'New',
  last_contact: '',
  appointment: '',
  follow_up: '',
}

const INDUSTRY_OPTIONS = ['Oil & Gas', 'Entertainment', 'Technology', 'Finance', 'Healthcare', 'Education']
const SOURCE_OPTIONS = ['Website', 'Referral', 'LinkedIn', 'Cold Outreach', 'Event', 'Other']
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low']
const STATUS_OPTIONS = ['New', 'Contacted', 'Qualified', 'Closed']

const getCanonicalOption = (value, options, fallback) => {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  const match = options.find((option) => option.toLowerCase() === raw.toLowerCase())
  return match || fallback
}

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDateTimeInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const toDateInputValue = (value) => {
  if (!value) return ''

  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    if (value.includes('T')) return value.split('T')[0]
    if (/^\d{4}-\d{2}-\d{2}\s/.test(value)) return value.split(' ')[0]

    const parsed = new Date(value)
    return formatDateInput(parsed)
  }

  if (value instanceof Date) {
    return formatDateInput(value)
  }

  if (value && typeof value.toDate === 'function') {
    return formatDateInput(value.toDate())
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return formatDateInput(new Date(value.seconds * 1000))
  }

  return ''
}

const toDateTimeInputValue = (value) => {
  if (!value) return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T09:00`

    const normalized = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/.test(trimmed)
      ? trimmed.replace(' ', 'T')
      : trimmed

    return formatDateTimeInput(new Date(normalized))
  }

  if (value instanceof Date) {
    return formatDateTimeInput(value)
  }

  if (value && typeof value.toDate === 'function') {
    return formatDateTimeInput(value.toDate())
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return formatDateTimeInput(new Date(value.seconds * 1000))
  }

  return ''
}

const getInitials = (value) => {
  const tokens = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!tokens.length) return '??'
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0]}${tokens[tokens.length - 1][0]}`.toUpperCase()
}

const formatLastUpdated = (value) => {
  if (!value) return 'Not synced yet'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not synced yet'

  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getStatusToneClass = (status) => {
  const key = String(status || '').trim().toLowerCase()
  if (key === 'contacted') return 'contacted'
  if (key === 'qualified') return 'qualified'
  if (key === 'closed') return 'closed'
  return 'new'
}

export default function AddCrmModal({ isOpen, onClose, onSubmit, isLoading, editingItem }) {
  const [form, setForm] = useState(INITIAL_STATE)

  useEffect(() => {
    if (editingItem) {
      setForm({
        ...INITIAL_STATE,
        ...editingItem,
        priority: getCanonicalOption(editingItem.priority, PRIORITY_OPTIONS, 'Medium'),
        status: getCanonicalOption(editingItem.status, STATUS_OPTIONS, 'New'),
      })
    } else {
      setForm(INITIAL_STATE)
    }
  }, [editingItem, isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handlePriorityClick = (priorityValue) => {
    setForm((prev) => ({ ...prev, priority: priorityValue }))
  }

  const handleStatusClick = (statusValue) => {
    setForm((prev) => ({ ...prev, status: statusValue }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!String(form.company_name || '').trim()) {
      window.alert('Company Name is required')
      return
    }

    await onSubmit({
      ...form,
      priority: getCanonicalOption(form.priority, PRIORITY_OPTIONS, 'Medium'),
      status: getCanonicalOption(form.status, STATUS_OPTIONS, 'New'),
    })
  }

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && !isLoading) {
      onClose()
    }
  }

  const openDatePicker = (event) => {
    if (typeof event.target.showPicker === 'function') {
      event.target.showPicker()
    }
  }

  const modalTitle = editingItem ? 'Edit contact' : 'Add contact'
  const actionLabel = editingItem ? 'Update contact' : 'Add contact'
  const statusLabel = getCanonicalOption(form.status, STATUS_OPTIONS, 'New')
  const statusToneClass = getStatusToneClass(statusLabel)
  const identityName = String(form.contact_person || '').trim() || 'Contact'
  const identityRole = String(form.role || '').trim() || '-'
  const identityCompany = String(form.company_name || '').trim() || '-'
  const initials = getInitials(identityName)

  const industryOptions = useMemo(() => {
    const currentValue = String(form.industry || '').trim()
    if (currentValue && !INDUSTRY_OPTIONS.some((option) => option.toLowerCase() === currentValue.toLowerCase())) {
      return [currentValue, ...INDUSTRY_OPTIONS]
    }
    return INDUSTRY_OPTIONS
  }, [form.industry])

  const sourceOptions = useMemo(() => {
    const currentValue = String(form.source || '').trim()
    if (currentValue && !SOURCE_OPTIONS.some((option) => option.toLowerCase() === currentValue.toLowerCase())) {
      return [currentValue, ...SOURCE_OPTIONS]
    }
    return SOURCE_OPTIONS
  }, [form.source])

  if (!isOpen) return null

  return (
    <div className="crm-contact-overlay" onClick={handleOverlayClick}>
      <div className="crm-contact-modal" role="dialog" aria-modal="true" aria-labelledby="crm-contact-title">
        <div className="crm-contact-header">
          <span className="crm-contact-title" id="crm-contact-title">{modalTitle}</span>
          <button
            type="button"
            className="crm-contact-close"
            onClick={onClose}
            title="Close"
            aria-label="Close modal"
            disabled={isLoading}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11">
              <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="crm-contact-identity">
          <div className="crm-contact-avatar">{initials}</div>
          <div className="crm-contact-identity-info">
            <div className="crm-contact-identity-name">{identityName}</div>
            <div className="crm-contact-identity-meta">
              <span>{identityRole}</span>
              <span className="crm-contact-meta-sep">&bull;</span>
              <span>{identityCompany}</span>
              <span className="crm-contact-meta-sep">&bull;</span>
              <span className={`crm-contact-status-pill ${statusToneClass}`}>
                <span className="crm-contact-status-dot" />
                <span>{statusLabel}</span>
              </span>
            </div>
          </div>
        </div>

        <form className="crm-contact-form" onSubmit={handleSubmit}>
          <div className="crm-contact-body">
            <section className="crm-contact-section">
              <div className="crm-contact-section-header">
                <div className="crm-contact-section-icon green">
                  <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
                    <rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5 4V3a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M6 9h4M8 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="crm-contact-section-label">Company info</span>
              </div>
              <div className="crm-contact-grid two">
                <label className="crm-contact-field">
                  <span className="crm-contact-label">
                    Company name <span className="crm-contact-req">*</span>
                  </span>
                  <input
                    type="text"
                    name="company_name"
                    value={form.company_name || ''}
                    onChange={handleChange}
                    required
                    placeholder="Company name"
                  />
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Industry</span>
                  <select name="industry" value={form.industry || ''} onChange={handleChange}>
                    <option value="">Select industry</option>
                    {industryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Location</span>
                  <input
                    type="text"
                    name="location"
                    value={form.location || ''}
                    onChange={handleChange}
                    placeholder="City or region"
                  />
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Source</span>
                  <select name="source" value={form.source || ''} onChange={handleChange}>
                    <option value="">Select source</option>
                    {sourceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="crm-contact-section">
              <div className="crm-contact-section-header">
                <div className="crm-contact-section-icon blue">
                  <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
                    <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M2 14.5c0-3.314 2.686-5.5 6-5.5s6 2.186 6 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="crm-contact-section-label">Contact person</span>
              </div>
              <div className="crm-contact-grid two">
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Full name</span>
                  <input
                    type="text"
                    name="contact_person"
                    value={form.contact_person || ''}
                    onChange={handleChange}
                    placeholder="Full name"
                  />
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Role / title</span>
                  <input
                    type="text"
                    name="role"
                    value={form.role || ''}
                    onChange={handleChange}
                    placeholder="Role or title"
                  />
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Email</span>
                  <input
                    type="email"
                    name="email"
                    value={form.email || ''}
                    onChange={handleChange}
                    placeholder="name@company.com"
                  />
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone || ''}
                    onChange={handleChange}
                    placeholder="+1 234 567 8900"
                  />
                </label>
              </div>
            </section>

            <section className="crm-contact-section">
              <div className="crm-contact-section-header">
                <div className="crm-contact-section-icon amber">
                  <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
                    <path d="M2 10L5 7l3 2 3-4 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 2v12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="crm-contact-section-label">Lead status</span>
              </div>
              <div className="crm-contact-grid two">
                <div className="crm-contact-field">
                  <span className="crm-contact-label">Priority</span>
                  <div className="crm-contact-toggle-group">
                    {PRIORITY_OPTIONS.map((option) => {
                      const key = option.toLowerCase()
                      const selected = String(form.priority || '').toLowerCase() === key
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`crm-contact-toggle-button ${selected ? `is-priority-${key}` : ''}`.trim()}
                          onClick={() => handlePriorityClick(option)}
                        >
                          <span className="crm-contact-toggle-dot" />
                          <span>{option}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="crm-contact-field">
                  <span className="crm-contact-label">Status</span>
                  <div className="crm-contact-toggle-group">
                    {STATUS_OPTIONS.map((option) => {
                      const key = option.toLowerCase()
                      const selected = String(form.status || '').toLowerCase() === key
                      return (
                        <button
                          key={option}
                          type="button"
                          className={`crm-contact-toggle-button ${selected ? `is-status-${key}` : ''}`.trim()}
                          onClick={() => handleStatusClick(option)}
                        >
                          <span className="crm-contact-toggle-dot" />
                          <span>{option}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="crm-contact-section">
              <div className="crm-contact-section-header">
                <div className="crm-contact-section-icon slate">
                  <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5 1v3M11 1v3M2 6h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="5.5" cy="9.5" r="1" fill="currentColor" />
                    <circle cx="8" cy="9.5" r="1" fill="currentColor" />
                    <circle cx="10.5" cy="9.5" r="1" fill="currentColor" />
                  </svg>
                </div>
                <span className="crm-contact-section-label">Scheduling</span>
              </div>
              <div className="crm-contact-grid three">
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Last contact date</span>
                  <input
                    type="date"
                    name="last_contact"
                    value={toDateInputValue(form.last_contact)}
                    onChange={handleChange}
                    onClick={openDatePicker}
                  />
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Appointment date &amp; time</span>
                  <input
                    type="datetime-local"
                    name="appointment"
                    value={toDateTimeInputValue(form.appointment)}
                    onChange={handleChange}
                    onClick={openDatePicker}
                  />
                  <span className="crm-contact-hint">Leave blank if not scheduled</span>
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Follow-up date &amp; time</span>
                  <input
                    type="datetime-local"
                    name="follow_up"
                    value={toDateTimeInputValue(form.follow_up)}
                    onChange={handleChange}
                    onClick={openDatePicker}
                  />
                  <span className="crm-contact-hint">Leave blank if not needed</span>
                </label>
              </div>
            </section>

            <section className="crm-contact-section">
              <div className="crm-contact-section-header">
                <div className="crm-contact-section-icon indigo">
                  <svg width="13" height="13" fill="none" viewBox="0 0 16 16">
                    <path d="M3 2h10a1 1 0 0 1 1 1v9l-3 3H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M11 12v3l3-3h-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="crm-contact-section-label">Notes</span>
              </div>
              <div className="crm-contact-grid one">
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Pain point</span>
                  <textarea
                    name="pain_point"
                    value={form.pain_point || ''}
                    onChange={handleChange}
                    placeholder="Describe the client's main challenge or problem..."
                    rows={3}
                  />
                  <span className="crm-contact-char-count">{String(form.pain_point || '').length} chars</span>
                </label>
                <label className="crm-contact-field">
                  <span className="crm-contact-label">Remarks</span>
                  <textarea
                    name="remarks"
                    value={form.remarks || ''}
                    onChange={handleChange}
                    placeholder="Internal notes, next steps, context..."
                    rows={2}
                  />
                  <span className="crm-contact-char-count">{String(form.remarks || '').length} chars</span>
                </label>
              </div>
            </section>
          </div>

          <div className="crm-contact-footer">
            <span className="crm-contact-footer-meta">
              Last updated: {formatLastUpdated(editingItem?.updated_at || editingItem?.created_at)}
            </span>
            <div className="crm-contact-footer-actions">
              <button
                type="button"
                className="crm-contact-cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button type="submit" className="crm-contact-save" disabled={isLoading}>
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{isLoading ? 'Saving...' : actionLabel}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
