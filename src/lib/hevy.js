// src/lib/hevy.js — Hevy API v1 integration
import { supabase } from './supabase'

const HEVY_BASE = 'https://api.hevyapp.com/v1'

async function getApiKey() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Neautentificat')

  const { data, error } = await supabase
    .from('profiles')
    .select('hevy_api_key')
    .eq('id', user.id)
    .single()

  if (error) throw new Error('Nu s-a putut citi profilul')
  if (!data?.hevy_api_key) throw new Error('Hevy API key lipsă — adaugă-l în Profil → Surse date')

  return data.hevy_api_key
}

async function hevyRequest(path, params = {}) {
  const apiKey = await getApiKey()

  const url = new URL(`${HEVY_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Hevy API error ${res.status}: ${err.error || res.statusText}`)
  }

  return res.json()
}

const MUSCLE_MAP = {
  'bench press': 'chest', 'incline': 'chest', 'decline': 'chest', 'fly': 'chest', 'chest': 'chest', 'dip': 'chest',
  'row': 'back', 'pull': 'back', 'lat': 'back', 'deadlift': 'back', 'back': 'back',
  'shrug': 'traps', 'face pull': 'rear_delt',
  'press': 'shoulders', 'lateral raise': 'shoulders', 'overhead': 'shoulders', 'shoulder': 'shoulders',
  'curl': 'biceps', 'bicep': 'biceps',
  'tricep': 'triceps', 'pushdown': 'triceps', 'extension': 'triceps', 'skull': 'triceps',
  'squat': 'quads', 'leg press': 'quads', 'lunge': 'quads',
  'hamstring': 'hamstrings', 'rdl': 'hamstrings', 'leg curl': 'hamstrings',
  'calf': 'calves',
  'plank': 'core', 'crunch': 'core', 'ab': 'core',
}

function detectMuscles(exercises) {
  const groups = new Set()
  for (const ex of exercises) {
    const name = (ex.title || '').toLowerCase()
    for (const [kw, group] of Object.entries(MUSCLE_MAP)) {
      if (name.includes(kw)) groups.add(group)
    }
  }
  return [...groups]
}

function calcVolume(exercises) {
  let total = 0
  for (const ex of exercises) {
    for (const set of (ex.sets || [])) {
      if (set.weight_kg && set.reps) total += set.weight_kg * set.reps
    }
  }
  return Math.round(total)
}

function calcAvgRPE(exercises) {
  const rpes = []
  for (const ex of exercises) {
    for (const set of (ex.sets || [])) {
      if (set.rpe) rpes.push(set.rpe)
    }
  }
  if (!rpes.length) return null
  return Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
}

// ── Fetch antrenamente — pageSize maxim 10 (limita Hevy API) ─────────────────
// Fără limită de pagini — fetchuiește TOT istoricul (se oprește când Hevy
// returnează < 10 rezultate, semn că am ajuns la ultima pagină).
// Apelat cu pages=N pentru compatibilitate cu codul existent (ex. preview 8 pag).
export async function fetchRecentWorkouts(pages = 9999) {
  const allWorkouts = []

  for (let page = 1; page <= pages; page++) {
    const data = await hevyRequest('/workouts', { page, pageSize: 10 })
    const workouts = data?.workouts || []
    if (workouts.length === 0) break

    for (const w of workouts) {
      allWorkouts.push({
        id: w.id,
        title: w.title || 'Antrenament',
        date: w.start_time?.slice(0, 10),
        start_time: w.start_time || null,
        duration_min: w.duration ? Math.round(w.duration / 60) : null,
        volume_kg: calcVolume(w.exercises || []),
        rpe_avg: calcAvgRPE(w.exercises || []),
        muscle_groups: detectMuscles(w.exercises || []),
        exercises: (w.exercises || []).map(ex => ({
          name: ex.title || ex.exercise_template_id,
          sets: (ex.sets || []).map(s => ({
            reps: s.reps,
            weight_kg: s.weight_kg,
            rpe: s.rpe,
            is_pr: s.indicator === 'personal_record',
          })),
        })),
        hours_ago: w.start_time
          ? Math.round((Date.now() - new Date(w.start_time).getTime()) / 3600000)
          : null,
      })
    }

    if (workouts.length < 10) break
  }

  return allWorkouts
}

export function calcMuscleRecovery(workouts) {
  const RECOVERY_HOURS = {
    chest: 48, back: 48, quads: 72, hamstrings: 72,
    shoulders: 48, biceps: 36, triceps: 36, calves: 24,
    core: 24, traps: 36, rear_delt: 36,
  }

  const lastTrained = {}
  for (const w of workouts) {
    if (!w.hours_ago) continue
    for (const g of w.muscle_groups) {
      if (!lastTrained[g] || w.hours_ago < lastTrained[g]) {
        lastTrained[g] = w.hours_ago
      }
    }
  }

  const ready = []
  const notReady = []
  for (const [g, needed] of Object.entries(RECOVERY_HOURS)) {
    const since = lastTrained[g] ?? 999
    if (since >= needed) ready.push(g)
    else notReady.push({ group: g, remainingHours: Math.round(needed - since) })
  }

  const hasPush = ['chest', 'shoulders', 'triceps'].every(g => ready.includes(g))
  const hasPull = ['back', 'biceps'].every(g => ready.includes(g))
  const hasLegs = ['quads', 'hamstrings'].every(g => ready.includes(g))

  let suggestedDay = 'Full Body Light'
  if (hasLegs) suggestedDay = 'Legs Day'
  else if (hasPull) suggestedDay = 'Pull Day — Spate & Biceps'
  else if (hasPush) suggestedDay = 'Push Day — Piept & Umeri'

  return { ready, notReady, suggestedDay }
}

export function calcWeeklyStats(workouts) {
  const cutoff = new Date(Date.now() - 7 * 86400000)
  const thisWeek = workouts.filter(w => w.date && new Date(w.date) >= cutoff)

  return {
    count: thisWeek.length,
    totalVolume: thisWeek.reduce((s, w) => s + (w.volume_kg || 0), 0),
    avgDuration: thisWeek.length
      ? Math.round(thisWeek.reduce((s, w) => s + (w.duration_min || 0), 0) / thisWeek.length)
      : 0,
    prs: thisWeek.reduce((s, w) => s + w.exercises.reduce((es, ex) => es + ex.sets.filter(set => set.is_pr).length, 0), 0),
  }
}
