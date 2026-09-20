// src/pages/Login.jsx — pagina de autentificare FORMA
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signInWithGoogle, signInWithEmail, error, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  async function handleEmailLogin(e) {
    e.preventDefault()
    setLocalError('')
    if (!email || !password) {
      setLocalError('Completează emailul și parola.')
      return
    }
    setSubmitting(true)
    const { error } = await signInWithEmail(email, password)
    setSubmitting(false)
    if (!error) navigate('/dashboard')
  }

  const displayError = localError || error

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoRow}>
          <svg width="40" height="40" viewBox="0 0 80 80" aria-label="FORMA">
            <rect width="80" height="80" rx="20" fill="#0F1117"/>
            <circle cx="40" cy="40" r="26" fill="none" stroke="#1A3A0A" strokeWidth="5"/>
            <circle cx="40" cy="40" r="26" fill="none" stroke="#97C459" strokeWidth="5"
              strokeDasharray="122 41" strokeDashoffset="41" strokeLinecap="round"
              transform="rotate(-90 40 40)"/>
            <text x="40" y="45" textAnchor="middle" fill="#C0DD97"
              fontSize="15" fontWeight="700" fontFamily="system-ui,sans-serif">75</text>
          </svg>
          <div>
            <div style={styles.logoName}>FORMA</div>
            <div style={styles.logoSub}>Daily Readiness Intelligence</div>
          </div>
        </div>

        <h1 style={styles.heading}>Bine ai revenit</h1>
        <p style={styles.subheading}>Autentifică-te pentru a vedea readiness-ul de azi</p>

        {/* Google OAuth */}
        <button onClick={signInWithGoogle} style={styles.googleBtn} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continuă cu Google
        </button>

        {/* Separator */}
        <div style={styles.separator}>
          <div style={styles.separatorLine}/>
          <span style={styles.separatorText}>sau cu email</span>
          <div style={styles.separatorLine}/>
        </div>

        {/* Email / Password form */}
        <form onSubmit={handleEmailLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@exemplu.com"
              style={styles.input}
              autoComplete="email"
              required
            />
          </div>

          <div style={styles.field}>
            <div style={styles.labelRow}>
              <label style={styles.label}>Parolă</label>
              <Link to="/auth/forgot-password" style={styles.forgotLink}>
                Ai uitat parola?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              autoComplete="current-password"
              required
            />
          </div>

          {displayError && (
            <div style={styles.errorBox}>
              {translateError(displayError)}
            </div>
          )}

          <button
            type="submit"
            style={{
              ...styles.submitBtn,
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
            disabled={submitting}
          >
            {submitting ? 'Se autentifică...' : 'Intră în cont'}
          </button>
        </form>

        <p style={styles.footer}>
          Nu ai cont?{' '}
          <Link to="/auth/signup" style={styles.link}>Creează-ți contul</Link>
        </p>
      </div>
    </div>
  )
}

// Traduce erorile Supabase în română
function translateError(msg) {
  if (!msg) return ''
  if (msg.includes('Invalid login credentials')) return 'Email sau parolă incorecte.'
  if (msg.includes('Email not confirmed')) return 'Confirmă emailul înainte de a te autentifica.'
  if (msg.includes('Too many requests')) return 'Prea multe încercări. Așteaptă câteva minute.'
  if (msg.includes('User already registered')) return 'Acest email este deja înregistrat.'
  return msg
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0F1117',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#16181F',
    border: '0.5px solid #2A2D38',
    borderRadius: '20px',
    padding: '2rem 2rem 1.75rem',
    width: '100%',
    maxWidth: '400px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '1.75rem',
  },
  logoName: {
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '0.18em',
    color: '#C0DD97',
  },
  logoSub: {
    fontSize: '11px',
    color: '#3B6D11',
    letterSpacing: '0.06em',
    marginTop: '2px',
  },
  heading: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#E8E8E4',
    margin: '0 0 6px',
  },
  subheading: {
    fontSize: '14px',
    color: '#6B6F7A',
    margin: '0 0 1.75rem',
    lineHeight: '1.5',
  },
  googleBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '11px',
    background: '#1E2028',
    border: '0.5px solid #2A2D38',
    borderRadius: '10px',
    color: '#E8E8E4',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  separator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '1.25rem 0',
  },
  separatorLine: {
    flex: 1,
    height: '0.5px',
    background: '#2A2D38',
  },
  separatorText: {
    fontSize: '12px',
    color: '#4A4E5A',
    whiteSpace: 'nowrap',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#9A9EA8',
  },
  forgotLink: {
    fontSize: '12px',
    color: '#639922',
    textDecoration: 'none',
  },
  input: {
    padding: '10px 12px',
    background: '#1E2028',
    border: '0.5px solid #2A2D38',
    borderRadius: '10px',
    color: '#E8E8E4',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  errorBox: {
    padding: '10px 12px',
    background: '#2A1A1A',
    border: '0.5px solid #5A2A2A',
    borderRadius: '8px',
    color: '#F09595',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  submitBtn: {
    padding: '11px',
    background: '#639922',
    border: 'none',
    borderRadius: '10px',
    color: '#0F1117',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '4px',
    transition: 'opacity 0.15s',
  },
  footer: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#4A4E5A',
    margin: '1.25rem 0 0',
  },
  link: {
    color: '#639922',
    textDecoration: 'none',
    fontWeight: '500',
  },
}
