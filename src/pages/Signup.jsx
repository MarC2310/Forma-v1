// src/pages/Signup.jsx — înregistrare cont nou FORMA
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Signup() {
  const { signUpWithEmail, signInWithGoogle, error } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]     = useState(false)
  const [localError, setLocalError] = useState('')

  async function handleSignup(e) {
    e.preventDefault()
    setLocalError('')

    if (password.length < 8) {
      setLocalError('Parola trebuie să aibă cel puțin 8 caractere.')
      return
    }

    setSubmitting(true)
    const { data, error } = await signUpWithEmail(email, password, fullName)
    setSubmitting(false)

    if (!error) {
      // Supabase trimite email de confirmare implicit
      // Dacă email confirmation e dezactivat în dashboard, userul e logat direct
      if (data?.user?.identities?.length === 0) {
        setLocalError('Acest email este deja înregistrat.')
      } else {
        setSuccess(true)
      }
    }
  }

  const displayError = localError || error

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="24" fill="#1A3A0A"/>
              <path d="M14 24l7 7 13-13" fill="none" stroke="#97C459"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={styles.heading}>Verifică emailul</h1>
          <p style={styles.subheading}>
            Am trimis un link de confirmare la <strong style={{color: '#C0DD97'}}>{email}</strong>.
            Deschide emailul și apasă pe link pentru a activa contul FORMA.
          </p>
          <p style={{...styles.subheading, marginTop: '0.75rem', fontSize: '13px', color: '#4A4E5A'}}>
            Nu găsești emailul? Verifică și folderul Spam.
          </p>
          <Link to="/auth/login" style={styles.backLink}>
            ← Înapoi la autentificare
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        <div style={styles.logoRow}>
          <svg width="36" height="36" viewBox="0 0 80 80" aria-label="FORMA">
            <rect width="80" height="80" rx="20" fill="#0F1117"/>
            <circle cx="40" cy="40" r="26" fill="none" stroke="#1A3A0A" strokeWidth="5"/>
            <circle cx="40" cy="40" r="26" fill="none" stroke="#97C459" strokeWidth="5"
              strokeDasharray="122 41" strokeDashoffset="41" strokeLinecap="round"
              transform="rotate(-90 40 40)"/>
            <text x="40" y="45" textAnchor="middle" fill="#C0DD97"
              fontSize="15" fontWeight="700" fontFamily="system-ui,sans-serif">75</text>
          </svg>
          <div style={styles.logoName}>FORMA</div>
        </div>

        <h1 style={styles.heading}>Creează contul tău</h1>
        <p style={styles.subheading}>
          Gratuit 14 zile, apoi 29 EUR/an. Anulezi oricând.
        </p>

        <button onClick={signInWithGoogle} style={styles.googleBtn}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Înregistrează-te cu Google
        </button>

        <div style={styles.separator}>
          <div style={styles.separatorLine}/>
          <span style={styles.separatorText}>sau cu email</span>
          <div style={styles.separatorLine}/>
        </div>

        <form onSubmit={handleSignup} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Nume complet</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Marcel Curiman"
              style={styles.input}
              autoComplete="name"
            />
          </div>

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
            <label style={styles.label}>Parolă</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minim 8 caractere"
              style={styles.input}
              autoComplete="new-password"
              required
            />
            <PasswordStrength password={password} />
          </div>

          {displayError && (
            <div style={styles.errorBox}>{displayError}</div>
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
            {submitting ? 'Se creează contul...' : 'Creează contul gratuit'}
          </button>
        </form>

        <p style={styles.terms}>
          Prin înregistrare, accepți{' '}
          <a href="/termeni" style={styles.termLink}>Termenii de utilizare</a>
          {' '}și{' '}
          <a href="/confidentialitate" style={styles.termLink}>Politica de confidențialitate</a>.
        </p>

        <p style={styles.footer}>
          Ai deja cont?{' '}
          <Link to="/auth/login" style={styles.link}>Autentifică-te</Link>
        </p>
      </div>
    </div>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  const len = password.length
  const strength = len < 6 ? 0 : len < 8 ? 1 : len < 12 ? 2 : 3
  const labels = ['Slabă', 'Acceptabilă', 'Bună', 'Excelentă']
  const colors = ['#E24B4A', '#BA7517', '#97C459', '#639922']

  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            flex: 1, height: '3px', borderRadius: '2px',
            background: i <= strength ? colors[strength] : '#2A2D38',
            transition: 'background 0.2s',
          }}/>
        ))}
      </div>
      <span style={{ fontSize: '11px', color: colors[strength] }}>
        {labels[strength]}
      </span>
    </div>
  )
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
    gap: '10px',
    marginBottom: '1.5rem',
  },
  logoName: {
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '0.18em',
    color: '#C0DD97',
  },
  heading: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#E8E8E4',
    margin: '0 0 6px',
  },
  subheading: {
    fontSize: '14px',
    color: '#6B6F7A',
    margin: '0 0 1.5rem',
    lineHeight: '1.5',
  },
  successIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.25rem',
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
  },
  separator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '1.25rem 0',
  },
  separatorLine: { flex: 1, height: '0.5px', background: '#2A2D38' },
  separatorText: { fontSize: '12px', color: '#4A4E5A', whiteSpace: 'nowrap' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '500', color: '#9A9EA8' },
  input: {
    padding: '10px 12px',
    background: '#1E2028',
    border: '0.5px solid #2A2D38',
    borderRadius: '10px',
    color: '#E8E8E4',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  errorBox: {
    padding: '10px 12px',
    background: '#2A1A1A',
    border: '0.5px solid #5A2A2A',
    borderRadius: '8px',
    color: '#F09595',
    fontSize: '13px',
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
  },
  terms: {
    fontSize: '12px',
    color: '#4A4E5A',
    textAlign: 'center',
    marginTop: '1rem',
    lineHeight: '1.6',
  },
  termLink: { color: '#639922', textDecoration: 'none' },
  footer: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#4A4E5A',
    margin: '0.75rem 0 0',
  },
  link: { color: '#639922', textDecoration: 'none', fontWeight: '500' },
  backLink: {
    display: 'block',
    textAlign: 'center',
    color: '#639922',
    textDecoration: 'none',
    fontSize: '14px',
    marginTop: '1.5rem',
  },
}
