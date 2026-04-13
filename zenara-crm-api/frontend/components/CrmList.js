import React, { useState } from 'react'

const priorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high': return 'var(--priority-high-bg)'
    case 'medium': return 'var(--priority-medium-bg)'
    case 'low': return 'var(--priority-low-bg)'
    default: return 'var(--priority-default-bg)'
  }
}

const statusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'new': return 'var(--status-new-bg)'
    case 'contacted': return 'var(--status-contacted-bg)'
    case 'qualified': return 'var(--status-qualified-bg)'
    case 'closed': return 'var(--status-closed-bg)'
    default: return 'var(--status-default-bg)'
  }
}

const statusTextColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'new': return 'var(--status-new-text)'
    default: return 'var(--status-default-text)'
  }
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
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T09:00`

    const normalized = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/.test(trimmed)
      ? trimmed.replace(' ', 'T')
      : trimmed

    const parsed = new Date(normalized)
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

const formatDateCardLabel = (value) => {
  const dateTimeValue = toDateTimeInputValue(value)
  if (!dateTimeValue) return 'Pick date & time'

  const parsed = new Date(dateTimeValue)
  if (Number.isNaN(parsed.getTime())) return dateTimeValue

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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

const buildDateDraftKey = (rowId, field) => `${rowId}:${field}`

export default function CrmList({
  items = [],
  emptyMessage = 'No CRM contacts found.',
  onEdit,
  onDelete,
  onUpdate,
  selectedIds = [],
  onSelectionChange,
  canEdit = true,
  canDelete = true,
  rowOffset = 0,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [dateDrafts, setDateDrafts] = useState({})
  const [activeDateEditor, setActiveDateEditor] = useState(null)
  const [savingDateKey, setSavingDateKey] = useState('')
  const dateInputRefs = React.useRef({})
  const isAllSelected = canDelete && items.length > 0 && items.every((item) => selectedIds.includes(item.id))

  React.useEffect(() => {
    if (expandedId && !items.some((item) => item.id === expandedId)) {
      setExpandedId(null)
    }
  }, [items, expandedId])

  React.useEffect(() => {
    const validKeys = new Set(
      items.flatMap((item) => ['appointment', 'follow_up'].map((field) => buildDateDraftKey(item.id, field)))
    )

    setDateDrafts((prev) => {
      const nextEntries = Object.entries(prev).filter(([key]) => validKeys.has(key))
      if (nextEntries.length === Object.keys(prev).length) {
        return prev
      }
      return Object.fromEntries(nextEntries)
    })

    if (activeDateEditor && !validKeys.has(activeDateEditor)) {
      setActiveDateEditor(null)
    }

    if (savingDateKey && !validKeys.has(savingDateKey)) {
      setSavingDateKey('')
    }
  }, [items, activeDateEditor, savingDateKey])

  React.useEffect(() => {
    if (!activeDateEditor) return

    const input = dateInputRefs.current[activeDateEditor]
    if (!input) return

    input.focus()
    if (typeof input.showPicker === 'function') {
      input.showPicker()
    }
  }, [activeDateEditor])

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

  const getCurrentDateValue = (row, field) => toDateTimeInputValue(row[field])

  const getDraftDateValue = (row, field) => {
    const key = buildDateDraftKey(row.id, field)
    return Object.prototype.hasOwnProperty.call(dateDrafts, key)
      ? dateDrafts[key]
      : getCurrentDateValue(row, field)
  }

  const openDateEditor = (event, row, field) => {
    event.stopPropagation()

    const key = buildDateDraftKey(row.id, field)
    setActiveDateEditor(key)
    setDateDrafts((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev
      }

      return {
        ...prev,
        [key]: getCurrentDateValue(row, field),
      }
    })
  }

  const updateDateDraft = (row, field, value) => {
    const key = buildDateDraftKey(row.id, field)
    setDateDrafts((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const clearDateEditor = (row, field) => {
    const key = buildDateDraftKey(row.id, field)

    setActiveDateEditor((prev) => (prev === key ? null : prev))
    setDateDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) {
        return prev
      }

      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const saveDateEditor = async (event, row, field) => {
    event.stopPropagation()

    const key = buildDateDraftKey(row.id, field)
    const currentValue = getCurrentDateValue(row, field)
    const draftValue = getDraftDateValue(row, field)

    if (draftValue === currentValue) {
      clearDateEditor(row, field)
      return
    }

    setSavingDateKey(key)
    const saved = await onUpdate(row, field, draftValue || null)
    setSavingDateKey((prev) => (prev === key ? '' : prev))

    if (saved) {
      clearDateEditor(row, field)
    }
  }

  const handleDateInputKeyDown = async (event, row, field) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      await saveDateEditor(event, row, field)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      clearDateEditor(row, field)
    }
  }

  const renderDateCell = (row, field, ariaLabel) => {
    const key = buildDateDraftKey(row.id, field)
    const currentValue = getCurrentDateValue(row, field)
    const draftValue = getDraftDateValue(row, field)
    const isEditing = activeDateEditor === key
    const isSaving = savingDateKey === key
    const isDirty = draftValue !== currentValue

    if (!canEdit) {
      return (
        <div className="date-cell-card">
          <svg className="date-cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span className={`date-cell-label ${currentValue ? '' : 'date-cell-placeholder'}`}>
            {currentValue ? formatDateCardLabel(row[field]) : 'Not scheduled'}
          </span>
        </div>
      )
    }

    return (
      <div
        className={`date-cell-card ${isEditing ? 'date-cell-card-editing' : ''}`}
        onClick={(event) => openDateEditor(event, row, field)}
      >
        <svg className="date-cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        {isEditing ? (
          <div className="date-cell-editor">
            <input
              ref={(element) => {
                if (element) {
                  dateInputRefs.current[key] = element
                } else {
                  delete dateInputRefs.current[key]
                }
              }}
              className="date-cell-input-editor"
              type="datetime-local"
              value={draftValue}
              onChange={(event) => updateDateDraft(row, field, event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => handleDateInputKeyDown(event, row, field)}
              aria-label={ariaLabel}
            />
            <div className="date-cell-actions">
              <button
                type="button"
                className="date-cell-action-btn date-cell-action-btn-secondary"
                onClick={(event) => {
                  event.stopPropagation()
                  clearDateEditor(row, field)
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="date-cell-action-btn"
                onClick={(event) => saveDateEditor(event, row, field)}
                disabled={isSaving || !isDirty}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <span className={`date-cell-label ${currentValue ? '' : 'date-cell-placeholder'}`}>
            {formatDateCardLabel(row[field])}
          </span>
        )}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--table-empty-text)' }}>
        {emptyMessage}
      </div>
    )
  }

  const truncatedStyle = {
    padding: '12px 10px',
    color: 'var(--table-cell-muted)',
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
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
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
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '1240px', fontSize: '13px', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ background: 'var(--table-head-bg)', borderBottom: '2px solid var(--table-head-border)' }}>
            <th style={{ padding: '12px 10px', width: '40px', whiteSpace: 'nowrap' }}>
              {canDelete ? (
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <span style={{ color: 'var(--table-viewonly-text)' }}>-</span>
              )}
            </th>
            <th style={{ padding: '12px 10px', width: '40px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>No</th>
            <th style={{ padding: '12px 10px', width: '230px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>Company Name</th>
            <th style={{ padding: '12px 10px', width: '170px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>Appointment</th>
            <th style={{ padding: '12px 10px', width: '170px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>Follow Up</th>
            <th style={{ padding: '12px 10px', width: '110px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>Priority</th>
            <th style={{ padding: '12px 10px', width: '110px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>Status</th>
            <th style={{ padding: '12px 10px', width: '180px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>Remarks</th>
            <th style={{ padding: '12px 10px', width: '120px', textAlign: 'left', fontWeight: 600, color: 'var(--table-head-text)', whiteSpace: 'nowrap' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, idx) => {
            const isExpanded = expandedId === row.id
            return (
              <React.Fragment key={row.id || idx}>
                <tr
                  style={{
                    borderBottom: isExpanded ? 'none' : '1px solid var(--table-row-border)',
                    background: isExpanded ? 'var(--table-row-expanded-bg)' : (selectedIds.includes(row.id) ? 'var(--table-row-selected-bg)' : 'transparent'),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isExpanded ? 'inset 0 2px 4px rgba(0,0,0,0.02)' : 'none'
                  }}
                  onClick={() => toggleExpand(row.id)}
                  onMouseEnter={(e) => { if (!selectedIds.includes(row.id) && !isExpanded) e.currentTarget.style.background = 'var(--table-row-hover-bg)' }}
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
                      <span style={{ color: 'var(--table-viewonly-text)' }}>-</span>
                    )}
                  </td>
                  <td style={{ ...truncatedStyle, width: '40px', color: 'var(--table-row-number)', fontSize: '11px' }}>{rowOffset + idx + 1}</td>
                  <td style={{ ...truncatedStyle, fontWeight: 600, color: 'var(--ink)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyItems: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: isExpanded ? 'var(--table-expand-icon-bg)' : 'transparent',
                        transition: 'background 0.2s'
                      }}>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isExpanded ? 'var(--table-expand-icon-stroke)' : 'var(--table-row-number)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                        >
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </div>
                      <span style={{ color: isExpanded ? 'var(--table-company-active)' : 'var(--table-company)', transition: 'color 0.2s' }}>{row.company_name}</span>
                      {isExpanded && <span style={{ fontSize: '10px', color: 'var(--table-viewing-tag)', fontWeight: 500, marginLeft: 'auto', marginRight: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Viewing Details</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px', width: '170px' }} onClick={(e) => e.stopPropagation()}>
                    {renderDateCell(row, 'appointment', 'Appointment date and time')}
                  </td>
                  <td style={{ padding: '12px 10px', width: '170px' }} onClick={(e) => e.stopPropagation()}>
                    {renderDateCell(row, 'follow_up', 'Follow up date and time')}
                  </td>
                  <td style={{ padding: '12px 10px', width: '110px' }} onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <CustomDropdown
                        value={row.priority || 'Low'}
                        options={priorityOptions}
                        onChange={(val) => onUpdate(row, 'priority', val)}
                        badgeStyle={badgeStyle(priorityColor(row.priority), 'var(--priority-text)')}
                        colorClassPrefix=""
                      />
                    ) : (
                      <div style={badgeStyle(priorityColor(row.priority), 'var(--priority-text)')}>
                        {row.priority || 'Low'}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 10px', width: '110px' }} onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <CustomDropdown
                        value={row.status || 'New'}
                        options={statusOptions}
                        onChange={(val) => onUpdate(row, 'status', val)}
                        badgeStyle={badgeStyle(statusColor(row.status), statusTextColor(row.status))}
                        colorClassPrefix=""
                      />
                    ) : (
                      <div style={badgeStyle(statusColor(row.status), statusTextColor(row.status))}>
                        {row.status || 'New'}
                      </div>
                    )}
                  </td>
                  <td
                    style={{ ...truncatedStyle, width: '180px', fontSize: '12px', color: 'var(--table-remark)' }}
                    title={row.remarks || ''}
                  >
                    {row.remarks || '-'}
                  </td>
                  <td style={{ padding: '12px 10px', width: '120px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {canEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          style={{
                            padding: '4px 8px',
                            background: 'var(--table-action-edit-bg)',
                            color: 'var(--table-action-edit-text)',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => onDelete(row.id)}
                          style={{
                            padding: '4px 8px',
                            background: 'var(--table-action-delete-bg)',
                            color: 'var(--table-action-delete-text)',
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
                      {!canEdit && !canDelete && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--table-viewonly-text)' }}>
                          View only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr style={{ background: 'var(--table-row-expanded-bg)', borderBottom: '1px solid var(--table-head-border)' }}>
                    <td colSpan="9" style={{ padding: '24px 40px 32px 60px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>

                        {/* Contact Card */}
                        <div style={{
                          background: 'var(--table-expanded-card-bg)',
                          padding: '20px',
                          borderRadius: '12px',
                          boxShadow: 'var(--table-expanded-card-shadow)',
                          border: '1px solid var(--table-expanded-card-border)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ background: 'var(--table-expand-icon-bg)', padding: 6, borderRadius: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--table-expand-icon-stroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--table-cell-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Client Contact</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{row.contact_person}</div>
                              <div style={{ fontSize: '13px', color: 'var(--table-cell-muted)' }}>{row.role}</div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--table-divider)', margin: '4px 0' }}></div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--table-row-number)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                              <a href={`tel:${row.phone}`} style={{ color: 'var(--table-link)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>{row.phone}</a>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--table-row-number)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                              <a href={`mailto:${row.email}`} style={{ color: 'var(--table-link)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>{row.email}</a>
                            </div>
                          </div>
                        </div>

                        {/* Business Card */}
                        <div style={{
                          background: 'var(--table-expanded-card-bg)',
                          padding: '20px',
                          borderRadius: '12px',
                          boxShadow: 'var(--table-expanded-card-shadow)',
                          border: '1px solid var(--table-expanded-card-border)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ background: 'var(--table-expand-icon-bg)', padding: 6, borderRadius: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--table-cell-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Business Profile</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--table-row-number)', fontSize: '12px' }}>Industry</span>
                              <span style={{ color: 'var(--table-remark)', fontSize: '13px', fontWeight: 500 }}>{row.industry}</span>
                            </div>
                            <div style={{ height: '1px', background: 'var(--table-subtle-divider)' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--table-row-number)', fontSize: '12px' }}>Location</span>
                              <span style={{ color: 'var(--table-remark)', fontSize: '13px', fontWeight: 500 }}>{row.location}</span>
                            </div>
                            <div style={{ height: '1px', background: 'var(--table-subtle-divider)' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--table-row-number)', fontSize: '12px' }}>Lead Source</span>
                              <span style={{ color: 'var(--table-remark)', fontSize: '13px', fontWeight: 500 }}>{row.source}</span>
                            </div>
                          </div>
                        </div>

                        {/* Strategy Card */}
                        <div style={{
                          background: 'var(--table-expanded-card-bg)',
                          padding: '20px',
                          borderRadius: '12px',
                          boxShadow: 'var(--table-expanded-card-shadow)',
                          border: '1px solid var(--table-expanded-card-border)',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <div style={{ background: 'var(--table-expand-icon-bg)', padding: 6, borderRadius: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--table-cell-muted)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Pain Points & Timeline</span>
                          </div>

                          <div style={{ flexGrow: 1, marginBottom: 12 }}>
                            <div style={{ color: 'var(--table-remark)', fontSize: '13px', fontWeight: '600', lineHeight: 1.5, background: 'var(--table-row-hover-bg)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #fdba74' }}>
                              {row.pain_point ? `"${row.pain_point}"` : 'No pain point added'}
                            </div>
                          </div>

                          <div style={{ background: 'var(--table-row-hover-bg)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--table-row-number)', fontSize: '11px', fontWeight: 600 }}>LAST CONTACT</span>
                            <span style={{ color: 'var(--table-cell-muted)', fontSize: '12px', fontWeight: 500 }}>
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
