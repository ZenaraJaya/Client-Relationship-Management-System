import React, { useEffect, useRef, useState } from 'react'

const initialState = {
  name: '',
  email: '',
}

export default function ProfileModal({ isOpen, onClose, onSubmit, isLoading, user }) {
  const [form, setForm] = useState(initialState)
  const [error, setError] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    setForm({
      name: user?.name || '',
      email: user?.email || '',
    })
    setSelectedPhoto(null)
    setPreviewUrl(user?.profile_photo_url || '')
    setPhotoLoadFailed(false)
    setError('')
  }, [isOpen, user])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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

    await onSubmit({
      name: form.name.trim(),
      profilePhotoFile: selectedPhoto,
    })
  }

  if (!isOpen) return null

  const roleLabel = ((user?.role || 'staff').trim() || 'staff').toUpperCase()
  const initials = (form.name || user?.name || 'U')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const handlePhotoPick = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for your profile photo.')
      return
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedPhoto(file)
    setPreviewUrl(URL.createObjectURL(file))
    setPhotoLoadFailed(false)
    if (error) setError('')
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--modal-overlay-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      zIndex: 1200,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: 'var(--modal-card-bg)',
        borderRadius: 18,
        border: '1px solid var(--modal-card-border)',
        boxShadow: 'var(--modal-card-shadow)',
        color: 'var(--ink)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '22px 22px 18px',
          borderBottom: '1px solid var(--line)',
          background: 'linear-gradient(180deg, var(--panel-strong) 0%, var(--modal-card-bg) 100%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.08em' }}>PROFILE</div>
              <h2 style={{ margin: '6px 0 4px', fontSize: 24, color: 'var(--modal-heading)' }}>Update your account</h2>
              <p style={{ margin: 0, color: 'var(--modal-copy)', fontSize: 14, lineHeight: 1.5 }}>
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
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--table-cell-muted)',
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
              gap: 16,
              padding: '14px',
              borderRadius: 16,
              background: 'var(--panel-strong)',
              border: '1px solid var(--line)',
            }}>
              <div style={{
                width: 74,
                height: 74,
                borderRadius: 22,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(150deg, #f5c6ae, #f0a782)',
                color: '#10231f',
                fontSize: 24,
                fontWeight: 800,
                flexShrink: 0,
                boxShadow: '0 12px 24px rgba(180, 96, 60, 0.16)',
              }}>
                {previewUrl && !photoLoadFailed ? (
                  <img
                    src={previewUrl}
                    alt={`${form.name || user?.name || 'User'} profile`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setPhotoLoadFailed(true)}
                  />
                ) : (
                  initials
                )}
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Profile picture</div>
                <div style={{ fontSize: 13, color: 'var(--table-cell-muted)', lineHeight: 1.5 }}>
                  Upload a square image for the best result. PNG and JPG work well.
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoPick}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '9px 13px',
                      borderRadius: 12,
                      border: '1px solid var(--line)',
                      background: 'var(--panel)',
                      color: 'var(--ink)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Upload profile pic
                  </button>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 14,
              background: 'var(--panel-strong)',
              border: '1px solid var(--line)',
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--table-cell-muted)', fontWeight: 700 }}>Access role</div>
                <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 800 }}>{roleLabel}</div>
              </div>
              <div style={{
                padding: '6px 10px',
                borderRadius: 999,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.04em',
              }}>
                READ ONLY
              </div>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Full name</span>
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
                  border: '1px solid var(--line)',
                  fontSize: 14,
                  color: 'var(--ink)',
                  background: 'var(--panel)',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Email address</span>
              <input
                type="email"
                name="email"
                value={form.email}
                readOnly
                aria-readonly="true"
                style={{
                  width: '100%',
                  padding: '11px 13px',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  fontSize: 14,
                  color: 'var(--table-cell-muted)',
                  background: 'var(--panel-strong)',
                  cursor: 'default',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--table-cell-muted)', fontWeight: 600 }}>
                Email is view only for this profile form.
              </span>
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
                border: '1px solid var(--modal-btn-secondary-border)',
                background: 'var(--modal-btn-secondary-bg)',
                color: 'var(--modal-btn-secondary-text)',
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
