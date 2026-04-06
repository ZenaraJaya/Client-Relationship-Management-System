import React, { useState } from 'react'

const priorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high': return '#fca5a5'
    case 'medium': return '#fcd34d'
    case 'low': return '#d1d5db'
    default: return '#e5e7eb'
  }
}

const statusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'new': return '#3b82f6'
    case 'contacted': return '#f59e0b'
    case 'qualified': return '#10b981'
    case 'closed': return '#ff0000ff'
    default: return '#9ca3af'
  }
}

const statusTextColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'new': return '#0f172a'
    default: return '#ffffff'
  }
}

const formatDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

const openDatePicker = (event) => {
  if (typeof event.target.showPicker === 'function') {
    event.target.showPicker()
  }
}

const openDatePickerFromCard = (event) => {
  event.stopPropagation()
  const input = event.currentTarget.querySelector('input')
  if (!input) return

  input.focus()
  if (typeof input.showPicker === 'function') {
    input.showPicker()
  }
}

const formatDateCardLabel = (value) => {
  const dateValue = toDateInputValue(value)
  if (!dateValue) return 'Pick date'

  const parsed = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateValue

  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CustomDropdown = ({ value, options, onChange, badgeStyle, colorClassPrefix = '' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = React.useRef(null)

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...badgeStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease',
          border: isOpen ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent'
        }}
      >
        <span>{options.find(opt => opt.value === value)?.icon} {value}</span>
        <svg
          className={`caret-icon ${isOpen ? 'caret-rotate' : ''}`}
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`dropdown-item ${colorClassPrefix}${opt.value.toLowerCase()}`}
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CrmList({
  items = [],
  onEdit,
  onDelete,
  onUpdate,
  selectedIds = [],
  onSelectionChange,
  canDelete = true,
  rowOffset = 0,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const isAllSelected = canDelete && items.length > 0 && items.every((item) => selectedIds.includes(item.id))

  React.useEffect(() => {
    if (expandedId && !items.some((item) => item.id === expandedId)) {
      setExpandedId(null)
    }
  }, [items, expandedId])

  const handleSelectAll = (e) => {
    if (!canDelete) return
    const pageIds = items.map((item) => item.id)
    if (e.target.checked) {
      onSelectionChange(Array.from(new Set([...selectedIds, ...pageIds])))
    } else {
      const pageIdSet = new Set(pageIds)
      onSelectionChange(selectedIds.filter((id) => !pageIdSet.has(id)))
    }
  }

  const handleSelectOne = (id) => {
    if (!canDelete) return
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
        No CRM contacts found.
      </div>
    )
  }

  const truncatedStyle = {
    padding: '12px 10px',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  const badgeStyle = (bgColor, textColor) => ({
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700,
    background: bgColor,
    color: textColor,
    textAlign: 'center',
    width: '100%',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  })

  const priorityOptions = [
    { value: 'High', icon: '' },
    { value: 'Medium', icon: '' },
    { value: 'Low', icon: '' }
  ]

  const statusOptions = [
    { value: 'New', icon: '' },
    { value: 'Contacted', icon: '' },
    { value: 'Qualified', icon: '' },
    { value: 'Closed', icon: '' }
  ]

  return (
    <div style={{ overflowX: 'auto', minHeight: '400px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '12px 10px', width: '40px' }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: 'pointer' }}
              />
            </th>
            <th style={{ padding: '12px 10px', width: '40px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>No</th>
            <th style={{ padding: '12px 10px', width: 'auto', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Company Name</th>
            <th style={{ padding: '12px 10px', width: '110px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Appointment</th>
            <th style={{ padding: '12px 10px', width: '110px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Follow Up</th>
            <th style={{ padding: '12px 10px', width: '110px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Priority</th>
            <th style={{ padding: '12px 10px', width: '110px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Status</th>
            <th style={{ padding: '12px 10px', width: '180px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Remarks</th>
            <th style={{ padding: '12px 10px', width: '120px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, idx) => {
            const isExpanded = expandedId === row.id
            return (
              <React.Fragment key={row.id || idx}>
                <tr
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid #f3f4f6',
                    background: isExpanded ? '#f8fafc' : (selectedIds.includes(row.id) ? '#f0f9ff' : 'transparent'),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isExpanded ? 'inset 0 2px 4px rgba(0,0,0,0.02)' : 'none'
                  }}
                  onClick={() => toggleExpand(row.id)}
                  onMouseEnter={(e) => { if (!selectedIds.includes(row.id) && !isExpanded) e.currentTarget.style.background = '#f9fafb' }}
                  onMouseLeave={(e) => { if (!selectedIds.includes(row.id) && !isExpanded) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '12px 10px', textAlign: 'center', width: '40px' }} onClick={(e) => e.stopPropagation()}>
                    {canDelete ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => handleSelectOne(row.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>-</span>
                    )}
                  </td>
                  <td style={{ ...truncatedStyle, width: '40px', color: '#94a3b8', fontSize: '11px' }}>{rowOffset + idx + 1}</td>
                  <td style={{ ...truncatedStyle, fontWeight: 600, color: '#111827' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyItems: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: isExpanded ? '#eff6ff' : 'transparent',
                        transition: 'background 0.2s'
                      }}>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isExpanded ? "#2563eb" : "#94a3b8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        >
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </div>
                      <span style={{ color: isExpanded ? '#1e40af' : '#0369a1', transition: 'color 0.2s' }}>{row.company_name}</span>
                      {isExpanded && <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, marginLeft: 'auto', marginRight: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Viewing Details</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', width: '110px' }} onClick={(e) => e.stopPropagation()}>
                    <div className="date-cell-card" onClick={openDatePickerFromCard}>
                      <svg className="date-cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span className={`date-cell-label ${toDateInputValue(row.appointment) ? '' : 'date-cell-placeholder'}`}>
                        {formatDateCardLabel(row.appointment)}
                      </span>
                      <input
                        className="date-cell-input-overlay"
                        type="date"
                        value={toDateInputValue(row.appointment)}
                        onChange={(e) => onUpdate(row, 'appointment', e.target.value)}
                        onClick={(e) => {
                          e.stopPropagation()
                          openDatePicker(e)
                        }}
                        aria-label="Appointment date"
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', width: '110px' }} onClick={(e) => e.stopPropagation()}>
                    <div className="date-cell-card" onClick={openDatePickerFromCard}>
                      <svg className="date-cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span className={`date-cell-label ${toDateInputValue(row.follow_up) ? '' : 'date-cell-placeholder'}`}>
                        {formatDateCardLabel(row.follow_up)}
                      </span>
                      <input
                        className="date-cell-input-overlay"
                        type="date"
                        value={toDateInputValue(row.follow_up)}
                        onChange={(e) => onUpdate(row, 'follow_up', e.target.value)}
                        onClick={(e) => {
                          e.stopPropagation()
                          openDatePicker(e)
                        }}
                        aria-label="Follow up date"
                      />
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', width: '110px' }} onClick={(e) => e.stopPropagation()}>
                    <CustomDropdown
                      value={row.priority || 'Low'}
                      options={priorityOptions}
                      onChange={(val) => onUpdate(row, 'priority', val)}
                      badgeStyle={badgeStyle(priorityColor(row.priority), '#111827')}
                      colorClassPrefix=""
                    />
                  </td>
                  <td style={{ padding: '12px 10px', width: '110px' }} onClick={(e) => e.stopPropagation()}>
                    <CustomDropdown
                      value={row.status || 'New'}
                      options={statusOptions}
                      onChange={(val) => onUpdate(row, 'status', val)}
                      badgeStyle={badgeStyle(statusColor(row.status), statusTextColor(row.status))}
                      colorClassPrefix=""
                    />
                  </td>
                  <td
                    style={{ ...truncatedStyle, width: '180px', fontSize: '12px', color: '#475569' }}
                    title={row.remarks || ''}
                  >
                    {row.remarks || '-'}
                  </td>
                  <td style={{ padding: '12px 10px', width: '120px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => onEdit(row)}
                        style={{
                          padding: '4px 8px',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Edit
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => onDelete(row.id)}
                          style={{
                            padding: '4px 8px',
                            background: '#fef2f2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td colSpan="9" style={{ padding: '24px 40px 32px 60px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>

                        {/* Contact Card */}
                        <div style={{
                          background: '#fff',
                          padding: '20px',
                          borderRadius: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.06)',
                          border: '1px solid #f1f5f9'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ background: '#eff6ff', padding: 6, borderRadius: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Client Contact</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>{row.contact_person}</div>
                              <div style={{ fontSize: '13px', color: '#64748b' }}>{row.role}</div>
                            </div>

                            <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                              <a href={`tel:${row.phone}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>{row.phone}</a>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                              <a href={`mailto:${row.email}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>{row.email}</a>
                            </div>
                          </div>
                        </div>

                        {/* Business Card */}
                        <div style={{
                          background: '#fff',
                          padding: '20px',
                          borderRadius: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.06)',
                          border: '1px solid #f1f5f9'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ background: '#f0fdf4', padding: 6, borderRadius: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Business Profile</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Industry</span>
                              <span style={{ color: '#475569', fontSize: '13px', fontWeight: 500 }}>{row.industry}</span>
                            </div>
                            <div style={{ height: '1px', background: '#f8fafc' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Location</span>
                              <span style={{ color: '#475569', fontSize: '13px', fontWeight: 500 }}>{row.location}</span>
                            </div>
                            <div style={{ height: '1px', background: '#f8fafc' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Lead Source</span>
                              <span style={{ color: '#475569', fontSize: '13px', fontWeight: 500 }}>{row.source}</span>
                            </div>
                          </div>
                        </div>

                        {/* Strategy Card */}
                        <div style={{
                          background: '#fff',
                          padding: '20px',
                          borderRadius: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.06)',
                          border: '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ background: '#fff7ed', padding: 6, borderRadius: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Pain Points & Timeline</span>
                          </div>

                          <div style={{ flexGrow: 1, marginBottom: 12 }}>
                            <div style={{ color: '#475569', fontSize: '13px', fontWeight: '600', lineHeight: 1.5, background: '#fcfcfd', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #fdba74' }}>
                              {row.pain_point ? `"${row.pain_point}"` : 'No pain point added'}
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>LAST CONTACT</span>
                            <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>
                              {row.last_contact ? new Date(row.last_contact).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                            </span>
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
