// src/lib/withings.js — Withings frontend integration
import { supabase } from './supabase'

const CLIENT_ID = import.meta.env.VITE_WITHINGS_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_APP_URL + '/auth/withings/callback'

export function startWithingsAuth() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'user.info,user.metrics,user.activity,user.sleepevents',
    state: 'forma_' + Date.now(),
  })
  window.location.href = `https://account.withings.com/oauth2_user/authorize2?${params}`
}

export async function fetchWithingsSleep(userId) {
  const { data, error } = await supabase.functions.invoke('withings-data', {
    body: { userId, dataType: 'sleep' }
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error || 'Eroare Withings')
  return data.data.sleep
}

export async function fetchWithingsBody(userId) {
  const { data, error } = await supabase.functions.invoke('withings-data', {
    body: { userId, dataType: 'body' }
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error || 'Eroare Withings')
  return data.data
}

export async function fetchWithingsAll(userId) {
  const { data, error } = await supabase.functions.invoke('withings-data', {
    body: { userId, dataType: 'all' }
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error || 'Eroare Withings')
  return data.data
}

export function calcSleepScore(sleep) {
  if (!sleep) return 50
  let score = 0
  const totalH = sleep.total_h || 0
  if (totalH >= 8)       score += 40
  else if (totalH >= 7)  score += 35
  else if (totalH >= 6)  score += 22
  else if (totalH >= 5)  score += 10
  if (sleep.deep_h && sleep.total_h) {
    const deepRatio = sleep.deep_h / sleep.total_h
    if (deepRatio >= 0.22)      score += 25
    else if (deepRatio >= 0.15) score += 18
    else if (deepRatio >= 0.10) score += 10
  }
  if (sleep.rem_h && sleep.total_h) {
    const remRatio = sleep.rem_h / sleep.total_h
    if (remRatio >= 0.20)       score += 15
    else if (remRatio >= 0.15)  score += 10
    else if (remRatio >= 0.10)  score += 5
  }
  if (sleep.spo2) {
    if (sleep.spo2 >= 95)       score += 10
    else if (sleep.spo2 >= 92)  score += 5
    else                         score -= 10
  }
  if (sleep.hr) {
    if (sleep.hr < 55)       score += 5
    else if (sleep.hr < 65)  score += 3
  }
  if (sleep.score) {
    if (sleep.score >= 85)      score = Math.min(100, score + 5)
    else if (sleep.score < 60)  score = Math.max(0, score - 10)
  }
  return Math.min(100, Math.max(0, Math.round(score)))
}

export function calcHRVScore(currentHRV, baselineHRV) {
  if (!currentHRV) return null  // null = nu avem date, nu 55 implicit
  if (!baselineHRV) {
    if (currentHRV >= 70) return 90
    if (currentHRV >= 55) return 75
    if (currentHRV >= 40) return 60
    if (currentHRV >= 25) return 40
    return 25
  }
  const ratio = currentHRV / baselineHRV
  if (ratio >= 1.10) return 95
  if (ratio >= 1.02) return 85
  if (ratio >= 0.95) return 75
  if (ratio >= 0.88) return 60
  if (ratio >= 0.80) return 40
  return 20
}
