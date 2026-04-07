import React, { useEffect, useState } from 'react'

const initialState = {
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
}

export default function ProfileModal({ isOpen, onClose, onSubmit, isLoading, user }) {
  const [form, setForm] = useState(initialState)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setForm({
      name: user?.name || '',
      email: user?.email || '',
      password: '',
      password_confirmation: '',
    })
    setError('')
  }, [isOpen, user])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Your name is required.')
      return
    }

    if (!form.email.trim()) {
      setError('Your email is required.')
      return
    }

    if (form.password && form.password.length < 6) {
      setError('Your new password must be at least 6 characters.')
      return
    }

    if (form.password !== form.password_confirmation) {
      setError('Your password confirmation does not match.')
      return
    }

    await onSubmit({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      password_confirmation: form.password_confirmation,
    })
  }

  if (!isOpen) return null

  const roleLabel = ((user?.role || 'staff').trim() || 'staff').toUpperCase()

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.42)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 1200,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: '#ffffff',
        borderRadius: 18,
        border: '1px solid #dbe7e0',
        boxShadow: '0 24px 48px rgba(15, 23, 42, 0.16)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '22px 22px 18px',
          borderBottom: '1px solid #e6eeea',
          background: 'linear-gradient(180deg, #f7fbf9 0%, #ffffff 100%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#2f6a5b', letterSpacing: '0.08em' }}>PROFILE</div>
              <h2 style={{ margin: '6px 0 4px', fontSize: 24, color: '#10231f' }}>Update your account</h2>
              <p style={{ margin: 0, color: '#5d736d', fontSize: 14, lineHeight: 1.5 }}>
                Both staff and admin can update their own profile details here.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: '1px solid #dbe7e0',
                background: '#ffffff',
                color: '#4e6762',
                cursor: 'pointer',
                fontSize: 22,
                lineHeight: 1,
              }}
              aria-label="Close profile modal"
            >
              &times;
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 22 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 14,
              background: '#f6faf8',
              border: '1px solid #e0ebe5',
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#60746f', fontWeight: 700 }}>Access role</div>
                <div style={{ fontSize: 15, color: '#17372f', fontWeight: 800 }}>{roleLabel}</div>
              </div>
              <div style={{
                padding: '6px 10px',
                borderRadius: 999,
                background: '#ddede6',
                color: '#1a5c4d',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.04em',
              }}>
                READ ONLY
              </div>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#26463d' }}>Full name</span>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  borderRadius: 12,
                  border: '1px solid #d7e4dd',
                  fontSize: 14,
                  color: '#16312b',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#26463d' }}>Email address</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  borderRadius: 12,
                  border: '1px solid #d7e4dd',
                  fontSize: 14,
                  color: '#16312b',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#26463d' }}>New password</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep your current password"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  borderRadius: 12,
                  border: '1px solid #d7e4dd',
                  fontSize: 14,
                  color: '#16312b',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#26463d' }}>Confirm new password</span>
              <input
                type="password"
                name="password_confirmation"
                value={form.password_confirmation}
                onChange={handleChange}
                placeholder="Repeat the new password"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  borderRadius: 12,
                  border: '1px solid #d7e4dd',
                  fontSize: 14,
                  color: '#16312b',
                }}
              />
            </label>

            {error && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: '#fff4f4',
                border: '1px solid #fecaca',
                color: '#b42318',
                fontSize: 13,
                fontWeight: 600,
              }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #d7e4dd',
                background: '#ffffff',
                color: '#35544b',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #1f7a63, #235948)',
                color: '#f5fffa',
                fontWeight: 800,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
