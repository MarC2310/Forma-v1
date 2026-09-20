// src/pages/ForgotPassword.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <Link to="/auth/login" style={backStyle}>← Înapoi</Link>
        <h1 style={h1Style}>Resetare parolă</h1>
        {sent ? (
          <p style={msgStyle}>
            Am trimis un link de resetare la <strong style={{color:'#C0DD97'}}>{email}</strong>.
            Verifică și folderul Spam.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <p style={subStyle}>Introdu emailul contului și îți trimitem un link de resetare.</p>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@exemplu.com"
              style={inputStyle} required
            />
            {error && <div style={errStyle}>{error}</div>}
            <button type="submit" style={btnStyle} disabled={loading}>
              {loading ? 'Se trimite...' : 'Trimite link de resetare'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// src/pages/ResetPassword.jsx
export function ResetPassword() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [done, setDone]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Parolele nu coincid.'); return }
    if (password.length < 8)  { setError('Minim 8 caractere.'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={h1Style}>Parolă nouă</h1>
        {done ? (
          <>
            <p style={msgStyle}>Parola a fost schimbată cu succes.</p>
            <Link to="/auth/login" style={{...btnStyle, textDecoration:'none', textAlign:'center', marginTop:'1rem', display:'block'}}>
              Mergi la autentificare
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Parolă nouă (minim 8 caractere)"
              style={inputStyle} required
            />
            <input type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirmă parola"
              style={inputStyle} required
            />
            {error && <div style={errStyle}>{error}</div>}
            <button type="submit" style={btnStyle} disabled={loading}>
              {loading ? 'Se salvează...' : 'Salvează parola nouă'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Stiluri comune ────────────────────────────────────────────────────────────
const pageStyle  = { minHeight:'100vh', background:'#0F1117', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', fontFamily:'system-ui,sans-serif' }
const cardStyle  = { background:'#16181F', border:'0.5px solid #2A2D38', borderRadius:'20px', padding:'2rem', width:'100%', maxWidth:'400px' }
const h1Style    = { fontSize:'20px', fontWeight:'600', color:'#E8E8E4', margin:'0 0 1rem' }
const subStyle   = { fontSize:'14px', color:'#6B6F7A', margin:'0', lineHeight:'1.5' }
const msgStyle   = { fontSize:'14px', color:'#9A9EA8', lineHeight:'1.6' }
const inputStyle = { padding:'10px 12px', background:'#1E2028', border:'0.5px solid #2A2D38', borderRadius:'10px', color:'#E8E8E4', fontSize:'14px', fontFamily:'inherit', outline:'none' }
const btnStyle   = { padding:'11px', background:'#639922', border:'none', borderRadius:'10px', color:'#0F1117', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }
const errStyle   = { padding:'10px 12px', background:'#2A1A1A', border:'0.5px solid #5A2A2A', borderRadius:'8px', color:'#F09595', fontSize:'13px' }
const backStyle  = { color:'#639922', textDecoration:'none', fontSize:'13px', display:'block', marginBottom:'1.25rem' }
