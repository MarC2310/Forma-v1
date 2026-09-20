// src/lib/rankSystem.js — Sistem provocări și rank FORMA
import { getLang } from './i18n'
import { supabase } from './supabase'

// ── Rankuri ─────────────────────────────────────────────────────────────────
export const RANKS = [
  { id: 'incepator', name: 'Începător', icon: '🥉', minPoints: 0,    color: '#CD7F32' },
  { id: 'activ',     name: 'Activ',     icon: '🥈', minPoints: 20,    color: '#A8A9AD' },
  { id: 'luptator',  name: 'Luptător',  icon: '⚔️', minPoints: 50,    color: '#7CB9E8' },
  { id: 'atlet',     name: 'Atlet',     icon: '🥇', minPoints: 100,   color: '#FFD700' },
  { id: 'campion',   name: 'Campion',   icon: '🏆', minPoints: 180,   color: '#FF8C00' },
  { id: 'maestru',   name: 'Maestru',   icon: '🎯', minPoints: 280,   color: '#00CED1' },
  { id: 'elite',     name: 'Elite',     icon: '💎', minPoints: 400,   color: '#4FC3F7' },
  { id: 'titan',     name: 'Titan',     icon: '⚡', minPoints: 560,   color: '#FF4500' },
  { id: 'legend',    name: 'Legend',    icon: '👑', minPoints: 760,   color: '#E040FB' },
  { id: 'mit',       name: 'Mit',       icon: '🌟', minPoints: 1000, color: '#B388FF' },
  { id: 'etern',     name: 'Etern',     icon: '♾️', minPoints: 1400, color: '#FF6EC7' },
]

export function getRank(points) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (points >= RANKS[i].minPoints) return RANKS[i]
  }
  return RANKS[0]
}

export function getNextRank(points) {
  for (let i = 0; i < RANKS.length; i++) {
    if (RANKS[i].minPoints > points) return RANKS[i]
  }
  return null
}

