// src/lib/googlefit.js
import { supabase } from './supabase'

const CLIENT_ID    = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_APP_URL + '/auth/googlefit/callback'

export function startGoogleFitAuth() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/fitness.activity.read',
      'https://www.googleapis.com/auth/fitness.heart_rate.read',
      'https://www.googleapis.com/auth/fitness.body.read',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function fetchGoogleFitData(userId, daysBack, hrHourlyDate) {
  const { data, error } = await supabase.functions.invoke('googlefit-data', {
    body: { userId, ts: Date.now(), ...(daysBack ? { daysBack } : {}), ...(hrHourlyDate ? { hrHourlyDate } : {}) }
  })

  // Token expirat sau neconectat → returnăm null cu flag în loc să aruncăm eroare
  if (error || !data?.ok) {
    const msg = data?.error || error?.message || 'Eroare Google Fit'
    // Token refresh eșuat = reconectare necesară
    if (msg.includes('Token refresh') || msg.includes('token') || msg.includes('401') || msg.includes('invalid_grant')) {
      return { _needsReconnect: true, _error: msg }
    }
    // Alte erori → null silențios (nu blocăm UI)
    console.warn('[Google Fit]', msg)
    return null
  }

  return data.data
}
