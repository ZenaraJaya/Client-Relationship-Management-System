import React, { useState, useEffect } from 'react'

export default function AddCrmModal({ isOpen, onClose, onSubmit, isLoading, editingItem }) {
  const initialState = {
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

  const [form, setForm] = useState(initialState)
  const [isPainPointFocused, setIsPainPointFocused] = useState(false)

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
      const date = value.toDate()
      return formatDateInput(date)
    }

    if (typeof value === 'object' && typeof value.seconds === 'number') {
      const date = new Date(value.seconds * 1000)
      return formatDateInput(date)
    }

    return ''
  }

  const toDateTimeInputValue = (value) => {
    if (!value) return ''

    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value.slice(0, 16)
      if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(value)) return value.replace(' ', 'T').slice(0, 16)
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`

      const parsed = new Date(value)
      return formatDateTimeInput(parsed)
    }

    if (value instanceof Date) {
      return formatDateTimeInput(value)
    }

    if (value && typeof value.toDate === 'function') {
      const date = value.toDate()
      return formatDateTimeInput(date)
    }

    if (typeof value === 'object' && typeof value.seconds === 'number') {
      const date = new Date(value.seconds * 1000)
      return formatDateTimeInput(date)
    }

    return ''
  }

  const openDatePicker = (event) => {
    if (typeof event.target.showPicker === 'function') {
      event.target.showPicker()
    }
  }

  useEffect(() => {
    if (editingItem) {
      setForm({ ...initialState, ...editingItem })
    } else {
      setForm(initialState)
    }
  }, [editingItem, isOpen])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.company_name.trim()) {
      alert('Company Name is required')
      return
    }
    await onSubmit(form)
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
        maxHeight: '90vh',
        overflowY: 'auto',
        width: '90%',
        maxWidth: 600,
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>{editingItem ? 'Edit Contact' : 'Add New CRM Contact'}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>
                Company Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                name="company_name"
                value={form.company_name || ''}
                onChange={handleChange}
                placeholder="Acme Corp"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Industry</label>
              <input
                type="text"
                name="industry"
                value={form.industry || ''}
                onChange={handleChange}
                placeholder="Software"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Location</label>
              <input
                type="text"
                name="location"
                value={form.location || ''}
                onChange={handleChange}
                placeholder="New York, USA"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Contact Person</label>
              <input
                type="text"
                name="contact_person"
                value={form.contact_person || ''}
                onChange={handleChange}
                placeholder="John Doe"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Role</label>
              <input
                type="text"
                name="role"
                value={form.role || ''}
                onChange={handleChange}
                placeholder="CEO"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Phone</label>
              <input
                type="tel"
                name="phone"
                value={form.phone || ''}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Email</label>
              <input
                type="email"
                name="email"
                value={form.email || ''}
                onChange={handleChange}
                placeholder="john@example.com"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Source</label>
              <select
                name="source"
                value={form.source || ''}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <option value="">Select Source</option>
                <option value="Referral">Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Website">Website</option>
                <option value="Event">Event</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Priority</label>
              <select
                name="priority"
                value={form.priority || 'Medium'}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Status</label>
              <select
                name="status"
                value={form.status || 'New'}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Last Contact Date</label>
              <input
                type="date"
                name="last_contact"
                value={toDateInputValue(form.last_contact)}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Appointment Date &amp; Time</label>
              <input
                type="datetime-local"
                name="appointment"
                value={toDateTimeInputValue(form.appointment)}
                onChange={handleChange}
                onClick={openDatePicker}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Follow Up Date &amp; Time</label>
              <input
                type="datetime-local"
                name="follow_up"
                value={toDateTimeInputValue(form.follow_up)}
                onChange={handleChange}
                onClick={openDatePicker}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Pain Point</label>
              <textarea
                name="pain_point"
                value={form.pain_point || ''}
                onChange={handleChange}
                onFocus={() => setIsPainPointFocused(true)}
                onBlur={() => setIsPainPointFocused(false)}
                placeholder="Describe their main pain point..."
                rows={isPainPointFocused ? 4 : 1}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: isPainPointFocused ? '1px solid #0f766e' : '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: isPainPointFocused ? 15 : 13,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  minHeight: isPainPointFocused ? 96 : 38,
                  resize: 'vertical',
                  transition: 'all 0.2s ease',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500 }}>Remarks</label>
              <textarea
                name="remarks"
                value={form.remarks || ''}
                onChange={handleChange}
                placeholder="Add extra notes..."
                rows="1"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: 38,
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #e5e7eb',
                background: '#fff',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                background: '#064e3b',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Saving...' : (editingItem ? 'Update Contact' : 'Add Contact')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
