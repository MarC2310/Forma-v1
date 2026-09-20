// src/lib/errorReporting.js
// Raportare de erori pentru Forma:
//  1) scrie erorile în Supabase (tabel error_logs) — le vezi în dashboard-ul tău
//  2) le trimite la Sentry DOAR dacă există VITE_SENTRY_DSN (altfel cod inert)
//  3) prinde și erorile din afara React (window.onerror + promisiuni respinse)
import { supabase } from './supabase'

let _sentry = null

// Apelat o singură dată la pornire (din main.jsx)
export async function initErrorReporting() {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      reportError(e.error || new Error(e.message), { source: 'window.onerror' })
    })
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason))
      reportError(reason, { source: 'unhandledrejection' })
    })
  }

  // Sentry se activează automat când setezi VITE_SENTRY_DSN în variabilele de mediu.
  // Fără DSN, nu se încarcă nimic — zero cost, zero risc.
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (dsn) {
    try {
      const url = 'https://esm.sh/@sentry/browser@8'
      const Sentry = await import(/* @vite-ignore */ url)
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0,
        release: 'forma@' + (import.meta.env.VITE_APP_VERSION || 'dev'),
      })
      _sentry = Sentry
      console.info('[Forma] Sentry activat')
    } catch (err) {
      console.warn('[Forma] Sentry nu s-a putut încărca:', err)
    }
  }
}

// Raportează o eroare. Best-effort: nu aruncă niciodată, nu blochează UI-ul.
export async function reportError(error, info = {}) {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[Forma] Eroare capturată:', err, info)

    if (_sentry) {
      try { _sentry.captureException(err, { extra: info }) } catch {}
    }

    let userId = null
    try {
      const { data } = await supabase.auth.getUser()
      userId = data?.user?.id ?? null
    } catch {}

    await supabase.from('error_logs').insert({
      user_id: userId,
      message: (err.message || '').slice(0, 1000),
      stack: (err.stack || '').slice(0, 4000),
      component_stack: (info.componentStack || '').slice(0, 4000),
      source: info.source || 'react',
      page: typeof location !== 'undefined' ? location.pathname : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      app_version: import.meta.env.VITE_APP_VERSION || null,
    })
  } catch {
    // Niciodată nu lăsăm raportarea erorilor să provoace ea însăși o eroare.
  }
}
