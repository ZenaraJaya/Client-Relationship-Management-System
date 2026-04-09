import React, { useMemo, useState } from 'react'
import styles from './AuthPanel.module.css'

const BACKGROUND_BUBBLES = [
  {
    size: '210px',
    left: '5%',
    duration: '22s',
    delay: '-4s',
    drift: '44px',
    opacity: 1,
    tint: 'rgba(30, 58, 138, 0.72)',
    edge: 'rgba(147, 197, 253, 0.92)',
    shadow: 'rgba(15, 23, 42, 0.44)',
    blur: '0px',
  },
  {
    size: '112px',
    left: '18%',
    duration: '15s',
    delay: '-10s',
    drift: '20px',
    opacity: 0.9,
    tint: 'rgba(12, 74, 110, 0.68)',
    edge: 'rgba(125, 211, 252, 0.88)',
    shadow: 'rgba(8, 47, 73, 0.44)',
    blur: '0px',
  },
  {
    size: '154px',
    left: '31%',
    duration: '20s',
    delay: '-6s',
    drift: '-30px',
    opacity: 0.92,
    tint: 'rgba(30, 64, 175, 0.7)',
    edge: 'rgba(147, 197, 253, 0.9)',
    shadow: 'rgba(30, 58, 138, 0.42)',
    blur: '1px',
  },
  {
    size: '128px',
    left: '47%',
    duration: '17s',
    delay: '-12s',
    drift: '24px',
    opacity: 0.86,
    tint: 'rgba(30, 58, 138, 0.68)',
    edge: 'rgba(147, 197, 253, 0.86)',
    shadow: 'rgba(15, 23, 42, 0.4)',
    blur: '0px',
  },
  {
    size: '196px',
    left: '60%',
    duration: '24s',
    delay: '-8s',
    drift: '-36px',
    opacity: 0.96,
    tint: 'rgba(67, 56, 202, 0.72)',
    edge: 'rgba(165, 180, 252, 0.9)',
    shadow: 'rgba(49, 46, 129, 0.44)',
    blur: '1px',
  },
  {
    size: '92px',
    left: '76%',
    duration: '14s',
    delay: '-3s',
    drift: '18px',
    opacity: 0.82,
    tint: 'rgba(3, 105, 161, 0.64)',
    edge: 'rgba(125, 211, 252, 0.86)',
    shadow: 'rgba(12, 74, 110, 0.4)',
    blur: '0px',
  },
  {
    size: '168px',
    left: '87%',
    duration: '19s',
    delay: '-9s',
    drift: '-26px',
    opacity: 0.92,
    tint: 'rgba(30, 58, 138, 0.7)',
    edge: 'rgba(147, 197, 253, 0.9)',
    shadow: 'rgba(15, 23, 42, 0.4)',
    blur: '0px',
  },
]

const BACKGROUND_SPARKLES = [
  { size: '18px', left: '11%', bottom: '18%', duration: '8s', delay: '-2s', opacity: 0.42 },
  { size: '24px', left: '24%', bottom: '11%', duration: '10s', delay: '-6s', opacity: 0.34 },
  { size: '14px', left: '39%', bottom: '23%', duration: '9s', delay: '-4s', opacity: 0.36 },
  { size: '28px', left: '52%', bottom: '14%', duration: '11s', delay: '-7s', opacity: 0.3 },
  { size: '16px', left: '64%', bottom: '26%', duration: '8.5s', delay: '-3s', opacity: 0.36 },
  { size: '20px', left: '73%', bottom: '9%', duration: '10.5s', delay: '-8s', opacity: 0.32 },
  { size: '12px', left: '84%', bottom: '20%', duration: '7.5s', delay: '-5s', opacity: 0.4 },
]

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: 'Add a password', percent: 0, tone: 'weak' }

  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 1) return { score, label: 'Weak password', percent: 25, tone: 'weak' }
  if (score === 2) return { score, label: 'Decent password', percent: 55, tone: 'medium' }
  if (score === 3) return { score, label: 'Strong password', percent: 80, tone: 'good' }
  return { score, label: 'Excellent password', percent: 100, tone: 'great' }
}

