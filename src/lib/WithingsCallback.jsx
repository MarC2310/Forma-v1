// src/pages/WithingsCallback.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function WithingsCallback() {
  const { user } = useAuth()
  const [status, setStatus] = useState('Se procesează autorizarea...')
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const err = params.get('error')
    if (err) { setError('Autorizare refuzată: ' + err); return }
    if (!code) { setError('Lipsă cod de autorizare'); return }
    if (!user) return
    exchangeCode(code)
  }, [user])

  async function exchangeCode(code) {
    try {
      setStatus('Se schimbă codul pentru tokens...')
      const { data, error } = await supabase.functions.invoke('withings-auth', {
        body: { action: 'exchange', code, userId: user.id }
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error || 'Eroare necunoscută')
      setStatus('✓ Withings conectat cu succes!')
      setDone(true)
      setTimeout(() => { window.location.href = '/dashboard' }, 2000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', gap: '1rem' }}>
      <svg width="56" height="56" viewBox="0 0 80 80">
        <rect width="80" height="80" rx="20" fill="#0F1117"/>
        <circle cx="40" cy="40" r="26" fill="none" stroke="#1A3A0A" strokeWidth="5"/>
        <circle cx="40" cy="40" r="26" fill="none" stroke={error ? '#E24B4A' : done ? '#97C459' : '#4A4E5A'} strokeWidth="5"
          strokeDasharray={done ? '163 0' : '81 81'} strokeLinecap="round" transform="rotate(-90 40 40)"/>
      </svg>
      {error ? (
        <>
          <div style={{ fontSize: 16, color: '#E24B4A', fontWeight: 600 }}>❌ Eroare</div>
          <div style={{ fontSize: 13, color: '#6B6F7A', maxWidth: 300, textAlign: 'center' }}>{error}</div>
          <a href="/profile" style={{ color: '#639922', fontSize: 13 }}>← Înapoi la Profil</a>
        </>
      ) : (
        <>
          <div style={{ fontSize: 16, color: done ? '#97C459' : '#E8E8E4', fontWeight: 600 }}>{status}</div>
          {done && <div style={{ fontSize: 13, color: '#4A4E5A' }}>Se redirecționează spre dashboard...</div>}
        </>
      )}
    </div>
  )
}