// ── Provocări definite ───────────────────────────────────────────────────────
export function getChallenges(now = new Date()) {
  const lang = getLang() === 'en' ? 'en' : 'ro'
  const locale = lang === 'en' ? 'en-US' : 'ro-RO'
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthName = now.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const monthShort = now.toLocaleDateString(locale, { month: 'long' })

  // Prima zi a saptamanii (luni)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999)
  const weekStr = `${weekStart.toLocaleDateString(locale,{day:'numeric',month:'short'})} – ${weekEnd.toLocaleDateString(locale,{day:'numeric',month:'short'})}`

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const ym = `${year}-${String(month+1).padStart(2,'0')}`

  // Descrieri lunare (conțin numele lunii) — traduse după limbă
  const DESC = lang === 'en' ? {
    steps:  `Accumulate as many steps as possible in ${monthShort}`,
    active: `Stay active every day in ${monthShort}`,
    sleep:  `Sleep ≥7h in ${monthShort}`,
  } : {
    steps:  `Acumulează cât mai mulți pași în ${monthShort}`,
    active: `Fii activ zilnic în ${monthShort}`,
    sleep:  `Dormi ≥7h în ${monthShort}`,
  }

  return {
    monthly: [
      {
        id: `luna_pasilor_${ym}`,
        title: '🦶 Luna Pașilor',
        subtitle: monthName,
        description: DESC.steps,
        type: 'monthly',
        metric: 'steps',
        ym,
        tiers: [
          { label: 'Bronz', target: 275000, points: 1, color: '#CD7F32' },
          { label: 'Argint', target: 300000, points: 2, color: '#A8A9AD' },
          { label: 'Aur',    target: 350000, points: 3, color: '#FFD700' },
        ],
      },
      {
        id: `luna_activa_${ym}`,
        title: '⚡ Luna Activă',
        subtitle: monthName,
        description: DESC.active,
        type: 'monthly',
        metric: 'active_days',
        ym,
        tiers: [
          { label: 'Bronz', target: Math.round(daysInMonth * 0.65), points: 1, color: '#CD7F32' },
          { label: 'Argint', target: Math.round(daysInMonth * 0.80), points: 2, color: '#A8A9AD' },
          { label: 'Aur',    target: daysInMonth, points: 3, color: '#FFD700' },
        ],
      },
      {
        id: `luna_somnului_${ym}`,
        title: '😴 Luna Somnului',
        subtitle: monthName,
        description: DESC.sleep,
        type: 'monthly',
        metric: 'sleep_nights',
        ym,
        tiers: [
          { label: 'Bronz', target: 15, points: 1, color: '#CD7F32' },
          { label: 'Argint', target: 20, points: 2, color: '#A8A9AD' },
          { label: 'Aur',    target: 25, points: 3, color: '#FFD700' },
        ],
      },
    ],
    weekly: [
      {
        id: `sapt_pasilor_${ym}_w${Math.ceil(now.getDate()/7)}`,
        title: '👟 Săptămâna Pașilor',
        subtitle: weekStr,
        description: 'Acumulează pași această săptămână',
        type: 'weekly',
        metric: 'steps',
        weekStart: weekStart.toISOString().slice(0,10),
        weekEnd: weekEnd.toISOString().slice(0,10),
        tiers: [
          { label: 'Bronz', target: 70000,  points: 1, color: '#CD7F32' },
          { label: 'Argint', target: 100000, points: 1, color: '#A8A9AD' },
          { label: 'Aur',    target: 150000, points: 2, color: '#FFD700' },
        ],
      },
      {
        id: `sapt_antrenamente_${ym}_w${Math.ceil(now.getDate()/7)}`,
        title: '🏋️ Săptămâna Forței',
        subtitle: weekStr,
        description: 'Antrenamente de forță această săptămână',
        type: 'weekly',
        metric: 'workouts',
        weekStart: weekStart.toISOString().slice(0,10),
        weekEnd: weekEnd.toISOString().slice(0,10),
        tiers: [
          { label: 'Bronz', target: 3, points: 1, color: '#CD7F32' },
          { label: 'Argint', target: 5, points: 1, color: '#A8A9AD' },
          { label: 'Aur',    target: 6, points: 2, color: '#FFD700' },
        ],
      },
    ],
  }
}

// ── Calcul progres ───────────────────────────────────────────────────────────
export function calcProgress(challenge, intervalsData, workouts) {
  const days = intervalsData?.days || []

  if (challenge.type === 'monthly') {
    const mDays = days.filter(d => d.date?.startsWith(challenge.ym))
    switch (challenge.metric) {
      case 'steps':
        return mDays.reduce((s, d) => s + (d.steps || 0), 0)
      case 'active_days':
        return mDays.filter(d => (d.steps || 0) >= 5000 || (d.moving_time || 0) > 0).length
      case 'sleep_nights':
        return mDays.filter(d => (d.sleep_hours || 0) >= 7).length
      default: return 0
    }
  }

  if (challenge.type === 'weekly') {
    const wDays = days.filter(d => d.date >= challenge.weekStart && d.date <= challenge.weekEnd)
    switch (challenge.metric) {
      case 'steps':
        return wDays.reduce((s, d) => s + (d.steps || 0), 0)
      case 'workouts':
        return (workouts || []).filter(w => w.date >= challenge.weekStart && w.date <= challenge.weekEnd).length
      default: return 0
    }
  }
  return 0
}