export default function AuthPanel({ onSubmit, isLoading, error }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [role, setRole] = useState('staff')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])
  const isSignup = mode === 'signup'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')

    if (!email.trim()) {
      setLocalError('Email is required.')
      return
    }

    if (!password) {
      setLocalError('Password is required.')
      return
    }

    if (isSignup) {
      if (!name.trim()) {
        setLocalError('Name is required.')
        return
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.')
        return
      }
    }

    await onSubmit({
      mode,
      name: name.trim(),
      role,
      email: email.trim(),
      password,
    })
  }

  const switchMode = (nextMode) => {
    if (isLoading) return
    setMode(nextMode)
    setLocalError('')
  }

  return (
    <div className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={`${styles.glow} ${styles.glowTop}`} />
        <span className={`${styles.glow} ${styles.glowMiddle}`} />
        <span className={`${styles.glow} ${styles.glowBottom}`} />
        <div className={styles.bubbleField}>
          {BACKGROUND_BUBBLES.map((bubble) => (
            <span
              key={`${bubble.left}-${bubble.size}`}
              className={styles.bubbleTrack}
              style={{
                '--bubble-size': bubble.size,
                '--bubble-left': bubble.left,
                '--bubble-duration': bubble.duration,
                '--bubble-delay': bubble.delay,
                '--bubble-drift': bubble.drift,
                '--bubble-opacity': bubble.opacity,
                '--bubble-tint': bubble.tint,
                '--bubble-edge': bubble.edge,
                '--bubble-shadow': bubble.shadow,
                '--bubble-blur': bubble.blur,
              }}
            >
              <span className={styles.bubble}>
                <span className={styles.bubbleRing} />
                <span className={styles.bubbleHighlight} />
                <span className={styles.bubbleGlint} />
              </span>
            </span>
          ))}
        </div>
        <div className={styles.sparkleField}>
          {BACKGROUND_SPARKLES.map((sparkle) => (
            <span
              key={`${sparkle.left}-${sparkle.size}`}
              className={styles.sparkle}
              style={{
                '--sparkle-size': sparkle.size,
                '--sparkle-left': sparkle.left,
                '--sparkle-bottom': sparkle.bottom,
                '--sparkle-duration': sparkle.duration,
                '--sparkle-delay': sparkle.delay,
                '--sparkle-opacity': sparkle.opacity,
              }}
            />
          ))}
        </div>
      </div>

      <section className={styles.formPane}>
        <div className={styles.modeSwitch} role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`${styles.modeButton} ${!isSignup ? styles.modeButtonActive : ''}`}
            aria-selected={!isSignup}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`${styles.modeButton} ${isSignup ? styles.modeButtonActive : ''}`}
            aria-selected={isSignup}
          >
            Sign Up
          </button>
        </div>

        <h2 className={styles.formTitle}>{isSignup ? 'Create your workspace' : 'Welcome back'}</h2>
        <p className={styles.formSubtitle}>
          {isSignup
            ? 'Set up your account and start managing leads in one calm workflow.'
            : 'Sign in to continue exactly where you left off.'}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {isSignup && (
            <div className={styles.fieldGroup}>
              <label htmlFor="auth-name" className={styles.label}>Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className={styles.input}
                autoComplete="name"
              />
            </div>
          )}

          {isSignup && (
            <div className={styles.fieldGroup}>
              <span className={styles.label}>Account Role</span>
              <div className={styles.roleSwitch} role="tablist" aria-label="Signup role">
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  className={`${styles.roleButton} ${role === 'staff' ? styles.roleButtonActive : ''}`}
                  aria-selected={role === 'staff'}
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`${styles.roleButton} ${role === 'admin' ? styles.roleButtonActive : ''}`}
                  aria-selected={role === 'admin'}
                >
                  Admin
                </button>
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="auth-email" className={styles.label}>Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={styles.input}
              autoComplete="email"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="auth-password" className={styles.label}>Password</label>
            <div className={styles.inputWithAction}>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? 'Create a strong password' : 'Enter password'}
                className={styles.input}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className={styles.ghostAction}
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {isSignup && (
            <>
              <div className={styles.strengthRow}>
                <div className={styles.strengthTrack}>
                  <span
                    className={`${styles.strengthFill} ${styles[`strength${passwordStrength.tone}`]}`}
                    style={{ width: `${passwordStrength.percent}%` }}
                  />
                </div>
                <span className={styles.strengthLabel}>{passwordStrength.label}</span>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="auth-confirm-password" className={styles.label}>Confirm Password</label>
                <div className={styles.inputWithAction}>
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={styles.input}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={styles.ghostAction}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </>
          )}

          {(localError || error) && (
            <div className={styles.errorCard}>
              {localError || error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className={styles.submitButton}>
            {isLoading ? 'Please wait...' : (isSignup ? 'Create Account' : 'Login')}
          </button>
        </form>

        <p className={styles.footnote}>
          By continuing, you agree to secure session logging and account protection checks.
        </p>
      </section>
    </div>
  )
}
