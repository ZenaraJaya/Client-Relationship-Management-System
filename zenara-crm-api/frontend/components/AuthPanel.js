import React, { useMemo, useState } from 'react'
import styles from './AuthPanel.module.css'

const BACKGROUND_BUBBLES = [
  { size: '160px', left: '8%', duration: '18s', delay: '-2s', drift: '34px', opacity: 0.6 },
  { size: '92px', left: '20%', duration: '14s', delay: '-8s', drift: '18px', opacity: 0.45 },
  { size: '132px', left: '34%', duration: '20s', delay: '-5s', drift: '-26px', opacity: 0.5 },
  { size: '108px', left: '54%', duration: '16s', delay: '-11s', drift: '22px', opacity: 0.42 },
  { size: '188px', left: '67%', duration: '24s', delay: '-7s', drift: '-32px', opacity: 0.5 },
  { size: '78px', left: '79%', duration: '13s', delay: '-4s', drift: '16px', opacity: 0.38 },
  { size: '146px', left: '88%', duration: '19s', delay: '-9s', drift: '-24px', opacity: 0.46 },
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
        <span className={`${styles.glow} ${styles.glowBottom}`} />
        <div className={styles.bubbleField}>
          {BACKGROUND_BUBBLES.map((bubble, index) => (
            <span
              key={`${bubble.left}-${bubble.size}`}
              className={styles.bubble}
              style={{
                '--bubble-size': bubble.size,
                '--bubble-left': bubble.left,
                '--bubble-duration': bubble.duration,
                '--bubble-delay': bubble.delay,
                '--bubble-drift': bubble.drift,
                '--bubble-opacity': bubble.opacity,
                '--bubble-blur': index % 2 === 0 ? '0px' : '1px',
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