// ── Puncte salvate în Supabase + LocalStorage (Auto-detect user) ──────────
export async function loadPoints(userId) {
  let targetUserId = userId

  if (!targetUserId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      targetUserId = session?.user?.id
    } catch (e) {
      console.error('Eroare sesiune:', e)
    }
  }

  if (!targetUserId) {
    try { return JSON.parse(localStorage.getItem('forma-rank-points') || '{}') } catch { return {} }
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('rank_points')
      .eq('id', targetUserId)
      .single()

    if (error) throw error
    
    const pts = data?.rank_points || {}
    localStorage.setItem('forma-rank-points', JSON.stringify(pts))
    return pts
  } catch (err) {
    console.error('Eroare la încărcarea punctelor din Supabase:', err)
    try { return JSON.parse(localStorage.getItem('forma-rank-points') || '{}') } catch { return {} }
  }
}

export async function savePoints(pts, userId) {
  localStorage.setItem('forma-rank-points', JSON.stringify(pts))

  let targetUserId = userId
  if (!targetUserId) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      targetUserId = session?.user?.id
    } catch (e) {}
  }

  if (!targetUserId) return

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ rank_points: pts })
      .eq('id', targetUserId)

    if (error) throw error
  } catch (err) {
    console.error('Eroare la salvarea punctelor în Supabase:', err)
  }
}

export function getTotalPoints(pts) {
  return Object.values(pts).reduce((s, v) => s + v, 0)
}

// ── Migrare chei vechi (decay_ → penalizare_) ───────────────────────────────
export function migrarePuncteVechi() {
  const pts = JSON.parse(localStorage.getItem('forma-rank-points') || '{}')
  const cheieVechi = Object.keys(pts).filter(k => k.startsWith('decay_'))
  if (cheieVechi.length === 0) return pts

  const areEarned = Object.entries(pts).some(([k, v]) =>
    !k.startsWith('decay_') && !k.startsWith('penalizare_') && v > 0
  )

  cheieVechi.forEach(oldKey => {
    const newKey = oldKey.replace('decay_', 'penalizare_')
    if (pts[newKey] === undefined) {
      pts[newKey] = areEarned ? pts[oldKey] : 0
    }
    delete pts[oldKey]
  })

  localStorage.setItem('forma-rank-points', JSON.stringify(pts))
  return pts
}

// ── Penalizare lunară (varianta blândă) ─────────────────────────────────────
export function aplicaPenalizareLunara() {
  const now = new Date()
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const penalizareKey = `penalizare_${prevYm}`

  const pts = JSON.parse(localStorage.getItem('forma-rank-points') || '{}')

  if (pts[penalizareKey] !== undefined) return pts

  const areEarned = Object.entries(pts).some(([k, v]) =>
    !k.startsWith('penalizare_') && !k.startsWith('decay_') && v > 0
  )
  if (!areEarned) {
    pts[penalizareKey] = 0
    localStorage.setItem('forma-rank-points', JSON.stringify(pts))
    return pts
  }

  const hadActivity = Object.keys(pts).some(k =>
    !k.startsWith('penalizare_') &&
    !k.startsWith('decay_') &&
    !k.startsWith('sapt_antrenamente') &&
    k.includes(`_${prevYm}`)
  )

  if (!hadActivity) {
    const total = getTotalPoints(pts)
    const floorPoints = getRank(total).minPoints
    const puncteScazute = Math.min(2, Math.max(0, total - floorPoints))
    pts[penalizareKey] = puncteScazute > 0 ? -puncteScazute : 0
  } else {
    pts[penalizareKey] = 0
  }

  localStorage.setItem('forma-rank-points', JSON.stringify(pts))
  return pts
}

// Verifică dacă o provocare a fost completată și acorda puncte
export async function checkAndAwardPoints(challenge, progress, userId) {
  const pts = await loadPoints(userId)
  let awardedTier = null

  for (let i = challenge.tiers.length - 1; i >= 0; i--) {
    const tier = challenge.tiers[i]
    if (progress >= tier.target) {
      const key = `${challenge.id}_${tier.label}`
      if (!pts[key]) {
        pts[key] = tier.points
        await savePoints(pts, userId)
        awardedTier = tier
      }
      break
    }
  }
  return awardedTier
}
