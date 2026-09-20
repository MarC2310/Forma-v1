// src/components/AuthCallback.jsx — handler redirect după OAuth
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase procesează automat tokenul din URL hash/query
    // onAuthStateChange din useAuth.js va prinde evenimentul
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/auth/login', { replace: true })
      }
    })
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1117',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <svg width="48" height="48" viewBox="0 0 80 80" aria-hidden="true">
        <rect width="80" height="80" rx="20" fill="#0F1117"/>
        <circle cx="40" cy="40" r="26" fill="none" stroke="#1A3A0A" strokeWidth="5"/>
        <circle cx="40" cy="40" r="26" fill="none" stroke="#97C459" strokeWidth="5"
          strokeDasharray="122 41" strokeLinecap="round"
          transform="rotate(-90 40 40)">
          <animateTransform attributeName="transform" type="rotate"
            from="-90 40 40" to="270 40 40" dur="1.2s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <p style={{ color: '#6B6F7A', fontSize: '14px' }}>Se autentifică...</p>
    </div>
  )
}

// ── Protected Route ───────────────────────────────────────────────────────────
// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0F1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '32px', height: '32px',
          border: '2px solid #1A3A0A',
          borderTopColor: '#639922',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />
  }

  return children
}

// ── Public Route (redirect dacă deja logat) ───────────────────────────────────
export function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
