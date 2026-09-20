// src/pages/Dashboard.jsx
import React from 'react'
import BLEHeartRateWidget from '../components/BLEHeartRate'
import { getBLEHRData } from '../hooks/useBLEHeartRate'
import RankPage from './RankPage'
import { getRank, getTotalPoints, loadPoints, aplicaPenalizareLunara, migrarePuncteVechi } from '../lib/rankSystem'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import { useI18n, setLang as setAppLang, translate } from '../lib/i18n'
import { fetchRecentWorkouts, calcMuscleRecovery, calcWeeklyStats } from '../lib/hevy'
import { fetchWithingsAll, calcSleepScore, calcHRVScore } from '../lib/withings'
import { fetchIntervalsData } from '../lib/intervals'
import { supabase } from '../lib/supabase'
import { QUERY_KEYS } from '../lib/queryClient'
import {
  useHevyQuery, useWithingsQuery, useIntervalsQuery,
  useProfileQuery, useInjuriesQuery, useNutritionQuery,
  useSupplementsQuery, useWaterQuery,
  useSuppLogsRealtime, useMealEntriesRealtime,
  useAddWater, useToggleSupplement,
  useBodyMeasurementsQuery,
} from '../hooks/useFormaQueries'
import { useReadinessScore } from '../hooks/useReadinessScore'
import { SkeletonDashboard } from '../components/SkeletonLoader'
import { useSwipeTabs } from '../hooks/useSwipe'
import OnboardingFlow from '../components/OnboardingFlow'
import { useSwipeNavigation } from '../hooks/useSwipeNavigation'
import AICoach from '../components/AICoach'
import AICoachChat from '../components/AICoachChat'
import ShareCard from '../components/ShareCard'
import NotificationBell from '../components/NotificationBell'
import BirthdayModal from '../components/BirthdayModal'
import RecoveryDetailModal from '../components/RecoveryDetailModal'
import MuscleMapModal from '../components/MuscleMapModal'
import { MiniMuscleMap } from '../components/MuscleRecoveryMap'
import HRVMeasurement from '../components/HRVMeasurement'
import VitaminDTracker from '../components/VitaminDTracker'
import AchievementToast from '../components/AchievementToast'
import { usePWA } from '../components/PWAManager'
import DynamicFavicon from '../components/DynamicFavicon'
import WaterTracker from '../components/WaterTracker'
import SplineChart from '../components/SplineChart'
import CaloriesBarChart from '../components/CaloriesBarChart'
import MacrosBarChart from '../components/MacrosBarChart'
import PMCChart from '../components/PMCChart'
import BodyBatteryWidget from '../components/BodyBatteryWidget'
import VitalityRingWidget from '../components/VitalityRingWidget'
import WeatherWidget from '../components/WeatherWidget'
import ActivityTab from './ActivityTab'
import NutritionTab from '../components/NutritionTab'
import SleepStatsView from '../components/SleepStatsView';

// ── Utilitar culoare scor vitalitate ─────────────────────────────────────────
function vitalScoreColor(v) {
  if (v >= 70) return '#5AAD1E'
  if (v >= 50) return '#F97316'
  return '#E24B4A'
}

// ── Persistență scor zilnic vitalitate ───────────────────────────────────────
function todayKey() {
  const d = new Date()
  return `forma_vitality_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function saveVitalityScore(score) {
  if (score > 0) {
    const key = todayKey()
    if (!localStorage.getItem(key)) localStorage.setItem(key, String(score))
  }
}
function loadVitalityHistory(days) {
  const scores = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = `forma_vitality_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const val = localStorage.getItem(key)
    scores.push(val ? parseInt(val, 10) : null)
  }
  return scores
}

// ── Sparkline vitalitate 7/14/30 zile ────────────────────────────────────────
function VitalitySparkline({ isDark }) {
  const [period, setPeriod] = useState(7)
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth, H = canvas.clientHeight
    canvas.width = W * dpr; canvas.height = H * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const raw = loadVitalityHistory(period)
    const filled = raw.map((v, i) => {
      if (v !== null) return v
      const prev = raw.slice(0, i).reverse().find(x => x !== null)
      const next = raw.slice(i+1).find(x => x !== null)
      if (prev && next) return Math.round((prev + next) / 2)
      return prev || next || 0
    })
    const scores = filled.filter(Boolean)
    if (scores.length < 2) return

    const minS = Math.min(...scores), maxS = Math.max(...scores)
    const range = maxS - minS || 10
    const padL = 4, padR = 4, padT = 8, padB = 4

    function sx(i) { return padL + i * (W - padL - padR) / (filled.length - 1) }
    function sy(v) { return H - padB - (v - minS) / range * (H - padT - padB) }

    // linha guia
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 3])
    const midV = (minS + maxS) / 2
    ctx.beginPath(); ctx.moveTo(0, sy(midV)); ctx.lineTo(W, sy(midV)); ctx.stroke()
    ctx.setLineDash([])

    // gradient linie
    const validPairs = filled.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0)
    if (validPairs.length < 2) return
    const grad = ctx.createLinearGradient(sx(validPairs[0]), 0, sx(validPairs[validPairs.length-1]), 0)
    validPairs.forEach(i => {
      const t = (i - validPairs[0]) / (validPairs[validPairs.length-1] - validPairs[0])
      grad.addColorStop(Math.min(1, Math.max(0, t)), vitalScoreColor(filled[i]))
    })
    ctx.strokeStyle = grad
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    ctx.beginPath()
    let first = true
    filled.forEach((v, i) => {
      if (v <= 0) return
      if (first) { ctx.moveTo(sx(i), sy(v)); first = false }
      else ctx.lineTo(sx(i), sy(v))
    })
    ctx.stroke()

    // puncte
    filled.forEach((v, i) => {
      if (v <= 0) return
      const isToday = i === filled.length - 1
      ctx.fillStyle = vitalScoreColor(v)
      ctx.beginPath()
      ctx.arc(sx(i), sy(v), isToday ? 4 : (period <= 14 ? 2 : 0), 0, Math.PI * 2)
      ctx.fill()
      if (isToday) {
        ctx.strokeStyle = isDark ? '#1a1a1a' : '#ffffff'
        ctx.lineWidth = 1.5; ctx.stroke()
      }
    })
  }, [period, isDark])

  const raw = loadVitalityHistory(period)
  const scores = raw.filter(Boolean)
  const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0
  const mn = scores.length ? Math.min(...scores) : 0
  const mx = scores.length ? Math.max(...scores) : 0
  const trend = scores.length >= 2 ? scores[scores.length-1] - scores[0] : 0

  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const mutedCol  = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)'
  const textCol   = isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.7)'

  return (
    <div style={{ marginBottom: 8 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: mutedCol }}>
          Vitalitate dimineață 🌅
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[7, 14, 30].map(n => (
            <button key={n} onClick={() => setPeriod(n)} style={{
              fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 5, cursor: 'pointer',
              border: `0.5px solid ${period === n ? (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)') : borderCol}`,
              background: period === n ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
              color: period === n ? textCol : mutedCol, fontFamily: 'inherit'
            }}>{n}z</button>
          ))}
        </div>
      </div>
      {/* canvas */}
      <canvas ref={canvasRef} style={{ width: '100%', height: 48, display: 'block' }}/>
      {/* stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[['medie', avg, textCol], ['min', mn, '#E24B4A'], ['max', mx, '#5AAD1E']].map(([lbl, val, col]) => (
            <span key={lbl} style={{ fontSize: 9, color: mutedCol }}>
              {lbl} <strong style={{ color: col, fontWeight: 700 }}>{val || '—'}</strong>
            </span>
          ))}
        </div>
        {scores.length >= 2 && (
          <span style={{ fontSize: 9, color: trend >= 0 ? '#5AAD1E' : '#E24B4A' }}>
            {trend >= 0 ? '+' : ''}{trend}pt / {period}z
          </span>
        )}
      </div>
    </div>
  )
}

// ── Hook pentru dimensiunea ferestrei ────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const fn = () => setWidth(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return width
}



// ── Calcul Vârstă Biologică ──────────────────────────────────────────────────
function calcBioAge({ age, hrRest, hrvRmssd, hrvSdnn, pwv, bpSys, bpDia, fatPct, vo2maxEst, weeklySteps, workoutsPerWeek, sleepAvg, gender }) {
  if (!age) return null
  let bioAge = age
  let factors = 0

  // HR odihnă (impact mare)
  if (hrRest) {
    factors++
    if (hrRest < 50) bioAge -= 5
    else if (hrRest < 55) bioAge -= 3
    else if (hrRest < 60) bioAge -= 1.5
    else if (hrRest < 65) bioAge += 0
    else if (hrRest < 70) bioAge += 1.5
    else if (hrRest < 80) bioAge += 3
    else bioAge += 6
  }

  // HRV RMSSD (impact mare — indicator cheie îmbătrânire SNV)
  if (hrvRmssd) {
    factors++
    // Valori tipice scad cu vârsta: 20-30 ani ~55ms, 40-50 ani ~35ms, 60+ ani ~20ms
    const expectedRmssd = Math.max(15, 65 - age * 0.6)
    const ratio = hrvRmssd / expectedRmssd
    if (ratio >= 1.3) bioAge -= 6
    else if (ratio >= 1.1) bioAge -= 3
    else if (ratio >= 0.9) bioAge -= 0.5
    else if (ratio >= 0.7) bioAge += 2
    else if (ratio >= 0.5) bioAge += 5
    else bioAge += 9
  }

  // PWV — rigiditate arterială (cel mai puternic predictor vârstă vasculară)
  if (pwv) {
    factors++
    // Valori normale cresc cu vârsta: ~6 la 20 ani, ~8 la 50 ani, ~10+ la 70 ani
    const expectedPwv = 5 + age * 0.07
    const diff = pwv - expectedPwv
    if (diff < -1.5) bioAge -= 5
    else if (diff < -0.5) bioAge -= 2.5
    else if (diff < 0.5) bioAge += 0
    else if (diff < 1.5) bioAge += 3
    else if (diff < 3) bioAge += 6
    else bioAge += 10
  }

  // Tensiune arterială
  if (bpSys && bpDia) {
    factors++
    if (bpSys < 115 && bpDia < 75) bioAge -= 3
    else if (bpSys < 125 && bpDia < 80) bioAge -= 1
    else if (bpSys < 130 && bpDia < 85) bioAge += 0
    else if (bpSys < 140 && bpDia < 90) bioAge += 3
    else bioAge += 7
  }

  // Compoziție corporală (% grăsime, ajustat pe gen)
  if (fatPct) {
    factors++
    const isFemale = gender === 'F'
    const optimal = isFemale ? 24 : 15
    const diff = fatPct - optimal
    if (diff < -3) bioAge -= 1 // prea slab nu e ideal
    else if (diff < 3) bioAge -= 2
    else if (diff < 8) bioAge += 0
    else if (diff < 14) bioAge += 3
    else bioAge += 7
  }

  // Activitate fizică (pași + antrenamente)
  if (weeklySteps) {
    factors++
    const dailyAvg = weeklySteps / 7
    if (dailyAvg >= 12000) bioAge -= 3
    else if (dailyAvg >= 9000) bioAge -= 1.5
    else if (dailyAvg >= 6000) bioAge += 0
    else if (dailyAvg >= 3000) bioAge += 2
    else bioAge += 4
  }

  if (workoutsPerWeek !== undefined && workoutsPerWeek !== null) {
    factors++
    if (workoutsPerWeek >= 4) bioAge -= 2
    else if (workoutsPerWeek >= 2) bioAge -= 1
    else if (workoutsPerWeek >= 1) bioAge += 0
    else bioAge += 1.5
  }

  // Somn
  if (sleepAvg) {
    factors++
    if (sleepAvg >= 7 && sleepAvg <= 8.5) bioAge -= 2
    else if (sleepAvg >= 6.5 && sleepAvg < 9.5) bioAge += 0
    else if (sleepAvg >= 5.5) bioAge += 2
    else bioAge += 4
  }

  if (factors < 3) return null // prea puține date pentru un calcul fiabil

  return Math.round(bioAge * 10) / 10
}

function calc1RM(weight, reps) {
  if (!weight || !reps) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30)) // Epley formula
}

// ── Estimare durată/calorii antrenament — identică cu WorkoutPage.jsx, ca să nu diveargă ──
function estimateWorkoutDuration(w) {
  if (w.duration_min) return { value: w.duration_min, isEstimated: false }
  const exercises = w.exercises || []
  const totalSets = exercises.reduce((s, ex) => s + (ex.sets?.length || 0), 0)
  const setsTimeMin = (totalSets * 72.5) / 60
  const transitionsTimeMin = (Math.max(0, exercises.length - 1) * 60) / 60
  const warmupMin = 5
  const value = Math.max(15, Math.round(setsTimeMin + transitionsTimeMin + warmupMin))
  return { value, isEstimated: true }
}

function estimateWorkoutCalories(durationMin, rpeAvg, userWeightKg) {
  const rpe = rpeAvg || 6.5
  const weightFactor = (userWeightKg || 80) / 80
  return Math.round(durationMin * Math.pow(rpe / 10, 1.5) * 7.5 * weightFactor)
}

// ── Body Battery — simulare orară 0-100%: încărcare din somn, descărcare din activitate ──
// Drenaj orar per tip de activitate (% baterie / oră)
function _bbActDrainRate(type, caloriesPerHour) {
  // Dacă avem calorii reale, le folosim ca proxy fidel pentru efort
  if (caloriesPerHour > 0) {
    // ~600 kcal/h = efort maxim ≈ 18% drenaj; ~100 kcal/h = ușor ≈ 3%
    return Math.min(18, Math.max(2, caloriesPerHour / 33))
  }
  const t = (type || '').toLowerCase()
  if (/weight|strength|gym|workout|muscl|lift|forca|forta/i.test(t)) return 13 // efort neuromuscular intens
  if (/run|jog|alerg/i.test(t)) return 10
  if (/ride|cycl|bike/i.test(t)) return 8
  if (/swim|inot/i.test(t)) return 9
  if (/walk|plimb|mers/i.test(t)) return 3  // efort mic
  if (/yoga|stretch|flex|pilates/i.test(t)) return 2
  if (/hike|trail/i.test(t)) return 7
  return 5
}

function calcBodyBattery({ sleepHours, sleepQuality, hrHourly, todayWorkout, currentHour, hrvMs, hrvBaseline, activities = [] }) {
  // 1. Nivel de start (la trezire) — determinat de somnul nopții precedente
  //    8h somn de calitate bună = aproape plin; somn scurt/slab = start redus
  const sleepFactor = sleepHours != null ? Math.min(1, sleepHours / 8) : 0.7
  const qualityFactor = sleepQuality != null ? sleepQuality / 10 : 0.75

  // HRV real (Intervals.icu) — dacă disponibil, ajustează nivelul de start:
  // HRV peste baseline-ul personal = recuperare bună = bonus la start;
  // HRV sub baseline = stres/oboseală reziduală = penalizare la start.
  let hrvAdjustment = 0
  if (hrvMs != null && hrvBaseline) {
    const ratio = hrvMs / hrvBaseline
    if (ratio >= 1.15) hrvAdjustment = 8
    else if (ratio >= 1.0) hrvAdjustment = 3
    else if (ratio >= 0.85) hrvAdjustment = -4
    else hrvAdjustment = -10
  }

  const startLevel = Math.max(15, Math.min(100, Math.round(35 + 60 * (sleepFactor * 0.65 + qualityFactor * 0.35) + hrvAdjustment)))

  // Pre-calculăm zonele de activitate (start_hour, end_hour, drain_rate) o singură dată
  const actZones = activities.filter(a => {
    const dt = a.start_time || a.start_date_local
    return dt != null && (a.moving_time || a.elapsed_time || a.duration)
  }).map(a => {
    const dt = new Date(a.start_time || a.start_date_local)
    const startH = dt.getHours() + dt.getMinutes() / 60
    const durH = (a.moving_time || a.elapsed_time || a.duration || 3600) / 3600
    const calPerH = (a.calories && durH > 0) ? a.calories / durH : 0
    return {
      startH,
      endH: startH + durH,
      rate: _bbActDrainRate(a.type, calPerH),
    }
  })

  // 2. Descărcare orară — bazată pe puls (proxy pentru activitate/efort) dacă disponibil,
  //    altfel pe o curbă tipică de consum (mai accentuată dimineața/seara, redusă noaptea)
  const hrMap = {}
  ;(hrHourly || []).filter(Boolean).forEach(h => { hrMap[h.hour] = h.hr })
  const baselineHr = Math.min(...(hrHourly || []).filter(Boolean).map(h => h.hr).filter(Boolean), 60) || 55

  const hourlyLevels = []
  let level = startLevel
  for (let h = 0; h <= 23; h++) {
    if (h > currentHour) { hourlyLevels.push(null); continue }
    const hr = hrMap[h]
    let drain
    if (hr) {
      // Cu cât pulsul e mai sus față de baseline, cu atât drenajul orar e mai mare
      const excess = Math.max(0, hr - baselineHr)
      drain = 0.8 + excess * 0.18
    } else {
      // Fallback: curbă tipică — drenaj minim noaptea, moderat ziua
      drain = (h >= 1 && h <= 5) ? 0.2 : 1.4
    }

    // Drenaj activitate cu rate proporțional cu tipul și durata reală din oră
    // Activitățile Intervals.icu au prioritate față de todayWorkout (Hevy fallback)
    if (actZones.length > 0) {
      actZones.forEach(z => {
        const overlapStart = Math.max(h, z.startH)
        const overlapEnd   = Math.min(h + 1, z.endH)
        const fraction     = Math.max(0, overlapEnd - overlapStart) // 0..1 din oră
        if (fraction > 0) drain += z.rate * fraction
      })
    } else if (todayWorkout?.start_time) {
      // Fallback: antrenament Hevy fără date Intervals.icu
      const wHour = new Date(todayWorkout.start_time).getHours()
      const wDurationH = Math.ceil((estimateWorkoutDuration(todayWorkout).value || 45) / 60)
      if (h >= wHour && h < wHour + wDurationH) drain += 10
    }

    level = Math.max(5, Math.min(100, level - drain))
    hourlyLevels.push(Math.round(level))
  }

  return { startLevel, current: hourlyLevels[currentHour] ?? startLevel, hourlyLevels, hrvAdjustment }
}

function scoreColor(score, c) {
  if (!c) return '#888'
  if (!score) return c.text4
  if (score >= 80) return c.green
  if (score >= 60) return c.orange
  return c.red
}

function recBadge(type, c) {
  if (!c) return null
  const map = {
    train_hard:     { label: 'ANTRENAMENT INTENS',  bg: c.green3, color: c.green },
    train_moderate: { label: 'ANTRENAMENT MODERAT', bg: c.green3, color: c.green },
    train_light:    { label: 'ANTRENAMENT UȘOR',    bg: '#3A2A0A', color: c.orange },
    rest:           { label: 'ODIHNĂ',              bg: '#3A0A0A', color: c.red },
    adapt:          { label: 'ADAPTAT',             bg: '#3A2A0A', color: c.orange },
  }
  return map[type] || map.train_moderate
}

function MiniProgressRing({ pct, color, c, size = 36 }) {
  if (!c) return null
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const safePct = (typeof pct === 'number' && isFinite(pct) && pct > 0) ? pct : 0
  const isOver = safePct > 100
  const clampedPct = Math.min(safePct, 100)
  const overPct = isOver ? Math.min(safePct - 100, 100) : 0
  const strokeW = 2.5

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track de fundal */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c.card2} strokeWidth={strokeW}/>
        {/* Progres normal (până la 100%) */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeW}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - clampedPct / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}/>
        {/* Zonă hașurată pentru depășire */}
        {isOver && (
          <>
            <defs>
              <pattern id={`hatch-${color.replace('#','')}`} patternUnits="userSpaceOnUse" width="3" height="3" patternTransform={`rotate(45)`}>
                <line x1="0" y1="0" x2="0" y2="3" stroke={c.red} strokeWidth="1.5"/>
              </pattern>
            </defs>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#hatch-${color.replace('#','')})`} strokeWidth={strokeW}
              strokeDasharray={circ} strokeDashoffset={circ * (1 - overPct / 100)}
              strokeLinecap="butt" transform={`rotate(-90 ${size/2} ${size/2})`} opacity="0.9"/>
          </>
        )}
      </svg>
      {isOver && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: size * 0.22, fontWeight: 700, color: c.red, whiteSpace: 'nowrap' }}>
          +{Math.round(pct - 100)}%
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, unit, delta, deltaPos, c, ringPct, ringColor, onClick, icon }) {
  if (!c) return null
  const [hover, setHover] = useState(false)
  const valStr = String(value ?? '')
  const valueFontSize = valStr.length > 7 ? 16 : valStr.length > 5 ? 18 : 22
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: c.card, borderRadius: c.radiusSm, padding: '0.75rem',
        boxShadow: hover ? c.shadowHero : c.shadowCard,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        position: 'relative', overflow: 'hidden', minWidth: 0,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: c.text3, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>{icon && <span style={{ fontSize: 12 }}>{icon}</span>}{typeof label === 'string' ? translate(label) : label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: valueFontSize, fontWeight: 800, color: c.text, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            {unit && <span style={{ fontSize: 11, color: c.text4, flexShrink: 0 }}>{unit}</span>}
          </div>
          {delta && <div style={{ fontSize: 10, marginTop: 3, color: deltaPos === true ? c.green : deltaPos === false ? c.red : c.text4, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{typeof delta === 'string' ? translate(delta) : delta}</div>}
        </div>
        {ringPct != null && <MiniProgressRing pct={ringPct} color={ringColor || c.green} c={c}/>}
      </div>
      {onClick && (
        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, color: c.text4, opacity: hover ? 1 : 0, transition: 'opacity 0.15s ease' }}>→</div>
      )}
    </div>
  )
}

function MiniBar({ label, value, max, color, isH, c }) {
  if (!c) return null
  const display = isH ? `${(value || 0).toFixed(1)}h` : value
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 72, fontSize: 12, color: c.text3, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: c.card2, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, ((value || 0) / max) * 100)}%`, height: '100%', background: color, borderRadius: 3 }}/>
      </div>
      <div style={{ width: 36, fontSize: 12, color: c.text, textAlign: 'right', fontWeight: 500 }}>{display}</div>
    </div>
  )
}

function ReadinessRing({ score, animated, c }) {
  if (!c) return null
  const circumference = 226
  const offset = circumference * (1 - score / 100)
  const color = scoreColor(score, c)
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const [displayOffset, setDisplayOffset] = useState(animated ? circumference : offset)

  useEffect(() => {
    if (!animated) return
    let start = null
    const duration = 1800
    function frame(ts) {
      if (!start) start = ts
      const t = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      setDisplayScore(Math.round(ease * score))
      setDisplayOffset(circumference - ease * (circumference - offset))
      if (t < 1) requestAnimationFrame(frame)
    }
    const id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [score, animated])

  return (
    <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
      <svg width="110" height="110" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="readinessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.65"/>
          </linearGradient>
          <filter id="readinessGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="60" cy="60" r="50" fill="none" stroke={c.card2} strokeWidth="9"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="url(#readinessGrad)" strokeWidth="9"
          strokeDasharray={circumference} strokeDashoffset={displayOffset}
          strokeLinecap="round" transform="rotate(-90 60 60)" filter="url(#readinessGlow)"
          style={{ transition: 'stroke-dashoffset 0.05s linear' }}/>
      </svg>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: c.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{displayScore}</div>
        <div style={{ fontSize: 10, color: c.text4, marginTop: 3 }}>/100</div>
      </div>
    </div>
  )
}


// ── Grafic puls orar cu zone somn + activitati ────────────────────────────────
function HROrarChart_impl({ hrData, currentHour, minHr, maxHr, avgHr, c, sleepData, activities }) {
  const { t } = useI18n()
  if (!c) return null
  if (!hrData || hrData.length === 0) return null

  const W = 340, H = 110, PAD = { t: 28, r: 8, b: 20, l: 28 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const hrs = hrData.map(d => d.hour)
  const vals = hrData.map(d => d.hr)
  const vmin = Math.min(...vals) - 5
  const vmax = Math.max(...vals) + 5
  const hMin = hrs[0], hMax = hrs[hrs.length - 1]
  const xScale = (h) => PAD.l + ((h - hMin) / Math.max(1, hMax - hMin)) * innerW
  const yScale = (v) => PAD.t + (1 - (v - vmin) / (vmax - vmin)) * innerH
  const pts = hrData.map(d => ({ x: xScale(d.hour), y: yScale(d.hr) }))

  // Catmull-Rom spline — curba naturala, fara coltiri
  const tension = 0.4  // 0=drept, 1=ondulat — 0.4 optim pentru HR
  let path = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i > 0 ? i-1 : i]
    const p1 = pts[i]
    const p2 = pts[i+1]
    const p3 = pts[i+2] !== undefined ? pts[i+2] : p2
    const cp1x = p1.x + (p2.x - p0.x) * tension / 2
    const cp1y = p1.y + (p2.y - p0.y) * tension / 2
    const cp2x = p2.x - (p3.x - p1.x) * tension / 2
    const cp2y = p2.y - (p3.y - p1.y) * tension / 2
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  const areaPath = `${path} L ${pts[pts.length-1].x} ${PAD.t+innerH} L ${pts[0].x} ${PAD.t+innerH} Z`
  const nowX = currentHour >= hMin && currentHour <= hMax ? xScale(currentHour) : null

  // Zone tip activitate → culoare + icon
  const ACT_STYLE = {
    Walk:          { color: '#3B6D11', fill: 'rgba(59,109,17,0.18)',  icon: '🚶' },
    Run:           { color: '#3B6D11', fill: 'rgba(59,109,17,0.22)',  icon: '🏃' },
    Hike:          { color: '#3B6D11', fill: 'rgba(59,109,17,0.18)',  icon: '🥾' },
    Ride:          { color: '#185FA5', fill: 'rgba(24,95,165,0.15)',  icon: '🚴' },
    VirtualRide:   { color: '#185FA5', fill: 'rgba(24,95,165,0.15)',  icon: '🚴' },
    WeightTraining:{ color: '#BA7517', fill: 'rgba(186,117,23,0.18)', icon: '🏋️' },
    Workout:       { color: '#BA7517', fill: 'rgba(186,117,23,0.18)', icon: '💪' },
    Yoga:          { color: '#5C3AA0', fill: 'rgba(92,58,160,0.15)',  icon: '🧘' },
    Swim:          { color: '#185FA5', fill: 'rgba(24,95,165,0.15)',  icon: '🏊' },
  }

  // Zona de somn din datele Withings/Intervals
  const sleepStart = sleepData?.start_hour ?? null
  const sleepEnd   = sleepData?.end_hour   ?? null

  // Activitati de azi din Intervals
  const todayActs = (activities || []).filter(a => {
    try {
      const startDT = a.start_time || a.start_date_local
      if (!startDT) return true // fara start_time, includem oricum
      const d = new Date(startDT)
      if (isNaN(d.getTime())) return true
      const h = d.getHours() + d.getMinutes()/60
      return h >= hMin && h <= hMax
    } catch { return true }
  })

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="hrGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.red} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={c.red} stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {/* ── Zona SOMN ── */}
        {sleepStart != null && sleepEnd != null && (() => {
          const sx1 = xScale(Math.max(sleepStart, hMin))
          const sx2 = xScale(Math.min(sleepEnd,   hMax))
          return (
            <g>
              <rect x={sx1} y={PAD.t} width={sx2-sx1} height={innerH} fill="rgba(90,110,200,0.12)"/>
              <line x1={sx2} y1={PAD.t} x2={sx2} y2={PAD.t+innerH} stroke="rgba(90,110,200,0.5)" strokeWidth="1.2" strokeDasharray="4 3"/>
              {/* Icon somn centrat sus */}
              <text x={(sx1+sx2)/2} y={PAD.t-16} textAnchor="middle" fontSize="13">😴</text>
              <text x={sx2+3} y={PAD.t+10} fontSize="7" fill="rgba(90,110,200,0.75)">☀️</text>
            </g>
          )
        })()}

        {/* ── Zone ACTIVITATI ── */}
        {todayActs.map((act, i) => {
          const style = ACT_STYLE[act.type] || { color: '#888', fill: 'rgba(136,136,136,0.15)', icon: '🏃' }
          const startDT = act.start_time || act.start_date_local
          const startD = startDT ? new Date(startDT) : null
          const startH = startD && !isNaN(startD.getTime()) ? startD.getHours() + startD.getMinutes()/60 : hMin
          const durH   = (act.elapsed_time || 1800) / 3600
          const endH   = Math.min(startH + durH, hMax)
          if (startH > hMax) return null
          const ax1 = xScale(Math.max(startH, hMin))
          const ax2 = xScale(endH)
          const midX = (ax1 + ax2) / 2
          const avgHR = act.average_heartrate ? Math.round(act.average_heartrate) : null
          return (
            <g key={i}>
              <rect x={ax1} y={PAD.t} width={ax2-ax1} height={innerH} fill={style.fill}/>
              <line x1={ax1} y1={PAD.t} x2={ax1} y2={PAD.t+innerH} stroke={style.color} strokeWidth="1" strokeDasharray="4 3" opacity="0.6"/>
              <line x1={ax2} y1={PAD.t} x2={ax2} y2={PAD.t+innerH} stroke={style.color} strokeWidth="1" strokeDasharray="4 3" opacity="0.6"/>
              {/* Icon sus */}
              <text x={midX} y={PAD.t - 16} textAnchor="middle" fontSize="13">{style.icon}</text>
              {/* HR mediu linie + label */}
              {avgHR && (
                <>
                  <line x1={ax1} y1={yScale(avgHR)} x2={ax2} y2={yScale(avgHR)} stroke={style.color} strokeWidth="1" strokeDasharray="3 2" opacity="0.5"/>
                  <text x={midX} y={PAD.t - 4} textAnchor="middle" fontSize="7" fill={style.color}>{avgHR}bpm</text>
                </>
              )}
            </g>
          )
        })}

        {/* Grid */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={PAD.l} y1={PAD.t + f*innerH} x2={PAD.l+innerW} y2={PAD.t + f*innerH} stroke={c.border2} strokeWidth="0.5" strokeDasharray="3 3"/>
        ))}

        {/* Area gradient */}
        <path d={areaPath} fill="url(#hrGrad2)"/>
        {(() => {
          const allBle = hrData.every(d => d.ble)
          const allReal = hrData.every(d => d.real)
          const lineColor = allBle ? "#81C784" : allReal ? c.red : c.red
          const lineW = allBle ? "2.2" : "1.8"
          return (
            <>
              {/* Curba spline neteda — fara linii drepte */}
              <path d={path} fill="none" stroke={lineColor} strokeWidth={lineW} strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
              {/* Punct live la ultimul citit (doar BLE) */}
              {allBle && (
                <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="3.5" fill="#81C784" stroke="white" strokeWidth="1.2" opacity="0.95"/>
              )}
            </>
          )
        })()}

        {/* Ora curenta */}
        {nowX && (
          <line x1={nowX} y1={PAD.t} x2={nowX} y2={PAD.t+innerH} stroke={c.green} strokeWidth="1.2" strokeDasharray="3 2"/>
        )}

        {/* Axe X — ore intregi (0, 1, 2 ... 23) */}
        {(() => {
          const startH = Math.ceil(hMin)
          const endH   = Math.floor(hMax)
          const span   = Math.max(1, endH - startH)
          const step   = span <= 6 ? 1 : span <= 12 ? 2 : 3
          const labels = []
          for (let h = startH; h <= endH; h += step) labels.push(h)
          return labels.map(h => (
            <text key={h} x={xScale(h)} y={H-4} textAnchor="middle" fontSize="8" fill={c.text4}>
              {String(h).padStart(2,'0')}:00
            </text>
          ))
        })()}
        {[vmin+5, avgHr, vmax-5].map((v, i) => (
          <text key={i} x={PAD.l-3} y={yScale(v)+3} textAnchor="end" fontSize="8" fill={c.text4}>{Math.round(v)}</text>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: c.text4 }}>
          <span>Min: <strong style={{ color: c.text }}>{minHr}</strong></span>
          <span>{t('Med')}: <strong style={{ color: c.red }}>{avgHr}</strong></span>
          <span>Max: <strong style={{ color: c.text }}>{maxHr}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: c.text4, alignItems: 'center' }}>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#81C784" strokeWidth="2.5"/></svg>BLE
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={c.red} strokeWidth="2.2"/></svg>real
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={c.red} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.5"/></svg>{t('estimat')}
          </span>
        </div>
      </div>
    </div>
  )
}


// ── Registru widget-uri pentru pagina Astăzi — id, etichetă, vizibilitate implicită ──
const ACTIVITY_WIDGET_REGISTRY = [
  { id: 'act_metrics',   label: '📊 Metrici activitate',          defaultOn: true },
  { id: 'act_fitness',   label: '📈 Fitness-Oboseală (Banister)', defaultOn: true },
  { id: 'act_steps',     label: '👟 Pași zilnici',                defaultOn: true },
  { id: 'act_steps_monthly', label: '📅 Pași lunar',             defaultOn: false },
  { id: 'act_hr',        label: '❤️ Puls zilnic',                 defaultOn: true },
  { id: 'act_workout',   label: '🏋️ Antrenament',                defaultOn: true },
]

// ── Comutator global — dezactivează funcțiile AI care consumă interogări (economie resurse) ──
const AI_COACH_DISABLED = true

const WIDGET_REGISTRY = [
  { id: 'aicoach',       label: '🌅 AI Coach — Briefing',        defaultOn: true },
  { id: 'aichat',        label: '💬 AI Coach — Chat',             defaultOn: true },
  { id: 'hero',          label: '⭐ Scor Readiness',              defaultOn: true },
  { id: 'quickstats',   label: '📊 Statistici rapide (grup)',     defaultOn: false },
  { id: 'qsteps',       label: '👟 Pași azi',                     defaultOn: true },
  { id: 'qsleep',       label: '😴 Somn',                         defaultOn: true },
  { id: 'qweight',      label: '⚖️ Greutate',                     defaultOn: true },
  { id: 'qworkouts',    label: '💪 Antrenamente',                  defaultOn: true },
  { id: 'qctl',         label: '📊 Fitness (CTL)',                 defaultOn: true },
  { id: 'qcalconsumed',  label: '🍽️ Calorii consumate',              defaultOn: true },
  { id: 'macros',        label: '📊 Macronutrienți',                  defaultOn: true },
  { id: 'subjective',    label: '😌 Stare subiectivă',            defaultOn: true },
  { id: 'bioage',        label: '🧬 Vârstă Biologică',            defaultOn: true },
  { id: 'heartage',      label: '❤️ Vârsta inimii',                defaultOn: true },
  { id: 'workoutsupp',   label: '💪 Antrenament + 💊 Suplimente AI', defaultOn: true },
  { id: 'hydration',     label: '💧 Hidratare',                   defaultOn: false },
  { id: 'fitnessctl',    label: '🏃 Fitness (CTL/ATL/TSB)',       defaultOn: false },
  { id: 'vo2max',        label: '🫁 VO2max',                      defaultOn: false },
  { id: 'bodybattery',   label: '🔋 Body Battery',                defaultOn: true },
  { id: 'ihrv',         label: '📈 Intervals.icu — HRV',         defaultOn: true },
  { id: 'isleep',       label: '📈 Intervals.icu — Somn',        defaultOn: true },
  { id: 'ihrrest',      label: '📈 Intervals.icu — Puls repaus', defaultOn: true },
  { id: 'iweight',      label: '📈 Intervals.icu — Greutate',    defaultOn: true },
  { id: 'vo2maxcard',   label: '🫁 VO2max',                      defaultOn: false },
  { id: 'calsburned',   label: '🔥 Calorii arse',                defaultOn: false },
  { id: 'weather',       label: '🌦️ Detalii meteo',               defaultOn: false },
  { id: 'circadian',     label: '🌙 Ritm Circadian',               defaultOn: true },
  { id: 'tlr',           label: '⚖️ Training Load Ratio',          defaultOn: false },
  { id: 'cardio_fitness', label: '🫁 Cardio Fitness (VO2max)',        defaultOn: true },
  { id: 'exertion',      label: '⚡ Exertion zilnic',                  defaultOn: true },
  { id: 'streaks',       label: '🔥 Streak-uri',                       defaultOn: true },
  { id: 'ble_hr',        label: '📡 BLE Heart Rate (Amazfit)',          defaultOn: false },
  { id: 'dayincifre',    label: '📊 Ziua în cifre',                 defaultOn: true },
  { id: 'ecg_upload',   label: '💓 EKG — Analiză AI',              defaultOn: true },
]

// ── Vârsta vasculară Framingham (non-laborator, BMI) — bază pt Vârsta inimii ──
function framinghamVascularAge({ gender, age, bmi, sbp, smoker, diabetes, bpTreated = false }) {
  if (!age || !bmi || !sbp) return null
  const a = parseFloat(age), b = parseFloat(bmi), s = parseFloat(sbp)
  if (!(a > 0) || !(b > 0) || !(s > 0)) return null
  const male = (gender || 'M') === 'M'
  const K = male
    ? { bAge: 3.11296, bBMI: 0.79277, bSBPu: 1.85508, bSBPt: 1.92672, bSmoke: 0.70953, bDiab: 0.53160, S0: 0.88431, mean: 23.9388 }
    : { bAge: 2.72107, bBMI: 0.51125, bSBPu: 2.81291, bSBPt: 2.88267, bSmoke: 0.61868, bDiab: 0.77763, S0: 0.94833, mean: 26.0145 }
  const bSBP = bpTreated ? K.bSBPt : K.bSBPu
  const L = K.bAge * Math.log(a) + K.bBMI * Math.log(b) + bSBP * Math.log(s)
    + (smoker ? K.bSmoke : 0) + (diabetes ? K.bDiab : 0)
  const risk = 1 - Math.pow(K.S0, Math.exp(L - K.mean))
  const BMI_REF = 22.5, SBP_REF = 125
  const lnAgeStar = (L - K.bBMI * Math.log(BMI_REF) - K.bSBPu * Math.log(SBP_REF)) / K.bAge
  const vAge = Math.exp(lnAgeStar)
  if (!isFinite(vAge)) return null
  return { vascularAge: vAge, riskPct: Math.max(0, Math.min(100, Math.round(risk * 1000) / 10)) }
}

function getDefaultLayout() {
  return WIDGET_REGISTRY.map(w => ({ id: w.id, visible: w.defaultOn }))
}

function RadarChart_impl({ counts, sessions, cardStyle, c }) {
  const [scaleMode, setScaleMode] = React.useState('relative')
  const MUSCLES = [
    { key:'chest',      label:translate('Piept')      },
    { key:'core',       label:translate('Core')       },
    { key:'shoulders',  label:translate('Umeri')      },
    { key:'triceps',    label:translate('Triceps')    },
    { key:'traps',      label:translate('Trapez')     },
    { key:'back',       label:translate('Spate')      },
    { key:'biceps',     label:translate('Biceps')     },
    { key:'calves',     label:translate('Gambe')      },
    { key:'hamstrings', label:translate('Ischio.')    },
    { key:'glutes',     label:translate('Fesier')     },
    { key:'quads',      label:translate('Cvadriceps') },
  ]
  const maxCount = Math.max(1, ...Object.values(counts))
  const maxVal   = scaleMode === 'relative' ? maxCount : Math.max(1, sessions)
  const N = MUSCLES.length
  const CX = 150, CY = 138, R = 88
  const rings = [0.25, 0.5, 0.75, 1.0]
  const pt = (i, r) => {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2
    return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
  }
  const labelPt = i => {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2
    return { x: CX + (R + 26) * Math.cos(angle), y: CY + (R + 26) * Math.sin(angle) }
  }
  const polyPts = MUSCLES.map((m, i) => {
    const r = ((counts[m.key] || 0) / maxVal) * R
    const p = pt(i, r)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
  const gridPolys = rings.map(ring =>
    MUSCLES.map((_, i) => { const p = pt(i, ring * R); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')
  )
  return (
    <div style={cardStyle}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:c.text4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{translate('Grupe musculare lucrate')}</div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          {['relative','absolute'].map(mode => (
            <button key={mode} onClick={() => setScaleMode(mode)}
              style={{ fontSize:10, padding:'2px 9px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'inherit',
                background: scaleMode===mode ? c.green+'28' : c.card2,
                color: scaleMode===mode ? c.green : c.text3,
                fontWeight: scaleMode===mode ? 700 : 400,
                transition:'all 0.15s' }}>
              {mode==='relative' ? translate('Relativ') : translate('Absolut')}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 300 276" width="100%" style={{ display:'block' }}>
        {gridPolys.map((pts, ri) => (
          <polygon key={ri} points={pts} fill="none" stroke={c.card2} strokeWidth={0.8} opacity={0.6}/>
        ))}
        {/* ring value hints on top spoke */}
        {rings.map((ring, ri) => {
          const p = pt(0, ring * R)
          return <text key={ri} x={(p.x+3).toFixed(1)} y={p.y.toFixed(1)} fontSize={6.5} fill={c.text4} dominantBaseline="middle">{Math.round(ring * maxVal)}</text>
        })}
        {MUSCLES.map((_, i) => {
          const o = pt(i, R)
          return <line key={i} x1={CX} y1={CY} x2={o.x.toFixed(1)} y2={o.y.toFixed(1)} stroke={c.card2} strokeWidth={0.7} opacity={0.5}/>
        })}
        <polygon points={polyPts} fill={c.green + '28'} stroke={c.green} strokeWidth={1.5} strokeLinejoin="round"/>
        {MUSCLES.map((m, i) => {
          const val = counts[m.key] || 0
          const r = (val / maxVal) * R
          const p = pt(i, r)
          return val > 0 ? (
            <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={3} fill={c.green}>
              <title>{m.label}: {val} sesiuni</title>
            </circle>
          ) : null
        })}
        {MUSCLES.map((m, i) => {
          const lp = labelPt(i)
          const val = counts[m.key] || 0
          const anchor = lp.x < CX - 4 ? 'end' : lp.x > CX + 4 ? 'start' : 'middle'
          return (
            <text key={i} x={lp.x.toFixed(1)} y={(lp.y + 4).toFixed(1)} fontSize={8.5}
              fill={val > 0 ? c.text : c.text4} textAnchor={anchor} fontWeight={val > 0 ? 600 : 400}>
              {m.label}{val > 0 ? ` (${val})` : ''}
            </text>
          )
        })}
        <circle cx={CX} cy={CY} r={2} fill={c.text4}/>
      </svg>
    </div>
  )
}

function AccordionCard({ title, titleRight, containerStyle, c, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={containerStyle}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', marginBottom: open ? 12 : 0 }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{typeof title === 'string' ? translate(title) : title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {titleRight}
          <span style={{ fontSize: 14, color: c.text4, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>⌄</span>
        </div>
      </div>
      {open && <>{children}</>}
    </div>
  )
}

// ── SleepRingCanvas — ring canvas pentru hero pagina Somn ────────────────────
function SleepRingCanvas_impl({ pct = 0, size = 92, isDark = false }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width  = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)
    const CX = size / 2, CY = size / 2, R = size * 0.413, LW = size * 0.082
    const START = -Math.PI / 2
    const SEGS  = 160
    // Track
    ctx.beginPath()
    ctx.arc(CX, CY, R, 0, 2 * Math.PI)
    ctx.strokeStyle = isDark ? 'rgba(147,197,253,.15)' : 'rgba(37,99,235,.1)'
    ctx.lineWidth   = LW
    ctx.lineCap     = 'butt'
    ctx.stroke()
    if (pct < 0.5) return
    const endAng = START + 2 * Math.PI * Math.min(pct, 100) / 100
    const span   = endAng - START
    // Blue gradient: #93C5FD → #1D4ED8
    for (let i = 0; i < SEGS; i++) {
      const a0 = START + span * i       / SEGS
      const a1 = START + span * (i + 1) / SEGS
      const t  = (i + 0.5) / SEGS
      const r  = Math.round(147 - t * (147 - 29))
      const g  = Math.round(197 - t * (197 - 78))
      const b  = Math.round(253 - t * (253 - 216))
      ctx.beginPath()
      ctx.arc(CX, CY, R, a0, a1)
      ctx.strokeStyle = `rgb(${r},${g},${b})`
      ctx.lineWidth   = LW
      ctx.lineCap     = 'butt'
      ctx.stroke()
    }
    // End cap
    ctx.beginPath()
    ctx.arc(CX + R * Math.cos(endAng), CY + R * Math.sin(endAng), LW / 2, 0, 2 * Math.PI)
    ctx.fillStyle = '#1D4ED8'
    ctx.fill()
  }, [pct, size, isDark])
  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }}/>
}

function StreaksWidget_impl({ intervalsData, combinedSleep, userProfile, c }) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)

  const todayStr3 = new Date().toISOString().slice(0,10)
  const days3 = (intervalsData?.days || []).slice().sort((a,b) => a.date > b.date ? 1 : -1)
  const stepsTarget3 = userProfile?.target_steps || 10000
  const calTarget3 = userProfile?.target_calories_burned || 500
  const sleepTarget3 = userProfile?.target_sleep_hours || 7.5

  const todayDay = days3.find(d => d.date === todayStr3) || {}
  const todaySleep = combinedSleep?.duration_h || combinedSleep?.total_h || todayDay.sleep_hours || 0
  const todaySteps = todayDay.steps || intervalsData?.today?.steps || 0
  // Calorii arse azi = suma activitatilor de azi
  const todayActsCal = (intervalsData?.activities || [])
    .filter(a => a.date === todayStr3)
    .reduce((s, a) => s + (a.calories || 0), 0)
  const todayCal = todayActsCal || intervalsData?.today?.calories || 0

  function filterActs(activities) {
    return (activities || []).filter(function(a) {
      const name = (a.name || '').toLowerCase()
      const type = (a.type || '').toLowerCase()
      return !name.includes('myfitnesspal') && !name.includes('mfp') &&
             !type.includes('myfitnesspal') && a.source !== 'myfitnesspal'
    })
  }

  function getCalForDate(dateStr, isToday) {
    if (isToday) return todayCal
    const acts = filterActs(intervalsData?.activities).filter(function(a) { return a.date === dateStr })
    if (acts.length > 0) return acts.reduce(function(s, a) { return s + (a.calories || 0) }, 0)
    // Fallback pe campuri alternative
    const dd = days3.find(function(x) { return x.date === dateStr }) || {}
    return dd.calories_burned || dd.active_calories || 0
  }

  function getDayData(dateStr) {
    const dd = days3.find(function(x) { return x.date === dateStr }) || {}
    const isToday = dateStr === todayStr3
    const steps = dd.steps || (isToday ? todaySteps : 0)
    const sleep = isToday ? todaySleep : (dd.sleep_hours || dd.sleep_h || 0)
    const cal = getCalForDate(dateStr, isToday)
    const p = steps >= stepsTarget3
    const sl = sleep >= sleepTarget3
    const ca = cal >= calTarget3
    return { steps, sleep, cal, p, sl, ca, score: (p?1:0)+(sl?1:0)+(ca?1:0) }
  }

  function calcStreak(checkFn) {
    let current = 0, max = 0, temp = 0
    // Excludem ziua de azi din streak curent daca nu e completa inca
    const sorted = [...days3].filter(d => d.date <= todayStr3)
    for (let i = sorted.length - 1; i >= 0; i--) {
      const d = sorted[i]
      const isToday = d.date === todayStr3
      // Pentru azi folosim datele live
      const dayD = isToday
        ? { steps: todaySteps, sleep_hours: todaySleep, calories: todayCal }
        : d
      if (checkFn(dayD)) current++
      else break
    }
    for (const d of sorted) {
      const isToday = d.date === todayStr3
      const dayD = isToday
        ? { steps: todaySteps, sleep_hours: todaySleep, calories: todayCal }
        : d
      if (checkFn(dayD)) { temp++; max = Math.max(max, temp) }
      else temp = 0
    }
    return { current, max }
  }

  const streakPasi    = calcStreak(d => (d.steps || 0) >= stepsTarget3)
  const streakSomn    = calcStreak(d => (d.sleep_hours || d.sleep_h || 0) >= sleepTarget3)
  function getCalForDay(d) {
    return getCalForDate(d.date, d.date === todayStr3)
  }

  const streakCalorii = calcStreak(d => getCalForDay(d) >= calTarget3)
  const streakPerfect = calcStreak(d =>
    (d.steps || 0) >= stepsTarget3 &&
    (d.sleep_hours || d.sleep_h || 0) >= sleepTarget3 &&
    getCalForDay(d) >= calTarget3
  )

  const { p: pasiOk, sl: somnOk, ca: calOk } = getDayData(todayStr3)
  const allOk = pasiOk && somnOk && calOk

  const STREAKS = [
    { label: 'Pași',    icon: '👟', target: stepsTarget3.toLocaleString() + ' ' + t('pași'), ...streakPasi,    ok: pasiOk, color: '#378ADD' },
    { label: 'Somn',    icon: '😴', target: sleepTarget3 + 'h ' + t('somn'),                 ...streakSomn,    ok: somnOk, color: '#8B5CF6' },
    { label: 'Calorii', icon: '🔥', target: calTarget3 + ' ' + t('kcal arse'),               ...streakCalorii, ok: calOk,  color: '#F97316' },
  ]

  return (
    <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1rem' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @property --bd-ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
        @keyframes bd-spin { to { --bd-ang: 360deg; } }
        .bd-anim { --bd-ang: 0deg; animation: bd-spin 3s linear infinite; padding: 1.5px; }
      `}} />
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', marginBottom: open ? 14 : 0 }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🔥 {t('Streak-uri')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {allOk && <div style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', background: '#FFD70022', padding: '3px 10px', borderRadius: 12, border: '1px solid #FFD70044' }}>⭐ {t('Zi perfectă!')}</div>}
          <span style={{ fontSize: 14, color: c.text4, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>⌄</span>
        </div>
      </div>

      {open && <>
      {/* Ziua Perfecta */}
      <div style={{ background: streakPerfect.current > 0 ? '#FFD70011' : c.card2, border: '0.5px solid ' + (streakPerfect.current > 0 ? '#FFD70044' : c.border), borderRadius: 12, padding: '0.875rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>
          {streakPerfect.current >= 7 ? '🏆' : streakPerfect.current >= 3 ? '🔥' : streakPerfect.current > 0 ? '✨' : '💤'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 2 }}>{t('Ziua Perfectă')}</div>
          <div style={{ fontSize: 11, color: c.text4, marginBottom: 6 }}>{t('Pași + Somn + Calorii ≥ target')}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: streakPerfect.current > 0 ? '#FFD700' : c.text4, lineHeight: 1 }}>{streakPerfect.current}</div>
              <div style={{ fontSize: 10, color: c.text4 }}>{t('curent')}</div>
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.text3, lineHeight: 1 }}>{streakPerfect.max}</div>
              <div style={{ fontSize: 10, color: c.text4 }}>{t('record')}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: pasiOk ? c.green : c.text4 }}>{pasiOk ? '✓' : '○'} {t('Pași')}</div>
          <div style={{ fontSize: 11, color: somnOk ? c.green : c.text4 }}>{somnOk ? '✓' : '○'} {t('Somn')}</div>
          <div style={{ fontSize: 11, color: calOk ? c.green : c.text4 }}>{calOk ? '✓' : '○'} {t('Calorii')}</div>
        </div>
      </div>

      {/* Streak-uri individuale */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {STREAKS.map(function(s3) {
          const _inner3 = <>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s3.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s3.current > 0 ? s3.color : c.text4, lineHeight: 1 }}>{s3.current}</div>
            <div style={{ fontSize: 9, color: c.text4, margin: '2px 0' }}>{t('zile streak')}</div>
            <div style={{ fontSize: 9, color: c.text4 }}>rec: {s3.max}</div>
            <div style={{ fontSize: 9, color: c.text4, marginTop: 3 }}>≥ {s3.target}</div>
            {s3.ok && <div style={{ fontSize: 9, color: s3.color, fontWeight: 700, marginTop: 2 }}>✓ {t('azi')}</div>}
          </>
          if (s3.ok) return (
            <div key={s3.label} className="bd-anim" style={{ borderRadius: 12, background: `conic-gradient(from var(--bd-ang), ${s3.color}44 0%, ${s3.color} 28%, ${s3.color}44 52%, ${s3.color} 78%, ${s3.color}44 100%)` }}>
              <div style={{ background: c.card, borderRadius: '10.5px', padding: '0.75rem', textAlign: 'center' }}>{_inner3}</div>
            </div>
          )
          return (
            <div key={s3.label} style={{ background: c.card2, borderRadius: 10, padding: '0.75rem', textAlign: 'center', border: '0.5px solid ' + c.border }}>{_inner3}</div>
          )
        })}
      </div>

      {/* Calendar 14 zile cu click */}
      <div>
        <div style={{ fontSize: 10, color: c.text4, marginBottom: 6 }}>{t('Ultimele 14 zile — apasă pe o zi pentru detalii')}</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({length: 14}, function(_, i) {
            const d = new Date(); d.setDate(d.getDate() - (13 - i))
            const dateStr = d.toISOString().slice(0,10)
            const { p, sl, ca, score } = getDayData(dateStr)
            const bg = score === 3 ? '#FFD700' : score === 2 ? c.green : score === 1 ? c.orange : c.card2
            const isToday = dateStr === todayStr3
            const isSelected = selectedDay === dateStr
            return (
              <div key={dateStr}
                onClick={function(){ setSelectedDay(isSelected ? null : dateStr) }}
                style={{ flex: 1, height: 32, borderRadius: 4, background: bg, opacity: isToday ? 1 : 0.8,
                  border: isSelected ? '2px solid ' + c.text : isToday ? '2px solid ' + c.text3 : '1px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
                  color: score === 3 ? '#000' : c.text4, fontWeight: isToday ? 700 : 400,
                  cursor: 'pointer', transition: 'all .15s' }}>
                {d.getDate()}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 9, color: c.text4, justifyContent: 'center' }}>
          <span>⬜ 0/3</span>
          <span style={{color:c.orange}}>■ 1/3</span>
          <span style={{color:c.green}}>■ 2/3</span>
          <span style={{color:'#FFD700'}}>■ 3/3 ⭐</span>
        </div>
      </div>

      {/* Popup zi selectata */}
      {selectedDay && (function() {
        const dd = days3.find(x => x.date === selectedDay) || {}
        const isToday = selectedDay === todayStr3
        const { steps, sleep, cal, p, sl, ca, score } = getDayData(selectedDay)
        const dayLabel = isToday ? t('Astăzi') : new Date(selectedDay + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
        const detailBg     = score === 3 ? '#FFD70018' : score === 2 ? (c.green  + '22') : score === 1 ? (c.orange + '22') : c.card2
        const detailBorder = score === 3 ? '#FFD70066' : score === 2 ? (c.green  + '55') : score === 1 ? (c.orange + '55') : c.border
        const detailScoreColor = score === 3 ? '#FFD700' : score === 2 ? c.green : score === 1 ? c.orange : c.text4
        return (
          <div style={{ marginTop: 12, background: detailBg, borderRadius: 12, padding: '0.875rem', border: '1px solid ' + detailBorder }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{dayLabel}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, color: detailScoreColor, fontWeight: 600 }}>
                  {score}/3 {t('obiective')}
                </div>
                <button onClick={function(){ setSelectedDay(null) }}
                  style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: c.text4, padding: '0 4px' }}>✕</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { ok: p,  color: '#378ADD', icon: '👟', val: steps >= 1000 ? (steps/1000).toFixed(1)+'k' : steps || '—', lbl: 'pași',      tgt: stepsTarget3/1000+'k target', bg: '#378ADD11' },
                { ok: sl, color: '#8B5CF6', icon: '😴', val: sleep ? Math.floor(sleep)+'h'+(Math.round((sleep%1)*60))+'m' : '—', lbl: 'somn', tgt: sleepTarget3+'h target',       bg: '#8B5CF611' },
                { ok: ca, color: '#F97316', icon: '🔥', val: cal || '—',                                                        lbl: 'kcal arse', tgt: calTarget3+' target',       bg: '#F9731611' },
              ].map(function(m, i) {
                const _mc = <>
                  <div style={{ fontSize: 16 }}>{m.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.ok ? m.color : c.text4, marginTop: 2 }}>{m.val}</div>
                  <div style={{ fontSize: 9, color: c.text4 }}>{t(m.lbl)}</div>
                  <div style={{ fontSize: 9, color: m.ok ? m.color : c.text4, fontWeight: m.ok ? 700 : 400 }}>{m.ok ? '✓' : '✗'} {m.tgt}</div>
                </>
                if (m.ok) return (
                  <div key={i} className="bd-anim" style={{ borderRadius: 10, background: `conic-gradient(from var(--bd-ang), ${m.color}44 0%, ${m.color} 28%, ${m.color}44 52%, ${m.color} 78%, ${m.color}44 100%)` }}>
                    <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: '8.5px', background: c.card, height: '100%', boxSizing: 'border-box' }}>{_mc}</div>
                  </div>
                )
                return (
                  <div key={i} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: c.card, border: '0.5px solid ' + c.border }}>{_mc}</div>
                )
              })}
            </div>
            {score === 3 && <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#FFD700', fontWeight: 700 }}>⭐ Zi perfectă!</div>}
            {score === 0 && <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: c.text4 }}>Niciun obiectiv atins în această zi.</div>}
          </div>
        )
      })()}
      </>}
    </div>
  )
}

function NotifSettingsPanel({ c, notifStatus, requestNotifications, notifPrefs, setNotifPrefs }) {
  const TYPES = [
    { key: 'briefing_dimineata', icon: '🌅', label: 'Briefing dimineață', desc: 'Zilnic la 8:30' },
    { key: 'briefing_seara',     icon: '🌙', label: 'Briefing seară',     desc: 'Zilnic la 23:00' },
    { key: 'reminder_somn',      icon: '😴', label: 'Reminder somn',      desc: 'Zilnic la 22:30' },
    { key: 'target_pasi',        icon: '👟', label: 'Target pași atins',  desc: 'Când atingi 10.000' },
    { key: 'target_calorii',     icon: '🔥', label: 'Target calorii',     desc: 'Când atingi targetul' },
  ]
  function toggle(key) {
    setNotifPrefs(function(prev) {
      const next = Object.assign({}, prev, { [key]: prev[key] === false ? true : false })
      localStorage.setItem('forma-notif-prefs', JSON.stringify(next))
      return next
    })
  }
  return (
    <div style={{ padding: '0 16px 12px', borderTop: '0.5px solid ' + c.border }}>
      {notifStatus !== 'granted' && (
        <button onClick={requestNotifications}
          style={{ width: '100%', padding: '8px', marginTop: 10, marginBottom: 6, background: c.green2, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Activează notificările
        </button>
      )}
      <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, marginBottom: 8, marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipuri de notificări</div>
      {TYPES.map(function(t) {
        const enabled = notifPrefs[t.key] !== false
        return (
          <div key={t.key} onClick={function(){ toggle(t.key) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer', borderBottom: '0.5px solid ' + c.border }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: c.text }}>{t.label}</div>
              <div style={{ fontSize: 10, color: c.text4 }}>{t.desc}</div>
            </div>
            <div style={{ width: 32, height: 18, borderRadius: 9, background: enabled ? c.green2 : c.card2, position: 'relative', border: '0.5px solid ' + c.border, flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: enabled ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: enabled ? '#fff' : c.text4, transition: 'left .2s' }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Acc({ title, children, defaultOpen = false, c }) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', background: open ? c.card2 : c.card, border: `0.5px solid ${c.border}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: c.text, marginBottom: open ? 6 : 0 }}>
        <span>{typeof title === 'string' ? translate(title) : title}</span>
        <span style={{ fontSize: 9, color: c.text4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// Calculează vârsta (ani întregi) din data nașterii (YYYY-MM-DD). null dacă lipsește/invalidă.
function calcAgeFromBirth(dateStr) {
  if (!dateStr) return null
  const b = new Date(dateStr)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

// ── Ceas izolat: își ține singur ora și se actualizează la minut, FĂRĂ
// să redeseneze tot Dashboard-ul (înainte tic-ul lui re-renda toată pagina) ──
function Clock() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })), 60000)
    return () => clearInterval(id)
  }, [])
  return t
}

// ── Memoizare: aceste componente grele se redesenează doar când li se schimbă
// efectiv props-urile, nu la fiecare render al Dashboard-ului ──
const HROrarChart    = React.memo(HROrarChart_impl)
const RadarChart     = React.memo(RadarChart_impl)
const SleepRingCanvas= React.memo(SleepRingCanvas_impl)
const StreaksWidget  = React.memo(StreaksWidget_impl)

export default function Dashboard() {
  const { user, userName, userAvatar, signOut } = useAuth()
  const { theme, toggleTheme, isDark, isAuto, themeMode } = useTheme()
  const { t, lang } = useI18n()
  const { notifStatus, requestNotifications, toggleNotifications } = usePWA()
  const c = useMemo(() => getColors(theme), [theme])   // referință stabilă → memoizarea cardurilor funcționează
  const w = useWindowWidth()
  const isMobile = w < 640

  const [tab, setTab] = useState('today')
  const TABS = ['today', 'sleep', 'activitate', 'nutrition', 'history', 'rank']
  const swipeHandlers = useSwipeTabs(TABS, tab, setTab, isMobile)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const TAB_ORDER = ['today', 'sleep', 'activitate', 'nutrition', 'statistics']
  const { onTouchStart, onTouchEnd } = useSwipeNavigation(
    TAB_ORDER, tab,
    (newTab) => { setTab(newTab) },
    { enabled: isMobile }
  )
  const [subj, setSubj] = useState({ energy: 7, sleep_quality: 8, motivation: 6, stress: 3, soreness: 3 })
  const [subjEntryWindow, setSubjEntryWindow] = useState(null) // fereastra ultimei intrări: 'morning'|'afternoon'|'evening'
  const [manualSleep, setManualSleep] = useState({ hours: '', score: '' })
  const [manualSleepSaved, setManualSleepSaved] = useState(false)
  const [sleepTrendDays, setSleepTrendDays] = useState(14)
  const [sleepDayOffset, setSleepDayOffset] = useState(0) // 0=azi, 1=ieri, 2=alaltăieri…
  const [activitateDayOffset, setActivitateDayOffset] = useState(0) // 0=azi, 1=ieri…
  const [nutritionDayOffset, setNutritionDayOffset] = useState(0) // 0=azi, 1=ieri…
  const [sleepTrendsMetric, setSleepTrendsMetric] = useState(null)
  const [sleepTrendsPeriod, setSleepTrendsPeriod] = useState(30)
  const [dashboardLayout, setDashboardLayout] = useState(() => getDefaultLayout())
  const [achievement, setAchievement] = useState(null)
  const [layoutEditMode, setLayoutEditMode] = useState(false)
  const [showNotifSettings, setShowNotifSettings] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('forma-notif-prefs') || '{}') } catch { return {} }
  })
  const [rankPointsVersion, setRankPointsVersion] = useState(0)
  const [todayArcAnim, setTodayArcAnim] = useState(false)
  const rankPoints = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    rankPointsVersion
    try { return JSON.parse(localStorage.getItem('forma-rank-points') || '{}') } catch { return {} }
  }, [rankPointsVersion])
  const totalRankPoints = getTotalPoints(rankPoints)
  const currentRank = getRank(totalRankPoints)

  // Migrare chei vechi + penalizare lunară la prima deschidere
  useEffect(() => {
    migrarePuncteVechi()
    aplicaPenalizareLunara()
    setRankPointsVersion(v => v + 1)
  }, [])
  const [activityEditMode, setActivityEditMode] = useState(false)
  const [activityLayout, setActivityLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('forma-activity-layout')
      return saved ? JSON.parse(saved) : ACTIVITY_WIDGET_REGISTRY.map(w => ({ id: w.id, visible: w.defaultOn }))
    } catch { return ACTIVITY_WIDGET_REGISTRY.map(w => ({ id: w.id, visible: w.defaultOn })) }
  })
  const [layoutSaving, setLayoutSaving] = useState(false)
  const [mapActivity, setMapActivity] = useState(null)
  const [activitiesExpanded, setActivitiesExpanded] = useState(false) // { id, name } pentru harta fullscreen
  const [pmcAiText, setPmcAiText] = useState(null)
  const [pmcAiLoading, setPmcAiLoading] = useState(false)
  const [weather, setWeather] = useState(null)
  const [stepsChartPeriod, setStepsChartPeriod] = useState(7)
  const [stepsChartData, setStepsChartData] = useState(null)
  const [stepsChartLoading, setStepsChartLoading] = useState(false)
  const [trainingLoad, setTrainingLoad] = useState(null) // { tss, ctl, atl, tsb }
  const [trainingLoadHistory, setTrainingLoadHistory] = useState([])
  const [injuries, setInjuries] = useState('')
  const [subjSaved, setSubjSaved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [showMuscleModal, setShowMuscleModal] = useState(false)
  const [muscleModalData, setMuscleModalData] = useState({})
  const [macroDetailMacro, setMacroDetailMacro] = useState(null)
  const [macroTodayModal, setMacroTodayModal] = useState(null)
  const [mealsModalOpen, setMealsModalOpen] = useState(false)
  const [heartAgeOpen, setHeartAgeOpen] = useState(() => { try { return localStorage.getItem('forma_heartage_open') !== 'false' } catch { return true } })
  const toggleHeartAge = () => setHeartAgeOpen(o => { const n = !o; try { localStorage.setItem('forma_heartage_open', String(n)) } catch {} ; return n })
  const [microAiData, setMicroAiData] = useState(null)
  const [microAiLoading, setMicroAiLoading] = useState(false)
  const [microAiError, setMicroAiError] = useState(null)
  const [nutAccordion, setNutAccordion] = useState({ micro: false, calories: false, macros: false })
  // Vitamina D din soare (UI) → mcg — sincronizat cu VitaminDTracker via localStorage
  const [solarVitDIU, setSolarVitDIU] = useState(() => {
    try { const d = new Date().toISOString().slice(0,10); return parseFloat(localStorage.getItem(`forma_vitd_total_${d}`) || '0') } catch { return 0 }
  })
  const solarVitDMcg = Math.round(solarVitDIU / 40 * 10) / 10  // 1 mcg = 40 IU
  const [microAutoTriggered, setMicroAutoTriggered] = useState(false)
  const microDebounceRef = useRef(null)
  const [microHover, setMicroHover] = useState(null)  // key of hovered nutrient
  const [manualSupps, setManualSupps] = useState(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      return JSON.parse(localStorage.getItem('forma_supps_' + todayStr) || '[]')
    } catch(e) { return [] }
  })
  const [takenSavedSupps, setTakenSavedSupps] = useState(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      return JSON.parse(localStorage.getItem('forma_taken_saved_' + todayStr) || '{}')
    } catch(e) { return {} }
  })
  const [suppFormOpen, setSuppFormOpen] = useState(false)
  const [suppForm, setSuppForm] = useState({ key: 'vit_d', name: '', value: '' })
  const [suppMode, setSuppMode] = useState('saved') // 'saved' | 'manual' | 'ai'
  const [suppAiText, setSuppAiText] = useState('')
  const [suppAiLoading, setSuppAiLoading] = useState(false)
  const [suppAiPreview, setSuppAiPreview] = useState(null) // { name, micros: [{key,value,unit}] }
    const [antioxOpen, setAntioxOpen] = useState(false)
  // waterToday gestionat de useNutritionData hook
  const [statsPeriod, setStatsPeriod] = useState(30)
  const [statsSubTab, setStatsSubTab] = useState('calendar')
  const [corpChartKeys, setCorpChartKeys] = useState(['weight'])
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const [selectedCalDay, setSelectedCalDay] = useState(null)
  const [selectedDayExtra, setSelectedDayExtra] = useState(null) // { health, water }
  const [selectedDayLoading, setSelectedDayLoading] = useState(false)
  const [activityWorkoutOpen, setActivityWorkoutOpen] = useState(false)
  const [weeklyView, setWeeklyView] = useState(null) // null | 'sessions' | 'prs' | { type: 'single', workout }
  const [calSummaryView, setCalSummaryView] = useState(null) // null | 'workouts' | 'active' | 'nutrition'
  const [suppLoading, setSuppLoading] = useState(false)
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false)
  const [portionFav, setPortionFav] = useState(null)     // favorit deschis pt. alegere cantitate
  const [portionQty, setPortionQty] = useState('')       // grame SAU porții, în funcție de bază
  const [portionSaving, setPortionSaving] = useState(false)
  const [favoriteMeals, setFavoriteMeals] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [swipedFavId, setSwipedFavId] = useState(null)   // favorit „deschis" prin glisare
  const [favDeletingId, setFavDeletingId] = useState(null)
  const favTouchRef = useRef({ x: 0, id: null })
  const [favAddedToast, setFavAddedToast] = useState(null)
  const [favSearchQuery, setFavSearchQuery] = useState('')
  const [favSort, setFavSort] = useState('recent')
  // Editare produs favorit (nume + imagine)
  const [favEditId, setFavEditId] = useState(null)
  const [favEditName, setFavEditName] = useState('')
  const [favEditImage, setFavEditImage] = useState(null)
  const [favEditSaving, setFavEditSaving] = useState(false)
  const favEditFileRef = useRef(null)

  // ── ECG Withings — stare locală ──────────────────────────────────────────
  const [ecgRecords, setEcgRecords] = useState([])
  const [ecgUploading, setEcgUploading] = useState(false)
  const [ecgAnalyzing, setEcgAnalyzing] = useState(false)
  const [ecgExpandedId, setEcgExpandedId] = useState(null)
  const ecgFileRef = useRef(null)

  // ── React Query — date cu cache automat + background refetch ─────────────
  const qc = useQueryClient()

  const hevyQ        = useHevyQuery(user?.id)
  const withingsQ    = useWithingsQuery(user?.id)
  const intervalsQ   = useIntervalsQuery(user?.id, 60)
  const bodyMeasQ    = useBodyMeasurementsQuery(user?.id, 180)
  const profileQ     = useProfileQuery(user?.id)
  const injuriesQ    = useInjuriesQuery(user?.id)
  const nutritionQ   = useNutritionQuery(user?.id)
  const supplementsQ = useSupplementsQuery(user?.id)
  const waterQ       = useWaterQuery(user?.id)

  // Realtime subscriptions
  useSuppLogsRealtime(user?.id)
  useMealEntriesRealtime(user?.id)

  // Mutations
  const addWaterMutation   = useAddWater(user?.id)
  const toggleSuppMutation = useToggleSupplement(user?.id)

  // Destructurare date
  const workouts    = hevyQ.data?.workouts    || []
  const recovery    = hevyQ.data?.recovery    || { suggestedDay: 'Pull Day', ready: [], notReady: [] }
  const weeklyStats = hevyQ.data?.weeklyStats || { count: 0, totalVolume: 0, prs: 0 }
  const hevyLoading  = hevyQ.isLoading
  const hevyFetching = hevyQ.isFetching
  const hevyError    = hevyQ.error?.message || null
  // HR logs din Supabase (cross-device sync BLE)

  const withingsData      = { sleep: withingsQ.data?.sleep || null, body: withingsQ.data?.body || null, days: withingsQ.data?.days || null }
  const withingsLoading   = withingsQ.isLoading
  const withingsConnected = !withingsQ.error

  const fitData    = null // Google Fit eliminat — date din Intervals.icu
  const fitLoading = false // Google Fit eliminat

  const intervalsData    = intervalsQ.data || null

  // Verificam notificari target cand datele se schimba
  useEffect(function() {
    if (!intervalsData) return
    const canPush = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    const steps = intervalsData?.today?.steps || 0
    const stepsTarget = userProfile?.target_steps || 10000
    const calories = intervalsData?.today?.calories || 0
    const calTarget = userProfile?.target_calories_burned || 500
    const today = new Date().toISOString().slice(0, 10)
    const prefs = JSON.parse(localStorage.getItem('forma-notif-prefs') || '{}')

    if (steps >= stepsTarget && prefs.target_pasi !== false) {
      const key = 'forma-notif-pasi-' + today
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1')
        setAchievement({
          type: 'pasi',
          title: '🚶 Ai atins targetul de pași!',
          body: `${Number(steps).toLocaleString()} pași · obiectiv ${Number(stepsTarget).toLocaleString()} ✓`,
        });
        (async () => {
          try {
            await supabase.from('notifications').insert({
              user_id: user?.id,
              title: '🚶 Ai atins targetul de pași!',
              body: `${Number(steps).toLocaleString()} pași · obiectiv ${Number(stepsTarget).toLocaleString()} ✓`,
              url: '/dashboard', read: false,
            })
            if (canPush) {
              await supabase.functions.invoke('send-notifications', {
                body: { type: 'target_pasi', userId: user?.id, data: { steps, target: stepsTarget } }
              })
            }
          } catch(e) { console.warn('notif pasi error', e) }
        })()
      }
    }

    if (calories >= calTarget && prefs.target_calorii !== false) {
      const key = 'forma-notif-calorii-' + today
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, '1')
        setAchievement({
          type: 'calorii',
          title: '🔥 Ai ars targetul de calorii!',
          body: `${calories} kcal arse · obiectiv ${calTarget} kcal ✓`,
        });
        (async () => {
          try {
            await supabase.from('notifications').insert({
              user_id: user?.id,
              title: '🔥 Ai ars targetul de calorii!',
              body: `${calories} kcal arse · obiectiv ${calTarget} kcal ✓`,
              url: '/dashboard', read: false,
            })
            if (canPush) {
              await supabase.functions.invoke('send-notifications', {
                body: { type: 'target_calorii', userId: user?.id, data: { calories, target: calTarget } }
              })
            }
          } catch(e) { console.warn('notif calorii error', e) }
        })()
      }
    }
  }, [intervalsData])

  const intervalsLoading = intervalsQ.isLoading


  // Dacă avem data nașterii, calculăm vârsta la fiecare pornire (se actualizează
  // singură la ziua de naștere), altfel folosim vârsta salvată ca număr.
  const userProfile = useMemo(() => {
    const p = profileQ.data
    if (!p) return null
    const derived = calcAgeFromBirth(p.birth_date)
    return derived != null ? { ...p, age: derived } : p
  }, [profileQ.data])
  // Limba aplicației din profil (sincronizată pe device-uri); fallback pe română.
  useEffect(() => { if (userProfile?.language) setAppLang(userProfile.language) }, [userProfile?.language])
  const activeInjuries = injuriesQ.data || []

  const nutrition        = nutritionQ.data?.today   || null
  const nutritionHistory = nutritionQ.data?.history || []
  const nutritionYesterday = (() => {
    const ys = new Date(Date.now() - 86400000).toISOString().slice(0,10)
    return nutritionQ.data?.history?.find(d => d.date === ys) || null
  })()
  const allMealEntries   = nutritionQ.data?.meals   || []  // raw entries with name

  // ── Nutriție zi selectată (accesibil și în modal, outside IIFE) ──
  const _nutDate = new Date(); _nutDate.setDate(_nutDate.getDate() - nutritionDayOffset)
  const nutDateStr = _nutDate.toISOString().slice(0, 10)
  const nutNutrition = nutritionDayOffset === 0
    ? nutrition
    : (nutritionHistory.find(d => d.date === nutDateStr) || null)

  const supplements = supplementsQ.data?.supplements || []
  const suppTaken   = supplementsQ.data?.suppTaken   || {}

  const waterTarget = userProfile?.target_water_ml || 2500
  const waterToday = { ...(waterQ.data || { total_ml: 0, logs: [] }), target_ml: waterTarget }
  const setWaterToday = (updater) => {
    const key = QUERY_KEYS.waterToday(user?.id, new Date().toISOString().slice(0,10))
    qc.setQueryData(key, typeof updater === 'function' ? updater(qc.getQueryData(key)) : updater)
  }

  // Ținte nutriționale PERSONALIZATE: dacă profilul are ținte explicite le folosim,
  // altfel le calculăm din greutate/înălțime/vârstă/gen (BMR Mifflin-St Jeor) →
  // TDEE (factor activitate) → ajustare pe obiectiv → distribuție macro pe g/kg.
  const nutritionTargets = useMemo(() => {
    const explicitCal = userProfile?.target_calories
    const explicitP   = userProfile?.target_protein_g
    const explicitC   = userProfile?.target_carbs_g
    const explicitF   = userProfile?.target_fat_g

    const w = withingsQ.data?.body?.weight_kg || userProfile?.weight_kg
    const h = userProfile?.height_cm
    const a = userProfile?.age
    const g = userProfile?.gender || 'M'
    const goal = userProfile?.goal || 'sanatate'

    // BMR Mifflin-St Jeor
    let bmr = null
    if (w && h && a) {
      const base = 10 * w + 6.25 * h - 5 * a
      bmr = Math.round(g === 'F' ? base - 161 : base + 5)
    }
    // TDEE — factor de activitate moderat (nu există câmp dedicat în profil)
    const tdee = bmr ? Math.round(bmr * 1.45) : null

    // Ajustare calorii pe obiectiv
    const calFactor =
      goal === 'slabit'      ? 0.80 :
      goal === 'hipertrofie' ? 1.12 :
      goal === 'forta'       ? 1.08 :
      goal === 'recompozitie'? 0.95 :
      goal === 'rezistenta'  ? 1.05 : 1.0
    const cal = explicitCal || (tdee ? Math.round(tdee * calFactor) : 2000)

    // Proteine g/kg pe obiectiv
    const pPerKg =
      goal === 'slabit'      ? 2.2 :
      goal === 'recompozitie'? 2.2 :
      goal === 'hipertrofie' ? 2.0 :
      goal === 'forta'       ? 2.0 :
      goal === 'rezistenta'  ? 1.6 : 1.8
    const protein = explicitP || (w ? Math.round(w * pPerKg) : 130)

    // Grăsimi: ~27% din calorii, cu minim 0.8 g/kg
    let fat = explicitF
    if (!fat) {
      const fatFromCal = Math.round(cal * 0.27 / 9)
      const fatMin = w ? Math.round(w * 0.8) : 55
      fat = Math.max(fatFromCal, fatMin)
    }
    // Carbohidrați: restul caloriilor după proteine și grăsimi
    let carbs = explicitC
    if (!carbs) {
      const remaining = cal - protein * 4 - fat * 9
      carbs = Math.max(50, Math.round(remaining / 4))
    }

    return {
      bmrDaily: cal, calories: cal,
      proteinG: protein, protein_g: protein,
      carbsG:   carbs,   carbs_g:   carbs,
      fatG:     fat,     fat_g:     fat,
    }
  }, [userProfile, withingsQ.data])

  const { readiness, setReadiness, updateScores, updateReadiness } = useReadinessScore()

  const loadGoogleFitData = () => {} // Google Fit eliminat
  const loadHevyData      = useCallback(() => { qc.invalidateQueries({ queryKey: QUERY_KEYS.hevy(user?.id) }) }, [user?.id, qc])
  const loadWithingsData  = useCallback(() => { qc.invalidateQueries({ queryKey: QUERY_KEYS.withings(user?.id) }) }, [user?.id, qc])
  const loadIntervalsData = useCallback(() => { qc.invalidateQueries({ queryKey: QUERY_KEYS.intervals(user?.id, 60) }) }, [user?.id, qc])
  const loadNutrition     = useCallback(() => { qc.invalidateQueries({ queryKey: QUERY_KEYS.nutrition(user?.id, new Date().toISOString().slice(0,10)) }) }, [user?.id, qc])

  // Persistă estimarea AI de micronutrienți în DB, proporțional pe mese după calorii
  const saveSuppToProfile = async (supp) => {
    if (!user?.id) return
    const current = userProfile?.saved_supplements || []
    if (current.some(s => s.name.toLowerCase() === supp.name.toLowerCase())) return
    const next = [...current, { ...supp, id: Date.now().toString() }]
    try {
      await supabase.from('profiles').update({ saved_supplements: next }).eq('id', user.id)
      qc.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) })
    } catch(e) { console.warn('save supp to profile error', e) }
  }

  const removeSuppFromProfile = async (suppId) => {
    if (!user?.id) return
    const current = userProfile?.saved_supplements || []
    const next = current.filter(s => s.id !== suppId)
    try {
      await supabase.from('profiles').update({ saved_supplements: next }).eq('id', user.id)
      qc.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) })
    } catch(e) { console.warn('remove supp from profile error', e) }
  }

  // Identifică categoria unui aliment pentru distribuire corectă micronutrienți
  const getMealCategory = (name = '') => {
    const n = name.toLowerCase()
    if (/latte|cappuccino|cafea|espresso|coffee|ceai|tea|macchiato|americano|flat.white/.test(n)) return 'hot_drink'
    if (/suc|juice|smoothie|shake|nectar|limonada|bautura|drink|cola|fanta|sprite|bere|beer|vin|wine|kombucha/.test(n)) return 'drink'
    if (/lapte|milk/.test(n) && !/ciocolata|chocolate|pudding|budinca/.test(n)) return 'drink'
    return 'food'
  }

  const persistMicroToDb = async (aiResult, meals) => {
    const totalCals = meals.reduce((s, m) => s + (m.calories||0), 0)
    if (!totalCals || !meals.length) return
    const solidMeals = meals.filter(m => !['hot_drink','drink'].includes(getMealCategory(m.name)))
    const solidCals  = solidMeals.reduce((s, m) => s + (m.calories||0), 0) || 1
    try {
      await Promise.all(meals.filter(m => m.id).map(m => {
        const isDrink = ['hot_drink','drink'].includes(getMealCategory(m.name))
        const r    = (m.calories||0) / totalCals
        const rS   = isDrink ? 0 : (m.calories||0) / solidCals
        const r1   = v => Math.round((v||0) * r * 10) / 10
        const r0   = v => Math.round((v||0) * r)
        const rP1  = v => isDrink ? 0 : Math.round((v||0) * rS * 10) / 10
        const rP0  = v => isDrink ? 0 : Math.round((v||0) * rS)
        return supabase.from('meal_entries').update({
          fiber_g:         r1(aiResult.fiber_g),
          sugar_g:         r1(aiResult.sugar_g),
          saturated_fat_g: r1(aiResult.saturated_fat_g),
          sodium_mg:       r0(aiResult.sodium_mg),
          potassium_mg:    r0(aiResult.potassium_mg),
          calcium_mg:      r0(aiResult.calcium_mg),
          iron_mg:         r1(aiResult.iron_mg),
          vitamin_c_mg:    r1(aiResult.vitamin_c_mg),
          vitamin_a_mcg:   rP0(aiResult.vitamin_a_mcg),
          vitamin_d_mcg:   r1(aiResult.vitamin_d_mcg),
          vitamin_b12_mcg: r1(aiResult.vitamin_b12_mcg),
          magnesium_mg:    r0(aiResult.magnesium_mg),
          zinc_mg:         r1(aiResult.zinc_mg),
          vitamin_b6_mg:   r1(aiResult.vitamin_b6_mg),
          folate_mcg:      r0(aiResult.folate_mcg),
          vitamin_e_mg:    rP1(aiResult.vitamin_e_mg),
          omega3_mg:       r0(aiResult.omega3_mg),
          selenium_mcg:    r1(aiResult.selenium_mcg),
          lycopene_mcg:    rP0(aiResult.lycopene_mcg    || 0),
          lutein_mcg:      rP0(aiResult.lutein_mcg      || 0),
          quercetin_mg:    rP1(aiResult.quercetin_mg    || 0),
          resveratrol_mg:  rP1(aiResult.resveratrol_mg  || 0),
          curcumin_mg:     rP1(aiResult.curcumin_mg     || 0),
          beta_carotene_mcg: rP0(aiResult.beta_carotene_mcg || 0),
        }).eq('id', m.id)
      }))
      qc.invalidateQueries({ queryKey: QUERY_KEYS.nutrition(user?.id, new Date().toISOString().slice(0,10)) })
    } catch(e) { console.warn('persistMicroToDb error:', e) }
  }


  const [healthScore, setHealthScore] = useState(null)

  // ── React Query gestionează fetch-ul automat ─────────────────────────────
  // useEffect-uri derivate pentru scoruri readiness

  useEffect(() => {
    if (!hevyQ.data?.workouts?.length) return
    const w = hevyQ.data.workouts
    const lw = w[0]
    const recoveryScore = lw ? (lw.hours_ago >= 72 ? 95 : lw.hours_ago >= 48 ? 80 : lw.hours_ago >= 36 ? 65 : lw.hours_ago >= 24 ? 45 : 25) : 85
    const injuries = injuriesQ.data || []
    let suggestedWorkout = hevyQ.data.recovery?.suggestedDay || '—'
    let recType = null
    if (injuries.length > 0) {
      const txt = injuries.map(i => i.description).join(' ').toLowerCase()
      recType = 'adapt'
      suggestedWorkout = txt.includes('genunchi') || txt.includes('menisc') ? 'Upper Body — evită exerciții pentru picioare'
        : txt.includes('umar') || txt.includes('umăr') ? 'Lower Body + Core — evită presă și tracțiuni'
        : 'Antrenament adaptat — evită zona afectată'
    }
    setReadiness(r => ({ ...r, scores: { ...r.scores, recovery: recoveryScore }, suggested_workout: suggestedWorkout, ...(recType ? { recommendation_type: recType } : {}) }))
  }, [hevyQ.data, injuriesQ.data])

  useEffect(() => {
    const sleep = withingsQ.data?.sleep
    if (!sleep?.total_h) return
    const sleepScore = calcSleepScore(sleep)
    const withingsHrvScore = calcHRVScore(sleep?.hrv, null)
    setReadiness(r => ({ ...r, scores: { ...r.scores, sleep: sleepScore, ...(r.scores.hrv === null && withingsHrvScore !== null ? { hrv: withingsHrvScore } : {}) } }))
  }, [withingsQ.data])

  useEffect(() => {
    // Readiness nutriție = datele de IERI (ce ai mâncat ieri influențează readiness azi)
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const yesterdayNutrition = nutritionQ.data?.history?.find(d => d.date === yesterdayStr)
    if (!yesterdayNutrition) return
    const weightKg = withingsQ.data?.body?.weight_kg || userProfile?.weight_kg || 80
    let score = 65
    if (yesterdayNutrition.protein_g) { const ppk = yesterdayNutrition.protein_g / weightKg; score += ppk >= 1.8 ? 20 : ppk >= 1.4 ? 10 : -5 }
    if (yesterdayNutrition.calories) { score += yesterdayNutrition.calories < 1500 ? -15 : yesterdayNutrition.calories > 3500 ? -10 : 5 }
    setReadiness(r => ({ ...r, scores: { ...r.scores, nutrition: Math.min(100, Math.max(0, score)) } }))
  }, [nutritionQ.data, userProfile])

  // Profil → layout dashboard persistent
  useEffect(() => {
    if (!profileQ.data) return
    const saved = profileQ.data.dashboard_layout
    if (saved?.length > 0) {
      // Merge: layout salvat + widgets noi care nu existau când s-a salvat
      const savedIds = new Set(saved.map(w => w.id))
      const newWidgets = getDefaultLayout().filter(w => !savedIds.has(w.id))
      let merged = [...saved, ...newWidgets]
      // Garantează că „heartage" există, e vizibil și stă imediat după „bioage"
      const haExisting = merged.find(w => w.id === 'heartage')
      merged = merged.filter(w => w.id !== 'heartage')
      const ha = haExisting ? { ...haExisting, visible: true } : { id: 'heartage', visible: true }
      const bi = merged.findIndex(w => w.id === 'bioage')
      if (bi >= 0) merged.splice(bi + 1, 0, ha); else merged.unshift(ha)
      setDashboardLayout(merged)
    }
    // Dacă nu există layout salvat, rămânem pe getDefaultLayout()
  }, [profileQ.data])

  useEffect(() => {
    if (!user?.id) return
    loadSubjectiveData()
    loadHealthScore()
    calcTrainingLoad()
  }, [user?.id])


  async function saveDashboardLayout(newLayout) {
    setDashboardLayout(newLayout)
    if (!user?.id) return
    setLayoutSaving(true)
    try {
      await supabase.from('profiles').update({ dashboard_layout: newLayout, updated_at: new Date().toISOString() }).eq('id', user.id)
    } catch (err) {
      console.warn('Save layout:', err.message)
    } finally {
      setLayoutSaving(false)
    }
  }

  function moveWidget(id, direction) {
    const idx = dashboardLayout.findIndex(w => w.id === id)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= dashboardLayout.length) return
    const newLayout = [...dashboardLayout]
    ;[newLayout[idx], newLayout[newIdx]] = [newLayout[newIdx], newLayout[idx]]
    saveDashboardLayout(newLayout)
  }

  function toggleActivityWidget(id) {
    setActivityLayout(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
      localStorage.setItem('forma-activity-layout', JSON.stringify(updated))
      return updated
    })
  }

  function isActivityVisible(id) {
    return activityLayout.find(w => w.id === id)?.visible ?? true
  }

  function toggleWidget(id) {
    const newLayout = dashboardLayout.map(w => w.id === id ? { ...w, visible: !w.visible } : w)
    saveDashboardLayout(newLayout)
  }

  async function loadSelectedDayExtra(dateStr) {
    if (!user?.id || !dateStr) return
    setSelectedDayLoading(true)
    try {
      const [healthRes, waterRes] = await Promise.all([
        supabase.from('health_metrics').select('*').eq('user_id', user.id).eq('date', dateStr).maybeSingle(),
        supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('date', dateStr),
      ])
      const waterTotal = (waterRes.data || []).reduce((s, l) => s + (l.amount_ml || 0), 0)
      setSelectedDayExtra({ health: healthRes.data || null, water: waterTotal })
    } catch (err) {
      console.warn('loadSelectedDayExtra:', err.message)
      setSelectedDayExtra(null)
    } finally {
      setSelectedDayLoading(false)
    }
  }

  async function loadWaterToday() {
    if (!user?.id) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('date', today)
      const total = (data || []).reduce((s, l) => s + (l.amount_ml || 0), 0)
      const weight = body?.weight_kg || userProfile?.weight_kg || 80
      const target = Math.round(weight * 35)
      setWaterToday({ total_ml: total, target_ml: target })
    } catch (err) { console.warn('Water load:', err.message) }
  }

  async function loadHealthScore() {
    if (!user?.id) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      const { data } = await supabase
        .from('health_metrics')
        .select('cardio_score, spo2')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()
      if (data) {
        if (data.cardio_score) setHealthScore(data.cardio_score)
        setReadiness(r => ({
          ...r,
          scores: {
            ...r.scores,
            ...(data.cardio_score ? { health: data.cardio_score } : {}),
          }
        }))
      }
    } catch { /* no health data today */ }
  }

  async function loadSupplements() {
    if (!user?.id) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data: suppData } = await supabase
        .from('supplements').select('*').eq('user_id', user.id).eq('active', true).order('created_at')
      if (suppData) setSupplements(suppData)
      // Încarcă bifările de azi
      const { data: logData } = await supabase
        .from('supplement_logs').select('supplement_id').eq('user_id', user.id).eq('date', today)
      if (logData) {
        const taken = {}
        logData.forEach(l => { taken[l.supplement_id] = true })
        setSuppTaken(taken)
      }
    } catch (err) { console.warn('Load supplements:', err.message) }
  }

  async function toggleSupplement(supp) {
    if (!user?.id) return
    const today = new Date().toISOString().slice(0, 10)
    const isTaken = suppTaken[supp.id]
    try {
      if (isTaken) {
        await supabase.from('supplement_logs')
          .delete().eq('user_id', user.id).eq('supplement_id', supp.id).eq('date', today)
        setSuppTaken(prev => { const n = {...prev}; delete n[supp.id]; return n })
      } else {
        await supabase.from('supplement_logs')
          .insert({ user_id: user.id, supplement_id: supp.id, date: today })
        setSuppTaken(prev => ({ ...prev, [supp.id]: true }))
      }
    } catch (err) { console.warn('Toggle supplement:', err.message) }
  }

  async function deleteSupplement(id) {
    try {
      await supabase.from('supplements').update({ active: false }).eq('id', id)
      setSupplements(prev => prev.filter(s => s.id !== id))
    } catch (err) { console.warn('Delete supplement:', err.message) }
  }

  async function generateSupplements() {
    if (AI_COACH_DISABLED) return   // recomandări AI suplimente dezactivate (economie AI)
    if (!user?.id || suppLoading) return
    setSuppLoading(true)
    try {
      const goalVal = userProfile?.goal || 'sanatate'
      const weightVal = userProfile?.weight_kg || body?.weight_kg || 75
      const ageVal = userProfile?.age || 35
      const hrvVal = readiness.scores.hrv
      const nutritionVal = nutrition
      const hasWorkouts = workouts && workouts.length > 0
      const stepsVal = intervalsData?.today?.steps || 0
      const isFemale = userProfile?.gender === 'F'

      // Prompt adaptat la profilul real — wellness vs fitness
      const isWellness = ['sanatate', 'rezistenta'].includes(goalVal) || !hasWorkouts
      const prompt = `Ești nutriționist expert. Recomandă suplimente personalizate pentru acest profil:

PROFIL:
- Gen: ${isFemale ? 'Feminin' : 'Masculin'}
- Obiectiv: ${goalVal}
- Vârstă: ${ageVal} ani, Greutate: ${weightVal}kg
- Face antrenamente cu greutăți: ${hasWorkouts ? 'da' : 'nu'}
- Pași zilnici: ${stepsVal > 0 ? stepsVal.toLocaleString() : 'nedisponibil'}
- HRV scor: ${hrvVal || 'nedisponibil'}/100
- Calorii: ${nutritionVal?.calories || 'nedisponibil'} kcal/zi
- Proteine: ${nutritionVal?.protein_g || 'nedisponibil'}g/zi
- Scor readiness: ${readiness.score}/100

${isWellness ? 'Profil wellness/sănătate generală — evită suplimentele de bodybuilding.' : ''}
${stepsVal >= 8000 && !hasWorkouts ? 'Persoană activă prin mers pe jos, nu prin sport de forță.' : ''}

Recomandă MAXIM 6 suplimente relevante pentru acest profil specific.
Răspunde DOAR cu JSON array, fără text înainte sau după:
[{"name":"Omega-3","dose":"2g cu masa de seară","reason":"sănătate cardiovasculară"},{"name":"Vitamina D3","dose":"4000 IU dimineața","reason":"imunitate și oase"}]`

      const { data: fnData } = await supabase.functions.invoke('ai-coach', {
        body: { prompt, max_tokens: 600 }
      })
      if (fnData?.ok && fnData.text) {
        const text = fnData.text.replace(/```json|```/g, '').trim()
        const first = text.indexOf('[')
        const last = text.lastIndexOf(']')
        if (first !== -1 && last !== -1) {
          const parsed = JSON.parse(text.slice(first, last + 1))
          // Dezactivează suplimentele vechi și salvează cele noi
          await supabase.from('supplements').update({ active: false }).eq('user_id', user.id)
          const toInsert = parsed.map((s) => ({ user_id: user.id, name: s.name, dose: s.dose, reason: s.reason, active: true }))
          const { data: inserted } = await supabase.from('supplements').insert(toInsert).select()
          if (inserted) setSupplements(inserted)
          setSuppTaken({})
        }
      }
    } catch (err) { console.warn('Supplements:', err.message) }
    finally { setSuppLoading(false) }
  }

  async function loadSubjectiveData() {
    if (!user?.id) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      const { data } = await supabase.from('subjective_inputs').select('*').eq('user_id', user.id).eq('date', today).maybeSingle()
      if (data) {
        setSubj({ energy: data.energy || 7, sleep_quality: data.sleep_quality || 8, motivation: data.motivation || 6, stress: data.stress || 3, soreness: data.soreness || 3 })
        if (data.notes) setInjuries(data.notes)
        if (data.manual_sleep_hours) setManualSleep({ hours: data.manual_sleep_hours.toString(), score: data.manual_sleep_score?.toString() || '' })
        // Fereastra ultimei intrări (pt afișare per perioadă). Din localStorage; fallback din ora updated_at
        let win = null
        try { win = (JSON.parse(localStorage.getItem('forma_subj_meta_' + today) || 'null'))?.window || null } catch (_) {}
        if (!win && data.updated_at) { const h = new Date(data.updated_at).getHours(); win = h < 16 ? 'morning' : h < 21 ? 'afternoon' : 'evening' }
        setSubjEntryWindow(win)
      }
    } catch (err) { /* no data yet */ }
  }

  async function saveManualSleep() {
    if (!user?.id || !manualSleep.hours) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      const { error } = await supabase.from('subjective_inputs').upsert({
        user_id: user.id,
        date: today,
        manual_sleep_hours: parseFloat(manualSleep.hours),
        manual_sleep_score: manualSleep.score ? parseInt(manualSleep.score) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })
      if (error) throw error
      setManualSleepSaved(true)
      setTimeout(() => setManualSleepSaved(false), 2000)
    } catch (err) {
      console.error('Save manual sleep error:', err)
      alert('Eroare la salvarea somnului: ' + err.message)
    }
  }

  async function loadActiveInjuries() {
    if (!user?.id) return
    try {
      const { data } = await supabase.from('injuries').select('*').eq('user_id', user.id).eq('active', true).order('started_at', { ascending: false })
      if (data) setActiveInjuries(data)
    } catch (err) { console.warn('Injuries:', err.message) }
  }

  async function saveSubjectiveData() {
    if (!user?.id) return
    const today = new Date().toISOString().slice(0, 10)
    try {
      await supabase.from('subjective_inputs').upsert({
        user_id: user.id,
        date: today,
        energy: subj.energy,
        sleep_quality: subj.sleep_quality,
        motivation: subj.motivation,
        stress: subj.stress,
        soreness: subj.soreness,
        notes: injuries || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,date' })
      // Marchează fereastra în care s-a introdus starea (pt afișarea per perioadă)
      const _h = new Date().getHours()
      const _win = _h < 16 ? 'morning' : _h < 21 ? 'afternoon' : 'evening'
      setSubjEntryWindow(_win)
      try { localStorage.setItem('forma_subj_meta_' + today, JSON.stringify({ window: _win, ts: Date.now() })) } catch (_) {}
      setSubjSaved(true)
      setTimeout(() => setSubjSaved(false), 2000)
    } catch (err) { console.error('Save subjective:', err) }
  }

  async function addInjury(description) {
    if (!user?.id || !description.trim()) return
    const injuryText = description.toLowerCase()
    const zone = injuryText.includes('genunchi') || injuryText.includes('menisc') ? 'knee'
      : injuryText.includes('umar') || injuryText.includes('umăr') ? 'shoulder'
      : injuryText.includes('spate') || injuryText.includes('lombar') ? 'back'
      : 'other'
    try {
      await supabase.from('injuries').insert({ user_id: user.id, description, zone, active: true, started_at: new Date().toISOString().slice(0,10) })
      loadActiveInjuries()
    } catch (err) { console.error('Add injury:', err) }
  }

  async function resolveInjury(id) {
    try {
      await supabase.from('injuries').update({ active: false, resolved_at: new Date().toISOString().slice(0,10) }).eq('id', id)
      loadActiveInjuries()
    } catch (err) { console.error('Resolve injury:', err) }
  }

  async function recalculateAndSave() {
    if (activeInjuries.length > 0) {
      recalculateWithInjuries(activeInjuries)
    } else {
      recalculate()
    }
    await saveSubjectiveData()
    // Adaugă accidentare nouă dacă e text nou
    if (injuries.trim() && injuries.length > 5) {
      const existingDesc = activeInjuries.map(i => i.description.toLowerCase())
      if (!existingDesc.some(d => d.includes(injuries.toLowerCase().slice(0, 10)))) {
        await addInjury(injuries.trim())
      }
    }
  }





  async function loadStepsChartPeriod(period) {
    if (!user?.id) return
    setStepsChartPeriod(period)
    // 7 zile — folosim direct deja încărcat, fără cerere suplimentară
    if (period === 7) { setStepsChartData(null); return }
    setStepsChartLoading(true)
    try {
      // Folosim datele din intervalsData deja incarcate
      setStepsChartData(intervalsData?.days || [])
    } catch (err) {
      console.warn('Steps chart period:', err.message)
      setStepsChartData([])
    } finally { setStepsChartLoading(false) }
  }

  // ── Model Banister (Fitness-Fatigue / Impulse-Response) ──────────────────
  // Calculează TSS zilnic din 2 surse disponibile, apoi trimite la Edge Function
  // pentru recursiunea EWMA (CTL/ATL/TSB), care necesită ordine strict cronologică.

  async function calcTrainingLoad() {
    if (!user?.id) return
    try {
      // Avem nevoie de minim ~56 zile istoric pentru ca CTL (fereastră 42z) să se stabilizeze
      const workoutsHistory = await fetchRecentWorkouts(8)
      const fitHistory = null // Google Fit eliminat — TSS cardio din Intervals.icu

      const tssByDate = {}
      const today = new Date()
      for (let i = 0; i < 60; i++) {
        const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10)
        tssByDate[d] = 0
      }

      // TSS din antrenamente forță (Hevy): duration_min × (RPE/10)² × 100/60
      ;(workoutsHistory || []).forEach(w => {
        if (!w.date || !w.duration_min) return
        const rpe = w.rpe_avg || 6
        const tss = w.duration_min * Math.pow(rpe / 10, 2) * (100 / 60)
        tssByDate[w.date] = (tssByDate[w.date] || 0) + tss
      })

      // TSS din activitati Intervals.icu (training_load per activitate)
      ;filterMFP(intervalsData?.activities).forEach(a => {
        if (!a.date || !a.training_load) return
        tssByDate[a.date] = (tssByDate[a.date] || 0) + (a.training_load || 0)
      })

      const dailyTss = Object.entries(tssByDate).map(([date, tss]) => ({ date, tss }))

      const { data, error } = await supabase.functions.invoke('training-load', {
        body: { userId: user.id, dailyTss }
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error || 'Eroare training-load')

      setTrainingLoad(data.latest)
      setTrainingLoadHistory(data.history || [])
    } catch (err) { console.warn('Training load:', err.message) }
  }

  // Detectare date Google Fit "stale" (sincronizare în curs)
  const fitDataIsStale = false

  // Detectare "posibil neactualizat" — data e corectă (azi), dar numărul de pași
  // pare suspect de mic pentru ora curentă (lag Garmin/Health Sync → Google Fit)
  const fitDataLooksStale = false // Google Fit eliminat

  // Date somn combinate
  const combinedSleep = useMemo(() => {
    const w = withingsData.sleep
    const localNow = new Date(Date.now() + 3 * 3600000)
    const todayLocal = localNow.toISOString().slice(0, 10)
    const yesterdayLocal = new Date(localNow.getTime() - 86400000).toISOString().slice(0, 10)

    // Intervals.icu sleep helper — filtrat și normalizat
    const iSleep = intervalsData?.today?.sleep_hours ?? intervalsData?.latest?.sleep_hours
    const iScore = intervalsData?.today?.sleep_score ?? intervalsData?.latest?.sleep_score
    const intervalsHasSleep = iSleep && iSleep > 0

    // 1. Withings — sursă principală dacă are date recente (azi sau ieri), indiferent de zi
    const withingsIsRecent = w && w.total_h > 0 && (w.date === todayLocal || w.date === yesterdayLocal)
    if (withingsIsRecent) {
      // Withings are fazele somnului dar nu HRV/SpO2 nocturn
      // Completăm cu datele din Intervals.icu (Garmin)
      const id = intervalsData?.today ?? intervalsData?.latest
      return {
        source: 'withings',
        ...w,
        hrv:         w.hrv         ?? id?.hrv         ?? null,
        spo2:        w.spo2        ?? id?.spo2        ?? null,
        hr:          w.hr          ?? id?.sleep_hr_avg ?? id?.hr_rest ?? null,
        respiration: w.respiration ?? id?.respiration  ?? null,
      }
    }

    // 2. Intervals.icu (Garmin) — weekend + orice zi fără Withings
    if (intervalsHasSleep) {
      const id = intervalsData?.today ?? intervalsData?.latest
      return {
        source: 'intervals',
        total_h: iSleep,
        deep_h: id?.sleep_deep_h ?? null,
        rem_h: id?.sleep_rem_h ?? null,
        light_h: id?.sleep_light_h ?? null,
        awake_h: id?.sleep_awake_h ?? null,
        hrv: id?.hrv ?? null,          // HRV nocturn Garmin
        spo2: id?.spo2 ?? null,        // SpO2 nocturn Garmin
        hr: id?.sleep_hr_avg ?? id?.hr_rest ?? null,  // HR nocturn Garmin
        respiration: id?.respiration ?? null,
        score: iScore ?? null,
      }
    }

    // 3. Input manual — fallback dacă Intervals.icu nu are date
    if (manualSleep.hours && parseFloat(manualSleep.hours) > 0) {
      return { source: 'manual', total_h: parseFloat(manualSleep.hours), deep_h: null, rem_h: null, light_h: null, awake_h: null, hrv: null, spo2: null, hr: null, score: manualSleep.score ? parseInt(manualSleep.score) : null, respiration: null }
    }

    return null
  }, [withingsData, intervalsData, manualSleep])
  // HRV filtrat din Intervals.icu — calculat o singură dată, folosit în hero card + body battery + readiness desc
  const intervalsHrv = useMemo(() => {
    const rawHrv = intervalsData?.today?.hrv ?? null
    if (rawHrv == null) return null
    const recentHrvs = (intervalsData?.days || []).slice(-30).map(d => d.hrv).filter(v => v != null && v > 0)
    const sorted = [...recentHrvs].sort((a, b) => a - b)
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null
    return (median != null && rawHrv > median * 2.5) ? null : Math.round(rawHrv)
  }, [intervalsData])
  const intervalsHrvBaseline = (() => {
    const vals = (intervalsData?.days || []).slice(-30).map(d => d.hrv).filter(v => v != null && v > 0)
    return vals.length >= 3 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  })()

  // Calcul automat scor sănătate din datele disponibile (Withings + Intervals.icu)
  // Identic cu logica din HealthDashboard, injectat în readiness.scores.health
  useEffect(() => {
    const hrRest = withingsData.body?.hr_rest ?? intervalsData?.today?.hr_rest ?? null
    const hrv = intervalsHrv
    const bpSys = withingsData.body?.bp_sys ?? withingsData.body?.systolic ?? null
    const bpDia = withingsData.body?.bp_dia ?? withingsData.body?.diastolic ?? null
    const pwv = withingsData.body?.pwv
    const spo2 = withingsData.body?.spo2 ?? intervalsData?.today?.spo2 ?? null
    const respiration = withingsData.sleep?.respiration
    if (!hrRest && !hrv && !bpSys && !pwv && !spo2) return // niciun datum disponibil

    let score = 0, factors = 0
    if (hrRest) { factors++; score += hrRest < 50 ? 20 : hrRest < 60 ? 17 : hrRest < 70 ? 13 : hrRest < 80 ? 8 : 3 }
    if (bpSys && bpDia) { factors++; score += bpSys < 120 && bpDia < 80 ? 20 : bpSys < 130 ? 15 : bpSys < 140 ? 9 : 3 }
    if (pwv) { factors++; score += pwv < 7 ? 20 : pwv < 9 ? 14 : pwv < 11 ? 8 : 2 }
    if (spo2) { factors++; score += spo2 >= 98 ? 15 : spo2 >= 96 ? 12 : spo2 >= 94 ? 7 : 2 }
    if (hrv) { factors++; score += hrv >= 60 ? 20 : hrv >= 45 ? 16 : hrv >= 35 ? 12 : hrv >= 25 ? 7 : 3 }
    if (respiration) { factors++; score += respiration >= 12 && respiration <= 18 ? 5 : 3 }
    if (factors === 0) return

    // maxPossible = suma punctelor DOAR pentru factorii disponibili
    // PWV și tensiune pot lipsi (API indisponibil) — nu penalizăm absența lor
    const maxPossible =
      (hrRest       ? 20 : 0) +
      (bpSys        ? 20 : 0) +
      (pwv          ? 20 : 0) +
      (spo2         ? 15 : 0) +
      (hrv          ? 20 : 0) +
      (respiration  ?  5 : 0)
    if (maxPossible === 0) return
    const healthScore = Math.min(100, Math.round((score / maxPossible) * 100))
    setReadiness(r => ({ ...r, scores: { ...r.scores, health: healthScore } }))
  }, [withingsData, intervalsData, intervalsHrv])

  // Lookup activitate Intervals.icu după dată — folosit în toate cardurile de antrenament
  // Match: dată exactă, preferând WeightTraining/Strength față de alte tipuri
  async function generatePmcAi(ctl, atl, tsb, rampRate) {
    if (AI_COACH_DISABLED) return   // interpretare AI grafic fitness dezactivată (economie AI)
    if (pmcAiLoading || !ctl) return
    setPmcAiLoading(true)
    try {
      const prompt = `Ești un expert în periodizare sportivă și modelul Banister de fitness-oboseală.
Analizează valorile curente ale atletului și oferă o interpretare clară, practică, în română:

CTL (Fitness, medie 42 zile): ${Math.round(ctl)}
ATL (Oboseală acută, medie 7 zile): ${Math.round(atl)}
TSB (Forma = CTL - ATL): ${tsb > 0 ? '+' : ''}${Math.round(tsb)}
Ramp Rate (ritmul de creștere): ${rampRate ? (Math.round(rampRate * 10) / 10) : 'N/A'}

Bazat strict pe aceste valori, răspunde concis (3-4 fraze) la:
1. Ce îi spune graficul despre starea lui actuală (antrenament, oboseală, formă)?
2. Ar trebui să se antreneze azi sau să se odihnească?
3. Există riscuri (supraantrenament, deantrenare, rampă prea abruptă)?
4. Un sfat specific și practic pentru săptămâna aceasta.

Fii direct și specific, nu generic. Evită jargonul, explică în termeni simpli.`

      // Apelăm prin Edge Function Supabase (server-side) — apelul direct din browser e blocat de CORS
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('ai-coach', {
        body: { prompt, max_tokens: 400 }
      })
      if (fnErr) throw new Error(fnErr.message)
      if (!fnData?.ok) throw new Error(fnData?.error || 'Eroare AI Coach')
      const text = fnData.text || null
      if (text) setPmcAiText(text)
      else setPmcAiText('Nu s-a putut genera interpretarea. Încearcă din nou.')
    } catch (err) {
      console.warn('PMC AI:', err.message)
      setPmcAiText(`Eroare: ${err.message}`)
    } finally {
      setPmcAiLoading(false)
    }
  }

    // Filtreaza activitatile MFP din lista Intervals.icu
  function filterMFP(activities) {
    return (activities || []).filter(a => {
      const name = (a.name || '').toLowerCase()
      const type = (a.type || '').toLowerCase()
      return !name.includes('myfitnesspal') && !name.includes('mfp') &&
             !type.includes('myfitnesspal') && a.source !== 'myfitnesspal'
    })
  }

  function getIntervalsActivity(date) {
    const acts = filterMFP(intervalsData?.activities).filter(a => a.date === date)
    return acts.find(a => /weight|strength|gym/i.test(a.type || '')) || acts[0] || null
  }

  // Afișare calorii cu sursă — folosit uniform în Dashboard
  function formatCalories(hevyWorkout) {
    const iAct = getIntervalsActivity(hevyWorkout?.date)
    if (iAct?.calories) return { value: iAct.calories, isReal: true, src: 'Intervals.icu' }
    const { value: dur } = estimateWorkoutDuration(hevyWorkout || {})
    const est = estimateWorkoutCalories(dur, hevyWorkout?.rpe_avg, userProfile?.weight_kg || body?.weight_kg)
    return { value: est, isReal: false, src: 'estimat' }
  }


  // HRV din Polar H10 BLE — prioritate față de Intervals.icu
  const [polarHrv, setPolarHrv] = useState(null)
  const displayHrv = polarHrv != null ? polarHrv : intervalsHrv
  const [polarHrvHistory, setPolarHrvHistory] = useState([])
  const [polarHrvHistoryLoaded, setPolarHrvHistoryLoaded] = useState(false)

  const [depletionTick, setDepletionTick] = useState(0)

  // Body Battery curent — calculat o singură dată, folosit în readiness + widget
  const bodyBatteryCurrent = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayWorkout = workouts.find(w => w.date === todayStr)
    // Activitățile de azi din Intervals.icu — folosite pentru drenaj diferențiat per tip
    const todayActs = (intervalsData?.activities || []).filter(a => {
      const d = a.date || a.start_time?.slice(0,10) || a.start_date_local?.slice(0,10)
      return d === todayStr && (a.start_time || a.start_date_local)
    })
    const result = calcBodyBattery({
      sleepHours: combinedSleep?.total_h,
      sleepQuality: subj.sleep_quality,
      hrHourly: null, // Google Fit eliminat
      todayWorkout,
      currentHour: new Date().getHours(),
      hrvMs: displayHrv,
      hrvBaseline: intervalsHrvBaseline,
      activities: todayActs,
    })
    return result
  }, [combinedSleep, workouts, intervalsHrv, polarHrv, intervalsHrvBaseline, subj, intervalsData])
 useEffect(() => {
    const timer = setInterval(() => setDepletionTick(t => t + 1), 15 * 60000) // la fiecare 15 min
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const { sleep, hrv, recovery, nutrition: nutr, subjective } = readiness.scores
    if (sleep === null && hrv === null && recovery === null) return
    // Fallback inteligent pentru somn: dacă lipsește total, estimăm din HR nocturn disponibil
    let sleepFallback = 70
    const wb = withingsData.body
    if (sleep === null && wb?.hr_rest) {
      // HR odihnă scăzut sugerează recuperare bună chiar fără date exacte de somn
      if (wb.hr_rest < 55) sleepFallback = 75
      else if (wb.hr_rest < 65) sleepFallback = 68
      else if (wb.hr_rest < 75) sleepFallback = 60
      else sleepFallback = 52
    }
    const s = sleep ?? sleepFallback, h = hrv ?? 65, r = recovery ?? 70, n = nutr ?? 65
    const he = readiness.scores.health
    let score
    if (he !== null && subjective !== null) {
      score = Math.round(s * 0.25 + h * 0.18 + r * 0.18 + n * 0.14 + subjective * 0.13 + he * 0.12)
    } else if (he !== null) {
      score = Math.round(s * 0.28 + h * 0.20 + r * 0.20 + n * 0.17 + he * 0.15)
    } else if (subjective !== null) {
      score = Math.round(s * 0.30 + h * 0.20 + r * 0.20 + n * 0.15 + subjective * 0.15)
    } else {
      score = Math.round(s * 0.35 + h * 0.24 + r * 0.24 + n * 0.17)
    }
    score = Math.min(100, Math.max(0, score))

    // ── Depleție pe parcursul zilei — "bateria organismului" ────────────────
    // Scorul de mai sus = potențialul zilei (calculat din somn/HRV/recuperare).
    // Pe măsură ce trece timpul și se acumulează activitate, readiness-ul real scade.
    const baseScore = score
    const nowHour = new Date().getHours() + new Date().getMinutes() / 60

    // Factor orar: de la ora 6 (trezire) la ora 23 (culcare), bateria se consumă treptat
    // Curbă non-liniară: scade lent dimineața, mai rapid spre seară
    const wakeHour = 6, sleepHour = 23
    const dayProgress = Math.max(0, Math.min(1, (nowHour - wakeHour) / (sleepHour - wakeHour)))
    // Curbă pătratică ușoară — accelerează spre finalul zilei
    const timeDepletion = Math.pow(dayProgress, 1.3) * 18 // până la -18 puncte doar din trecerea timpului

    // Factor activitate: pași acumulați azi (peste 5000 pași încep să "coste" baterie)
    const stepsToday = intervalsData?.today?.steps || 0
    const stepsDepletion = Math.min(12, Math.max(0, (stepsToday - 5000) / 1000) * 1.2) // până la -12 puncte

    // Factor antrenament: dacă a fost azi un antrenament Hevy, scade suplimentar
    const lastWorkoutHoursAgo = workouts?.[0]?.hours_ago
    const workoutToday = lastWorkoutHoursAgo !== undefined && lastWorkoutHoursAgo < 18
    const workoutDepletion = workoutToday ? Math.max(0, 10 - lastWorkoutHoursAgo * 0.3) : 0 // până la -10, scade cu timpul de la antrenament

    const totalDepletion = Math.round(timeDepletion + stepsDepletion + workoutDepletion)
    score = Math.max(0, Math.round(baseScore - totalDepletion))

    // ── Body Battery — dacă e sub 40% la ora curentă, penalizare suplimentară
    // Logică: BB scăzut = organism obosit = readiness real mai mic decât potențialul
    const bb = bodyBatteryCurrent?.current
    let bbPenalty = 0
    if (bb != null) {
      if (bb < 20) bbPenalty = 10
      else if (bb < 30) bbPenalty = 7
      else if (bb < 40) bbPenalty = 4
      else if (bb < 50) bbPenalty = 2
    }
    if (bbPenalty > 0) score = Math.max(0, score - bbPenalty)

    // ── Penalizare variație bruscă de presiune atmosferică ────────────────────
    // SNA reacționează la schimbări bruște de presiune (>6 hPa în 24h) — pot afecta
    // recuperarea, somnul, și senzația de oboseală, independent de alți factori.
    let pressurePenalty = 0
    if (weather?.pressure_delta_24h != null) {
      const absDelta = Math.abs(weather.pressure_delta_24h)
      if (absDelta >= 10) pressurePenalty = 6
      else if (absDelta >= 6) pressurePenalty = 3
    }
    if (pressurePenalty > 0) score = Math.max(0, score - pressurePenalty)

    // ── Bonus/penalizare hidratare ────────────────────────────────────────────
    // Hidratare bună (≥80% target) → mic bonus pentru recuperare
    // Hidratare slabă (<40% target, după ora 14) → penalizare suplimentară
    // Apă: folosim consumul de IERI (influențează readiness azi)
    const yesterdayWaterMl = waterToday.yesterday_ml || 0
    if (waterTarget) {
      const waterPct = yesterdayWaterMl / waterTarget
      if (waterPct >= 0.8) score = Math.min(100, score + 3)
      else if (waterPct < 0.4) score = Math.max(0, score - 5)
    }
    // Dacă există accidentări active, păstrează tipul adapt
    const type = r.recommendation_type === 'adapt' ? 'adapt' : score >= 82 ? 'train_hard' : score >= 65 ? 'train_moderate' : score >= 48 ? 'train_light' : 'rest'
    const labels = { train_hard: 'Zi excelentă — antrenament intens', train_moderate: 'Pregătit pentru antrenament moderat', train_light: 'Antrenament ușor sau mobilitate', rest: 'Zi de odihnă recomandată', adapt: 'Antrenament adaptat — accidentare activă' }
    const sleepSrc = combinedSleep?.source === 'intervals' ? 'Intervals.icu' : combinedSleep?.source === 'manual' ? 'manual' : 'Withings'
    const hrvDisplay = displayHrv ?? combinedSleep?.hrv ?? null
    const hrvSrc = polarHrv != null ? 'Polar H10' : intervalsHrv != null ? 'Intervals.icu' : 'Withings'

    // ── Ore de recuperare recomandate după antrenamentul de azi ──────────────
    // Model: recuperarea scade progresiv pe măsură ce CTL (fitness cronic) crește —
    // organism mai antrenat = adaptare mai rapidă = recuperare mai scurtă.
    let recoveryHours = null
    if (workoutToday && workouts?.[0]) {
      const w0 = workouts[0]
      const rpe = w0.rpe_avg || 7
      const volT = (w0.volume_kg || 0) / 1000

      const iData = intervalsData?.latest || intervalsData?.today
      const ctl = iData?.ctl ?? trainingLoad?.ctl ?? null
      const tsb = iData?.tsb ?? trainingLoad?.tsb ?? null

      // 1. Baza: determinată de intensitate (RPE)
      const base = rpe >= 9 ? 48 : rpe >= 7.5 ? 40 : rpe >= 6 ? 32 : 24

      // 2. Volum bonus — seturi mari sau sesiuni lungi cer mai mult timp
      const volBonus = volT > 15 ? 8 : volT > 10 ? 4 : 0

      // 3. Factor CTL (fitness cronic) — inversul adaptării:
      //    CTL scăzut (< 30) = organism neadaptat → recuperare lungă
      //    CTL mediu (30-60) = adaptare parțială → reducere moderată
      //    CTL ridicat (60-80) = organism bine antrenat → reducere semnificativă
      //    CTL elite (> 80) = adaptare maximă → recuperare optimizată (-40% din baza)
      //    Reducerea maximă e limitată la 40% — recuperarea biologică minimă există indiferent
      let ctlFactor = 0
      if (ctl !== null) {
        if (ctl >= 80)      ctlFactor = 0.40  // -40% față de baza neadaptată
        else if (ctl >= 60) ctlFactor = 0.30  // -30%
        else if (ctl >= 45) ctlFactor = 0.20  // -20%
        else if (ctl >= 30) ctlFactor = 0.10  // -10%
        else                ctlFactor = 0.00  // fără reducere — organism neadaptat
      }
      const ctlReduction = Math.round(base * ctlFactor)

      // 4. TSB adjustment — oboseala acumulată cere mai mult timp de recuperare
      //    TSB pozitiv = proaspăt → fără penalizare
      //    TSB negativ = oboseală acumulată → recuperare mai lungă
      const tsbBonus = tsb !== null && tsb < -20 ? 8 : tsb !== null && tsb < -10 ? 4 : 0

      // 5. HRV adjustment — Polar H10 prioritar față de Intervals.icu
      const hrvAdj = displayHrv != null && intervalsHrvBaseline != null && displayHrv < intervalsHrvBaseline * 0.85 ? 4 : 0

      recoveryHours = Math.max(16, base + volBonus + tsbBonus + hrvAdj - ctlReduction)
      // Rotunjim la multiplu de 4h pentru lizibilitate
      recoveryHours = Math.round(recoveryHours / 4) * 4

      // Stocăm și CTL pentru afișare
      recoveryHours = { hours: recoveryHours, ctl, ctlFactor, base, ctlReduction }
    }

    setReadiness(r => ({
      ...r,
      score,
      recommendation_type: type,
      label: type === 'adapt' ? r.label : labels[type],
      desc: type === 'adapt' ? r.desc : (combinedSleep?.total_h ? `Somn ${combinedSleep.total_h.toFixed(1)}h (${sleepSrc}) · HRV ${hrvDisplay != null ? `${hrvDisplay}ms (${hrvSrc})` : '—'} · ${r.suggested_workout}${totalDepletion > 0 ? ` · −${totalDepletion}p energie consumată azi` : ''}${bbPenalty > 0 ? ` · 🔋 −${bbPenalty}p baterie scăzută` : ''}${pressurePenalty > 0 ? ` · ⚡ −${pressurePenalty}p presiune atmosferică` : ''}` : `Date somn indisponibile · ${r.suggested_workout}`),
      suggested_workout: type === 'adapt' ? r.suggested_workout : r.suggested_workout,
      recovery_hours: recoveryHours,  // {hours, ctl, ctlFactor, base, ctlReduction} | null
    }))
  }, [readiness.scores, withingsData, depletionTick, waterToday, weather, manualSleep, bodyBatteryCurrent?.current, intervalsData])

  // Injectează scorul HRV — Polar H10 are prioritate față de Intervals.icu și Withings
  useEffect(() => {
    if (displayHrv == null) return
    let hrvScore = null
    if (displayHrv >= 80) hrvScore = 95
    else if (displayHrv >= 60) hrvScore = 85
    else if (displayHrv >= 45) hrvScore = 72
    else if (displayHrv >= 35) hrvScore = 60
    else if (displayHrv >= 28) hrvScore = 48
    else if (displayHrv >= 20) hrvScore = 35
    else hrvScore = 20
    setReadiness(r => ({ ...r, scores: { ...r.scores, hrv: hrvScore } }))
  }, [intervalsHrv, polarHrv])

  // Auto-recalculează când se încarcă accidentările active
  useEffect(() => {
    if (activeInjuries.length > 0) {
      recalculateWithInjuries(activeInjuries)
    }
  }, [activeInjuries])

  function recalculateWithInjuries(injuriesList) {
    const { energy, sleep_quality, motivation, stress, soreness } = subj
    const subjScore = Math.round(((energy + sleep_quality + motivation + (11 - stress) + (11 - soreness)) / 5) * 10)
    const allText = (injuries + ' ' + injuriesList.map(i => i.description).join(' ')).toLowerCase()
    const hasInjury = injuriesList.length > 0 || allText.length > 3
    const hasKnee = allText.includes('genunchi') || allText.includes('menisc') || injuriesList.some(i => i.zone === 'knee')
    const hasShoulder = allText.includes('umar') || allText.includes('umăr') || injuriesList.some(i => i.zone === 'shoulder')
    const hasBack = allText.includes('spate') || allText.includes('lombar') || injuriesList.some(i => i.zone === 'back')
    let suggestedWorkout = recovery.suggestedDay || 'Antrenament adaptat'
    let recType = 'adapt'
    if (hasKnee) suggestedWorkout = 'Upper Body — evită exerciții pentru picioare'
    else if (hasShoulder) suggestedWorkout = 'Lower Body + Core — evită presă și tracțiuni'
    else if (hasBack) suggestedWorkout = 'Recuperare activă — fără încărcare pe coloană'
    else suggestedWorkout = 'Antrenament adaptat — evită zona afectată'
    setReadiness(r => ({ ...r, recommendation_type: recType, suggested_workout: suggestedWorkout, label: 'Antrenament adaptat — accidentare activă', desc: `Accidentare activă: ${injuriesList.map(i=>i.description).join(', ')}. Evită zona afectată.`, scores: { ...r.scores, subjective: subjScore } }))
  }

  function recalculate() {
    const { energy, sleep_quality, motivation, stress, soreness } = subj
    const subjScore = Math.round(((energy + sleep_quality + motivation + (11 - stress) + (11 - soreness)) / 5) * 10)
    // Combină accidentările din DB + inputul nou
    const allInjuryText = (injuries + ' ' + activeInjuries.map(i => i.description).join(' ')).toLowerCase()
    const hasInjury = activeInjuries.length > 0 || (allInjuryText.length > 3 && (allInjuryText.includes('durere') || allInjuryText.includes('accidentar') || allInjuryText.includes('menisc') || allInjuryText.includes('genunchi') || allInjuryText.includes('umăr') || allInjuryText.includes('spate') || allInjuryText.includes('tendon')))
    const injuryText = allInjuryText
    const hasKnee = injuryText.includes('genunchi') || injuryText.includes('menisc') || activeInjuries.some(i => i.zone === 'knee')
    const hasShoulder = injuryText.includes('umar') || injuryText.includes('umăr') || activeInjuries.some(i => i.zone === 'shoulder')
    const hasBack = injuryText.includes('spate') || injuryText.includes('lombar') || activeInjuries.some(i => i.zone === 'back')
    let suggestedWorkout = readiness.suggested_workout
    let recType = readiness.recommendation_type
    if (hasInjury) {
      recType = 'adapt'
      suggestedWorkout = hasKnee ? 'Upper Body — evită exerciții pentru picioare' : hasShoulder ? 'Lower Body + Core — evită presă și tracțiuni' : hasBack ? 'Recuperare activă — fără încărcare pe coloană' : 'Antrenament adaptat — evită zona afectată'
    }
    setReadiness(r => ({ ...r, recommendation_type: recType, suggested_workout: suggestedWorkout, label: hasInjury ? 'Antrenament adaptat — accidentare detectată' : r.label, desc: hasInjury ? `Accidentare: ${injuries}. Evită zona afectată.` : r.desc, scores: { ...r.scores, subjective: subjScore } }))
  }

  const now = new Date()
  const today = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
  // Ora live e gestionată de componenta <Clock/> (izolată) — nu mai stă în
  // state-ul Dashboard, deci tic-ul de minut nu mai redesenează toată pagina.

  // ── Helper: rulează estimarea AI micronutrienți (shared de auto-trigger și buton) ──
  const runMicroEstimate = React.useCallback(async (mealsArr) => {
    if (microAiLoading || mealsArr.length === 0) return
    setMicroAiLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const mealLines = mealsArr.map(m =>
        `${m.name || 'aliment'} (${m.calories||0}kcal, P${m.protein_g||0}g C${m.carbs_g||0}g G${m.fat_g||0}g)`
      ).join('; ')
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ textDescription: `Esti un nutritionist expert. Calculeaza totalul micronutrientilor pentru TOATE mesele de azi combinate: ${mealLines}.

REGULI STRICTE — respecta cu exactitate:
1. Returneaza UN SINGUR JSON cu sumele totale pentru toate mesele combinate.
2. Daca un micronutrient NU este prezent in niciun aliment din lista, valoarea TREBUIE sa fie 0. NU estima valori pozitive daca nu exista o sursa clara.
3. Antioxidantii de mai jos se gasesc DOAR in surse specifice — pune 0 daca nu exista acele surse:
   - beta_carotene_mcg: DOAR din morcovi, dovleac, ardei portocaliu/rosu, cartof dulce, spanac, kale. Cafea, lapte, latte, carne, oua, cereale = 0.
   - lycopene_mcg: DOAR din rosii, pasta de rosii, pepene rosu, grapefruit roz. Cafea, lapte, paine, carne = 0.
   - lutein_mcg: DOAR din spanac, kale, galbenus de ou, varza, broccoli. Cafea, lapte, carne, cereale = 0.
   - quercetin_mg: DOAR din ceapa (mai ales rosie), mere, capere, fructe de padure. Cafea, lapte, carne, orez = 0.
   - resveratrol_mg: DOAR din vin rosu, struguri rosii, afine, fructe de padure inchise la culoare. Cafea, lapte, carne = 0.
   - curcumin_mg: DOAR din turmeric/curcuma (condiment galben). Daca nu e explicit mentionat turmeric = 0.
4. Bauturi precum cafea, latte, cappuccino, ceai, lapte, suc de citrice contribuie 0 la antioxidantii de mai sus.
5. NU inventa valori. Fii conservator — este mai bine sa returnezi 0 decat o valoare incorecta.` })
      })
      const json = await res.json()
      if (json?.ok && json.result) {
        setMicroAiData({ totals: json.result, meals: null })
        setMicroAiError(null)
        await persistMicroToDb(json.result, mealsArr)
      } else {
        setMicroAiError(json?.error || `Estimarea AI a eșuat (status ${res.status})`)
      }
    } catch(e) { console.warn('micro auto-estimate error', e); setMicroAiError(e.message || 'Eroare rețea la estimare') }
    setMicroAiLoading(false)
  }, [microAiLoading, persistMicroToDb])

  // Auto-estimează micronutrienții — DOAR după ora 22:00 și MAXIM O DATĂ PE ZI.
  // Înainte de 22:00 nu se face niciun calcul automat. Butonul manual e activ tot după 22.
  useEffect(() => {
    if (tab !== 'nutrition') return
    if (microAiData !== null || microAiLoading || microAutoTriggered) return
    // Blocaj înainte de ora 22 — NU marcăm microAutoTriggered ca să reevaluăm mai târziu
    if (new Date().getHours() < 22) return
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayMeals = allMealEntries.filter(m => m.date === todayStr)
    if (todayMeals.length === 0) return
    // Deja date micro salvate azi → nu mai apela AI
    const hasExistingMicro = todayMeals.some(m =>
      (m.sugar_g > 0) || (m.sodium_mg > 0) || (m.vitamin_c_mg > 0)
    )
    if (hasExistingMicro) { setMicroAutoTriggered(true); return }
    // Gardă zilnică: un singur apel automat pe zi
    let lastAuto = null
    try { lastAuto = localStorage.getItem('forma_micro_auto_day') } catch (_) { /* ignore */ }
    if (lastAuto === todayStr) { setMicroAutoTriggered(true); return }
    try { localStorage.setItem('forma_micro_auto_day', todayStr) } catch (_) { /* ignore */ }
    setMicroAutoTriggered(true)
    runMicroEstimate(todayMeals)
  }, [tab, allMealEntries])
  // Notă: reestimarea la fiecare masă a fost eliminată. Calculul micro pornește
  // automat o dată/zi după ora 22, sau manual din buton (activ tot după 22).
  const badge = recBadge(readiness.recommendation_type, c)
  const lastWorkout = workouts[0]
  const body = withingsData.body

  // ── Stare subiectivă pe 3 ferestre (<16 / 16–21 / >21) ──
  // Scorul folosește mereu ultima intrare; afișarea din hero apare doar dacă
  // fereastra curentă are o intrare proaspătă.
  const currentSubjWindow = (() => { const h = new Date().getHours(); return h < 16 ? 'morning' : h < 21 ? 'afternoon' : 'evening' })()
  const subjWindowLabels = { morning: 'Dimineață', afternoon: 'După-amiază', evening: 'Seară' }
  const subjIsFresh = subjEntryWindow != null && subjEntryWindow === currentSubjWindow

  // ── Vârstă biologică calculată ────────────────────────────────────────────
  const bioAge = (() => {
    const sleepAvg = combinedSleep?.total_h
    return calcBioAge({
      age: userProfile?.age,
      hrRest: body?.hr_rest,
      hrvRmssd: intervalsHrv,
      pwv: body?.pwv,
      bpSys: body?.bp_sys ?? body?.systolic ?? null,
      bpDia: body?.bp_dia ?? body?.diastolic ?? null,
      fatPct: body?.fat_pct,
      weeklySteps: intervalsData?.days?.slice(-7).reduce((s, d) => s + (d.steps||0), 0) || 0,
      workoutsPerWeek: weeklyStats?.count,
      sleepAvg,
      gender: userProfile?.gender,
    })
  })()
  const protPerKg = nutrition?.protein_g && body?.weight_kg ? (nutrition.protein_g / body.weight_kg).toFixed(2) : nutrition?.protein_g ? (nutrition.protein_g / 80).toFixed(2) : null

  // ── Targeturi nutriționale pentru inelele de progres ──────────────────────

  // ── BMR calculat din biometrice (Mifflin-St Jeor) ──────────────────────────
  const bmrCalculated = useMemo(() => {
    const w = withingsQ.data?.body?.weight_kg || userProfile?.weight_kg
    const h = userProfile?.height_cm
    const a = userProfile?.age
    const g = userProfile?.gender || 'M'
    if (!w || !h || !a) return nutritionTargets.bmrDaily || 1800
    const base = 10 * w + 6.25 * h - 5 * a
    return Math.round(g === 'F' ? base - 161 : base + 5)
  }, [userProfile, withingsQ.data, nutritionTargets])

  // ── Calorii metabolism bazal arse până acum (proporțional cu ora din zi) ──
  const bmrSoFar = useMemo(() => {
    const nowHour = new Date().getHours() + new Date().getMinutes() / 60
    return Math.round((bmrCalculated / 24) * nowHour)
  }, [bmrCalculated])

  // ── Auto-sync greutate Withings → profiles (o dată pe zi) ───────────────────
  useEffect(() => {
    const withingsWeight = withingsQ.data?.body?.weight_kg
    if (!withingsWeight || !user?.id) return
    const today = new Date().toISOString().slice(0, 10)
    const syncKey = `forma-weight-sync-${user.id}-${today}`
    if (localStorage.getItem(syncKey)) return          // deja sincronizat azi
    const profileWeight = userProfile?.weight_kg
    if (profileWeight && Math.abs(withingsWeight - profileWeight) < 0.1) {
      localStorage.setItem(syncKey, '1')               // valorile sunt identice, marchez ca sinc
      return
    }
    ;(async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ weight_kg: withingsWeight })
          .eq('id', user.id)
        if (!error) {
          localStorage.setItem(syncKey, '1')
          qc.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) })
          console.log(`[FORMA] Greutate actualizată din Withings: ${withingsWeight} kg`)
        }
      } catch(e) { console.warn('weight sync error', e) }
    })()
  }, [withingsQ.data, user?.id, userProfile?.weight_kg])

  // ── Istoricul măsurătorilor HRV Polar H10 (Statistici / Sănătate) ───────────
  useEffect(() => {
    if (statsSubTab !== 'health' || !user?.id || polarHrvHistoryLoaded) return
    setPolarHrvHistoryLoaded(true)
    supabase.from('hrv_measurements')
      .select('measured_at,rmssd,sdnn,sd1,sd2,pnn50,lf_hf_ratio,stress_index,readiness_score,quality,duration_min,artifact_pct,rr_count,device_name')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(60)
      .then(({ data }) => { if (data) setPolarHrvHistory(data) })
  }, [statsSubTab, user?.id, polarHrvHistoryLoaded])

  // ── ECG — încarcă istoricul la montare ───────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    supabase.from('ecg_records')
      .select('id,uploaded_at,measured_at,device_brand,file_name,storage_path,status,result_label,result_color,result_summary,result_tags,bpm_avg')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setEcgRecords(data) })
  }, [user?.id])

  // ── ECG — handler upload + analiză AI ───────────────────────────────────
  const handleEcgUpload = useCallback(async (file) => {
    if (!file || !user?.id) return
    setEcgUploading(true)
    try {
      // 1. Upload PDF în Supabase Storage
      const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
      const { error: upErr } = await supabase.storage.from('ecg-files').upload(storagePath, file, { contentType: 'application/pdf' })
      if (upErr) throw upErr

      // 2. Insert record cu status=analyzing
      const { data: newRec, error: insErr } = await supabase.from('ecg_records').insert({
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        status: 'analyzing',
      }).select().single()
      if (insErr) throw insErr

      setEcgUploading(false)
      setEcgAnalyzing(true)

      // 3. Reîncarcă lista să apară "Se analizează..."
      setEcgRecords(prev => [{ ...newRec, status: 'analyzing' }, ...prev])

      // 4. Apelează edge function analyze-ecg
      const { data: result, error: fnErr } = await supabase.functions.invoke('analyze-ecg', {
        body: { record_id: newRec.id, storage_path: storagePath, user_id: user.id }
      })
      if (fnErr) throw fnErr

      // 5. Reîncarcă lista actualizată
      const { data: refreshed } = await supabase.from('ecg_records')
        .select('id,uploaded_at,measured_at,device_brand,file_name,storage_path,status,result_label,result_color,result_summary,result_tags,bpm_avg')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(50)
      if (refreshed) setEcgRecords(refreshed)
    } catch (err) {
      console.error('ECG upload error:', err)
      // Marchează ultimul record ca eroare
      setEcgRecords(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error', result_label: 'Eroare la analiză' } : r))
    } finally {
      setEcgUploading(false)
      setEcgAnalyzing(false)
      if (ecgFileRef.current) ecgFileRef.current.value = ''
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ECG — handler ștergere înregistrare ─────────────────────────────────
  const handleEcgDelete = useCallback(async (id, storagePath) => {
    if (!user?.id) return
    if (!window.confirm('Ștergi această înregistrare ECG? Acțiunea nu poate fi anulată.')) return
    try {
      // Șterge fișierul PDF din Storage
      if (storagePath) {
        await supabase.storage.from('ecg-files').remove([storagePath])
      }
      // Șterge înregistrarea din DB
      await supabase.from('ecg_records').delete().eq('id', id).eq('user_id', user.id)
      // Actualizează state-ul local
      setEcgRecords(prev => prev.filter(r => r.id !== id))
      if (ecgExpandedId === id) setEcgExpandedId(null)
    } catch (err) {
      console.error('ECG delete error:', err)
      alert('Eroare la ștergere. Încearcă din nou.')
    }
  }, [user?.id, ecgExpandedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── VO2max — formula Uth-Sørensen-Overgaard-Pedersen: VO2max = 15.3 × (HRmax / HRrest) ──
  const vo2max = (() => {
    const hrRest = body?.hr_rest
    const age = userProfile?.age
    // HRmax măsurat azi (dacă disponibil) e mai precis decât formula teoretică 220-vârstă
    const hrMaxMeasured = intervalsData?.todayActivities?.[0]?.hr_max || intervalsData?.today?.hr_rest
    const hrMaxTheoretical = age ? 220 - age : null
    const hrMax = (hrMaxMeasured && hrMaxMeasured > 100) ? hrMaxMeasured : hrMaxTheoretical

    if (hrRest && hrMax && hrRest > 30) {
      const value = Math.round(15.3 * (hrMax / hrRest) * 10) / 10
      return { value, hrMax, hrRest, hrMaxIsMeasured: hrMaxMeasured > 100 }
    }

    return null
  })()

  // ── Nivel de fitness — combină activitate zilnică, frecvență antrenamente, HR de repaus ──
  // ── Liste detaliate pentru cardurile interactive din acordion Antrenament ──
  const weeklyWorkouts = (() => {
    const cutoff = new Date(Date.now() - 7 * 86400000)
    return workouts.filter(w => w.date && new Date(w.date) >= cutoff)
  })()

  const weeklyPRs = (() => {
    const prs = []
    weeklyWorkouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        (ex.sets || []).forEach(set => {
          if (set.is_pr) prs.push({ workoutTitle: w.title, workoutDate: w.date, exerciseName: ex.name, weight_kg: set.weight_kg, reps: set.reps })
        })
      })
    })
    return prs
  })()

  // ── Durată medie estimată (din durata Hevy dacă există, altfel din nr. seturi × 2.8 min/set) ──
  // Formulă identică cu cea din WorkoutHistoryCard (WorkoutPage.jsx), pentru consistență.
  const avgDurationEstimated = (() => {
    if (weeklyWorkouts.length === 0) return { value: 0, isEstimated: false }
    const estimates = weeklyWorkouts.map(w => estimateWorkoutDuration(w))
    const avg = Math.round(estimates.reduce((s, e) => s + e.value, 0) / estimates.length)
    const anyEstimated = estimates.some(e => e.isEstimated)
    return { value: avg, isEstimated: anyEstimated }
  })()

  const fitnessLevel = (() => {
    const avgSteps = (() => { const d7 = intervalsData?.days?.slice(-7)||[]; return d7.length ? Math.round(d7.reduce((s,d)=>s+(d.steps||0),0)/d7.length) : 0 })()
    const workoutsPerWeek = weeklyStats?.count || 0
    const hrRest = body?.hr_rest

    let score = 0
    // Pași medii/zi (0-40 puncte)
    if (avgSteps >= 12000) score += 40
    else if (avgSteps >= 9000) score += 32
    else if (avgSteps >= 6000) score += 22
    else if (avgSteps >= 3000) score += 12
    else score += 4

    // Antrenamente/săptămână (0-35 puncte)
    if (workoutsPerWeek >= 5) score += 35
    else if (workoutsPerWeek >= 3) score += 27
    else if (workoutsPerWeek >= 1) score += 15
    else score += 3

    // HR de repaus — indicator de condiție cardiovasculară (0-25 puncte)
    if (hrRest) {
      if (hrRest < 55) score += 25
      else if (hrRest < 62) score += 19
      else if (hrRest < 70) score += 12
      else if (hrRest < 78) score += 6
      else score += 2
    } else {
      score += 12 // valoare neutră dacă lipsește HR
    }

    let label, color
    if (score >= 80) { label = 'Atlet'; color = c.green }
    else if (score >= 60) { label = 'Activ'; color = c.green }
    else if (score >= 38) { label = 'Moderat'; color = c.orange }
    else { label = 'Sedentar'; color = c.red }

    return { score, label, color }
  })()

  // Stiluri responsive
  // ── Constante de spacing — folosite uniform în tot dashboardul ──
  const CARD_GAP = '0.875rem'   // spațiu între carduri
  const GRID_GAP = 8            // gap în px pentru griduri

  const grid4 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: GRID_GAP, marginBottom: CARD_GAP }
  const grid2 = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: GRID_GAP + 2, marginBottom: CARD_GAP }

  // ── Gradient background pentru tab 'today' bazat pe scorul de readiness ──
  const _todayGradBg = (() => {
    if (tab === 'sleep') {
      return isDark
        ? `linear-gradient(to bottom,#060D1A 0%,#0A1628 18%,#0F2044 38%,#1A3560 55%,${c.bg} 78%,${c.bg} 100%)`
        : `linear-gradient(to bottom,#060D1A 0%,#0A1628 15%,#0F2044 34%,#1A3560 50%,#2B5A9E 62%,#5B8FD4 72%,#A8C8F0 82%,${c.bg} 100%)`
    }
    if (tab === 'activitate') {
      return isDark
        ? 'linear-gradient(to bottom, #14532d 0%, #166534 40%, #4ade80 75%, #e8f5e9 100%)'
        : 'linear-gradient(to bottom, #052e16 0%, #166534 35%, #15803d 65%, #22c55e 100%)'
    }
    if (tab === 'nutrition') {
      return 'linear-gradient(to bottom, #451a03 0%, #92400e 30%, #d97706 68%, #fdf4dc 100%)'
    }
    if (tab === 'history') {
      return 'linear-gradient(to bottom, #1e1035 0%, #3b0764 22%, #7c3aed 52%, #f0e8fd 100%)'
    }
    if (tab !== 'today') return c.bg
    const sc = readiness.score || 0
    const light = sc >= 70 ? '#EEF8E6' : sc >= 50 ? '#FEF3E2' : '#FEF0F0'
    const dark  = sc >= 70 ? '#162410' : sc >= 50 ? '#2D1D06' : '#2A0F0F'
    const col = isDark ? dark : light
    return `linear-gradient(to bottom, ${col} 0%, ${col} 30%, ${c.bg} 52%)`
  })()

  const s = useMemo(() => ({
    page:    { minHeight: '100vh', background: _todayGradBg, padding: isMobile ? '0.75rem' : '1rem', paddingBottom: isMobile ? '5.5rem' : '1rem', fontFamily: c.fontFamily, maxWidth: 860, margin: '0 auto', boxSizing: 'border-box', overflowX: 'hidden' },
    header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: (tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'none' : `0.5px solid ${c.border2}` },
    card:    { background: c.card, borderRadius: c.radius, padding: isMobile ? '1rem' : '1.25rem', marginBottom: CARD_GAP, boxShadow: c.shadowCard },
    heroCard:{ background: c.card, borderRadius: c.radius, padding: isMobile ? '1rem' : '1.25rem', marginBottom: CARD_GAP, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.9rem' : '1.5rem', alignItems: 'flex-start', boxShadow: c.shadowHero },
    tabRow:  { display: 'flex', gap: 4, marginBottom: CARD_GAP, background: c.card, padding: 5, borderRadius: c.radiusSm, overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: c.shadowCard },
    tab:     { padding: isMobile ? '6px 10px' : '7px 12px', fontSize: isMobile ? 11 : 12, borderRadius: 7, cursor: 'pointer', color: c.text3, border: 'none', background: 'transparent', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 },
    tabActive: { background: c.card3, color: c.text, fontWeight: 600 },
    sectionLabel: { fontSize: 11, fontWeight: 600, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.85rem' },
    primaryBtn: { width: '100%', padding: '13px', background: c.gradGreen, border: 'none', borderRadius: c.radiusSm, color: '#16291A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: c.shadowGlow(c.green) },
  }), [c, isMobile, tab, _todayGradBg, CARD_GAP])

  function renderWidget(id) {
    switch (id) {
      case 'aicoach': {
        if (AI_COACH_DISABLED) return null   // briefing dimineață/seară dezactivat (economie AI)
        // Construiește fastingData din ultimele mese pentru AICoach
        const fastingDataForCoach = (() => {
          if (!allMealEntries || allMealEntries.length === 0) return []
          const sorted = [...allMealEntries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          const lastEntry = sorted[0]
          if (!lastEntry?.created_at) return []
          const elapsed = (Date.now() - new Date(lastEntry.created_at).getTime()) / 3600000
          return [{ startedAt: lastEntry.created_at, endedAt: null, date: lastEntry.date, hours: elapsed }]
        })()
        return <AICoach user={user} data={{ sleep: combinedSleep, body, workouts, nutrition, nutritionYesterday, profile: userProfile, readiness, gender: userProfile?.gender || 'M', injuries: activeInjuries, waterToday, weather, intervalsData, bioAge, bodyBattery: bodyBatteryCurrent, fastingData: fastingDataForCoach }} c={c} isMobile={isMobile} />
      }

      case 'aichat':
        if (AI_COACH_DISABLED) return null   // chat AI dezactivat (economie AI)
        return <AICoachChat user={user} data={{ sleep: combinedSleep, body, workouts, nutrition, profile: userProfile, readiness, injuries: activeInjuries, waterToday, weather, intervalsData }} c={c} isMobile={isMobile} />

      case 'hero': {
        // ── Hero section — date locale ──
        const heroHour = new Date().getHours()
        const heroGreeting = heroHour < 12 ? t('Bună dimineața') : heroHour < 18 ? t('Bună ziua') : t('Bună seara')
        const heroFirstName = userName?.split(' ')[0] || ''
        const heroDateRo = new Date().toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
        const heroScore = readiness.score || 0
        const heroColor = heroScore >= 70 ? c.green : heroScore >= 50 ? c.orange : c.red
        const heroBg = isDark
          ? heroScore >= 70
            ? 'linear-gradient(145deg,#1e2a1a 0%,#252932 65%,#1A1D23 100%)'
            : heroScore >= 50
            ? 'linear-gradient(145deg,#2a2010 0%,#252932 65%,#1A1D23 100%)'
            : 'linear-gradient(145deg,#2a1a1a 0%,#252932 65%,#1A1D23 100%)'
          : heroScore >= 70
            ? 'linear-gradient(145deg,#eef8e6 0%,#ffffff 65%,#F4F6F9 100%)'
            : heroScore >= 50
            ? 'linear-gradient(145deg,#fef7e8 0%,#ffffff 65%,#F4F6F9 100%)'
            : 'linear-gradient(145deg,#fef0f0 0%,#ffffff 65%,#F4F6F9 100%)'
        const heroSleep = combinedSleep?.total_h ? `${combinedSleep.total_h.toFixed(1)}h` : '—'
        const heroSteps = intervalsData?.today?.steps
          ? intervalsData.today.steps >= 1000
            ? `${(intervalsData.today.steps / 1000).toFixed(1)}k`
            : String(intervalsData.today.steps)
          : '—'
        const heroKcal = nutrition?.calories ? nutrition.calories.toLocaleString() : '—'
        const heroHrvRaw = intervalsData?.today?.hrv
        const heroHrv = heroHrvRaw ? `${Math.round(heroHrvRaw)}ms` : readiness.scores.hrv ? String(readiness.scores.hrv) : '—'
        const heroInsight = (() => {
          const days = (intervalsData?.days || []).filter(d => d.readiness && d.sleep_hours).slice(-30)
          if (days.length >= 5) {
            const tgt = userProfile?.target_sleep_hours || 7.5
            const good = days.filter(d => d.sleep_hours >= tgt)
            const poor = days.filter(d => d.sleep_hours < tgt)
            if (good.length >= 2 && poor.length >= 2) {
              const avgG = Math.round(good.reduce((a,d) => a + d.readiness, 0) / good.length)
              const avgP = Math.round(poor.reduce((a,d) => a + d.readiness, 0) / poor.length)
              const diff = avgG - avgP
              if (Math.abs(diff) >= 5) return lang === 'en'
                ? `When you sleep ≥${tgt}h, your readiness is ${Math.abs(diff)}pt ${diff > 0 ? 'higher' : 'lower'}.`
                : `Când dormi ≥${tgt}h, readiness-ul tău e cu ${Math.abs(diff)}pt ${diff > 0 ? 'mai mare' : 'mai mic'}.`
            }
          }
          if (heroScore >= 70) return `Condiție bună — antrenament moderat-intens recomandat.`
          if (heroScore >= 50) return `Recuperare activă recomandată azi.`
          return `Prioritizează somnul și hidratarea azi.`
        })()
        // Persistăm scorul de dimineață
        saveVitalityScore(heroScore)

        return (
          <>
            {/* ── HERO — blended cu gradientul paginii, fără card wrapper ── */}
            <div style={{ marginBottom: CARD_GAP, paddingBottom: 4 }}>
              {/* Ring (144px, gradient conic) + coloana text cu salut în top */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
                {/* Ring animat canvas */}
                <VitalityRingWidget score={heroScore} isDark={isDark}/>
                {/* Coloana text — salut la top, vitalitate dedesubt */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Salut — mutat aici, la dreapta cercului */}
                  <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: isDark ? 'rgba(253,230,138,0.75)' : `${heroColor}cc`, letterSpacing: '0.01em', lineHeight: 1.2 }}>
                    {heroGreeting}{heroFirstName ? `, ${heroFirstName}` : ''}
                  </div>
                  {/* Text: Vitalitate · etichetă calitativă · recomandare */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: isDark ? 'rgba(253,230,138,0.45)' : `${heroColor}99`, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{t('Vitalitate')}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: heroColor, lineHeight: 1, marginBottom: 5 }}>
                      {heroScore >= 85 ? t('Excelent') : heroScore >= 70 ? t('Bun') : heroScore >= 50 ? t('Acceptabil') : heroScore >= 30 ? t('Obosit') : heroScore > 0 ? t('Epuizat') : '—'}
                    </div>
                    <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: isDark ? '#FDE68A' : c.text, lineHeight: 1.25, marginBottom: 3 }}>
                      {t(readiness.label) || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? 'rgba(253,230,138,0.65)' : c.text3, lineHeight: 1.4 }}>
                      {t(readiness.suggested_workout) || ''}
                    </div>
                  </div>
                </div>
              </div>
              {/* Pills: somn / pași / kcal / hrv */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                {[
                  { label: 'Somn',  value: heroSleep, color: c.purple },
                  { label: 'Pași',  value: heroSteps, color: c.blue },
                  { label: 'Kcal',  value: heroKcal,  color: c.orange },
                  { label: 'HRV',   value: heroHrv,   color: heroColor },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.65)', borderRadius: 8, padding: '6px 4px', textAlign: 'center', border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)'}` }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, margin: '0 auto 3px' }}/>
                    <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 8, color: isDark ? 'rgba(253,230,138,0.4)' : c.text4, marginTop: 2 }}>{t(label)}</div>
                  </div>
                ))}
              </div>
              {/* Insight — fără card, just text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                <span style={{ fontSize: 12 }}>💡</span>
                <span style={{ fontSize: 10, color: isDark ? 'rgba(253,230,138,0.8)' : heroColor, lineHeight: 1.4 }}>{t(heroInsight)}</span>
              </div>
            </div>

            {/* ── Sub-scoruri + apă + body battery ── */}
            <div style={{ ...s.card, marginBottom: CARD_GAP }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                {[['Somn', readiness.scores.sleep, (readiness.scores.sleep||0)>=70], ['Recuperare', readiness.scores.recovery, (readiness.scores.recovery||0)>=65], ['Subiectiv', subjIsFresh ? readiness.scores.subjective : null, subjIsFresh && readiness.scores.subjective ? readiness.scores.subjective>=65 : null], ['HRV', readiness.scores.hrv, (readiness.scores.hrv||0)>=65], ['Nutriție', readiness.scores.nutrition, (readiness.scores.nutrition||0)>=65], ['Sănătate', readiness.scores.health, readiness.scores.health ? readiness.scores.health>=65 : null]].map(([label, val, pos]) => {
                  const _barColors = { 'Somn': '#4A9EE8', 'Subiectiv': '#BA7517', 'Nutriție': '#3B6D11', 'Recuperare': '#3B6D11', 'HRV': '#BA7517', 'Sănătate': '#3B6D11' }
                  const _barColor = _barColors[label] || c.green2
                  const _navClick = label === 'Recuperare' ? () => setShowRecoveryModal(true)
                    : label === 'Somn'     ? () => setTab('sleep')
                    : label === 'Subiectiv' ? () => setTab('today')
                    : label === 'Nutriție' ? () => setTab('nutrition')
                    : label === 'Sănătate' ? () => { window.location.href = '/health' }
                    : undefined
                  const _clickable = !!_navClick
                  return (
                  <div key={label}
                    onClick={_navClick}
                    style={{ display: 'flex', flexDirection: 'column', fontSize: 12, color: c.text3, cursor: _clickable ? 'pointer' : 'default', borderRadius: 6, padding: '2px 4px', transition: 'background 0.15s' }}
                    onMouseEnter={_clickable ? e => e.currentTarget.style.background = c.card2 : undefined}
                    onMouseLeave={_clickable ? e => e.currentTarget.style.background = 'transparent' : undefined}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: val === null ? c.border : pos ? c.green2 : c.orange, flexShrink: 0 }}/>
                      {t(label)}: <span style={{ color: val === null ? c.text4 : c.text, fontWeight: 500 }}>{val !== null ? val : '—'}</span>
                      {_clickable && <span style={{ fontSize: 9, color: c.text4, marginLeft: 1 }}>›</span>}
                    </div>
                    <div style={{ height: '2.5px', background: isDark ? 'rgba(255,255,255,0.08)' : '#EDE6DB', borderRadius: '2px', overflow: 'hidden', marginTop: '4px', marginLeft: '12px' }}>
                      <div style={{ height: '100%', width: `${val ?? 0}%`, background: _barColor, borderRadius: '2px', transition: 'width 1.1s ease' }} />
                    </div>
                  </div>
                  )
                })}
              </div>
              {/* Apă */}
              {(() => {
                const yWater = waterToday.yesterday_ml || 0
                const pct = waterTarget ? yWater / waterTarget : 0
                const delta = pct >= 0.8 ? 3 : pct < 0.4 ? -5 : 0
                const mlText = `${Math.round(yWater / 100) / 10}L / ${Math.round(waterTarget / 100) / 10}L`
                const col = delta > 0 ? c.green2 : delta < 0 ? c.orange : c.text4
                const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '●'
                return (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: c.text4 }}>
                      <span>💧</span><span>{t('Apă (ieri)')}:</span>
                      <span style={{ color: c.text3 }}>{mlText}</span>
                      <span style={{ color: col, fontWeight: 700, marginLeft: 2 }}>{arrow} {delta > 0 ? `+${delta}p` : delta < 0 ? `${delta}p` : 'neutru'}</span>
                    </div>
                    <div style={{ height: '2.5px', background: isDark ? 'rgba(255,255,255,0.08)' : '#EDE6DB', borderRadius: '2px', overflow: 'hidden', marginTop: '4px', marginLeft: '18px' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.round(pct * 100))}%`, background: '#4A9EE8', borderRadius: '2px', transition: 'width 1.1s ease' }} />
                    </div>
                  </div>
                )
              })()}
              {/* Body Battery + Recuperare */}
              {(bodyBatteryCurrent?.current != null || readiness.recovery_hours?.hours) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {bodyBatteryCurrent?.current != null && (() => {
                    const bb = bodyBatteryCurrent.current
                    const bbColor = bb >= 60 ? c.green : bb >= 30 ? c.orange : c.red
                    return (
                      <div style={{ fontSize: 11, marginBottom: 2, width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.text4 }}>
                          <span>🔋</span><span>Body Battery:</span>
                          <span style={{ color: bbColor, fontWeight: 700 }}>{bb}%</span>
                          {bb < 40 && <span style={{ color: c.text4, marginLeft: 2 }}>· −{bb < 20 ? 10 : bb < 30 ? 7 : bb < 40 ? 4 : 2}p readiness</span>}
                        </div>
                        <div style={{ height: '2.5px', background: isDark ? 'rgba(255,255,255,0.08)' : '#EDE6DB', borderRadius: '2px', overflow: 'hidden', marginTop: '4px', marginLeft: '18px' }}>
                          <div style={{ height: '100%', width: `${bb}%`, background: '#97C459', borderRadius: '2px', transition: 'width 1.1s ease' }} />
                        </div>
                      </div>
                    )
                  })()}
                  {readiness.recovery_hours?.hours && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: isDark ? '#2A1A0A' : '#FFF3D8', borderRadius: 8, padding: '4px 10px', border: `0.5px solid ${c.orange}44`, flexWrap: 'wrap' }}>
                      <span>⏱️</span>
                      <span style={{ color: c.orange, fontWeight: 600 }}>Recuperare: {readiness.recovery_hours.hours}h</span>
                      {readiness.recovery_hours.ctl != null && (
                        <span style={{ color: c.text4, fontSize: 10 }}>· CTL {Math.round(readiness.recovery_hours.ctl)} → −{Math.round(readiness.recovery_hours.ctlReduction)}h față de debut</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </>
        )
      }
      // ── Statistici rapide — identice cu cardurile din tab-ul Activitate ──
      case 'qsteps':
        return (
          <MetricCard label={'Pași azi'} icon="👟"
            value={(intervalsData?.today?.steps || 0).toLocaleString() || '—'}
            delta={userProfile?.target_steps ? `${t('țintă')} ${userProfile.target_steps.toLocaleString()}` : intervalsData?.today?.steps >= 10000 ? '✓ 10k' : ''}
            deltaPos={(intervalsData?.today?.steps || 0) >= (userProfile?.target_steps || 10000)} c={c}
            ringPct={intervalsData?.today?.steps && userProfile?.target_steps ? Math.round((intervalsData.today.steps / userProfile.target_steps) * 100) : null}
            ringColor={c.green}
            onClick={() => { setTab('activitate'); }}/>
        )

      case 'qsleep':
        return (
          <MetricCard label={'Somn'} icon="😴"
            value={combinedSleep?.total_h ? `${combinedSleep.total_h.toFixed(1)}h` : '—'}
            delta={combinedSleep ? `${t('Scor')} ${readiness.scores.sleep || '—'}/100` : 'lipsă'}
            deltaPos={combinedSleep?.total_h >= 7} c={c}
            onClick={() => setTab('sleep')}/>
        )

      case 'qweight': {
        const nowHourQ = new Date().getHours()
        const todayStrQ = new Date().toISOString().slice(0, 10)
        const todayWQ = intervalsData?.today?.weight_kg
        const daysQ = intervalsData?.days || []
        const idxQ = daysQ.findIndex(x => x.date === todayStrQ)
        const yestWQ = idxQ > 0 ? daysQ[idxQ - 1]?.weight_kg : null
        const weightKg = body?.weight_kg ?? (todayWQ ?? (nowHourQ < 11 ? yestWQ : null))
        const weightSrc = body?.weight_kg ? 'Withings' : todayWQ ? 'Intervals.icu' : (nowHourQ < 11 && yestWQ) ? 'Intervals.icu · ieri' : null
        const target = userProfile?.target_weight_kg
        return (
          <MetricCard label={'Greutate'} icon="⚖️"
            value={weightKg ? `${weightKg}` : '—'} unit={weightKg ? 'kg' : ''}
            delta={target ? (weightKg ? `${t('țintă')} ${target}kg (${weightKg > target ? '−' : '+'}${Math.abs(weightKg - target).toFixed(1)}kg)` : `${t('țintă')} ${target}kg`) : (body?.fat_pct ? `${body.fat_pct}% ${t('grăsime')}` : weightSrc || 'Withings')}
            deltaPos={target && weightKg ? Math.abs(weightKg - target) < 1 : null} c={c}
            onClick={() => { setTab('history'); setStatsSubTab('corp') }}/>
        )
      }

      case 'qworkouts': {
        return (
          <MetricCard label={'Antrenamente'} icon="💪"
            value={weeklyStats.count} unit="/săpt"
            delta={`${weeklyStats.prs} ${t('PR-uri')} · ${weeklyStats.volume ? (weeklyStats.volume/1000).toFixed(1) + 't' : ''}`}
            deltaPos={weeklyStats.prs > 0} c={c}
            onClick={() => window.location.href='/workout'}/>
        )
      }

      case 'qctl': {
        const ictd2 = intervalsData?.latest || intervalsData?.today
        const hasI2 = ictd2?.ctl != null
        const ctl2 = hasI2 ? ictd2.ctl : trainingLoad?.ctl
        const tsb2 = hasI2 ? ictd2.tsb : trainingLoad?.tsb
        const src2 = hasI2 ? 'Intervals.icu' : 'estimat'
        return (
          <MetricCard label={'Fitness (CTL)'} icon="📈"
            value={ctl2 != null ? Math.round(ctl2) : '—'}
            delta={tsb2 != null ? (tsb2 > 5 ? `✓ ${t('proaspăt')} TSB +${Math.round(tsb2)}` : tsb2 < -10 ? `⚠ ${t('oboseală')} TSB ${Math.round(tsb2)}` : `${t('echilibrat')} TSB ${Math.round(tsb2)}`) + ` · ${src2}` : src2}
            deltaPos={tsb2 != null ? tsb2 >= -10 : null} c={c}
            onClick={() => setTab('activitate')}/>
        )
      }

      case 'qcalconsumed': {
        const cal = nutrition?.calories || 0
        const tgtCal = nutritionTargets.calories || 2000
        const pct = cal ? Math.min(100, Math.round((cal / tgtCal) * 100)) : null
        const proto = nutrition?.protein_g || 0
        return (
          <MetricCard label={'Calorii'} icon="🍽️"
            value={cal ? cal.toLocaleString() : '—'}
            unit={cal ? 'kcal' : ''}
            delta={cal ? `${proto}g ${t('proteină')} · ${t('țintă')} ${tgtCal}` : 'nicio masă logată azi'}
            deltaPos={cal ? cal >= tgtCal * 0.7 && cal <= tgtCal * 1.1 : null}
            ringPct={pct}
            ringColor={c.green2} c={c}
            onClick={() => window.location.href = '/nutrition'}/>
        )
      }

      // Compatibilitate cu layout-uri vechi salvate
      case 'quickstats':
        return (
          <div style={grid4}>
            {renderWidget('qsteps')}
            {renderWidget('qsleep')}
            {renderWidget('qweight')}
            {renderWidget('qworkouts')}
          </div>
        )

            case 'macros': {
        const cal   = nutrition?.calories   || 0
        const prot  = nutrition?.protein_g  || 0
        const carbs = nutrition?.carbs_g    || 0
        const fat   = nutrition?.fat_g      || 0
        const fiber = nutrition?.fiber_g    || 0
        const tCal  = nutritionTargets.calories  || 2000
        const tProt = nutritionTargets.protein_g || 160
        const tCarb = nutritionTargets.carbs_g   || 200
        const tFat  = nutritionTargets.fat_g     || 70
        const tFib  = 30

        // Donut
        const total = prot * 4 + carbs * 4 + fat * 9
        const R = 36, C = 2 * Math.PI * R
        const protLen  = total > 0 ? (prot  * 4 / total) * C : 0
        const carbsLen = total > 0 ? (carbs * 4 / total) * C : 0
        const fatLen   = total > 0 ? (fat   * 9 / total) * C : 0

        const macros = [
          { label: 'Calorii', val: Math.round(cal),  target: tCal,  unit: 'kcal', color: c.green,  pct: tCal  ? Math.min(100, Math.round(cal  / tCal  * 100)) : 0 },
          { label: 'Proteine',  val: Math.round(prot), target: tProt, unit: 'g',    color: '#97C459', pct: tProt ? Math.min(100, Math.round(prot / tProt * 100)) : 0 },
          { label: 'Carbohidrați', val: Math.round(carbs),target: tCarb, unit: 'g', color: '#4A7EB5', pct: tCarb ? Math.min(100, Math.round(carbs/ tCarb * 100)) : 0 },
          { label: 'Grăsimi',   val: Math.round(fat),  target: tFat,  unit: 'g',    color: '#F0A830', pct: tFat  ? Math.min(100, Math.round(fat  / tFat  * 100)) : 0 },
          { label: 'Fibre',     val: Math.round(fiber),target: tFib,  unit: 'g',    color: c.orange,  pct: tFib  ? Math.min(100, Math.round(fiber/ tFib  * 100)) : 0 },
        ]

        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={s.sectionLabel}>📊 {t('Distribuție macronutrienți')}</div>
              <div style={{ fontSize: 11, color: c.text4, cursor: 'pointer' }} onClick={() => setTab('nutrition')}>→ {t('detalii')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Donut */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <svg width="90" height="90" viewBox="0 0 90 90">
                  <circle cx="45" cy="45" r={R} fill="none" stroke={c.card2} strokeWidth="11"/>
                  <circle cx="45" cy="45" r={R} fill="none" stroke="#97C459" strokeWidth="11"
                    strokeDasharray={`${protLen} ${C}`} strokeDashoffset={C * 0.25}
                    strokeLinecap="butt" transform="rotate(-90 45 45)"/>
                  <circle cx="45" cy="45" r={R} fill="none" stroke="#4A7EB5" strokeWidth="11"
                    strokeDasharray={`${carbsLen} ${C}`} strokeDashoffset={C * 0.25 - protLen}
                    strokeLinecap="butt" transform="rotate(-90 45 45)"/>
                  <circle cx="45" cy="45" r={R} fill="none" stroke="#F0A830" strokeWidth="11"
                    strokeDasharray={`${fatLen} ${C}`} strokeDashoffset={C * 0.25 - protLen - carbsLen}
                    strokeLinecap="butt" transform="rotate(-90 45 45)"/>
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: cal > tCal ? c.red : c.text }}>{Math.round(cal)}</div>
                  <div style={{ fontSize: 8, color: c.text4 }}>kcal</div>
                </div>
              </div>
              {/* Bare */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {macros.map(m => (
                  <div key={m.label} style={{ marginBottom: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: c.text4, marginBottom: 2 }}>
                      <span style={{ color: c.text3 }}>{t(m.label)}</span>
                      <span style={{ color: m.pct >= 100 ? m.color : c.text4 }}>
                        {m.val}{m.unit} <span style={{ color: m.pct >= 90 ? m.color : c.text4 }}>/ {m.target}{m.unit}</span>
                      </span>
                    </div>
                    <div style={{ height: 5, background: c.card2, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 3, transition: 'width 0.6s ease' }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }

      case 'subjective':
        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={s.sectionLabel}>{t('Stare subiectivă')} · {t(subjWindowLabels[currentSubjWindow])}</div>
              {subjIsFresh
                ? <span style={{ fontSize: 10, color: c.green2, fontWeight: 600 }}>✓ {t('introdusă')}</span>
                : <span style={{ fontSize: 10, color: c.orange, fontWeight: 600 }}>{t('fereastră nouă')}</span>}
            </div>
            {!subjIsFresh && (
              <div style={{ fontSize: 11, color: c.text4, marginBottom: 10, lineHeight: 1.5 }}>
                {subjEntryWindow
                  ? `Ai introdus starea ${subjWindowLabels[subjEntryWindow]?.toLowerCase()}. Adaugă din nou pentru ${subjWindowLabels[currentSubjWindow]?.toLowerCase()} sau lasă valabilă ultima intrare.`
                  : `Adaugă starea pentru ${subjWindowLabels[currentSubjWindow]?.toLowerCase()}.`}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 10 : 12, marginBottom: 12 }}>
              {[['energy','Energie'],['sleep_quality','Calitate somn'],['motivation','Motivație'],['stress','Stres (1=minim)'],['soreness','Dureri musculare']].map(([key, label]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: c.text3, marginBottom: 4 }}>
                    <span>{t(label)}</span><span style={{ color: c.text, fontWeight: 600 }}>{subj[key]}</span>
                  </div>
                  <input type="range" min="1" max="10" value={subj[key]}
                    onChange={e => setSubj(p => ({ ...p, [key]: parseInt(e.target.value) }))}
                    style={{ width: '100%', accentColor: c.green2 }}/>
                </div>
              ))}
            </div>
            {activeInjuries.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: c.red, fontWeight: 600, marginBottom: 6 }}>⚠ {t('Accidentări active')}</div>
                {activeInjuries.map(inj => (
                  <div key={inj.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#2E1416', borderRadius: c.radiusSm, padding: '10px 12px', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: '#F09595', flex: 1 }}>
                      {inj.zone === 'knee' ? '🦵' : inj.zone === 'shoulder' ? '💪' : inj.zone === 'back' ? '🔙' : '⚠️'} {inj.description}
                      <span style={{ fontSize: 10, color: c.text4, marginLeft: 6 }}>{t('din')} {inj.started_at}</span>
                    </span>
                    <button onClick={() => resolveInjury(inj.id)}
                      style={{ fontSize: 11, padding: '4px 10px', background: c.card3, border: 'none', borderRadius: 10, color: c.text3, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      ✓ {t('Rezolvat')}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: c.text3, marginBottom: 5 }}>{t('Dureri / accidentări noi')}</div>
              <textarea value={injuries} onChange={e => setInjuries(e.target.value)}
                placeholder={t('ex: durere ușoară genunchi stâng...')}
                style={{ width: '100%', background: c.card2, border: 'none', borderRadius: c.radiusSm, color: c.text, fontSize: 13, padding: '10px 12px', fontFamily: 'inherit', resize: 'none', minHeight: 54 }}/>
            </div>
            <button onClick={recalculateAndSave} style={{ ...s.primaryBtn, background: subjSaved ? c.green3 : c.green2, color: subjSaved ? c.green : '#fff' }}>
              {subjSaved ? t('✓ Salvat & recalculat') : t('Salvează & recalculează readiness ↗')}
            </button>
          </div>
        )

      case 'bioage':
        if (bioAge === null || !userProfile?.age) return null
        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.sectionLabel}>{t('Vârstă Biologică')}</div>
              <div style={{ fontSize: 11, color: c.text4 }}>{t('vs. vârsta reală')} {userProfile.age}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: bioAge < userProfile.age ? c.green : bioAge > userProfile.age + 2 ? c.red : c.text }}>{bioAge}</div>
                <div style={{ fontSize: 11, color: c.text4 }}>{t('ani biologici')}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: c.text2, lineHeight: 1.6 }}>
                  {(() => {
                    const L = lang === 'en'
                    const dY = (userProfile.age - bioAge).toFixed(1)
                    const dO = (bioAge - userProfile.age).toFixed(1)
                    if (bioAge < userProfile.age - 3) return L ? `Excellent! Your body works like someone ${dY} years younger.` : `Excelent! Corpul tău funcționează ca al unei persoane cu ${dY} ani mai tânără.`
                    if (bioAge < userProfile.age) return L ? `Good! You are ${dY} years "younger" biologically than your chronological age.` : `Bine! Ești cu ${dY} ani "mai tânăr" biologic decât vârsta cronologică.`
                    if (bioAge > userProfile.age + 3) return L ? `Careful — the indicators suggest a biological age ${dO} years higher. Recovery and activity recommended.` : `Atenție — indicatorii sugerează o vârstă biologică cu ${dO} ani mai mare. Recuperare și activitate recomandate.`
                    if (bioAge > userProfile.age) return L ? `Your biological age is slightly above your chronological age (+${dO} years).` : `Vârsta biologică e ușor peste cea cronologică (+${dO} ani).`
                    return L ? 'Your biological age matches your chronological age.' : 'Vârsta biologică corespunde cu cea cronologică.'
                  })()}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: c.text4, lineHeight: 1.5, paddingTop: 10, borderTop: `0.5px solid ${c.border2}` }}>
              {(() => {
                const L = lang === 'en'
                const parts = [L ? 'resting HR' : 'HR odihnă']
                if (intervalsHrv) parts.push('HRV RMSSD (Intervals.icu)')
                if (body?.pwv) parts.push(L ? 'arterial stiffness (PWV)' : 'rigiditate arterială (PWV)')
                if (body?.bp_sys) parts.push(L ? 'blood pressure' : 'tensiune')
                if (body?.fat_pct) parts.push(L ? 'body composition' : 'compoziție corporală')
                if ((intervalsData?.days?.slice(-7).reduce((s,d)=>s+(d.steps||0),0)||0)) parts.push(L ? 'physical activity' : 'activitate fizică')
                if (weeklyStats?.count !== undefined) parts.push(L ? 'workouts' : 'antrenamente')
                if (combinedSleep?.total_h) parts.push(L ? 'sleep' : 'somn')
                return (L ? 'Calculated from: ' : 'Calculat din: ') + parts.join(', ') + '.'
              })()}
            </div>
          </div>
        )

      case 'heartage': {
        // Ultima valoare per câmp: snapshot Withings → istoric body_measurements → profil
        const _bmDesc = (bodyMeasQ?.data || []).filter(Boolean).slice().sort((a,b) => (a.date < b.date ? 1 : -1))
        const hv = (f) => {
          if (body?.[f] != null && body[f] !== 0) return body[f]
          const rec = _bmDesc.find(d => d[f] != null && d[f] !== 0)
          return rec ? rec[f] : null
        }
        const age = userProfile?.age ? parseFloat(userProfile.age) : null
        const wKg = hv('weight_kg') || userProfile?.weight_kg
        const hCm = userProfile?.height_cm
        const bmiH = wKg && hCm ? wKg / Math.pow(hCm/100, 2) : null
        // Edge-ul Withings întoarce `systolic` (nu `bp_sys`); acoperim ambele + istoric + manual
        const sbpH = hv('bp_sys') ?? body?.systolic ?? hv('systolic') ?? userProfile?.bp_sys ?? null
        if (!age || !bmiH || !sbpH) return null
        const base = framinghamVascularAge({ gender: userProfile?.gender, age, bmi: bmiH, sbp: sbpH, smoker: userProfile?.smoker, diabetes: userProfile?.diabetes })
        if (!base) return null

        // ── Ajustări din markerii cardio măsurați ──
        const factors = [{ label: 'Framingham', note: `${lang === 'en' ? 'base' : 'bază'} ${Math.round(base.vascularAge)}`, delta: 0 }]
        let adj = 0
        const pushF = (label, note, d) => { factors.push({ label, note, delta: d }); adj += d }

        const pwvH = hv('pwv')
        if (pwvH) pushF('PWV', `${pwvH} m/s`, pwvH < 7 ? -2 : pwvH < 9 ? 0 : pwvH < 11 ? 3 : 6)

        const hrRestH = hv('hr_rest') ?? intervalsData?.today?.hr_rest ?? intervalsData?.latest?.hr_rest ?? null
        if (hrRestH) pushF('HR repaus', `${hrRestH} bpm`, hrRestH < 55 ? -2 : hrRestH < 65 ? 0 : hrRestH < 75 ? 2 : 4)

        const hrvH = displayHrv ?? intervalsHrv ?? null
        if (hrvH) pushF('HRV', `${Math.round(hrvH)} ms`, hrvH >= 55 ? -2 : hrvH >= 40 ? -1 : hrvH >= 30 ? 0 : hrvH >= 20 ? 1 : 2)

        const vo2H = (intervalsData?.today?.vo2max ?? intervalsData?.latest?.vo2max) ?? vo2max?.value ?? null
        if (vo2H) pushF('VO₂max', `${vo2H}`, vo2H >= 50 ? -3 : vo2H >= 45 ? -2 : vo2H >= 40 ? -1 : vo2H >= 35 ? 0 : vo2H >= 30 ? 2 : 4)

        const avgStepsH = (() => { const d7 = intervalsData?.days?.slice(-7)||[]; return d7.length ? Math.round(d7.reduce((s,d)=>s+(d.steps||0),0)/d7.length) : 0 })()
        if (avgStepsH > 0) pushF('Activitate', `${(avgStepsH/1000).toFixed(1)}k ${lang === 'en' ? 'steps' : 'pași'}`, avgStepsH >= 10000 ? -2 : avgStepsH >= 7500 ? -1 : avgStepsH >= 5000 ? 0 : 2)

        const fatH = hv('fat_pct')
        if (fatH) pushF('Grăsime', `${fatH}%`, fatH < 15 ? -1 : fatH < 22 ? 0 : fatH < 28 ? 1 : 2)

        adj = Math.max(-10, Math.min(10, adj))
        const heartAge = Math.max(20, Math.min(95, Math.round(base.vascularAge + adj)))
        const delta = heartAge - Math.round(age)
        const younger = delta <= 0
        const accent = delta <= -3 ? '#4ade80' : delta <= 2 ? '#4ade80' : delta <= 8 ? '#f0a830' : '#ef4444'
        const scalePct = Math.max(0, Math.min(100, ((heartAge - 30) / (75 - 30)) * 100))
        const youPct = Math.max(0, Math.min(100, ((Math.round(age) - 30) / (75 - 30)) * 100))

        return (
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: c.radius, background: isDark ? 'linear-gradient(135deg,#2a1116 0%,#1a0e14 55%,#14171f 100%)' : 'linear-gradient(135deg,#fff1f2 0%,#fee2e2 60%,#fff 100%)', border: `1px solid ${accent}44`, marginBottom: CARD_GAP, boxShadow: c.shadowCard }}>
            <style>{`@keyframes forma_hbeat{0%,100%{transform:scale(1)}8%{transform:scale(1.12)}16%{transform:scale(1)}24%{transform:scale(1.07)}32%{transform:scale(1)}}`}</style>
            {/* Inimă pulsând pe fundal */}
            <div aria-hidden="true" style={{ position:'absolute', right:-16, top:'50%', transform:'translateY(-50%)', zIndex:0, pointerEvents:'none', opacity: isDark ? 0.14 : 0.10 }}>
              <svg width="190" height="190" viewBox="0 0 100 100" style={{ overflow:'visible' }}>
                <path d="M50 86 C 18 60, 10 40, 26 28 C 39 18, 50 30, 50 39 C 50 30, 61 18, 74 28 C 90 40, 82 60, 50 86 Z" fill="#ef4444" style={{ transformOrigin:'center', animation:'forma_hbeat 1.1s ease-in-out infinite' }}/>
              </svg>
            </div>

            <div style={{ position:'relative', zIndex:1, padding: isMobile ? '1rem' : '1.1rem 1.25rem' }}>
              <div onClick={toggleHeartAge} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:15 }}>❤️</span>
                  <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.09em', textTransform:'uppercase', color:c.text4 }}>{t('Vârsta inimii')}</span>
                </div>
                <span style={{ fontSize:13, color:c.text4, transform: heartAgeOpen ? 'none' : 'rotate(-90deg)', transition:'transform .2s' }}>▾</span>
              </div>

              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:42, fontWeight:800, color:c.text, lineHeight:1 }}>{heartAge} <span style={{ fontSize:15, fontWeight:600, color:c.text4 }}>{t('ani')}</span></div>
                <div style={{ fontSize:13, fontWeight:600, color:accent, marginTop:6 }}>
                  {delta === 0
                    ? t('Egală cu vârsta ta')
                    : younger
                    ? (lang === 'en' ? `▼ ${Math.abs(delta)} years younger (vs ${Math.round(age)})` : `▼ cu ${Math.abs(delta)} ani mai tânără (vs ${Math.round(age)})`)
                    : (lang === 'en' ? `▲ ${delta} years older (vs ${Math.round(age)})` : `▲ cu ${delta} ani mai bătrână (vs ${Math.round(age)})`)}
                </div>
              </div>

              {/* scală 30–75 */}
              <div style={{ marginTop:12, height:8, borderRadius:5, background:'rgba(128,128,128,0.2)', position:'relative' }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${scalePct}%`, borderRadius:5, background:accent }}/>
                <div style={{ position:'absolute', left:`${youPct}%`, top:-3, width:2, height:14, background:c.text3 }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:c.text4, marginTop:4 }}>
                <span>30</span><span>▲ {lang === 'en' ? 'you' : 'tu'} {Math.round(age)}</span><span>75</span>
              </div>

              {heartAgeOpen && (
                <div style={{ marginTop:14, paddingTop:12, borderTop:`0.5px solid ${c.border2}` }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:c.text4, marginBottom:8 }}>{lang === 'en' ? 'Factors · 10-yr CV risk' : 'Factori · risc CV 10 ani'} {base.riskPct}%</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {factors.map((f,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background: isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)', borderRadius:8, padding:'6px 9px' }}>
                        <span style={{ fontSize:11, color:c.text3 }}>{t(f.label)} <span style={{ color:c.text4 }}>{f.note}</span></span>
                        <span style={{ fontSize:11, fontWeight:700, color: f.delta < 0 ? '#4ade80' : f.delta > 0 ? '#f87171' : c.text4 }}>{f.delta === 0 ? '—' : f.delta > 0 ? `+${f.delta}` : f.delta}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:10, color:c.text4, marginTop:10, fontStyle:'italic', lineHeight:1.5 }}>
                    {t('Estimare informativă: vârstă vasculară Framingham (2008) + ajustări din markeri cardio măsurați. Nu înlocuiește consultul medical.')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      case 'workoutsupp':
        return (
          <div style={grid2}>
            <div style={s.card}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: badge.bg, color: badge.color, marginBottom: 8, display: 'inline-block' }}>ANTRENAMENT</span>
              <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 6 }}>{readiness.suggested_workout}</div>
              <div style={{ fontSize: 12, color: c.text3, lineHeight: 1.6 }}>
                {recovery.notReady.length > 0 && <div style={{ marginBottom: 6, color: c.orange }}>⏳ {recovery.notReady.slice(0,2).map(g => `${g.group} (${g.remainingHours}h)`).join(', ')}</div>}
                {['· Deadlift 4×5 @ 85% 1RM','· Barbell Row 4×8','· Pull-ups 3×max','· Face Pull 3×15','· Barbell Curl 3×10'].map(e => <div key={e}>{e}</div>)}
              </div>
            </div>
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: supplements.length > 0 ? 10 : 0 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: isDark ? '#3A2A0A' : '#FFF3D8', color: c.orange, display: 'inline-block' }}>SUPLIMENTE AI</span>
                  {supplements.length > 0 && (
                    <span style={{ fontSize: 10, color: c.text4, marginLeft: 8 }}>
                      {Object.keys(suppTaken).length}/{supplements.length} azi
                    </span>
                  )}
                </div>
                <button onClick={generateSupplements} disabled={suppLoading}
                  style={{ fontSize: 11, padding: '5px 12px', background: c.card2, border: 'none', borderRadius: 10, color: suppLoading ? c.text4 : c.green2, cursor: suppLoading ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  {suppLoading ? '⏳ ...' : supplements.length > 0 ? '↻ Regenerează' : '✨ Generează'}
                </button>
              </div>
              {supplements.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {supplements.map((sup) => {
                    const taken = suppTaken[sup.id]
                    return (
                      <div key={sup.id}
                        onClick={() => toggleSupplement(sup)}
                        style={{ background: taken ? c.green3 : c.card2, border: 'none', borderRadius: c.radiusSm, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${taken ? c.green : c.text4}`, background: taken ? c.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {taken && <span style={{ fontSize: 13, color: '#fff', lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: taken ? c.green : c.text }}>{sup.name}</div>
                          <div style={{ fontSize: 11, color: c.text4 }}>{sup.dose}</div>
                        </div>
                        {sup.reason && <div style={{ fontSize: 10, color: c.text3, maxWidth: '35%', textAlign: 'right', fontStyle: 'italic', lineHeight: 1.3 }}>{sup.reason}</div>}
                        <button onClick={e => { e.stopPropagation(); deleteSupplement(sup.id) }}
                          style={{ fontSize: 11, color: c.text4, background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 }}>✕</button>
                      </div>
                    )
                  })}
                  <div style={{ fontSize: 10, color: c.text4, marginTop: 4, textAlign: 'center' }}>
                    Apasă pe supliment pentru a bifa administrarea de azi
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: c.text4, padding: '0.5rem 0', lineHeight: 1.5 }}>
                  Apasă ✨ Generează pentru recomandări personalizate bazate pe profilul și datele tale.
                </div>
              )}
            </div>
          </div>
        )

      case 'hydration':
        return <WaterTracker c={c} weightKg={body?.weight_kg || userProfile?.weight_kg} isMobile={isMobile}
          onUpdate={(newTotal) => setWaterToday(prev => ({ total_ml: newTotal, target_ml: prev?.target_ml || Math.round((body?.weight_kg || userProfile?.weight_kg || 80) * 35) }))}/>

      case 'fitnessctl': {
        const ictd = intervalsData?.latest || intervalsData?.today
        const hasIntervals = ictd?.ctl != null
        const pmcSrc = hasIntervals ? 'Intervals.icu' : 'estimat'
        const pmcLatest = hasIntervals ? ictd : trainingLoad
        const pmcHistory = hasIntervals && intervalsData?.pmcHistory?.length > 5 ? intervalsData.pmcHistory : trainingLoadHistory
        if (!pmcLatest) return null
        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={s.sectionLabel}>Fitness-Oboseală (Banister)</div>
                <div style={{ fontSize: 10, color: hasIntervals ? c.green : c.text4, marginTop: 2 }}>{hasIntervals ? '✓ Intervals.icu' : '⚠ estimat'}</div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                <span style={{ color: c.text3 }}>CTL <strong style={{ color: c.green }}>{Math.round(pmcLatest.ctl)}</strong></span>
                <span style={{ color: c.text3 }}>ATL <strong style={{ color: c.orange }}>{Math.round(pmcLatest.atl)}</strong></span>
                <span style={{ color: c.text3 }}>TSB <strong style={{ color: (pmcLatest.tsb ?? pmcLatest.ctl - pmcLatest.atl) >= 0 ? c.green : c.red }}>{((pmcLatest.tsb ?? pmcLatest.ctl - pmcLatest.atl) > 0 ? '+' : '')}{Math.round(pmcLatest.tsb ?? pmcLatest.ctl - pmcLatest.atl)}</strong></span>
              </div>
            </div>
            {pmcHistory.length > 5 && <PMCChart history={pmcHistory} c={c} height={140}/>}
          </div>
        )
      }

      case 'vo2max': {
        const intervalsVo2 = intervalsData?.today?.vo2max ?? intervalsData?.latest?.vo2max ?? null
        const displayVo2 = intervalsVo2 ?? vo2max?.value ?? null
        const vo2Src = intervalsVo2 != null ? 'Intervals.icu' : vo2max ? 'estimat din HR' : null
        if (!displayVo2) return null
        return (
          <MetricCard label={'VO2max'} value={displayVo2} unit="ml/kg/min"
            delta={vo2Src || ''}
            deltaPos={displayVo2 >= 40} c={c}
            onClick={loadIntervalsData}/>
        )
      }

      case 'bodybattery': {
        const _bbTodayStr = new Date().toISOString().slice(0, 10)
        const _bbActs = filterMFP(intervalsData?.activities).filter(a => a.date === _bbTodayStr)

        // Persistăm valoarea curentă a bateriei (va fi citită mâine ca punct de start la 00:00)
        if (bodyBatteryCurrent?.current != null) {
          try { localStorage.setItem(`forma_bb_${_bbTodayStr}`, bodyBatteryCurrent.current) } catch (_) {}
        }

        // Citim valoarea de la 23:59 a zilei precedente (stocată în sesiunea anterioară)
        const _bbPrevDayBattery = (() => {
          try {
            const d = new Date(); d.setDate(d.getDate() - 1)
            const prevKey = `forma_bb_${d.toISOString().slice(0, 10)}`
            const v = parseInt(localStorage.getItem(prevKey), 10)
            return isNaN(v) ? null : Math.max(10, Math.min(100, v))
          } catch (_) { return null }
        })()

        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={s.sectionLabel}>🔋 Body Battery</div>
              {intervalsHrv && <span style={{ fontSize: 10, color: c.text4 }}>HRV {intervalsHrv}ms · intervals.icu</span>}
            </div>
            <BodyBatteryWidget
              data={bodyBatteryCurrent}
              activities={_bbActs}
              sleepHours={combinedSleep?.total_h ?? null}
              prevDayBattery={_bbPrevDayBattery}
              c={c}
            />
          </div>
        )
      }

      // ── Widget-uri individuale Intervals.icu — pot fi adăugate/scoase independent ──
      case 'ihrv': {
        if (!intervalsData) return null
        return (
          <MetricCard label={'HRV'} icon="📊" value={intervalsHrv ?? '—'} unit={intervalsHrv ? 'ms' : ''}
            delta={intervalsHrvBaseline ? `baseline ${intervalsHrvBaseline}ms · Intervals.icu` : 'Intervals.icu'}
            deltaPos={intervalsHrv != null && intervalsHrvBaseline != null ? intervalsHrv >= intervalsHrvBaseline : null} c={c}
            onClick={() => setTab('activitate')}/>
        )
      }

      case 'isleep': {
        if (!intervalsData) return null
        const d = intervalsData.today || intervalsData.latest
        if (!d?.sleep_hours) return null
        return (
          <MetricCard label={'Somn'} value={d.sleep_hours.toFixed(1)} unit="h"
            delta={d.sleep_score != null ? `scor ${d.sleep_score}/100 · Intervals.icu` : 'Intervals.icu'}
            deltaPos={d.sleep_hours >= 7} c={c}
            onClick={() => setTab('sleep')}/>
        )
      }

      case 'ihrrest': {
        if (!intervalsData) return null
        const d = intervalsData.today || intervalsData.latest
        if (!d?.hr_rest) return null
        return (
          <MetricCard label={'Puls repaus'} icon="❤️" value={d.hr_rest} unit="bpm"
            delta="Intervals.icu"
            deltaPos={d.hr_rest <= 55} c={c}
            onClick={() => setTab('sleep')}/>
        )
      }

      case 'iweight': {
        if (!intervalsData) return null
        const nowH = new Date().getHours()
        const todayStr3 = new Date().toISOString().slice(0, 10)
        const todayW = intervalsData.today?.weight_kg
        const days3 = intervalsData.days || []
        const idx3 = days3.findIndex(x => x.date === todayStr3)
        const yestW = idx3 > 0 ? days3[idx3 - 1]?.weight_kg : null
        const wVal = (nowH < 11 && todayW == null) ? yestW : (todayW ?? yestW)
        if (!wVal) return null
        const isYest = nowH < 11 && todayW == null && yestW != null
        const tgt = userProfile?.target_weight_kg
        return (
          <MetricCard label={'Greutate'} icon="⚖️" value={`${wVal}`} unit="kg"
            delta={tgt ? `țintă ${tgt}kg (${wVal > tgt ? '−' : '+'}${Math.abs(wVal - tgt).toFixed(1)}kg)` : isYest ? 'ieri · Intervals.icu' : 'Intervals.icu'}
            deltaPos={tgt ? Math.abs(wVal - tgt) < 1 : null} c={c}
            onClick={() => { setTab('history'); setStatsSubTab('corp') }}/>
        )
      }

      // Compatibilitate cu layout-urile vechi salvate în Supabase — afișează cele 4 carduri combinate
      case 'intervalsicu': {
        if (!intervalsData) return null
        const d = intervalsData.today || intervalsData.latest
        if (!d) return null
        const nowHour2 = new Date().getHours()
        const todayStr2 = new Date().toISOString().slice(0, 10)
        const days2 = intervalsData.days || []
        const idx2 = days2.findIndex(x => x.date === todayStr2)
        const yestW2 = idx2 > 0 ? days2[idx2 - 1]?.weight_kg : null
        const wVal2 = (nowHour2 < 11 && !d.weight_kg) ? yestW2 : (d.weight_kg ?? yestW2)
        const tgt2 = userProfile?.target_weight_kg
        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.sectionLabel}>📈 Intervals.icu — Wellness</div>
              <span style={{ fontSize: 10, color: c.text4 }}>{d.date === todayStr2 ? 'azi' : d.date}</span>
            </div>
            <div style={grid4}>
              <MetricCard label={'HRV'} value={intervalsHrv ?? '—'} unit={intervalsHrv ? 'ms' : ''} delta={intervalsHrvBaseline ? `baseline ${intervalsHrvBaseline}ms` : 'Intervals.icu'} deltaPos={intervalsHrv != null && intervalsHrvBaseline != null ? intervalsHrv >= intervalsHrvBaseline : null} c={c}/>
              <MetricCard label={'Somn'} value={d.sleep_hours != null ? d.sleep_hours.toFixed(1) : '—'} unit={d.sleep_hours ? 'h' : ''} delta={d.sleep_score != null ? `scor ${d.sleep_score}/100` : 'Intervals.icu'} deltaPos={d.sleep_hours >= 7} c={c}/>
              <MetricCard label={'Puls repaus'} value={d.hr_rest ?? '—'} unit={d.hr_rest ? 'bpm' : ''} delta="Intervals.icu" deltaPos={d.hr_rest <= 55} c={c}/>
              <MetricCard label={'Greutate'} value={wVal2 ?? '—'} unit={wVal2 ? 'kg' : ''} delta={tgt2 ? `țintă ${tgt2}kg (${wVal2 > tgt2 ? '−' : '+'}${Math.abs(wVal2 - tgt2).toFixed(1)}kg)` : 'Intervals.icu'} deltaPos={tgt2 && wVal2 ? Math.abs(wVal2 - tgt2) < 1 : null} c={c}/>
            </div>
          </div>
        )
      }

      case 'vo2maxcard': {
        const latestWithVo2 = [...(intervalsData?.days || [])].reverse().find(d => d.vo2max != null)
        const intervalsVo2 = latestWithVo2?.vo2max ?? null
        const displayVo2 = intervalsVo2 ?? vo2max?.value ?? null
        if (!displayVo2) return null
        const vo2Src = intervalsVo2 != null ? `Intervals.icu · ${latestWithVo2.date}` : vo2max ? `estimat · HR` : ''
        return (
          <MetricCard label={'VO2max'} value={displayVo2} unit="ml/kg/min"
            delta={vo2Src} deltaPos={displayVo2 >= 40} c={c}
            onClick={() => setTab('activitate')}/>
        )
      }

      case 'calsburned': {
        const nowHourCal = new Date().getHours() + new Date().getMinutes() / 60
        const bmrPerHour = (nutritionTargets.bmrDaily || 1800) / 24

        // Prioritate 1: suma caloriilor reale din activitățile Intervals.icu de azi
        const todayStr = new Date().toISOString().slice(0, 10)
        const todayActs = filterMFP(intervalsData?.activities).filter(a => a.date === todayStr)
        const intervalsCals = todayActs.length > 0 && todayActs.some(a => a.calories != null)
          ? todayActs.reduce((sum, a) => sum + (a.calories || 0), 0)
          : null

        const rawCal = intervalsData?.todayActivities?.reduce((s, a) => s + (a.calories||0), 0) || null
        const maxRealistic = nowHourCal < 10 ? Math.round(bmrPerHour * nowHourCal + 400) : null
        const calIsStale = !intervalsCals && rawCal && maxRealistic && rawCal > maxRealistic
        const fitActiveCals = (!calIsStale && rawCal)
          ? Math.round(Math.max(0, rawCal - bmrSoFar))
          : null

        // Valoarea finală afișată + sursa
        const activeCals = intervalsCals ?? fitActiveCals
        const isReal = intervalsCals != null
        const target = userProfile?.target_calories_burned

        return (
          <MetricCard label={'Calorii arse'} icon="🔥"
            value={activeCals ?? '—'} unit={activeCals ? 'kcal' : ''}
            delta={calIsStale ? 'sincronizare în curs' : isReal ? `✓ Intervals.icu (${todayActs.length} ${t('activități')})` : target ? `${t('țintă')} ${target} kcal` : 'activitate'}
            deltaPos={calIsStale ? false : isReal ? true : target && activeCals ? activeCals >= target : null}
            ringPct={activeCals && target ? Math.min(100, Math.round((activeCals / target) * 100)) : null}
            ringColor={c.orange} c={c}
            onClick={() => setTab('activitate')}/>
        )
      }

      case 'ble_hr':
        return (
          <BLEHeartRateWidget c={c} isMobile={isMobile}/>
        )

      case 'streaks':
        return <StreaksWidget intervalsData={intervalsData} combinedSleep={combinedSleep} userProfile={userProfile} c={c}/>

      case 'exertion': {
        const ictdEx = intervalsData?.latest || intervalsData?.today || {}
        const ctl = ictdEx.ctl ?? trainingLoad?.ctl ?? null
        const atl = ictdEx.atl ?? trainingLoad?.atl ?? null
        const tsb = ictdEx.tsb ?? trainingLoad?.tsb ?? null

        if (!ctl || !atl) return (
          <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>⚡ {t('Exertion zilnic')}</div>
            <div style={{ fontSize: 11, color: c.text4 }}>Date ATL/CTL indisponibile · sync Intervals.icu</div>
          </div>
        )

        // CTL < 15 = istoric insuficient
        if (ctl < 15) return (
          <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>⚡ {t('Exertion zilnic')}</div>
            <div style={{ fontSize: 13, color: c.text3, marginBottom: 6 }}>CTL {Math.round(ctl)} · ATL {Math.round(atl)}</div>
            <div style={{ fontSize: 11, color: c.text4, lineHeight: 1.5, padding: '8px 10px', background: c.card2, borderRadius: 8, borderLeft: '3px solid ' + c.orange }}>
              📈 Istoric insuficient — Exertion devine precis după 4-6 săptămâni de activitate sincronizată.
              Continuă să te miști zilnic și datele se vor calibra automat.
            </div>
          </div>
        )

        // Target dinamic bazat pe CTL si obiectiv
        const goal = userProfile?.goal || 'sanatate'
        const goalFactor = goal === 'hipertrofie' ? 1.05 : goal === 'forta' ? 0.95 : goal === 'slabit' ? 1.15 : goal === 'rezistenta' ? 1.20 : goal === 'recompozitie' ? 1.10 : 1.0
        const targetATL = Math.round(ctl * goalFactor)

        // Pct fata de target
        const pct = Math.round(atl / targetATL * 100)

        // Zone
        let zone, zoneColor, zoneLabel, zoneDesc
        if (pct < 40)       { zone='rest';     zoneColor='#4FC3F7'; zoneLabel='Rest';     zoneDesc='Efort foarte scăzut. Ok pentru recuperare activă.' }
        else if (pct < 70)  { zone='light';    zoneColor='#81C784'; zoneLabel='Light';    zoneDesc='Efort ușor. Bun pentru menținere și recuperare.' }
        else if (pct < 100) { zone='moderate'; zoneColor='#FFD54F'; zoneLabel='Moderate'; zoneDesc='Zona optimă de antrenament. Progres consistent.' }
        else if (pct < 130) { zone='hard';     zoneColor='#FF8A65'; zoneLabel='Hard';     zoneDesc='Efort ridicat. Asigură-te că dormi suficient.' }
        else                 { zone='peak';     zoneColor='#EF5350'; zoneLabel='Peak';     zoneDesc='Supraîncărcare. Prioritizează recuperarea mâine.' }

        // Pozitia indicatorului pe bara (0-100%)
        const barPct = Math.min(100, Math.round(pct / 160 * 100))

        // Trend TSB (forma): pozitiv = odihnat, negativ = obosit
        const tsbColor = tsb == null ? c.text4 : tsb > 5 ? c.green : tsb > -10 ? c.orange : c.red
        const tsbLabel = tsb == null ? '—' : tsb > 5 ? 'Odihnit' : tsb > -10 ? 'Echilibrat' : 'Obosit'

        // Mini grafic ATL ultimele 14 zile
        const atlHistory = (intervalsData?.days || [])
          .filter(d => d.atl != null)
          .slice(-14)

        return (
          <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚡ {t('Exertion zilnic')}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {tsb != null && (
                  <span style={{ fontSize: 10, color: tsbColor, background: tsbColor + '22', padding: '2px 7px', borderRadius: 10 }}>
                    TSB {tsb > 0 ? '+' : ''}{Math.round(tsb)} · {tsbLabel}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color: zoneColor, background: zoneColor + '22', padding: '2px 8px', borderRadius: 12 }}>{zoneLabel}</span>
              </div>
            </div>

            {/* Valori principale */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: zoneColor }}>{Math.round(atl)}</span>
              <span style={{ fontSize: 13, color: c.text4 }}>ATL</span>
              <span style={{ fontSize: 13, color: c.text4, marginLeft: 4 }}>/ {targetATL} target</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: pct >= 70 && pct < 130 ? c.green : c.text4, marginLeft: 'auto' }}>{pct}%</span>
            </div>

            {/* Bara zone colorate */}
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <div style={{ height: 12, borderRadius: 6, overflow: 'hidden',
                background: 'linear-gradient(to right, #4FC3F7 0%, #4FC3F7 25%, #81C784 25%, #81C784 44%, #FFD54F 44%, #FFD54F 63%, #FF8A65 63%, #FF8A65 81%, #EF5350 81%, #EF5350 100%)',
                position: 'relative' }}>
                <div style={{ position: 'absolute', left: barPct + '%', top: '50%', transform: 'translate(-50%, -50%)',
                  width: 18, height: 18, borderRadius: '50%', background: zoneColor,
                  border: '3px solid #fff', boxShadow: '0 2px 6px ' + zoneColor + '88', zIndex: 2 }}/>
              </div>
              <div style={{ display: 'flex', marginTop: 5, fontSize: 9, color: c.text4 }}>
                <div style={{ width: '25%', textAlign: 'center' }}>Rest</div>
                <div style={{ width: '19%', textAlign: 'center' }}>Light</div>
                <div style={{ width: '19%', textAlign: 'center' }}>Moderate</div>
                <div style={{ width: '18%', textAlign: 'center' }}>Hard</div>
                <div style={{ width: '19%', textAlign: 'center' }}>Peak</div>
              </div>
            </div>

            {/* Target info */}
            <div style={{ fontSize: 10, color: c.text4, marginTop: 4, marginBottom: 10 }}>
              Target = CTL ({Math.round(ctl)}) × {goalFactor} ({goal}) = {targetATL}
            </div>

            {/* Mini grafic ATL */}
            {atlHistory.length > 3 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32, marginBottom: 8 }}>
                {atlHistory.map((d, i) => {
                  const maxATL = Math.max(...atlHistory.map(x => x.atl))
                  const h = Math.max(3, Math.round(d.atl / maxATL * 32))
                  const isToday = i === atlHistory.length - 1
                  const dayPct = Math.round(d.atl / targetATL * 100)
                  const dayColor = dayPct < 40 ? '#4FC3F7' : dayPct < 70 ? '#81C784' : dayPct < 100 ? '#FFD54F' : dayPct < 130 ? '#FF8A65' : '#EF5350'
                  return (
                    <div key={i} title={d.date + ': ATL ' + Math.round(d.atl)}
                      style={{ flex: 1, height: h, background: isToday ? dayColor : dayColor + '66',
                        borderRadius: 2, transition: 'height .3s', border: isToday ? '1px solid ' + dayColor : 'none' }}/>
                  )
                })}
              </div>
            )}

            {/* Interpretare */}
            <div style={{ fontSize: 11, color: c.text3, lineHeight: 1.5, padding: '7px 10px', background: zoneColor + '11', borderRadius: 8, borderLeft: '3px solid ' + zoneColor }}>
              {zoneDesc}
            </div>
          </div>
        )
      }

      case 'cardio_fitness': {
        // Surse VO2max: 1) Intervals.icu (Garmin) 2) Withings 3) Formula HR
        const latestWithVo2 = [...(intervalsData?.days || [])].reverse().find(d => d.vo2max != null)
        const intervalsVo2 = latestWithVo2?.vo2max ?? null
        const withingsVo2 = withingsData?.body?.vo2max ?? null
        const formulaVo2 = vo2max?.value ?? null
        const displayVo2 = intervalsVo2 ?? withingsVo2 ?? formulaVo2
        const vo2Src = intervalsVo2 != null ? `Garmin · ${latestWithVo2?.date || ''}` : withingsVo2 != null ? 'Withings Body' : formulaVo2 ? 'estimat din HR' : null

        // Trend — comparam ultimele 2 valori
        const vo2History = (intervalsData?.days || []).filter(d => d.vo2max != null).slice(-8)
        const prevVo2 = vo2History.length >= 2 ? vo2History[vo2History.length - 2]?.vo2max : null
        const trend = displayVo2 && prevVo2 ? Math.round((displayVo2 - prevVo2) * 10) / 10 : null

        // Zone VO2max (pe varsta/gen - folosim valori generale)
        // Poor < 30 | Fair 30-37 | Good 38-45 | Excellent 46-53 | Superior 54+
        const getZone = v => {
          if (!v) return null
          if (v < 30) return { label: 'Scăzut',    color: '#EF5350', pos: Math.min(20, v/30*20) }
          if (v < 38) return { label: 'Moderat',   color: '#FFA726', pos: 20 + (v-30)/8*20 }
          if (v < 46) return { label: 'Bun',       color: '#FFEE58', pos: 40 + (v-38)/8*20 }
          if (v < 54) return { label: 'Foarte bun',color: '#9CCC65', pos: 60 + (v-46)/8*20 }
          return { label: 'Excelent', color: '#26A69A', pos: Math.min(95, 80 + (v-54)/10*15) }
        }
        const zone = getZone(displayVo2)

        // Varsta biologica cardio (VO2max scade ~1ml/kg/min la fiecare 10 ani dupa 25)
        const age = userProfile?.age || 40
        const gender = userProfile?.gender || 'M'
        // Reference mediane per decada (barbati): 20s=48, 30s=44, 40s=41, 50s=37, 60s=33
        const refByAge = gender === 'F'
          ? [42, 38, 35, 32, 28]  // femei
          : [48, 44, 41, 37, 33]  // barbati
        const decadeIdx = Math.min(4, Math.floor(Math.max(0, age - 20) / 10))
        const refVo2 = refByAge[decadeIdx]
        const cardioAge = displayVo2 ? Math.round(age - (displayVo2 - refVo2) * 2) : null

        if (!displayVo2) return (
          <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>🫁 Cardio Fitness</div>
            <div style={{ fontSize: 11, color: c.text4 }}>Date VO2max indisponibile · necesită Garmin sau Withings</div>
          </div>
        )

        return (
          <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🫁 Cardio Fitness</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {trend != null && (
                  <span style={{ fontSize: 11, color: trend >= 0 ? c.green : c.red, fontWeight: 600 }}>
                    {trend > 0 ? '▲' : trend < 0 ? '▼' : '='} {Math.abs(trend)}
                  </span>
                )}
                {zone && <span style={{ fontSize: 11, fontWeight: 700, color: zone.color, background: zone.color + '22', padding: '2px 8px', borderRadius: 12 }}>{zone.label}</span>}
              </div>
            </div>

            {/* Valoare principala */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: zone?.color || c.text }}>{displayVo2}</span>
              <span style={{ fontSize: 13, color: c.text4 }}>ml/kg/min</span>
              {cardioAge && (
                <span style={{ fontSize: 11, color: c.text4, marginLeft: 8 }}>
                  · {t('vârstă cardio')}: <strong style={{ color: cardioAge <= age ? c.green : c.orange }}>{cardioAge} {t('ani')}</strong>
                </span>
              )}
            </div>

            {/* Bara zona */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{ height: 12, borderRadius: 6, background: 'linear-gradient(to right, #EF5350 0%, #EF5350 20%, #FFA726 20%, #FFA726 40%, #FFEE58 40%, #FFEE58 60%, #9CCC65 60%, #9CCC65 80%, #26A69A 80%, #26A69A 100%)' }}>
                {zone && (
                  <div style={{ position: 'absolute', left: zone.pos + '%', top: '50%', transform: 'translate(-50%,-50%)', width: 20, height: 20, borderRadius: '50%', background: zone.color, border: '3px solid #fff', boxShadow: '0 2px 8px ' + zone.color + '88', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 8, fontWeight: 900, color: '#fff' }}>{displayVo2}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', marginTop: 6, fontSize: 9, color: c.text4 }}>
                <div style={{ width: '20%', textAlign: 'center' }}>{t('Scăzut')}</div>
                <div style={{ width: '20%', textAlign: 'center' }}>{t('Moderat')}</div>
                <div style={{ width: '20%', textAlign: 'center' }}>{t('Bun')}</div>
                <div style={{ width: '20%', textAlign: 'center' }}>{t('F. bun')}</div>
                <div style={{ width: '20%', textAlign: 'center' }}>{t('Excelent')}</div>
              </div>
            </div>

            {/* Sursa + mini trend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 10, color: c.text4 }}>
                {vo2Src && <span style={{ color: c.green }}>✓ {vo2Src}</span>}
              </div>
              {vo2History.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
                  {vo2History.slice(-6).map((d, i) => {
                    const h = Math.round((d.vo2max - 25) / (60 - 25) * 100)
                    return (
                      <div key={i} style={{ width: 6, height: Math.max(4, h * 0.24) + 'px', background: i === vo2History.slice(-6).length - 1 ? zone?.color || c.blue : c.card2, borderRadius: 3 }}/>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Interpretare */}
            {zone && (
              <div style={{ fontSize: 11, color: c.text3, marginTop: 8, lineHeight: 1.5, padding: '7px 10px', background: zone.color + '11', borderRadius: 8, borderLeft: '3px solid ' + zone.color }}>
                {zone.label === 'Scăzut'     && t('Capacitate cardio redusă. Activitate aerobică regulată (mers, înot, ciclism) poate îmbunătăți rapid VO2max.')}
                {zone.label === 'Moderat'    && t('Nivel mediu. Antrenamente cardio de 3-4x/săptămână te vor aduce în zona Bun în câteva luni.')}
                {zone.label === 'Bun'        && t('Capacitate cardio bună, deasupra mediei. Continuă cu activitate aerobică regulată.')}
                {zone.label === 'Foarte bun' && t('Nivel excelent de fitness cardiovascular. Ești în top 25% pentru vârsta ta.')}
                {zone.label === 'Excelent'   && t('Performanță de top — nivel de atlet. Menține prin antrenamente de intensitate variată.')}
              </div>
            )}
          </div>
        )
      }

      case 'tlr': {
        const ictd2 = intervalsData?.latest || intervalsData?.today || {}
        const pmcFromI = ictd2?.ctl != null
        const pmcL = pmcFromI ? ictd2 : trainingLoad
        const ctl2 = pmcL?.ctl ?? null
        const atl2 = pmcL?.atl ?? null
        if (!ctl2 || !atl2 || ctl2 === 0) return (
          <div style={{ background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>⚖️ Training Load Ratio</div>
            <div style={{ fontSize: 11, color: c.text4 }}>Date CTL/ATL indisponibile · sync Intervals.icu</div>
          </div>
        )
        if (ctl2 < 15) return (
          <div style={{ background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>⚖️ Training Load Ratio</div>
            <div style={{ fontSize: 11, color: c.text4, lineHeight: 1.5, padding: '8px 10px', background: c.card2, borderRadius: 8, borderLeft: '3px solid ' + c.orange }}>
              📈 Istoric insuficient — Training Load Ratio devine precis după 4-6 săptămâni de activitate sincronizată.
            </div>
          </div>
        )
        const ratio2 = atl2 / ctl2
        const r2 = Math.round(ratio2 * 100) / 100
        let zone2, zoneColor2, zoneLabel2
        if (ratio2 < 0.8)      { zone2='low';     zoneColor2='#4FC3F7'; zoneLabel2='Low' }
        else if (ratio2 < 1.3) { zone2='optimal'; zoneColor2='#66BB6A'; zoneLabel2='Optimal' }
        else if (ratio2 < 1.5) { zone2='high';    zoneColor2='#FFA726'; zoneLabel2='High' }
        else                   { zone2='risk';     zoneColor2='#EF5350'; zoneLabel2='Risk' }
        const ratioToPos2 = r => {
          if (r <= 0.8) return r / 0.8 * 20
          if (r <= 1.3) return 20 + (r - 0.8) / 0.5 * 45
          if (r <= 1.5) return 65 + (r - 1.3) / 0.2 * 20
          return Math.min(100, 85 + (r - 1.5) / 0.5 * 15)
        }
        const pos2 = ratioToPos2(ratio2)
        return (
          <div style={{ background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚖️ Training Load Ratio</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: c.text4 }}>CTL {Math.round(ctl2)} · ATL {Math.round(atl2)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: zoneColor2, background: zoneColor2 + '22', padding: '2px 8px', borderRadius: 12 }}>{zoneLabel2}</span>
              </div>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{ height: 14, borderRadius: 7, background: 'linear-gradient(to right, #4FC3F7 0%, #4FC3F7 20%, #66BB6A 20%, #66BB6A 65%, #FFA726 65%, #FFA726 85%, #EF5350 85%, #EF5350 100%)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: `${pos2}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 24, borderRadius: '50%', background: zoneColor2, border: '3px solid #fff', boxShadow: `0 2px 8px ${zoneColor2}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                  <span style={{ fontSize: 9, fontWeight: 900, color: '#fff' }}>{r2}</span>
                </div>
              </div>
              <div style={{ display: 'flex', marginTop: 8 }}>
                <div style={{ width: '20%', fontSize: 10, color: '#4FC3F7', textAlign: 'center' }}>Low</div>
                <div style={{ width: '45%', fontSize: 10, color: '#66BB6A', textAlign: 'center' }}>Optimal</div>
                <div style={{ width: '20%', fontSize: 10, color: '#FFA726', textAlign: 'center' }}>High</div>
                <div style={{ width: '15%', fontSize: 10, color: '#EF5350', textAlign: 'center' }}>Risk</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: c.text3, lineHeight: 1.5, padding: '8px 10px', background: zoneColor2 + '11', borderRadius: 8, borderLeft: `3px solid ${zoneColor2}` }}>
              {zone2 === 'low'     && t('Sarcina de antrenament e scăzută. Poți crește intensitatea.')}
              {zone2 === 'optimal' && t('Raport optim — zona ideală pentru progres cu risc scăzut.')}
              {zone2 === 'high'    && t('Oboseală ridicată. Monitorizează recuperarea.')}
              {zone2 === 'risk'    && t('Risc supraantrenament. Prioritizează odihna.')}
            </div>
          </div>
        )
      }

      case 'dayincifre': {
        const todayStr2 = new Date().toISOString().slice(0,10)
        const iToday = intervalsData?.today || intervalsData?.latest || {}
        const steps2 = iToday.steps || intervalsData?.days?.find(d=>d.date===todayStr2)?.steps || 0
        const stepsTarget2 = userProfile?.target_steps || 10000
        const stepsPct = stepsTarget2>0 ? Math.min(120,Math.round(steps2/stepsTarget2*100)) : 0

        const sleepH2 = combinedSleep?.duration_h || combinedSleep?.total_h || 0
        const sleepPct = Math.min(110, Math.round(sleepH2/8*100))
        const sleepLabel = sleepH2>=7.5?'bun':sleepH2>=6?'ok':'scăzut'
        const sleepColor = sleepH2>=7.5?c.green:sleepH2>=6?c.orange:c.red

        const calBurned2 = iToday.calories || intervalsData?.todayActivities?.reduce((s,a)=>s+(a.calories||0),0) || 0
        const calTarget2 = userProfile?.target_calories_burned || 500
        const calBurnedPct = calTarget2>0 ? Math.min(130,Math.round(calBurned2/calTarget2*100)) : 0
        const calBurnedColor = calBurnedPct>=100?c.green:calBurnedPct>=70?c.orange:c.text3

        const calCons2 = nutrition?.calories || 0
        const calConsTarget = userProfile?.calories_consumed_target || 2000
        const calConsPct = calConsTarget>0 ? Math.min(110,Math.round(calCons2/calConsTarget*100)) : 0

        const hrRest2 = iToday.hr_rest || withingsData?.body?.hr_rest || null
        const hrColor = hrRest2 ? (hrRest2<60?c.green:hrRest2<75?c.text:c.orange) : c.text3

        const hrv2 = iToday.hrv || iToday.hrv_rmssd || null
        const hrvBaseline = intervalsData?.days?.slice(-30).filter(d=>d.hrv>0).reduce((s,d,_,a)=>s+d.hrv/a.length,0) || 50
        const hrvDelta = hrv2 ? Math.round(hrv2-hrvBaseline) : null
        const hrvColor = hrv2 ? (hrv2>=hrvBaseline?c.green:hrv2>=hrvBaseline*0.85?c.orange:c.red) : c.text3

        const weight2 = body?.weight_kg ?? withingsData?.body?.weight_kg ?? body?.weight ?? null
        const weightPrev = intervalsData?.days?.slice(-8,-1).find(d=>d.weight_kg??d.weight)?.weight_kg ?? intervalsData?.days?.slice(-8,-1).find(d=>d.weight_kg??d.weight)?.weight ?? null
        const weightDelta = weight2&&weightPrev ? Math.round((weight2-weightPrev)*10)/10 : null

        const todayWorkouts = (workouts||[]).filter(w=>w.date===todayStr2)
        const workoutCount = todayWorkouts.length

        const cells = [
          { icon:'👟', val: steps2>=1000?`${(steps2/1000).toFixed(1)}k`:steps2||'—', lbl:'pași', sub: steps2?`${stepsPct}%`:'—', subColor: stepsPct>=100?c.green:stepsPct>=70?c.blue:c.text4 },
          { icon:'😴', val: sleepH2?`${Math.floor(sleepH2)}h${Math.round((sleepH2%1)*60)}m`:'—', lbl:'somn', sub:sleepH2?sleepLabel:'—', subColor:sleepColor },
          { icon:'🔥', val: calBurned2?`${calBurned2}`:'—', lbl:'kcal arse', sub:calBurned2?`${calBurnedPct>100?'+':''}${calBurnedPct}%`:'—', subColor:calBurnedColor },
          { icon:'🍽️', val: calCons2?`${calCons2}`:'—', lbl:'kcal cons.', sub:calCons2?`${calConsPct}%`:'—', subColor:c.text4 },
          { icon:'❤️', val: hrRest2?`${hrRest2}`:'—', lbl:'bpm repaus', sub:hrRest2?'repaus':'—', subColor:hrColor },
          { icon:'📈', val: hrv2?`${Math.round(hrv2)}`:'—', lbl:'HRV ms', sub:hrvDelta!=null?(hrvDelta>0?`+${hrvDelta}`:`${hrvDelta}`):'—', subColor:hrvColor },
          { icon:'⚖️', val: weight2?`${Math.round(weight2*10)/10}`:'—', lbl:'kg', sub:weightDelta!=null?(weightDelta>0?`+${weightDelta}`:weightDelta===0?'=':String(weightDelta)):'—', subColor:weightDelta!=null?(weightDelta<0?c.green:weightDelta>0?c.orange:c.text4):c.text4 },
          { icon:'💪', val: workoutCount||'—', lbl:'antren.', sub:workoutCount?'azi':'—', subColor:workoutCount?c.green:c.text4 },
        ]

        return (
          <AccordionCard
            title={t('📊 Ziua în cifre')}
            titleRight={<div style={{ fontSize: 10, color: c.text4 }}>{new Date().toLocaleDateString('ro-RO',{weekday:'short',day:'numeric',month:'short'})}</div>}
            containerStyle={{ background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '1rem' }}
            c={c}
          >
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap: 6 }}>
              {cells.map((cell,i) => (
                <div key={i} style={{ background: c.card2, borderRadius: 10, padding:'10px 6px', textAlign:'center' }}>
                  <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 4 }}>{cell.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text, lineHeight: 1 }}>{cell.val}</div>
                  <div style={{ fontSize: 9, color: c.text4, marginTop: 3, lineHeight: 1.2 }}>{t(cell.lbl)}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: cell.subColor, marginTop: 2 }}>{t(cell.sub)}</div>
                </div>
              ))}
            </div>
            {/* SLOT MEDALII — se va activa cand sistemul de medalii e integrat */}
            {false && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${c.border}`, display:'flex', gap: 6, alignItems:'center' }}>
                <div style={{ fontSize: 10, color: c.text4 }}>🏅 Medalii azi:</div>
              </div>
            )}
          </AccordionCard>
        )
      }

      case 'weather':
        if (!weather) return null
        return (
          <div style={s.card}>
            <div style={s.sectionLabel}>Detalii meteo</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              <div><div style={{ fontSize: 10, color: c.text4 }}>Temperatură</div><div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{weather.temperature_c}°C</div></div>
              <div><div style={{ fontSize: 10, color: c.text4 }}>Presiune</div><div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{weather.pressure_hpa} hPa</div></div>
            </div>
          </div>
        )

      case 'circadian': {
        // ── Date pentru widget circadian ────────────────────────────────────
        const now = new Date()
        const hour = now.getHours() + now.getMinutes() / 60

        // Estimare ora de trezire din datele de somn
        const sleepH = combinedSleep?.total_h || 7.5
        const wakeHour = (() => {
          // Folosim ora curenta ca referinta - daca e dimineata devreme, presupunem ca s-a trezit recent
          if (hour >= 5 && hour <= 10) return hour - 0.5 // trezit recent
          return 7 // fallback: trezire la 7:00
        })()
        const bedHour = wakeHour - sleepH // ora de culcare estimata

        // Model circadian simplificat bazat pe ora de trezire
        // Peak cognitiv: +2-4h după trezire
        // Peak fizic: +5-8h după trezire
        // Post-lunch dip: +6-7h după trezire
        // Seara: pregătire somn
        const hoursAwake = hour - wakeHour
        const getCircadianPhase = (h) => {
          const ha = h - wakeHour
          if (ha < 0 || ha > 17) return { phase: 'somn', label: 'Timp de somn', icon: '😴', color: '#5C8FD6', energy: 20 }
          if (ha < 1)   return { phase: 'trezire', label: 'Trezire — nivel scăzut', icon: '🌅', color: '#F0A830', energy: 35 }
          if (ha < 2)   return { phase: 'activare', label: 'Activare cortizol', icon: '⚡', color: '#F0A830', energy: 55 }
          if (ha < 4)   return { phase: 'peak_cog', label: 'Peak cognitiv 🧠', icon: '🧠', color: '#9FD66B', energy: 90 }
          if (ha < 6)   return { phase: 'peak_fiz', label: 'Peak fizic 💪', icon: '💪', color: '#9FD66B', energy: 85 }
          if (ha < 7.5) return { phase: 'dip', label: 'Post-prânz — dip', icon: '😪', color: '#F0A830', energy: 55 }
          if (ha < 10)  return { phase: 'recovery', label: 'Recuperare după-amiaza', icon: '🔄', color: '#97C459', energy: 70 }
          if (ha < 13)  return { phase: 'seara', label: 'Seară — relaxare', icon: '🌆', color: '#F0A830', energy: 45 }
          return { phase: 'culcare', label: 'Pregătire somn', icon: '🌙', color: '#5C8FD6', energy: 25 }
        }

        const currentPhase = getCircadianPhase(hour)

        // Fereastra de alimentatie (eating window)
        const meals = [] // din intervalsData sau nutrition
        const firstMealHour = wakeHour + 1 // ideal: prima masa la 1h dupa trezire
        const lastMealHour = wakeHour + 13  // fereastra 13h dupa trezire
        const eatingWindowH = lastMealHour - firstMealHour
        const idealBedtime = wakeHour + 16  // 16h dupa trezire

        // Ora optima de antrenament (peak fizic)
        const optimalWorkoutHour = wakeHour + 5.5
        const formatH = (h) => {
          const hh = Math.floor(((h % 24) + 24) % 24)
          const mm = Math.round((h - Math.floor(h)) * 60)
          return `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}`
        }

        // Grafic energie pe 24h — 48 puncte (la 30 min)
        const energyCurve = Array.from({ length: 48 }, (_, i) => {
          const h = wakeHour + i * 0.5 - 1
          return getCircadianPhase(h).energy
        })

        const hrvAdj = intervalsHrv && intervalsHrvBaseline
          ? Math.round((intervalsHrv / intervalsHrvBaseline - 1) * 100)
          : 0
        const energyAdj = Math.max(-20, Math.min(20, hrvAdj * 0.5))
        const currentEnergy = Math.min(100, Math.max(5, currentPhase.energy + energyAdj))

        return (
          <AccordionCard
            title={t('🌙 Ritm Circadian')}
            containerStyle={s.card}
            c={c}
          >

            {/* Faza curentă */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', background: c.card2, borderRadius: c.radiusSm }}>
              <div style={{ fontSize: 28 }}>{currentPhase.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: currentPhase.color }}>{t(currentPhase.label)}</div>
                <div style={{ fontSize: 11, color: c.text4, marginTop: 2 }}>
                  {hour.toFixed(0) !== (wakeHour).toFixed(0)
                    ? `${hoursAwake < 0 ? '—' : `${Math.floor(Math.max(0,hoursAwake))}h ${Math.round((Math.max(0,hoursAwake) % 1) * 60)}min ${t('de la trezire')}`}`
                    : t('Prima oră după trezire')}
                </div>
              </div>
              {/* Mini ring energie */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: currentPhase.color }}>{currentEnergy}%</div>
                <div style={{ fontSize: 10, color: c.text4 }}>{t('energie')}</div>
              </div>
            </div>

            {/* Grafic energie zilnică — SVG simplu */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: c.text4, marginBottom: 4 }}>{t('Nivelul de energie estimat pe parcursul zilei')}</div>
              <svg width="100%" height="52" viewBox="0 0 192 52" preserveAspectRatio="none" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="circGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9FD66B" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="#9FD66B" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {/* Zona umpluta */}
                <path
                  d={`M 0 ${52 - energyCurve[0] * 0.44} ` +
                    energyCurve.map((e, i) => `L ${i * 4} ${52 - e * 0.44}`).join(' ') +
                    ` L ${191} 52 L 0 52 Z`}
                  fill="url(#circGrad)"
                />
                {/* Linia */}
                <path
                  d={`M 0 ${52 - energyCurve[0] * 0.44} ` +
                    energyCurve.map((e, i) => `L ${i * 4} ${52 - e * 0.44}`).join(' ')}
                  fill="none" stroke="#9FD66B" strokeWidth="1.5"
                />
                {/* Indicator ora curenta */}
                {(() => {
                  const idx = Math.min(47, Math.round(hoursAwake * 2))
                  const x = idx * 4
                  const y = 52 - currentEnergy * 0.44
                  return (
                    <g>
                      <line x1={x} y1="0" x2={x} y2="52" stroke={currentPhase.color} strokeWidth="1" strokeDasharray="2,2"/>
                      <circle cx={x} cy={y} r="3" fill={currentPhase.color}/>
                    </g>
                  )
                })()}
              </svg>
              {/* Etichete ore */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: c.text4, marginTop: 2 }}>
                <span>{formatH(wakeHour)}</span>
                <span>{formatH(wakeHour + 4)}</span>
                <span>{formatH(wakeHour + 8)}</span>
                <span>{formatH(wakeHour + 12)}</span>
                <span>{formatH(wakeHour + 16)}</span>
              </div>
            </div>

            {/* Grid 4 recomandări */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <div style={{ background: c.card2, borderRadius: c.radiusSm, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: c.text4 }}>💪 {t('Antrenament optim')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.green }}>{formatH(optimalWorkoutHour)}</div>
                <div style={{ fontSize: 10, color: c.text4 }}>{t('peak fizic')}</div>
              </div>
              <div style={{ background: c.card2, borderRadius: c.radiusSm, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: c.text4 }}>🌙 {t('Ora optimă somn')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#5C8FD6' }}>{formatH(idealBedtime)}</div>
                <div style={{ fontSize: 10, color: c.text4 }}>16h {t('după trezire')}</div>
              </div>
              <div style={{ background: c.card2, borderRadius: c.radiusSm, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: c.text4 }}>🍽️ {t('Fereastră alimentație')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.orange }}>{formatH(firstMealHour)} — {formatH(lastMealHour)}</div>
                <div style={{ fontSize: 10, color: c.text4 }}>{eatingWindowH}h {t('interval')}</div>
              </div>
              <div style={{ background: c.card2, borderRadius: c.radiusSm, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: c.text4 }}>🧠 {t('Peak cognitiv')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.green }}>{formatH(wakeHour + 2)} — {formatH(wakeHour + 4)}</div>
                <div style={{ fontSize: 10, color: c.text4 }}>{t('focus maxim')}</div>
              </div>
            </div>

            {/* Avertisment eating window */}
            {hour > lastMealHour && hour < idealBedtime && (
              <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(226,75,74,0.10)', borderRadius: c.radiusSm, border: '0.5px solid rgba(226,75,74,0.3)' }}>
                <div style={{ fontSize: 11, color: '#E24B4A' }}>{lang === 'en' ? `🌙 The eating window closed at ${formatH(lastMealHour)} — avoid meals now for quality sleep.` : `🌙 Fereastra de alimentație s-a închis la ${formatH(lastMealHour)} — evită mesele acum pentru un somn de calitate.`}</div>
              </div>
            )}
          </AccordionCard>
        )
      }

      // ── ECG WITHINGS — card upload + ultimul rezultat ────────────────────
      case 'ecg_upload': {
        const lastEcg = ecgRecords[0] || null
        const ecgStatusColor = (s, col) => {
          if (col) return col
          if (s === 'normal')    return '#22c55e'
          if (s === 'attention') return '#f59e0b'
          if (s === 'critical')  return '#ef4444'
          if (s === 'analyzing') return '#818cf8'
          return c.text4
        }
        const ecgBusy = ecgUploading || ecgAnalyzing
        // Mini ECG SVG — undă PQRST schematică, culoare dinamică
        const EcgWave = ({ color = '#ef4444', flat = false }) => (
          <svg width="100%" height="36" viewBox="0 0 240 36" style={{ display:'block' }}>
            <line x1="0" y1="1" x2="240" y2="1" stroke={`${color}18`} strokeWidth=".5"/>
            <line x1="0" y1="18" x2="240" y2="18" stroke={`${color}18`} strokeWidth=".5"/>
            <line x1="0" y1="35" x2="240" y2="35" stroke={`${color}18`} strokeWidth=".5"/>
            {flat
              ? <line x1="0" y1="18" x2="240" y2="18" stroke={`${color}40`} strokeWidth="1" strokeDasharray="6 5"/>
              : <polyline fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                  points="0,18 7,18 9,15 11,18 17,18 19,18 21,12 23,1 25,32 27,18 33,18 35,18 37,15 39,18 45,18 47,18 49,12 51,1 53,32 55,18 61,18 63,18 65,15 67,18 73,18 75,18 77,12 79,1 81,32 83,18 89,18 91,18 93,15 95,18 101,18 103,18 105,12 107,1 109,32 111,18 117,18 119,18 121,15 123,18 129,18 131,18 133,12 135,1 137,32 139,18 145,18 147,18 149,15 151,18 157,18 159,18 161,12 163,1 165,32 167,18 173,18 175,18 177,15 179,18 185,18 187,18 189,12 191,1 193,32 195,18 201,18 203,18 205,15 207,18 213,18 215,18 217,12 219,1 221,32 223,18 229,18 231,18 233,15 235,18 240,18"/>
            }
          </svg>
        )
        const ecgColor = lastEcg ? ecgStatusColor(lastEcg.status, lastEcg.result_color) : '#ef4444'
        return (
          <div style={{ background: isDark ? `${ecgColor}0d` : `${ecgColor}08`, border: `1px solid ${ecgColor}35`, borderRadius: c.radiusMd, padding: CARD_GAP, marginBottom: CARD_GAP }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:`${ecgColor}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={ecgColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:c.text }}>ECG Withings</div>
                  <div style={{ fontSize:10, color:c.text4 }}>{t('Analiză AI')} · 5 {t('derivații')}</div>
                </div>
              </div>
              {ecgRecords.length > 0 && (
                <div style={{ fontSize:10, color:c.text4 }}>{ecgRecords.length} {t('înregistrări')}</div>
              )}
            </div>

            {/* Mini wave */}
            <div style={{ background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)', borderRadius:8, padding:'6px 8px', marginBottom:10 }}>
              <EcgWave color={ecgColor} flat={!lastEcg || lastEcg.status === 'analyzing'}/>
            </div>

            {/* Ultimul rezultat */}
            {lastEcg && (
              <div style={{ marginBottom:10 }}>
                {lastEcg.status === 'analyzing' ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:isDark?'rgba(129,140,248,0.1)':'rgba(129,140,248,0.08)', borderRadius:8 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:'#818cf8', animation:'ecgPulse 1.2s infinite' }}/>
                    <span style={{ fontSize:11, color:'#818cf8' }}>{t('AI analizează ECG-ul... (5 derivații)')}</span>
                  </div>
                ) : (
                  <div style={{ padding:'9px 11px', background:isDark?`${ecgColor}12`:`${ecgColor}0a`, border:`1px solid ${ecgColor}30`, borderRadius:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ecgColor} strokeWidth="2.5" strokeLinecap="round">
                        {lastEcg.status === 'normal'
                          ? <polyline points="20 6 9 17 4 12"/>
                          : <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/>
                        }
                      </svg>
                      <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:ecgColor }}>{lastEcg.result_label ? t(lastEcg.result_label) : t('Analizat')}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                          {(lastEcg.measured_at || lastEcg.uploaded_at) && (
                            <span style={{ fontSize:9.5, color:c.text4 }}>
                              {new Date(lastEcg.measured_at || lastEcg.uploaded_at).toLocaleDateString('ro-RO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          )}
                          {lastEcg.device_brand && lastEcg.device_brand !== 'Necunoscut' && (
                            <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:`${ecgColor}15`, color:ecgColor, fontWeight:600 }}>
                              {lastEcg.device_brand}
                            </span>
                          )}
                        </div>
                      </div>
                      {lastEcg.bpm_avg && <span style={{ marginLeft:'auto', fontSize:10, color:c.text4 }}>{lastEcg.bpm_avg} bpm avg</span>}
                    </div>
                    {lastEcg.result_summary && (
                      <div style={{ fontSize:10.5, color:c.text3, lineHeight:1.5, marginBottom:6 }}>{lastEcg.result_summary}</div>
                    )}
                    {lastEcg.result_tags && lastEcg.result_tags.length > 0 && (
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {(Array.isArray(lastEcg.result_tags) ? lastEcg.result_tags : JSON.parse(lastEcg.result_tags || '[]')).map((tag, ti) => (
                          <span key={ti} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:`${ecgColor}18`, color:ecgColor, fontWeight:600 }}>✓ {tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Upload button */}
            <input ref={ecgFileRef} type="file" accept="application/pdf,.pdf" style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleEcgUpload(f) }}/>
            <button
              onClick={() => ecgFileRef.current?.click()}
              disabled={ecgBusy}
              style={{ width:'100%', background:`${ecgColor}12`, border:`1.5px dashed ${ecgColor}60`, borderRadius:9, padding:'9px 0', cursor:ecgBusy?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:ecgBusy?0.6:1, fontFamily:'inherit' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ecgColor} strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style={{ fontSize:12, fontWeight:600, color:ecgColor }}>
                {ecgUploading ? t('Se încarcă...') : ecgAnalyzing ? t('AI analizează...') : ecgRecords.length > 0 ? t('+ Adaugă EKG nou') : t('Încarcă PDF EKG (Withings, Garmin, Samsung...)')}
              </span>
            </button>

            {/* CSS pentru animație */}
            <style>{`
              @keyframes ecgPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
              @keyframes spin{to{transform:rotate(360deg)}}
              .activitate-page{position:relative;}
              .activitate-page::before{
                content:'';
                position:fixed;
                top:0;left:0;right:0;bottom:0;
                background:url('/activity-bg.jpg') center top / contain no-repeat;
                background-color:var(--act-bg,#12121A);
                filter:blur(3px);
                transform:scale(1.06);
                z-index:0;
                pointer-events:none;
              }
              .activitate-page > *{position:relative;z-index:1;}
            `}</style>
          </div>
        )
      }

      default:
        return null
    }
  }

  // Skeleton la loading inițial
  if (hevyLoading && withingsLoading && !workouts.length) {
    return (
      <div style={{ minHeight: '100vh', background: c.bg, padding: isMobile ? '0.75rem' : '1rem', fontFamily: c.fontFamily, maxWidth: 860, margin: '0 auto', boxSizing: 'border-box' }}>
        <SkeletonDashboard c={c} isMobile={isMobile}/>
      </div>
    )
  }

  return (
    <div style={s.page} className={tab === 'activitate' ? 'activitate-page' : undefined} {...swipeHandlers} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <BirthdayModal birthDate={userProfile?.birth_date} name={userName} userId={user?.id} />
      {/* CSS override pentru componente header în tab 'today' — face weather și bell transparente */}

      {/* Header */}
      <div style={s.header}>
        {/* Stânga: clopoțel · meteo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NotificationBell transparent={tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history'}/>
          <WeatherWidget c={c} onWeatherUpdate={setWeather} transparent={tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history'}/>
        </div>

        {/* Centru: dată + oră */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.3 }}>
          <div style={{ fontSize: 9, color: tab === 'sleep' ? 'rgba(147,197,253,.5)' : (tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'rgba(255,255,255,.75)' : c.text3, textAlign: 'center' }}>{today}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: (tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'rgba(255,255,255,.95)' : c.text }}><Clock /></div>
        </div>

        {/* Dreapta: rank · temă · favicon · profil cu arc verde */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setTab('rank')} title={`${currentRank.name} · ${totalRankPoints}p`}
            style={{ height: 34, padding: '0 9px', borderRadius: c.radiusSm, background: (tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'transparent' : c.card, border: (tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'none' : `1px solid ${currentRank.color}44`, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, boxShadow: (tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'none' : c.shadowCard, color: (tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'rgba(255,255,255,.8)' : currentRank.color, fontFamily: 'inherit', fontWeight: 700 }}>
            <span>{currentRank.icon}</span>
            <span style={{ fontSize: 11 }}>{totalRankPoints}p</span>
          </button>
          <button onClick={toggleTheme}
            title={themeMode === 'dark' ? 'Temă: Întunecat → apasă pentru Luminos' : themeMode === 'light' ? 'Temă: Luminos → apasă pentru Auto' : 'Temă: Auto → apasă pentru Întunecat'}
            style={{ width: 34, height: 34, borderRadius: '50%', background: (tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'transparent' : c.card, border: (tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'none' : (isAuto ? `1px solid ${c.green}` : `1px solid ${c.border}`), cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: (tab === 'today' || tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'none' : c.shadowCard, color: (tab === 'sleep' || tab === 'activitate' || tab === 'nutrition' || tab === 'history') ? 'rgba(255,255,255,.8)' : c.text3, fontFamily: 'inherit', flexShrink: 0 }}>
            {themeMode === 'dark' ? '🌙' : themeMode === 'light' ? '☀️' : '✨'}
          </button>
          <DynamicFavicon score={readiness.score} />
          <div style={{ position: 'relative' }}>
            {/* Profil — arc deschis verde */}
            <div onClick={() => setMenuOpen(!menuOpen)} style={{ position: 'relative', width: 44, height: 44, cursor: 'pointer', flexShrink: 0 }}>
              <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
                <circle cx="22" cy="22" r="19"
                  fill="none"
                  stroke={c.green}
                  strokeWidth="1.5"
                  strokeDasharray="79.6 39.8"
                  strokeLinecap="round"
                  transform="rotate(280 22 22)"/>
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: '50%', background: c.card, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {userAvatar
                  ? <img src={userAvatar} alt="" width="36" height="36" style={{ borderRadius: '50%', objectFit: 'cover' }}/>
                  : <span style={{ fontSize: 14, color: c.accent, fontWeight: 600 }}>{userName?.[0] || 'M'}</span>}
              </div>
            </div>
            {menuOpen && (
              <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }}/>
              <div style={{ position: 'absolute', right: 0, top: 44, background: c.card3, border: 'none', borderRadius: c.radiusSm, padding: '8px 0', minWidth: 190, zIndex: 100, boxShadow: c.shadowHero }}>
                <div style={{ padding: '6px 16px', fontSize: 13, color: c.text3 }}>{userName}</div>
                <div style={{ height: '0.5px', background: c.border, margin: '4px 0' }}/>
                <div onClick={() => window.location.href='/profile'} style={{ padding: '8px 16px', fontSize: 13, color: c.text, cursor: 'pointer' }}>Profil & Setări</div>
                <div onClick={() => window.location.href='/progress'} style={{ padding: '8px 16px', fontSize: 13, color: c.blue, cursor: 'pointer' }}>📈 Progres 30/90z</div>
                <div onClick={() => window.location.href='/workout'} style={{ padding: '8px 16px', fontSize: 13, color: c.orange, cursor: 'pointer' }}>💪 Antrenament</div>
                <div onClick={() => window.location.href='/health'} style={{ padding: '8px 16px', fontSize: 13, color: c.red, cursor: 'pointer' }}>{t('❤️ Sănătate')}</div>
                <div onClick={() => window.location.href='/nutrition'} style={{ padding: '8px 16px', fontSize: 13, color: c.green, cursor: 'pointer' }}>📸 Nutriție & Scanare AI</div>
                <div onClick={() => { setShowShare(true); setMenuOpen(false) }} style={{ padding: '8px 16px', fontSize: 13, color: c.blue, cursor: 'pointer' }}>↗ Partajează scorul</div>
                <div onClick={function(){ setShowNotifSettings(function(p){ return !p }) }}
                  style={{ padding: '8px 16px', fontSize: 13, color: notifStatus === 'granted' ? c.green : c.orange, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{notifStatus === 'granted' ? '🔔 Notificări active' : '🔔 Activează notificări'}</span>
                  <span style={{ fontSize: 10, color: c.text4 }}>⚙️</span>
                </div>
                {showNotifSettings ? <NotifSettingsPanel c={c} notifStatus={notifStatus} requestNotifications={requestNotifications} notifPrefs={notifPrefs} setNotifPrefs={setNotifPrefs}/> : null}
                {notifStatus !== 'granted' && false && (
                  <div style={{ padding: '8px 16px', fontSize: 13, color: c.orange, cursor: 'pointer' }}>🔔 Activează notificări push</div>
                )}
                <div onClick={signOut} style={{ padding: '8px 16px', fontSize: 13, color: c.red, cursor: 'pointer' }}>Deconectare</div>
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {showOnboarding && (
        <OnboardingFlow
          userId={user?.id}
          onComplete={() => setShowOnboarding(false)}
          onGoToProfile={() => { setShowOnboarding(false); window.location.href = '/profile' }}
        />
      )}

      <AchievementToast
        achievement={achievement}
        onClose={() => setAchievement(null)}
      />

      {/* Tab row — vizibil doar pe desktop; pe mobile navigarea e in bottom nav */}
      {!isMobile && (
        <div style={s.tabRow}>
          {[['today','Astăzi'],['sleep','Somn'],['activitate','Activitate'],['nutrition','Nutriție'],['history','📊 Statistici'],['rank','🏆 Rank']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>{t(label)}</button>
          ))}
        </div>
      )}

      {/* ── TAB: ASTĂZI ── */}
      {tab === 'today' && (
        <div style={{ position: 'relative', zIndex: 0 }}>
          {/* ── Inima Vitalitate — puls în fundal, sus-dreapta ── */}
          <style>{`
            @keyframes vitalHeartbeat{0%{transform:scale(1)}7%{transform:scale(1.13)}14%{transform:scale(1)}22%{transform:scale(1.08)}30%{transform:scale(1)}100%{transform:scale(1)}}
            @keyframes vitalGlow{0%,100%{filter:drop-shadow(0 0 5px rgba(255,200,60,0.30))}7%{filter:drop-shadow(0 0 16px rgba(255,215,80,0.85))}22%{filter:drop-shadow(0 0 11px rgba(255,215,80,0.6))}}
            @keyframes vitalRing{0%{transform:scale(0.7);opacity:0}6%{opacity:0.5}70%{transform:scale(1.9);opacity:0}100%{opacity:0}}
          `}</style>
          <div aria-hidden="true" style={{ position: 'absolute', top: 4, right: -6, width: 160, height: 160, zIndex: -1, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,215,90,0.4)', opacity: 0.15, animation: 'vitalRing 1.09s ease-out infinite' }}/>
            <img src="/vitalitate.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.15, animation: 'vitalHeartbeat 1.09s ease-in-out infinite, vitalGlow 1.09s ease-in-out infinite', transformOrigin: 'center' }}/>
          </div>

          {layoutEditMode && (
            <div style={{ background: c.card, borderRadius: c.radiusSm, padding: '1rem', marginBottom: '1.1rem', boxShadow: c.shadowCard }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Adaugă widget</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(dashboardLayout || getDefaultLayout()).filter(w => !w.visible).map(w => {
                  const meta = WIDGET_REGISTRY.find(r => r.id === w.id)
                  return (
                    <button key={w.id} onClick={() => toggleWidget(w.id)}
                      style={{ fontSize: 12, padding: '6px 12px', background: c.card2, border: 'none', borderRadius: 10, color: c.text3, cursor: 'pointer', fontFamily: 'inherit' }}>
                      + {meta?.label ? t(meta.label) : w.id}
                    </button>
                  )
                })}
                {(dashboardLayout || getDefaultLayout()).filter(w => !w.visible).length === 0 && (
                  <div style={{ fontSize: 12, color: c.text4 }}>Toate widget-urile disponibile sunt deja afișate.</div>
                )}
              </div>
            </div>
          )}

          {(() => {
            const SMALL_IDS = new Set(['ihrv','isleep','ihrrest','iweight','vo2maxcard','calsburned','qsteps','qsleep','qweight','qworkouts','qctl'])
            const GAP = 8 // gap consistent pentru toate gridurile
            const visibleWidgets = (dashboardLayout || getDefaultLayout()).filter(w => w.visible)

            // Grupăm secvențele consecutive de carduri mici într-un singur rând grid
            const groups = []
            let i = 0
            while (i < visibleWidgets.length) {
              const w = visibleWidgets[i]
              if (SMALL_IDS.has(w.id)) {
                const group = []
                while (i < visibleWidgets.length && SMALL_IDS.has(visibleWidgets[i].id)) {
                  group.push(visibleWidgets[i]); i++
                }
                groups.push({ type: 'small', widgets: group })
              } else {
                groups.push({ type: 'full', widget: w }); i++
              }
            }

            return groups.map((group, gi) => {
              if (group.type === 'small') {
                const maxCols = isMobile ? 2 : 4
                const cols = Math.min(group.widgets.length, maxCols)
                return (
                  <div key={`sg-${gi}`} style={{ marginBottom: '1rem' }}>
                    {/* Bara de editare pentru întregul rând de carduri mici */}
                    {layoutEditMode && (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: GAP, marginBottom: 4 }}>
                        {group.widgets.map(w => {
                          const globalIdx = visibleWidgets.findIndex(v => v.id === w.id)
                          const shortLabel = (WIDGET_REGISTRY.find(r => r.id === w.id)?.label || w.id)
                            .replace(/📈 Intervals\.icu — /, '').replace(/📊 /,'').replace(/👟 /,'').replace(/😴 /,'').replace(/⚖️ /,'').replace(/💪 /,'').replace(/🔋 /,'').replace(/🫁 /,'').replace(/🔥 /,'')
                          return (
                            <div key={w.id} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c.card2, borderRadius: 8, padding: '3px 6px', minWidth: 0 }}>
                              <span style={{ fontSize: 10, color: c.text3, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{shortLabel}</span>
                              <div style={{ display: 'flex', gap: 1, flexShrink: 0, marginLeft: 2 }}>
                                <button onClick={() => moveWidget(w.id, -1)} disabled={globalIdx === 0}
                                  style={{ width: 18, height: 18, background: 'transparent', border: 'none', color: c.text3, cursor: 'pointer', fontSize: 11, padding: 0, opacity: globalIdx === 0 ? 0.3 : 1 }}>↑</button>
                                <button onClick={() => moveWidget(w.id, 1)} disabled={globalIdx === visibleWidgets.length - 1}
                                  style={{ width: 18, height: 18, background: 'transparent', border: 'none', color: c.text3, cursor: 'pointer', fontSize: 11, padding: 0, opacity: globalIdx === visibleWidgets.length - 1 ? 0.3 : 1 }}>↓</button>
                                <button onClick={() => toggleWidget(w.id)}
                                  style={{ width: 18, height: 18, background: 'transparent', border: 'none', color: c.red, cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* Gridul de carduri — același gap și coloane indiferent de modul editare */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: GAP }}>
                      {group.widgets.map(w => {
                        const content = renderWidget(w.id)
                        if (!content) return <div key={w.id}/>
                        return (
                          <div key={w.id} style={layoutEditMode ? { outline: `1.5px dashed ${c.border}`, borderRadius: c.radiusSm } : undefined}>
                            {content}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              } else {
                // Widget full-width
                const w = group.widget
                const meta = WIDGET_REGISTRY.find(r => r.id === w.id)
                const content = renderWidget(w.id)
                if (!content) return null
                const globalIdx = visibleWidgets.findIndex(v => v.id === w.id)
                return (
                  <React.Fragment key={w.id}>
                    <div style={{ marginBottom: layoutEditMode ? 0 : CARD_GAP, position: 'relative' }}>
                      {layoutEditMode && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c.card2, borderRadius: '8px 8px 0 0', padding: '5px 10px', marginBottom: 1 }}>
                          <span style={{ fontSize: 11, color: c.text3, fontWeight: 600 }}>{meta?.label ? t(meta.label) : w.id}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => moveWidget(w.id, -1)} disabled={globalIdx === 0}
                              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: c.text3, cursor: 'pointer', fontSize: 13, opacity: globalIdx === 0 ? 0.3 : 1 }}>↑</button>
                            <button onClick={() => moveWidget(w.id, 1)} disabled={globalIdx === visibleWidgets.length - 1}
                              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: c.text3, cursor: 'pointer', fontSize: 13, opacity: globalIdx === visibleWidgets.length - 1 ? 0.3 : 1 }}>↓</button>
                            <button onClick={() => toggleWidget(w.id)}
                              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: c.red, cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </div>
                        </div>
                      )}
                      <div style={layoutEditMode ? { outline: `1.5px dashed ${c.border}`, borderRadius: layoutEditMode ? `0 0 ${c.radiusSm} ${c.radiusSm}` : c.radiusSm, marginBottom: '0.75rem' } : undefined}>
                        {content}
                      </div>
                    </div>
                    {w.id === 'hero' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: -4, marginBottom: '0.5rem' }}>
                        {layoutSaving && <span style={{ fontSize: 11, color: c.text4 }}>💾 se salvează...</span>}
                        {!layoutSaving && !layoutEditMode && dashboardLayout && <span style={{ fontSize: 11, color: c.text4 }}>✓ {t('layout salvat')}</span>}
                        <button onClick={() => setLayoutEditMode(o => !o)}
                          style={{ fontSize: 12, padding: '5px 12px', background: layoutEditMode ? c.green3 : c.card2, border: 'none', borderRadius: c.radiusSm, color: layoutEditMode ? c.green : c.text3, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                          {layoutEditMode ? t('✓ Gata') : t('⚙️ Editează pagina')}
                        </button>
                      </div>
                    )}
                  </React.Fragment>
                )
              }
            })
          })()}
        </div>
      )}

      {/* ── TAB: SOMN ── */}
      {tab === 'sleep' && (() => {
        const sleepDays7 = (intervalsData?.days || []).slice(-7)
        const sleepTarget = userProfile?.target_sleep_hours || 7.5
        const totalSleepWeek = sleepDays7.reduce((s, d) => s + (d.sleep_hours || 0), 0)
        const avgSleepWeek = sleepDays7.length ? totalSleepWeek / sleepDays7.length : 0
        const sleepDebt = sleepTarget * 7 - totalSleepWeek
        const nightsOk = sleepDays7.filter(d => (d.sleep_hours || 0) >= sleepTarget).length
        const consistencyPct = sleepDays7.length ? Math.round((nightsOk / sleepDays7.length) * 100) : null
        const slpDayLabels = lang === 'en' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']
        return (
          <div style={{ position: 'relative', zIndex: 0 }}>
            {/* ── Luna Somn — stele animate în fundal, sus-dreapta ── */}
            <style>{`
              @keyframes somnStarTwinkle{0%,100%{opacity:0.15;transform:scale(0.5)}50%{opacity:1;transform:scale(1)}}
            `}</style>
            <div aria-hidden="true" style={{ position: 'absolute', top: 6, right: -4, width: 130, height: 120, zIndex: -1, pointerEvents: 'none', opacity: 0.15 }}>
              {/* Luna — imaginea ta exactă */}
              <img src="/luna.png" alt="" style={{ position: 'absolute', left: 4, top: 14, width: 90, height: 'auto', display: 'block' }}/>
              {/* Stele animate în jurul lunii */}
              <svg width="130" height="120" viewBox="0 0 130 120" fill="none" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
                <defs><linearGradient id="somnStarGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fff2b0"/><stop offset="50%" stopColor="#ffd54a"/><stop offset="100%" stopColor="#c8940f"/>
                </linearGradient></defs>
                {[[104,26,3],[116,42,2.4],[98,16,2],[122,58,3],[108,70,2.4],[92,50,1.8],[124,34,1.8],[110,84,2.6],[86,78,1.8],[102,94,2.2],[120,76,1.8],[90,32,1.8]].map(([cx,cy,r],i) => {
                  const d = `M${cx} ${cy-r} L${cx+r*0.28} ${cy-r*0.28} L${cx+r} ${cy} L${cx+r*0.28} ${cy+r*0.28} L${cx} ${cy+r} L${cx-r*0.28} ${cy+r*0.28} L${cx-r} ${cy} L${cx-r*0.28} ${cy-r*0.28} Z`
                  return <path key={i} d={d} fill="url(#somnStarGrad)" style={{ transformOrigin: `${cx}px ${cy}px`, animation: `somnStarTwinkle 2.5s ease-in-out ${(i*0.27).toFixed(2)}s infinite` }}/>
                })}
              </svg>
            </div>

            {/* ── HERO SOMN — design albastru cu navigație zile ── */}
            {(() => {
              const allSleepDays = (intervalsData?.days || []).filter(d => (d.sleep_hours || 0) > 0)
              const maxOffset = Math.max(0, allSleepDays.length - 1)
              const clampedOffset = Math.min(sleepDayOffset, maxOffset)

              // viewSleep: datele pentru ziua vizualizată
              const viewSleep = clampedOffset === 0
                ? combinedSleep
                : (() => {
                    const d = allSleepDays[allSleepDays.length - 1 - clampedOffset + 1]
                    if (!d) return null
                    return { source: 'intervals', total_h: d.sleep_hours || 0, deep_h: d.sleep_deep_h ?? null, rem_h: d.sleep_rem_h ?? null, light_h: d.sleep_light_h ?? null, awake_h: d.sleep_awake_h ?? null, score: d.sleep_score ?? null, hrv: d.hrv ?? null, hr: d.sleep_hr_avg ?? null, date: d.date }
                  })()

              if (!viewSleep && !combinedSleep) return null
              const vs = viewSleep || {}

              const sc       = vs.score || (vs.total_h ? Math.min(100, Math.round((vs.total_h / 8) * 100)) : null)
              const scLabel  = sc >= 80 ? 'Bun' : sc >= 60 ? 'Moderat' : sc != null ? 'Slab' : '—'
              const scColor  = sc >= 80 ? '#1D4ED8' : sc >= 60 ? '#B45309' : sc != null ? '#B91C1C' : '#9CA3AF'
              const scBg     = sc >= 80 ? 'rgba(29,78,216,.08)' : sc >= 60 ? 'rgba(217,119,6,.08)' : sc != null ? 'rgba(185,28,28,.08)' : 'transparent'
              const scBorder = sc >= 80 ? 'rgba(29,78,216,.22)' : sc >= 60 ? 'rgba(217,119,6,.22)' : sc != null ? 'rgba(185,28,28,.22)' : 'transparent'

              const totalH  = vs.total_h  || 0
              const deepH   = vs.deep_h   || 0
              const remH    = vs.rem_h    || 0
              const awakeH  = vs.awake_h  || 0
              const remPct  = totalH > 0 && remH  > 0 ? Math.round((remH  / totalH) * 100) : null
              const deepPct = totalH > 0 && deepH > 0 ? Math.round((deepH / totalH) * 100) : null
              const awakePct = totalH > 0 && awakeH > 0 ? Math.round((awakeH / totalH) * 100) : null
              const effPct  = totalH > 0 ? Math.round(((totalH - awakeH) / totalH) * 100) : null

              // Coaching
              let coachMsg = null
              if (sc != null && sc < 50) coachMsg = 'Somn slab noaptea trecută. Încearcă să mergi la culcare mai devreme și evită ecranele cu 1h înainte.'
              else if (awakeH > 1.2) coachMsg = 'Ai fost treaz mai mult decât de obicei. Asigură-te că dormitorul este întunecat și răcoros.'
              else if (deepH > 0 && deepH < 0.5) coachMsg = 'Somn profund scăzut. Evită alcoolul și exercițiile intense seara.'
              else if (remH > 0 && remH < 0.75) coachMsg = 'Somn REM insuficient. Încearcă să ai un program de somn consistent.'
              else if (totalH < 6 && totalH > 0) coachMsg = 'Ore de somn insuficiente. Țintește cel puțin 7–8 ore pe noapte.'
              else if (sc != null && sc >= 80) coachMsg = 'Somn excelent! Continuă rutina actuală — consistența e cheia recuperării.'
              else if (sc != null && sc >= 65) coachMsg = 'Somn bun. Câteva ajustări mici pot duce scorul peste 80.'

              // Etichetă dată
              const dayLabel = (() => {
                const L = lang === 'en'
                if (clampedOffset === 0) return L ? 'today' : 'azi'
                const d = vs.date || ''
                if (!d) return L ? `${clampedOffset} days ago` : `acum ${clampedOffset} zile`
                const dt = new Date(d + 'T12:00:00')
                const dn = L ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] : ['Du','Lu','Ma','Mi','Jo','Vi','Sâ']
                const mn = L ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','nov','dec']
                return `${dn[dt.getDay()]} · ${dt.getDate()} ${mn[dt.getMonth()]}`
              })()

              // Culori noapte — alb/albastru deschis pe cer negru
              const nPrimary  = '#FFFFFF'
              const nSecond   = 'rgba(147,197,253,.8)'
              const nMuted    = 'rgba(147,197,253,.45)'
              const nTabBg    = 'rgba(255,255,255,.09)'
              const nTabBord  = '0.5px solid rgba(255,255,255,.12)'
              const nScCol    = sc >= 80 ? '#93C5FD' : sc >= 60 ? '#FCD34D' : sc != null ? '#FCA5A5' : '#9CA3AF'
              const nScBg     = sc >= 80 ? 'rgba(147,197,253,.15)' : sc >= 60 ? 'rgba(252,211,77,.12)' : sc != null ? 'rgba(252,165,165,.12)' : 'transparent'
              const nScBorder = sc >= 80 ? 'rgba(147,197,253,.35)' : sc >= 60 ? 'rgba(252,211,77,.3)' : sc != null ? 'rgba(252,165,165,.3)' : 'transparent'

              return (
                <>
                  {/* CSS keyframes — stele pâlpâitoare + nor deriva */}
                  <style>{`
                    @keyframes _slpTw1{0%,100%{opacity:.85}45%{opacity:.1}80%{opacity:.7}}
                    @keyframes _slpTw2{0%,100%{opacity:.55}30%{opacity:.95}65%{opacity:.15}}
                    @keyframes _slpTw3{0%,100%{opacity:.7}20%{opacity:.2}55%{opacity:.9}85%{opacity:.3}}
                    @keyframes _slpTw4{0%,100%{opacity:.4}40%{opacity:.9}70%{opacity:.2}}
                    @keyframes _slpTw5{0%,100%{opacity:.9}25%{opacity:.3}60%{opacity:.7}90%{opacity:.15}}
                    @keyframes _slpTw6{0%,100%{opacity:.3}35%{opacity:.8}75%{opacity:.1}}
                    @keyframes _slpCloud{0%,100%{transform:translateX(0)}50%{transform:translateX(9px)}}
                  `}</style>

                  {/* Hero — fundal transparent (pagina are cerul de noapte) */}
                  <div style={{ margin: '-0.75rem -1rem 0', padding: '0.75rem 1rem 0', background: 'transparent', position: 'relative' }}>

                    {/* Stele + Lună SVG — absolute peste tot hero-ul */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 375 280" preserveAspectRatio="xMidYMid slice">
                      {/* Lună: departe, vagă, ascunsă după nori */}
                      <circle cx="310" cy="44" r="26" fill="#FFFDE7" opacity=".06"/>
                      <circle cx="310" cy="44" r="18" fill="#FFFDE7" opacity=".08"/>
                      <circle cx="310" cy="44" r="13" fill="#FFF9C4" opacity=".12"/>
                      <circle cx="317" cy="40" r="13" fill="#0A1628" opacity=".75"/>
                      {/* Nori peste lună — derivă lentă */}
                      <g style={{animation:'_slpCloud 12s ease-in-out infinite'}}>
                        <ellipse cx="302" cy="52" rx="50" ry="16" fill="rgba(12,28,62,.87)"/>
                        <ellipse cx="324" cy="41" rx="34" ry="13" fill="rgba(10,24,56,.82)"/>
                        <ellipse cx="280" cy="48" rx="30" ry="11" fill="rgba(14,32,70,.8)"/>
                      </g>
                      <g style={{animation:'_slpCloud 17s ease-in-out infinite reverse'}}>
                        <ellipse cx="310" cy="62" rx="55" ry="13" fill="rgba(10,22,54,.68)"/>
                        <ellipse cx="286" cy="56" rx="26" ry="10" fill="rgba(12,28,60,.6)"/>
                      </g>
                      {/* Stele grup 1 — 2.4s */}
                      <circle cx="22" cy="16" r="1.1" fill="white" style={{animation:'_slpTw1 2.4s ease-in-out infinite',animationDelay:'0s'}}/>
                      <circle cx="145" cy="10" r=".9" fill="white" style={{animation:'_slpTw1 2.4s ease-in-out infinite',animationDelay:'.6s'}}/>
                      <circle cx="350" cy="22" r="1.2" fill="white" style={{animation:'_slpTw1 2.4s ease-in-out infinite',animationDelay:'1.2s'}}/>
                      <circle cx="68" cy="58" r=".8" fill="white" style={{animation:'_slpTw1 2.4s ease-in-out infinite',animationDelay:'1.8s'}}/>
                      <circle cx="370" cy="70" r=".7" fill="white" style={{animation:'_slpTw1 2.4s ease-in-out infinite',animationDelay:'.3s'}}/>
                      {/* Stele grup 2 — 3.1s */}
                      <circle cx="72" cy="12" r=".8" fill="white" style={{animation:'_slpTw2 3.1s ease-in-out infinite',animationDelay:'.4s'}}/>
                      <circle cx="212" cy="8" r=".9" fill="white" style={{animation:'_slpTw2 3.1s ease-in-out infinite',animationDelay:'1.1s'}}/>
                      <circle cx="112" cy="44" r=".7" fill="white" style={{animation:'_slpTw2 3.1s ease-in-out infinite',animationDelay:'.7s'}}/>
                      <circle cx="198" cy="54" r=".6" fill="white" style={{animation:'_slpTw2 3.1s ease-in-out infinite',animationDelay:'2.5s'}}/>
                      <circle cx="370" cy="46" r=".8" fill="white" style={{animation:'_slpTw2 3.1s ease-in-out infinite',animationDelay:'1.5s'}}/>
                      {/* Stele grup 3 — 4.2s */}
                      <circle cx="118" cy="18" r="1.1" fill="white" style={{animation:'_slpTw3 4.2s ease-in-out infinite',animationDelay:'.2s'}}/>
                      <circle cx="255" cy="14" r=".7" fill="white" style={{animation:'_slpTw3 4.2s ease-in-out infinite',animationDelay:'1.8s'}}/>
                      <circle cx="46" cy="34" r=".9" fill="white" style={{animation:'_slpTw3 4.2s ease-in-out infinite',animationDelay:'3.0s'}}/>
                      <circle cx="152" cy="50" r=".8" fill="white" style={{animation:'_slpTw3 4.2s ease-in-out infinite',animationDelay:'.9s'}}/>
                      <circle cx="345" cy="62" r=".7" fill="white" style={{animation:'_slpTw3 4.2s ease-in-out infinite',animationDelay:'2.2s'}}/>
                      <circle cx="18" cy="76" r=".6" fill="white" style={{animation:'_slpTw3 4.2s ease-in-out infinite',animationDelay:'3.6s'}}/>
                      {/* Stele grup 4 — 5.5s */}
                      <circle cx="226" cy="26" r=".8" fill="white" style={{animation:'_slpTw4 5.5s ease-in-out infinite',animationDelay:'.5s'}}/>
                      <circle cx="372" cy="14" r=".7" fill="white" style={{animation:'_slpTw4 5.5s ease-in-out infinite',animationDelay:'2.1s'}}/>
                      <circle cx="86" cy="66" r="1" fill="white" style={{animation:'_slpTw4 5.5s ease-in-out infinite',animationDelay:'4.0s'}}/>
                      <circle cx="242" cy="68" r=".6" fill="white" style={{animation:'_slpTw4 5.5s ease-in-out infinite',animationDelay:'1.3s'}}/>
                      {/* Stele grup 5 — 3.8s */}
                      <circle cx="40" cy="24" r=".7" fill="white" style={{animation:'_slpTw5 3.8s ease-in-out infinite',animationDelay:'1.0s'}}/>
                      <circle cx="188" cy="34" r=".9" fill="white" style={{animation:'_slpTw5 3.8s ease-in-out infinite',animationDelay:'2.6s'}}/>
                      <circle cx="326" cy="42" r=".6" fill="white" style={{animation:'_slpTw5 3.8s ease-in-out infinite',animationDelay:'.1s'}}/>
                      <circle cx="135" cy="70" r=".8" fill="white" style={{animation:'_slpTw5 3.8s ease-in-out infinite',animationDelay:'3.3s'}}/>
                      {/* Stele grup 6 — 6.2s (lente) */}
                      <circle cx="96" cy="28" r=".6" fill="rgba(200,220,255,1)" style={{animation:'_slpTw6 6.2s ease-in-out infinite',animationDelay:'2.0s'}}/>
                      <circle cx="272" cy="38" r=".7" fill="rgba(200,220,255,1)" style={{animation:'_slpTw6 6.2s ease-in-out infinite',animationDelay:'4.5s'}}/>
                      <circle cx="362" cy="80" r=".6" fill="rgba(200,220,255,1)" style={{animation:'_slpTw6 6.2s ease-in-out infinite',animationDelay:'.8s'}}/>
                      <circle cx="28" cy="88" r=".5" fill="rgba(200,220,255,1)" style={{animation:'_slpTw6 6.2s ease-in-out infinite',animationDelay:'5.1s'}}/>
                    </svg>

                    {/* Nav zile */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative', zIndex: 2 }}>
                      <button onClick={() => setSleepDayOffset(o => Math.min(o + 1, maxOffset))}
                        style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: clampedOffset >= maxOffset ? 'default' : 'pointer', color: '#93C5FD', fontSize: 18, opacity: clampedOffset >= maxOffset ? 0.28 : 1, fontFamily: 'inherit' }}>‹</button>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>{dayLabel}</div>
                        <div style={{ fontSize: 10, color: nMuted, marginTop: 1 }}>{t('noapte trecută')}</div>
                      </div>
                      <button onClick={() => setSleepDayOffset(o => Math.max(o - 1, 0))}
                        style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: clampedOffset <= 0 ? 'default' : 'pointer', color: '#93C5FD', fontSize: 18, opacity: clampedOffset <= 0 ? 0.28 : 1, fontFamily: 'inherit' }}>›</button>
                    </div>

                    {/* Ring + ore + badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 2 }}>
                      <div style={{ position: 'relative', flexShrink: 0, width: 92, height: 92 }}>
                        <SleepRingCanvas pct={sc || 0} size={92} isDark={true}/>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <span style={{ fontSize: 24, fontWeight: 900, color: '#BFDBFE', lineHeight: 1, letterSpacing: '-0.03em' }}>{sc ?? '—'}</span>
                          <span style={{ fontSize: 8, color: 'rgba(147,197,253,.38)', letterSpacing: '.05em' }}>/100</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 40, fontWeight: 900, color: nPrimary, letterSpacing: '-0.04em', lineHeight: 1 }}>
                            {totalH > 0 ? totalH.toFixed(1) : '—'}
                          </span>
                          {totalH > 0 && <span style={{ fontSize: 17, fontWeight: 700, color: 'rgba(147,197,253,.42)' }}>h</span>}
                        </div>
                        <div style={{ fontSize: 11, color: nMuted, marginBottom: 8 }}>{t('Somn noapte trecută')}</div>
                        <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: nScCol, background: nScBg, padding: '3px 12px', borderRadius: 20, border: `1px solid ${nScBorder}` }}>{t(scLabel)}</div>
                      </div>
                    </div>

                    {/* Mini tabs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 12, paddingBottom: 24, position: 'relative', zIndex: 2 }}>
                      {[
                        { label: 'REM',       val: remPct   != null ? `${remPct}%`   : remH   > 0 ? `${Math.round(remH*60)}m`   : '—' },
                        { label: 'Profund',   val: deepPct  != null ? `${deepPct}%`  : deepH  > 0 ? `${Math.round(deepH*60)}m`  : '—' },
                        { label: 'Treaz',     val: awakePct != null ? `${awakePct}%` : awakeH > 0 ? `${Math.round(awakeH*60)}m` : '—' },
                        { label: 'Eficiență', val: effPct   != null ? `${effPct}%`   : '—' },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background: nTabBg, borderRadius: 10, padding: '8px 4px', textAlign: 'center', border: nTabBord }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: nPrimary, lineHeight: 1 }}>{val}</div>
                          <div style={{ fontSize: 8, color: nMuted, marginTop: 3, fontWeight: 600 }}>{t(label)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coaching — transparent, subtil */}
                  {coachMsg && (
                    <div style={{ padding: '10px 0 12px', borderBottom: 'none', marginBottom: CARD_GAP }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(147,197,253,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>💡 Coaching</div>
                      <div style={{ fontSize: 12, color: 'rgba(147,197,253,.5)', lineHeight: 1.5, fontWeight: 400 }}>{t(coachMsg)}</div>
                    </div>
                  )}
                </>
              )
            })()}

            {/* Faze somn — 4 ring cards */}
            {combinedSleep?.deep_h != null ? (() => {
              const totalH = combinedSleep.total_h || 1
              const stages = [
                { key: 'awake',  label: 'Treaz',   val: combinedSleep.awake_h || 0, color: '#8b8aa0', bg: '#8b8aa022' },
                { key: 'rem',    label: 'REM',      val: combinedSleep.rem_h   || 0, color: '#1D9E75', bg: '#1D9E7522' },
                { key: 'core',   label: 'Ușor',     val: combinedSleep.light_h || 0, color: '#4A7EB5', bg: '#4A7EB522' },
                { key: 'deep',   label: 'Profund',  val: combinedSleep.deep_h  || 0, color: '#534AB7', bg: '#534AB722' },
              ]
              const fmtH = v => { const h=Math.floor(v); const m=Math.round((v-h)*60); return h>0?`${h}h${m<10?'0'+m:m}m`:`${m}min` }
              const getRating = (key, pct) => {
                if (key==='awake')  return pct<=8?'Excelent':pct<=15?'Bun':pct<=25?'Acceptabil':'Slab'
                if (key==='rem')    return pct>=20?'Excelent':pct>=15?'Bun':pct>=10?'Acceptabil':'Slab'
                if (key==='core')   return pct>=50&&pct<=65?'Bun':pct>=40?'Acceptabil':'Slab'
                if (key==='deep')   return pct>=13?'Excelent':pct>=8?'Bun':pct>=5?'Acceptabil':'Slab'
                return '—'
              }
              const ratingColor = r => r==='Excelent'?'#22c55e':r==='Bun'?'#4a9eff':r==='Acceptabil'?'#f0a830':'#ef4444'
              const circ = 176
              return (
                <Acc title={t('💤 Faze somn')} defaultOpen c={c}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: CARD_GAP }}>
                    {stages.map(({ key, label, val, color, bg }) => {
                      const pct = Math.round((val/totalH)*100)
                      const offset = circ * (1 - Math.min(pct/100, 1))
                      const rating = getRating(key, pct)
                      return (
                        <div key={key} style={{ background: c.card, borderRadius: c.radiusSm, padding: '12px 14px', boxShadow: c.shadowCard, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
                            <circle cx="36" cy="36" r="28" fill="none" stroke={bg} strokeWidth="5"/>
                            <circle cx="36" cy="36" r="28" fill="none" stroke={color} strokeWidth="5"
                              strokeDasharray={circ} strokeDashoffset={offset}
                              strokeLinecap="round" transform="rotate(-90 36 36)"/>
                            <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="800" fontFamily="inherit">{pct}%</text>
                          </svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(label)}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: c.text, lineHeight: 1.2, marginTop: 2 }}>{fmtH(val)}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: ratingColor(rating), marginTop: 3 }}>{t(rating)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Acc>
              )
            })() : combinedSleep ? (
              <div style={{ ...s.card, fontSize: 12, color: c.text4 }}>
                {lang === 'en' ? 'Sleep stages are not available from ' : 'Fazele de somn nu sunt disponibile din '}{combinedSleep.source === 'intervals' ? 'Intervals.icu' : (lang === 'en' ? 'the selected source' : 'sursa selectată')}.
              </div>
            ) : null}

            {/* 3b. Balanță somn & Consistență — deschis */}
            {sleepDays7.length > 0 && (
              <Acc title={t('⚖️ Balanță somn & Consistență')} defaultOpen c={c}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: CARD_GAP }}>
                  <div style={{ background: c.card, borderRadius: c.radius, padding: '12px 14px', boxShadow: c.shadowCard }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t('Deficit somn')}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: sleepDebt > 0 ? c.orange : c.green, lineHeight: 1 }}>
                      {sleepDebt > 0 ? `-${sleepDebt.toFixed(1)}h` : `+${Math.abs(sleepDebt).toFixed(1)}h`}
                    </div>
                    <div style={{ fontSize: 10, color: c.text4, marginTop: 4 }}>
                      {sleepDebt > 0 ? 'deficit' : 'surplus'} vs {sleepTarget}h/{lang === 'en' ? 'night' : 'noapte'} · 7 {lang === 'en' ? 'days' : 'zile'}
                    </div>
                  </div>
                  <div style={{ background: c.card, borderRadius: c.radius, padding: '12px 14px', boxShadow: c.shadowCard }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t('Consistență')}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: consistencyPct >= 70 ? c.green : consistencyPct >= 50 ? c.orange : c.red, lineHeight: 1 }}>
                      {consistencyPct != null ? `${consistencyPct}%` : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: c.text4, marginTop: 4 }}>
                      {nightsOk}/{sleepDays7.length} {lang === 'en' ? 'nights' : 'nopți'} ≥ {sleepTarget}h
                    </div>
                  </div>
                </div>
              </Acc>
            )}

            {/* 4. Metrici detaliate — închis */}
            {combinedSleep && (() => {
              const totalH = combinedSleep.total_h || 0
              const deepH  = combinedSleep.deep_h  || 0
              const remH   = combinedSleep.rem_h   || 0
              const awakeH = combinedSleep.awake_h || 0
              const sleepTarget2 = userProfile?.target_sleep_hours || 7.5
              const efficiencyPct = totalH > 0 && awakeH >= 0 ? Math.round(((totalH - awakeH) / totalH) * 100) : null
              const deepPct  = totalH > 0 && deepH  > 0 ? Math.round((deepH  / totalH) * 100) : null
              const remPct   = totalH > 0 && remH   > 0 ? Math.round((remH   / totalH) * 100) : null
              const awakePct = totalH > 0 && awakeH > 0 ? Math.round((awakeH / totalH) * 100) : null

              const rateTime = v => v >= sleepTarget2 ? 'Bun' : v >= sleepTarget2 - 1 ? 'Acceptabil' : v > 0 ? 'Slab' : null
              const rateHRDip = v => v == null ? null : v >= 8 ? 'Excelent' : v >= 5 ? 'Bun' : 'Slab'
              const rateREM = p => p == null ? null : p >= 20 ? 'Excelent' : p >= 15 ? 'Bun' : p >= 10 ? 'Acceptabil' : 'Slab'
              const rateDeep = p => p == null ? null : p >= 13 ? 'Excelent' : p >= 8 ? 'Bun' : p >= 5 ? 'Acceptabil' : 'Slab'
              const rateEff = p => p == null ? null : p >= 90 ? 'Excelent' : p >= 82 ? 'Bun' : p >= 70 ? 'Acceptabil' : 'Slab'
              const rateHR = v => v == null ? null : v < 55 ? 'Excelent' : v < 65 ? 'Bun' : 'Acceptabil'

              // HR dip = % drop from resting to nocturnal (approx)
              const hrDipPct = combinedSleep.hr && combinedSleep.hrv
                ? Math.max(0, Math.round(15 - (combinedSleep.hr - 50) * 0.3))
                : null

              const metrics = [
                { icon: '⏱', label: 'Ore somn',  val: totalH > 0 ? `${Math.floor(totalH)}h${Math.round((totalH%1)*60)}m` : '—', rating: rateTime(totalH), bar: totalH / (sleepTarget2 * 1.2) },
                { icon: '💓', label: 'HR Dip',    val: hrDipPct != null ? `${hrDipPct}%` : combinedSleep.hr ? `${Math.round(combinedSleep.hr)}bpm` : '—', rating: hrDipPct != null ? rateHRDip(hrDipPct) : rateHR(combinedSleep.hr), bar: hrDipPct != null ? hrDipPct / 15 : combinedSleep.hr ? Math.max(0, 1 - (combinedSleep.hr - 45) / 30) : 0 },
                { icon: '🔮', label: 'REM',       val: remPct  != null ? `${remPct}%`  : remH  > 0 ? `${Math.round(remH*60)}m` : '—', rating: rateREM(remPct),  bar: remPct  != null ? remPct / 25  : 0 },
                { icon: '💜', label: 'Profund',   val: deepPct != null ? `${deepPct}%` : deepH > 0 ? `${Math.round(deepH*60)}m` : '—', rating: rateDeep(deepPct), bar: deepPct != null ? deepPct / 20 : 0 },
                { icon: '⚡', label: 'Eficiență', val: efficiencyPct != null ? `${efficiencyPct}%` : '—', rating: rateEff(efficiencyPct), bar: efficiencyPct != null ? efficiencyPct / 100 : 0 },
                { icon: '🔄', label: 'HRV noapte', val: combinedSleep.hrv ? `${Math.round(combinedSleep.hrv)}ms` : '—', rating: combinedSleep.hrv ? (combinedSleep.hrv >= 50 ? 'Bun' : combinedSleep.hrv >= 35 ? 'Acceptabil' : 'Slab') : null, bar: combinedSleep.hrv ? Math.min(1, combinedSleep.hrv / 80) : 0 },
              ]

              const rColor = r => r === 'Excelent' ? '#22c55e' : r === 'Bun' ? '#4a9eff' : r === 'Acceptabil' ? '#f0a830' : r === 'Slab' ? '#ef4444' : c.text4
              const rBg    = r => r === 'Excelent' ? '#22c55e22' : r === 'Bun' ? '#4a9eff22' : r === 'Acceptabil' ? '#f0a83022' : r === 'Slab' ? '#ef444422' : c.card2

              return (
                <Acc title={t('📋 Metrici detaliate')} defaultOpen={true} c={c}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: CARD_GAP }}>
                    {metrics.map(({ icon, label, val, rating, bar }) => {
                      const col = rColor(rating)
                      return (
                        <div key={label} style={{ background: c.card, borderRadius: c.radiusSm, padding: '12px 12px 10px', boxShadow: c.shadowCard }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ fontSize: 9, color: c.text4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 11 }}>{icon}</span>
                              <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(label)}</span>
                            </div>
                            {rating && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: col, padding: '1px 6px', borderRadius: 6, background: rBg(rating) }}>{t(rating)}</div>
                            )}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: c.text, lineHeight: 1, marginBottom: 7 }}>{val}</div>
                          <div style={{ height: 3, borderRadius: 3, background: c.card2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, Math.round((bar || 0) * 100))}%`, background: col, borderRadius: 3, transition: 'width 0.4s ease' }}/>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Acc>
              )
            })()}

            {/* 5. Trend nopți — închis */}
            {(intervalsData?.days || []).length > 0 && (() => {
              const trendOptions = [{ label: '7Z', days: 7 }, { label: '14Z', days: 14 }, { label: '1L', days: 30 }, { label: '3L', days: 90 }]
              const trendData = (intervalsData?.days || []).slice(-sleepTrendDays)
              const trendAvg = trendData.length ? trendData.reduce((s, d) => s + (d.sleep_hours || 0), 0) / trendData.length : 0
              const showLabels = sleepTrendDays <= 14
              return (
                <Acc title={t('📊 Trend nopți')} c={c}>
                <div style={s.card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('Trend somn')}</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {trendOptions.map(({ label, days }) => (
                        <button key={days} onClick={() => setSleepTrendDays(days)}
                          style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 9, fontWeight: 600, background: sleepTrendDays === days ? '#7c6bf5' : c.card2, color: sleepTrendDays === days ? '#fff' : c.text4, transition: 'all 0.15s' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: sleepTrendDays > 30 ? 2 : 4, height: 64, marginBottom: 4 }}>
                    {trendData.map((d, i) => {
                      const h = d.sleep_hours || 0
                      const good = h >= sleepTarget
                      const barH = h > 0 ? Math.max(4, Math.round((h / 10) * 56)) : 3
                      const dow = new Date(d.date + 'T12:00:00').getDay()
                      const lbl = slpDayLabels[dow === 0 ? 6 : dow - 1]
                      const isLast = i === trendData.length - 1
                      const showLbl = showLabels || (sleepTrendDays === 30 && i % 7 === 0) || (sleepTrendDays === 90 && i % 14 === 0) || isLast
                      return (
                        <div key={d.date || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          {showLabels && h > 0 && <div style={{ fontSize: 7, color: c.text4 }}>{h.toFixed(1)}</div>}
                          <div style={{ width: '100%', height: barH, borderRadius: '2px 2px 0 0', background: good ? '#7c6bf5' : c.card2, border: `0.5px solid ${good ? 'rgba(124,107,245,.35)' : c.border2}` }}/>
                          <div style={{ fontSize: 7, color: isLast ? '#a78bfa' : c.text4, whiteSpace: 'nowrap' }}>{showLbl ? lbl : ''}</div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 9, color: c.text4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 16, height: 0, borderTop: '1px dashed #7c6bf566', display: 'inline-block' }}/>
                    {lang === 'en' ? 'Target' : 'Țintă'} {sleepTarget}h · {lang === 'en' ? 'avg' : 'medie'} {trendAvg > 0 ? trendAvg.toFixed(1) : '—'}h/{lang === 'en' ? 'night' : 'noapte'} ({sleepTrendDays} {lang === 'en' ? 'days' : 'zile'})
                  </div>
                </div>
                </Acc>
              )
            })()}

            {/* 6. Corelație Somn ↔ HRV — închis */}
            {(() => {
              const corrDays = (intervalsData?.days || []).filter(d => d.sleep_hours > 0 && d.hrv > 0).slice(-60)
              if (corrDays.length < 5) return null
              const xs = corrDays.map(d => d.sleep_hours)
              const ys = corrDays.map(d => d.hrv)
              const n = xs.length
              const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n
              const ssxy = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)
              const ssx  = xs.reduce((s,x)=>s+(x-mx)**2,0)
              const ssy  = ys.reduce((s,y)=>s+(y-my)**2,0)
              const slope = ssx > 0 ? ssxy/ssx : 0
              const inter = my - slope*mx
              const r = (ssx>0&&ssy>0) ? ssxy/Math.sqrt(ssx*ssy) : 0
              const rLabel = Math.abs(r) >= 0.5 ? (r>0?'corelație pozitivă puternică':'corelație negativă puternică') : Math.abs(r) >= 0.25 ? (r>0?'corelație pozitivă slabă':'corelație negativă slabă') : 'fără corelație clară'
              const rColor = Math.abs(r) >= 0.5 ? (r>0?'#22c55e':'#ef4444') : Math.abs(r) >= 0.25 ? '#f0a830' : '#6b67a0'

              // SVG dimensions
              const W=280, H=140, PL=32, PR=12, PT=10, PB=24
              const cW=W-PL-PR, cH=H-PT-PB
              const minX=Math.floor(Math.min(...xs)-0.5), maxX=Math.ceil(Math.max(...xs)+0.5)
              const minY=Math.floor(Math.min(...ys)-5),   maxY=Math.ceil(Math.max(...ys)+5)
              const px = x => PL + ((x-minX)/(maxX-minX))*cW
              const py = y => PT + cH - ((y-minY)/(maxY-minY))*cH
              // regression line endpoints
              const rx1=minX, ry1=slope*minX+inter, rx2=maxX, ry2=slope*maxX+inter
              // clamp to chart
              const clampY = y => Math.max(minY, Math.min(maxY, y))

              return (
                <Acc title={t('🔗 Corelație Somn ↔ HRV')} c={c}>
                <div style={s.card}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:9, fontWeight:600, color:c.text4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{t('Corelație Somn ↔ HRV')}</div>
                    <div style={{ fontSize:9, color:rColor, fontWeight:600 }}>r = {r.toFixed(2)}</div>
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block', overflow:'visible' }}>
                    {/* Grid lines Y */}
                    {[0.25,0.5,0.75].map(t => {
                      const yv = minY + t*(maxY-minY)
                      return <g key={t}>
                        <line x1={PL} y1={py(yv)} x2={W-PR} y2={py(yv)} stroke={c.border2} strokeWidth="0.5" strokeDasharray="3,3"/>
                        <text x={PL-3} y={py(yv)+3} textAnchor="end" fontSize="7" fill={c.text4}>{Math.round(yv)}</text>
                      </g>
                    })}
                    {/* Axes */}
                    <line x1={PL} y1={PT} x2={PL} y2={PT+cH} stroke={c.border2} strokeWidth="0.5"/>
                    <line x1={PL} y1={PT+cH} x2={W-PR} y2={PT+cH} stroke={c.border2} strokeWidth="0.5"/>
                    {/* X labels */}
                    {Array.from({length: maxX-minX+1}, (_,i)=>minX+i).filter(v=>v%1===0).map(v => (
                      <text key={v} x={px(v)} y={H-8} textAnchor="middle" fontSize="7" fill={c.text4}>{v}h</text>
                    ))}
                    {/* Regression line */}
                    <line x1={px(rx1)} y1={py(clampY(ry1))} x2={px(rx2)} y2={py(clampY(ry2))}
                      stroke={rColor} strokeWidth="1.2" strokeDasharray="4,3" opacity="0.7"/>
                    {/* Data points */}
                    {corrDays.map((d, i) => {
                      const good = d.sleep_hours >= (userProfile?.target_sleep_hours||7.5)
                      const isLast = i >= corrDays.length - 7
                      return (
                        <circle key={i} cx={px(d.sleep_hours)} cy={py(d.hrv)} r={isLast?3:2.2}
                          fill={good ? '#7c6bf5' : c.card2}
                          stroke={isLast ? (good?'#a78bfa':'#9b97c4') : (good?'rgba(124,107,245,.5)':c.border2)}
                          strokeWidth="0.8" opacity={isLast?1:0.7}/>
                      )
                    })}
                    {/* Axis labels */}
                    <text x={PL + cW/2} y={H} textAnchor="middle" fontSize="7" fill={c.text4}>{t('Ore somn')}</text>
                    <text x={8} y={PT + cH/2} textAnchor="middle" fontSize="7" fill={c.text4}
                      transform={`rotate(-90, 8, ${PT+cH/2})`}>{t('HRV (ms)')}</text>
                  </svg>
                  <div style={{ fontSize:10, color:rColor, marginTop:6 }}>{t(rLabel)}</div>
                  <div style={{ fontSize:9, color:c.text4, marginTop:3 }}>
                    {corrDays.length} {lang === 'en' ? 'nights' : 'nopți'} · {lang === 'en' ? 'purple' : 'violet'} = ≥{userProfile?.target_sleep_hours||7.5}h · {lang === 'en' ? 'last 7 nights highlighted' : 'ultimele 7 nopți evidențiate'}
                  </div>
                </div>
                </Acc>
              )
            })()}

            {/* ── Sleep Trends ── */}
            {(() => {
              const allDays = intervalsData?.days || []
              const trendMetrics = [
                {
                  key: 'score',
                  label: 'Scor Somn',
                  icon: '🌙',
                  color: '#7c6bf5',
                  unit: '%',
                  getValue: d => d.sleep_score || null,
                  formatVal: v => `${Math.round(v)}`,
                  formatUnit: '%',
                  normalLow: 36, normalHigh: 85,
                  lowLabel: 'Scăzut <36%', normalLabel: 'Normal 36–85%', optimalLabel: 'Optimal >85%',
                  lowColor: '#ef4444', normalColor: '#7c6bf5', optimalColor: '#22c55e',
                  getStatus: (v, nl, nh) => v >= nh ? { label: 'Optimal', color: '#22c55e' } : v >= nl ? { label: 'Normal', color: '#22c55e' } : { label: 'Scăzut', color: '#ef4444' }
                },
                {
                  key: 'hours',
                  label: 'Ore dormite',
                  icon: '⏱',
                  color: '#4a9eff',
                  unit: 'h',
                  getValue: d => d.sleep_hours > 0 ? d.sleep_hours : null,
                  formatVal: v => { const h=Math.floor(v); const m=Math.round((v-h)*60); return m>0?`${h}h${m}m`:`${h}h` },
                  formatUnit: '',
                  normalLow: 6, normalHigh: 9,
                  lowLabel: '<6h', normalLabel: '6–9h', optimalLabel: '>9h',
                  lowColor: '#ef4444', normalColor: '#22c55e', optimalColor: '#4a9eff',
                  getStatus: (v, nl, nh) => v >= nh ? { label: 'Mult', color: '#4a9eff' } : v >= nl ? { label: 'Normal', color: '#22c55e' } : { label: 'Puțin', color: '#ef4444' }
                },
                {
                  key: 'deep',
                  label: 'Somn profund',
                  icon: '💜',
                  color: '#534AB7',
                  unit: 'h',
                  getValue: d => d.deep_hours > 0 ? d.deep_hours : null,
                  formatVal: v => { const h=Math.floor(v); const m=Math.round((v-h)*60); return h>0?`${h}h${m}m`:`${m}min` },
                  formatUnit: '',
                  normalLow: 0.5, normalHigh: 2,
                  lowLabel: '<30min', normalLabel: '30min–2h', optimalLabel: '>2h',
                  lowColor: '#ef4444', normalColor: '#22c55e', optimalColor: '#534AB7',
                  getStatus: (v, nl, nh) => v >= nh ? { label: 'Excelent', color: '#534AB7' } : v >= nl ? { label: 'Normal', color: '#22c55e' } : { label: 'Puțin', color: '#ef4444' }
                },
                {
                  key: 'rem',
                  label: 'REM',
                  icon: '🔮',
                  color: '#1D9E75',
                  unit: 'h',
                  getValue: d => d.rem_hours > 0 ? d.rem_hours : null,
                  formatVal: v => { const h=Math.floor(v); const m=Math.round((v-h)*60); return h>0?`${h}h${m}m`:`${m}min` },
                  formatUnit: '',
                  normalLow: 0.75, normalHigh: 2.5,
                  lowLabel: '<45min', normalLabel: '45min–2.5h', optimalLabel: '>2.5h',
                  lowColor: '#ef4444', normalColor: '#22c55e', optimalColor: '#1D9E75',
                  getStatus: (v, nl, nh) => v >= nh ? { label: 'Excelent', color: '#1D9E75' } : v >= nl ? { label: 'Normal', color: '#22c55e' } : { label: 'Puțin', color: '#ef4444' }
                },
                {
                  key: 'bank',
                  label: 'Sleep Bank',
                  icon: '🏦',
                  color: '#f0a830',
                  unit: 'h',
                  getValue: (d, target) => d.sleep_hours > 0 ? d.sleep_hours - target : null,
                  formatVal: v => { const abs=Math.abs(v); const h=Math.floor(abs); const m=Math.round((abs-h)*60); const pfx=v>=0?'+':'-'; return h>0?`${pfx}${h}h${m}m`:`${pfx}${m}min` },
                  formatUnit: '',
                  normalLow: -0.5, normalHigh: 0.5,
                  lowLabel: 'Deficit', normalLabel: 'Echilibru', optimalLabel: 'Surplus',
                  lowColor: '#ef4444', normalColor: '#22c55e', optimalColor: '#4a9eff',
                  getStatus: (v) => v >= 0 ? { label: 'Surplus', color: '#22c55e' } : { label: 'Deficit', color: '#f0a830' }
                },
              ]

              // Compute cumulative bank for the whole history
              const sleepTargetLocal = userProfile?.target_sleep_hours || 7.5
              const allDaysWithBank = (() => {
                let cum = 0
                return allDays.map(d => {
                  const delta = d.sleep_hours > 0 ? d.sleep_hours - sleepTargetLocal : 0
                  cum += delta
                  return { ...d, _bankCum: cum }
                })
              })()

              const getMetricData = (metric, period) => {
                const days = (metric.key === 'bank' ? allDaysWithBank : allDays)
                  .filter(d => d.sleep_hours > 0)
                  .slice(-period)
                return days.map(d => {
                  if (metric.key === 'bank') {
                    return { date: d.date, val: d._bankCum }
                  }
                  return { date: d.date, val: metric.getValue(d, sleepTargetLocal) }
                }).filter(d => d.val != null)
              }

              const drawSparkSVG = (data, color, W=80, H=36) => {
                if (!data || data.length < 2) return null
                const vals = data.map(d => d.val)
                const mn = Math.min(...vals), mx = Math.max(...vals)
                const range = mx - mn || 1
                const pad = 3
                const pts = vals.map((v,i) => {
                  const x = pad + (i/(vals.length-1))*(W-pad*2)
                  const y = H-pad - ((v-mn)/range)*(H-pad*2)
                  return `${x.toFixed(1)},${y.toFixed(1)}`
                })
                const aS = `${pad},${H-pad}`
                const aE = `${W-pad},${H-pad}`
                const gId = `sg_${color.replace('#','')}`
                return (
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                    <defs>
                      <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
                        <stop offset="100%" stopColor={color} stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <polygon points={`${aS} ${pts.join(' ')} ${aE}`} fill={`url(#${gId})`}/>
                    <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
                    <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="2.5" fill={color}/>
                  </svg>
                )
              }

              const drawDetailSVG = (data, metric, W=270, H=90) => {
                if (!data || data.length < 2) return null
                const vals = data.map(d => d.val)
                const mn = Math.min(...vals, metric.normalLow - (metric.normalHigh - metric.normalLow)*0.2)
                const mx = Math.max(...vals, metric.normalHigh + (metric.normalHigh - metric.normalLow)*0.2)
                const range = mx - mn || 1
                const pad = 8
                const pts = vals.map((v,i) => {
                  const x = pad + (i/(vals.length-1))*(W-pad*2)
                  const y = H-pad - ((v-mn)/range)*(H-pad*2)
                  return `${x.toFixed(1)},${y.toFixed(1)}`
                })
                const avg = vals.reduce((a,b)=>a+b,0)/vals.length
                const ya = (H-pad - ((avg-mn)/range)*(H-pad*2)).toFixed(1)
                const yNH = (H-pad - ((metric.normalHigh-mn)/range)*(H-pad*2)).toFixed(1)
                const yNL = (H-pad - ((metric.normalLow-mn)/range)*(H-pad*2)).toFixed(1)
                const aS = `${pad},${H-pad}`
                const aE = `${(W-pad).toFixed(1)},${H-pad}`
                const gId = `dg_${metric.key}`
                return (
                  <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
                    <defs>
                      <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={metric.color} stopOpacity="0.25"/>
                        <stop offset="100%" stopColor={metric.color} stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    {/* Normal range band */}
                    <rect x={pad} y={yNH} width={W-pad*2} height={parseFloat(yNL)-parseFloat(yNH)} fill="#22c55e" opacity="0.07"/>
                    {/* Avg dashed line */}
                    <line x1={pad} y1={ya} x2={W-pad} y2={ya} stroke={metric.color} strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
                    <text x={W-pad-2} y={parseFloat(ya)-3} textAnchor="end" fontSize="7" fill={metric.color} opacity="0.8">
                      avg {metric.formatVal(avg)}
                    </text>
                    {/* Area + line */}
                    <polygon points={`${aS} ${pts.join(' ')} ${aE}`} fill={`url(#${gId})`}/>
                    <polyline points={pts.join(' ')} fill="none" stroke={metric.color} strokeWidth="1.8" strokeLinejoin="round"/>
                    <circle cx={pts[pts.length-1].split(',')[0]} cy={pts[pts.length-1].split(',')[1]} r="3" fill={metric.color}/>
                  </svg>
                )
              }

              const periodOptions = [
                { label: '30Z', days: 30 },
                { label: '3L', days: 90 },
                { label: '6L', days: 180 },
                { label: '1A', days: 365 },
              ]

              return (
                <Acc title={t('📈 Analize pe termen lung')} c={c}>
                <div style={{ background: c.card, borderRadius: c.radius, padding: '14px 16px', boxShadow: c.shadowCard, marginBottom: '0.75rem' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.09em' }}>{t('Trends Somn')}</div>
                    {sleepTrendsMetric && (
                      <div style={{ display: 'flex', gap: 3 }}>
                        {periodOptions.map(({label, days}) => (
                          <button key={days} onClick={() => setSleepTrendsPeriod(days)}
                            style={{ padding: '2px 7px', borderRadius: 8, border: 'none', background: sleepTrendsPeriod === days ? '#7c6bf5' : c.card2, color: sleepTrendsPeriod === days ? '#fff' : c.text4, fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metric cards */}
                  {trendMetrics.map((metric, mIdx) => {
                    const sparkData = getMetricData(metric, 30)
                    const detailData = getMetricData(metric, sleepTrendsPeriod)
                    const lastVal = sparkData.length > 0 ? sparkData[sparkData.length-1].val : null
                    const status = lastVal != null ? metric.getStatus(lastVal, metric.normalLow, metric.normalHigh) : null
                    const sparkSVG = drawSparkSVG(sparkData, metric.color)
                    const isExpanded = sleepTrendsMetric === metric.key
                    const allVals = detailData.map(d=>d.val).filter(Boolean)
                    const normalCount = allVals.filter(v=>v>=metric.normalLow&&v<=metric.normalHigh).length
                    const lowCount = allVals.filter(v=>v<metric.normalLow).length
                    const highCount = allVals.filter(v=>v>metric.normalHigh).length
                    const totalCount = allVals.length || 1

                    return (
                      <React.Fragment key={metric.key}>
                        <div
                          onClick={() => setSleepTrendsMetric(isExpanded ? null : metric.key)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: mIdx === 0 ? 'none' : `0.5px solid ${c.card2}`, cursor: 'pointer' }}>
                          {/* Left: icon + label + value */}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: c.text4, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span>{metric.icon}</span>
                              <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9 }}>{t(metric.label)}</span>
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: c.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
                              {lastVal != null ? metric.formatVal(lastVal) : '—'}
                              <span style={{ fontSize: 11, fontWeight: 500, color: c.text4 }}>{metric.formatUnit}</span>
                            </div>
                            {status && (
                              <div style={{ fontSize: 10, marginTop: 3, fontWeight: 600, color: status.color }}>
                                {status.color === '#22c55e' ? '✓' : '↓'} {t(status.label)}
                              </div>
                            )}
                          </div>
                          {/* Sparkline */}
                          <div style={{ flexShrink: 0 }}>{sparkSVG}</div>
                          {/* Arrow */}
                          <div style={{ fontSize: 13, color: c.text4, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>›</div>
                        </div>

                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <div style={{ background: c.card2, borderRadius: 12, padding: '12px 14px', marginBottom: 8, marginTop: 2, border: `0.5px solid ${metric.color}44` }}>
                            {/* Current value + status */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div>
                                <div style={{ fontSize: 10, color: c.text4, marginBottom: 4 }}>{metric.icon} {t(metric.label)} · {lang === 'en' ? `last ${sleepTrendsPeriod} days` : `ultimele ${sleepTrendsPeriod} zile`}</div>
                                <div style={{ fontSize: 24, fontWeight: 800, color: c.text, lineHeight: 1 }}>
                                  {lastVal != null ? metric.formatVal(lastVal) : '—'}
                                  <span style={{ fontSize: 14, fontWeight: 500, color: c.text4 }}>{metric.formatUnit}</span>
                                </div>
                                <div style={{ fontSize: 10, color: c.text4, marginTop: 4 }}>
                                  {lang === 'en' ? 'Normal range' : 'Interval normal'}: {metric.formatVal(metric.normalLow)} – {metric.formatVal(metric.normalHigh)}
                                </div>
                              </div>
                              {status && (
                                <div style={{ fontSize: 9, fontWeight: 700, color: status.color, padding: '3px 9px', borderRadius: 9, background: `${status.color}22`, border: `0.5px solid ${status.color}44`, whiteSpace: 'nowrap' }}>
                                  {t(status.label)}
                                </div>
                              )}
                            </div>

                            {/* Detail chart */}
                            <div style={{ marginBottom: 10 }}>
                              {drawDetailSVG(detailData, metric)}
                            </div>

                            {/* Breakdown bar */}
                            {allVals.length > 0 && (
                              <div style={{ borderTop: `0.5px solid ${c.card}`, paddingTop: 10, marginTop: 4 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{t('Distribuție nopți')}</div>
                                <div style={{ height: 6, borderRadius: 3, display: 'flex', overflow: 'hidden', marginBottom: 8 }}>
                                  {lowCount > 0 && <div style={{ flex: lowCount, background: metric.lowColor, opacity: 0.7 }}/>}
                                  {normalCount > 0 && <div style={{ flex: normalCount, background: metric.normalColor, opacity: 0.7 }}/>}
                                  {highCount > 0 && <div style={{ flex: highCount, background: metric.optimalColor, opacity: 0.7 }}/>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {lowCount > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: c.text4 }}>
                                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: metric.lowColor, flexShrink: 0 }}/>
                                      {t(metric.lowLabel)} — {Math.round(lowCount/totalCount*100)}% {lang === 'en' ? 'nights' : 'nopți'}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: c.text4 }}>
                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: metric.normalColor, flexShrink: 0 }}/>
                                    {t(metric.normalLabel)} — {Math.round(normalCount/totalCount*100)}% {lang === 'en' ? 'nights' : 'nopți'}
                                  </div>
                                  {highCount > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: c.text4 }}>
                                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: metric.optimalColor, flexShrink: 0 }}/>
                                      {t(metric.optimalLabel)} — {Math.round(highCount/totalCount*100)}% {lang === 'en' ? 'nights' : 'nopți'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
                </Acc>
              )
            })()}

            {/* 7. Introdu manual — închis */}
            <Acc title={t('✏️ Introdu manual')} c={c}>
              <div style={s.card}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="number" step="0.25" value={manualSleep.hours}
                    onChange={e => setManualSleep(p => ({ ...p, hours: e.target.value }))}
                    placeholder={lang === 'en' ? 'Hours slept (e.g. 7.5)' : 'Ore dormite (ex: 7.5)'}
                    style={{ flex: 1, minWidth: 100, padding: '9px 12px', background: c.card2, border: 'none', borderRadius: 8, color: c.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}/>
                  <input type="number" value={manualSleep.score}
                    onChange={e => setManualSleep(p => ({ ...p, score: e.target.value }))}
                    placeholder={lang === 'en' ? 'Score' : 'Scor'}
                    style={{ width: 64, padding: '9px 12px', background: c.card2, border: 'none', borderRadius: 8, color: c.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}/>
                  <button onClick={saveManualSleep} disabled={!manualSleep.hours}
                    style={{ padding: '9px 16px', background: manualSleepSaved ? c.green3 : manualSleep.hours ? c.gradGreen : c.card2, border: 'none', borderRadius: 8, color: manualSleepSaved ? c.green : manualSleep.hours ? '#16291A' : c.text4, fontSize: 12, fontWeight: 700, cursor: manualSleep.hours ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {manualSleepSaved ? '✓ Salvat' : 'Salvează'}
                  </button>
                </div>
              </div>
            </Acc>

            {/* 8. Biometrice Withings — închis */}
            {body && (
              <Acc title={t('⌚ Biometrice Withings')} c={c}>
                <div style={s.card}>
                  <div style={s.sectionLabel}>{lang === 'en' ? 'Biometrics' : 'Biometrice'} — Withings ({body.date})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)', gap: 8 }}>
                    {[['Greutate', body.weight_kg ? `${body.weight_kg}kg` : '—'],['Masă grasă', body.fat_pct ? `${body.fat_pct}%` : '—'],['Masă musculară', body.muscle_kg ? `${body.muscle_kg}kg` : '—'],['PWV', body.pwv ? `${body.pwv}m/s` : '—'],['Tensiune', body.bp_sys ? `${body.bp_sys}/${body.bp_dia}` : '—'],['HR odihnă', body.hr_rest ? `${body.hr_rest}bpm` : '—']].map(([label, val]) => (
                      <div key={label} style={{ background: c.card2, borderRadius: 8, padding: '0.75rem' }}>
                        <div style={{ fontSize: 10, color: c.text4, marginBottom: 3 }}>{t(label)}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: c.text }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Acc>
            )}
          </div>
        )
      })()}

{tab === 'activitate' && (
  <ActivityTab 
    intervalsData={intervalsData}
    userProfile={userProfile}
    c={c}
    t={t}
    lang={lang}
    activitateDayOffset={activitateDayOffset}
    setActivitateDayOffset={setActivitateDayOffset}
    filterMFP={filterMFP}
    loadIntervalsData={loadIntervalsData}
    Acc={Acc}
    PMCChart={PMCChart}
    HROrarChart={HROrarChart}
    trainingLoadHistory={trainingLoadHistory}
    trainingLoad={trainingLoad}
    pmcAiText={pmcAiText}
    setPmcAiText={setPmcAiText}
    generatePmcAi={generatePmcAi}
    pmcAiLoading={pmcAiLoading}
    activityEditMode={activityEditMode}
    setActivityEditMode={setActivityEditMode}
    ACTIVITY_WIDGET_REGISTRY={ACTIVITY_WIDGET_REGISTRY}
    isActivityVisible={isActivityVisible}
    toggleActivityWidget={toggleActivityWidget}
    stepsChartPeriod={stepsChartPeriod}
    loadStepsChartPeriod={loadStepsChartPeriod}
    stepsChartLoading={stepsChartLoading}
    stepsChartData={stepsChartData}
    combinedSleep={combinedSleep}
    getBLEHRData={getBLEHRData}
    activityWorkoutOpen={activityWorkoutOpen}
    setActivityWorkoutOpen={setActivityWorkoutOpen}
    hevyFetching={hevyFetching}
    loadHevyData={loadHevyData}
    weeklyStats={weeklyStats}
    weeklyView={weeklyView}
    setWeeklyView={setWeeklyView}
    weeklyWorkouts={weeklyWorkouts}
    weeklyPRs={weeklyPRs}
    estimateWorkoutDuration={estimateWorkoutDuration}
    formatCalories={formatCalories}
    calc1RM={calc1RM}
  />
)}
            
      

      {/* ── TAB: ISTORIC ── */}
      {/* ── TAB: RANK ── */}
      {tab === 'rank' && (
        <div>
          <RankPage
            intervalsData={intervalsData}
            workouts={workouts}
            userName={userName}
          />
        </div>
      )}

      {tab === 'nutrition' && (
  <NutritionTab
    nutritionDayOffset={nutritionDayOffset}
    setNutritionDayOffset={setNutritionDayOffset}
    _nutDate={_nutDate}
    nutDateStr={nutDateStr}
    bmrSoFar={bmrSoFar}
    bmrCalculated={bmrCalculated}
    intervalsData={intervalsData}
    filterMFP={filterMFP}
    nutNutrition={nutNutrition}
    nutritionTargets={nutritionTargets}
    userProfile={userProfile}
    body={body}
    waterToday={waterToday}
    setWaterToday={setWaterToday}
    allMealEntries={allMealEntries}
    mealsModalOpen={mealsModalOpen}
    setMealsModalOpen={setMealsModalOpen}
    macroTodayModal={macroTodayModal}
    setMacroTodayModal={setMacroTodayModal}
    setShowFavoritesSheet={setShowFavoritesSheet}
    setFavoritesLoading={setFavoritesLoading}
    setFavoriteMeals={setFavoriteMeals}
    showFavoritesSheet={showFavoritesSheet}
    favoriteMeals={favoriteMeals}
    favSearchQuery={favSearchQuery}
    setFavSearchQuery={setFavSearchQuery}
    favSort={favSort}
    setFavSort={setFavSort}
    favoritesLoading={favoritesLoading}
    portionFav={portionFav}
    setPortionFav={setPortionFav}
    portionQty={portionQty}
    setPortionQty={setPortionQty}
    portionSaving={portionSaving}
    setPortionSaving={setPortionSaving}
    favAddedToast={favAddedToast}
    setFavAddedToast={setFavAddedToast}
    favDeletingId={favDeletingId}
    setFavDeletingId={setFavDeletingId}
    swipedFavId={swipedFavId}
    setSwipedFavId={setSwipedFavId}
    favEditId={favEditId}
    setFavEditId={setFavEditId}
    favEditName={favEditName}
    setFavEditName={setFavEditName}
    favEditImage={favEditImage}
    setFavEditImage={setFavEditImage}
    favEditSaving={favEditSaving}
    setFavEditSaving={setFavEditSaving}
    microAiData={microAiData}
    setMicroAiData={setMicroAiData}
    microAiLoading={microAiLoading}
    microAiError={microAiError}
    manualSupps={manualSupps}
    setManualSupps={setManualSupps}
    solarVitDMcg={solarVitDMcg}
    solarVitDIU={solarVitDIU}
    setSolarVitDIU={setSolarVitDIU}
    nutAccordion={nutAccordion}
    setNutAccordion={setNutAccordion}
    suppFormOpen={suppFormOpen}
    setSuppFormOpen={setSuppFormOpen}
    suppForm={suppForm}
    setSuppForm={setSuppForm}
    suppMode={suppMode}
    setSuppMode={setSuppMode}
    takenSavedSupps={takenSavedSupps}
    setTakenSavedSupps={setTakenSavedSupps}
    suppAiText={suppAiText}
    setSuppAiText={setSuppAiText}
    suppAiLoading={suppAiLoading}
    setSuppAiLoading={setSuppAiLoading}
    suppAiPreview={suppAiPreview}
    setSuppAiPreview={setSuppAiPreview}
    microHover={microHover}
    setMicroHover={setMicroHover}
    antioxOpen={antioxOpen}
    setAntioxOpen={setAntioxOpen}
    runMicroEstimate={runMicroEstimate}
    saveSuppToProfile={saveSuppToProfile}
    removeSuppFromProfile={removeSuppFromProfile}
    c={c}
    s={s}
    isMobile={isMobile}
    isDark={isDark}
    CARD_GAP={CARD_GAP}
    Acc={Acc}
    WaterTracker={WaterTracker}
    VitaminDTracker={VitaminDTracker}
    CaloriesBarChart={CaloriesBarChart}
    MacrosBarChart={MacrosBarChart}
    nutritionHistory={nutritionHistory}
    supabase={supabase}
    user={user}
    qc={qc}
  />
)}
      
      {tab === 'history' && (() => {
        const periodOptions = [[1, lang === 'en' ? '1 day' : '1 zi'],[7, lang === 'en' ? '7 days' : '7 zile'],[14, lang === 'en' ? '14 days' : '14 zile'],[30, lang === 'en' ? '30 days' : '30 zile'],[90, lang === 'en' ? '90 days' : '90 zile'],[0, lang === 'en' ? 'All' : 'Tot']]
        const cutoffDate = statsPeriod === 0
          ? (() => {
              const _allD = [
                ...(intervalsData?.days||[]).map(d=>d.date),
                ...(workouts||[]).map(w=>w.date),
                ...(nutritionHistory||[]).map(n=>n.date),
              ].filter(Boolean).sort()
              return _allD.length ? _allD[0] : '2020-01-01'
            })()
          : new Date(Date.now() - statsPeriod * 86400000).toISOString().slice(0,10)

        // ── Antrenamente: separă forță (Hevy) vs cardio (pași/activitate) ──────
        const periodWorkouts = workouts.filter(w => w.date && w.date >= cutoffDate)
        const strengthSessions = periodWorkouts.length
        const strengthVolume = periodWorkouts.reduce((s,w) => s + (w.volume_kg||0), 0)
        const avgDuration = strengthSessions > 0 ? Math.round(periodWorkouts.reduce((s,w)=>s+(w.duration_min||0),0)/strengthSessions) : 0
        const allMuscleGroups = {}
        periodWorkouts.forEach(w => (w.muscle_groups||[]).forEach(g => { allMuscleGroups[g] = (allMuscleGroups[g]||0)+1 }))
        const topMuscleGroups = Object.entries(allMuscleGroups).sort((a,b)=>b[1]-a[1]).slice(0,5)

        const periodFitDays = (intervalsData?.days || []).filter(d => d.date >= cutoffDate)
        const totalSteps = periodFitDays.reduce((s,d)=>s+(d.steps||0),0)
        const avgStepsP = periodFitDays.length>0 ? Math.round(totalSteps/periodFitDays.length) : 0
        const activeDays = periodFitDays.filter(d => d.steps >= 8000).length
        const totalCalBurned = periodFitDays.reduce((s,d)=>s+(d.calories_burned||0),0)

        // ── Nutriție ──────────────────────────────────────────────────────────
        const periodNutrition = nutritionHistory.filter(n => n.date >= cutoffDate)
        const avgCalories = periodNutrition.length>0 ? Math.round(periodNutrition.reduce((s,n)=>s+(n.calories||0),0)/periodNutrition.length) : 0
        const avgProtein = periodNutrition.length>0 ? Math.round(periodNutrition.reduce((s,n)=>s+(n.protein_g||0),0)/periodNutrition.length*10)/10 : 0
        const loggedDays = periodNutrition.length

        // ── Somn ──────────────────────────────────────────────────────────────
        const sleepHrsAvg = combinedSleep?.total_h ? combinedSleep.total_h.toFixed(1) : '—'

        // ── Sănătate ──────────────────────────────────────────────────────────
        const cardioScoreNow = readiness.scores.health
        const hrvScoreNow = readiness.scores.hrv

        // ── Corp: MiniBodyChart multi-series (defined here to avoid TDZ in bundle) ─
        const MiniBodyChart = ({ series = [], low, high, target: tgt }) => {
          const W2 = 310, H2 = 120, pl2 = 38, pr2 = 20, pt2 = 12, pb2 = 24
          const [tip, setTip] = useState(null) // { cx, cy, text, color }
          // Build per-series point arrays
          const seriesData = series.map(s => ({
            ...s,
            pts: (s.days || []).filter(d => d[s.fieldKey] != null).map(d => ({
              date: d.date, v: d[s.fieldKey], label: d.date?.slice(5)
            }))
          })).filter(s => s.pts.length >= 1)
          if (!seriesData.length) {
            return <div style={{ textAlign:'center', color:'#888', fontSize:12, padding:'1.5rem 0' }}>{t('Date insuficiente')}</div>
          }
          // Single point: show as card with value, not chart
          if (!seriesData.some(s => s.pts.length >= 2)) {
            return (
              <div style={{ padding:'0.75rem 0' }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:6 }}>
                  {seriesData.map(s => s.pts.length > 0 && (
                    <div key={s.key} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.pts[0].v}{s.unit}</div>
                      <div style={{ fontSize:10, color:'#888' }}>{t(s.label)} · {s.pts[0].date}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'#666', fontStyle:'italic' }}>
                  📊 Graficul necesită date istorice · activează istoricul Withings în edge function
                </div>
              </div>
            )
          }
          const isSingle = seriesData.length === 1
          // Shared X axis: all dates
          const allDates = [...new Set(seriesData.flatMap(s => s.pts.map(p => p.date)))].sort()
          const innerW2 = W2 - pl2 - pr2, innerH2 = H2 - pt2 - pb2
          const xByDate = {}
          allDates.forEach((d, i) => { xByDate[d] = pl2 + (i / Math.max(allDates.length - 1, 1)) * innerW2 })
          // Y scale per series (each normalizes independently in multi mode)
          const getY = (s) => {
            const vals = s.pts.map(p => p.v)
            const extra = isSingle ? [...(tgt != null ? [tgt] : []), low, high] : []
            const allV2 = [...vals, ...extra]
            const mn = Math.min(...allV2), mx = Math.max(...allV2)
            const pad2 = (mx - mn) * 0.15 || 1
            const lo2 = mn - pad2, hi2 = mx + pad2
            return { y: v => pt2 + innerH2 - ((v - lo2) / (hi2 - lo2)) * innerH2, lo2, hi2 }
          }
          const primary = seriesData[0]
          const { y: yP, lo2, hi2 } = getY(primary)
          const avgP = primary.pts.reduce((s2, p) => s2 + p.v, 0) / primary.pts.length
          const tickDates = allDates.length <= 5 ? allDates
            : [allDates[0], allDates[Math.floor(allDates.length/3)], allDates[Math.floor(2*allDates.length/3)], allDates[allDates.length-1]]
          // Tooltip bubble dimensions
          const TW = 68, TH = 28, TR = 5
          const clampTX = (cx) => Math.min(Math.max(cx - TW/2, 2), W2 - TW - 2)
          return (
            <svg width="100%" viewBox={`0 0 ${W2} ${H2}`} style={{ display:'block' }}
              onMouseLeave={() => setTip(null)}>
              {/* Normal range band — solo greutate only */}
              {isSingle && primary.fieldKey === 'weight_kg' && (
                <>
                  <rect x={pl2} y={yP(high)} width={innerW2} height={yP(low)-yP(high)} fill="rgba(74,222,128,0.08)"/>
                  <line x1={pl2} y1={yP(low)} x2={pl2+innerW2} y2={yP(low)} stroke="#4ade80" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4}/>
                  <line x1={pl2} y1={yP(high)} x2={pl2+innerW2} y2={yP(high)} stroke="#4ade80" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4}/>
                </>
              )}
              {/* Target line */}
              {isSingle && tgt != null && (
                <line x1={pl2} y1={yP(tgt)} x2={pl2+innerW2} y2={yP(tgt)} stroke="#e879f9" strokeWidth={1} strokeDasharray="5,3"/>
              )}
              {/* Avg line — primary series, thinner, behind data */}
              <line x1={pl2} y1={yP(avgP)} x2={pl2+innerW2} y2={yP(avgP)}
                stroke={primary.color} strokeWidth={0.8} strokeDasharray="4,3" opacity={0.55}/>
              {/* Each series */}
              {seriesData.map((s, si) => {
                const { y: ySeries } = getY(s)
                const validPts = s.pts.filter(p => xByDate[p.date] !== undefined)
                if (validPts.length < 2) return null
                const pathD = validPts.map((p, i) => `${i===0?'M':'L'}${xByDate[p.date].toFixed(1)},${ySeries(p.v).toFixed(1)}`).join(' ')
                return (
                  <g key={s.key}>
                    <path d={pathD} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
                    {validPts.map((p, i) => {
                      const cx = xByDate[p.date], cy = ySeries(p.v)
                      return (
                        <circle key={i} cx={cx} cy={cy} r={5} fill="transparent" stroke="none"
                          style={{ cursor:'pointer' }}
                          onMouseEnter={() => setTip({ cx, cy, color: s.color, label: s.label, value: p.v, unit: s.unit, date: p.date })}>
                          <circle cx={cx} cy={cy} r={2.5} fill={s.color} style={{ pointerEvents:'none' }}/>
                        </circle>
                      )
                    })}
                    {/* Last point value label */}
                    {(() => { const lp = validPts[validPts.length-1]; return lp ? (
                      <text x={xByDate[lp.date]} y={ySeries(lp.v)-6} fontSize={8} fill={s.color} textAnchor="middle" fontWeight="600">
                        {lp.v}{s.unit}
                      </text>
                    ) : null })()}
                  </g>
                )
              })}
              {/* Visible dots layer (on top of hit areas) */}
              {seriesData.map(s => {
                const { y: ySeries } = getY(s)
                return s.pts.filter(p => xByDate[p.date] !== undefined).map((p, i) => (
                  <circle key={s.key+i} cx={xByDate[p.date]} cy={ySeries(p.v)} r={2.5} fill={s.color} style={{ pointerEvents:'none' }}/>
                ))
              })}
              {/* X ticks */}
              {tickDates.map(d => xByDate[d] !== undefined ? (
                <text key={d} x={xByDate[d]} y={H2-4} fontSize={8} fill="#888" textAnchor="middle">{d.slice(5)}</text>
              ) : null)}
              {/* Y ticks — primary series only */}
              {isSingle && [lo2, (lo2+hi2)/2, hi2].map((v, i) => (
                <text key={i} x={pl2-3} y={yP(v)+3} fontSize={8} fill="#888" textAnchor="end">{v.toFixed(1)}</text>
              ))}
              {/* Hover tooltip */}
              {tip && (() => {
                const tx = clampTX(tip.cx)
                const ty = tip.cy - TH - 6 < pt2 ? tip.cy + 8 : tip.cy - TH - 6
                return (
                  <g style={{ pointerEvents:'none' }}>
                    <rect x={tx} y={ty} width={TW} height={TH} rx={TR} ry={TR}
                      fill="rgba(20,20,30,0.88)" stroke={tip.color} strokeWidth={1}/>
                    <text x={tx + TW/2} y={ty + 10} fontSize={7.5} fill="#aaa" textAnchor="middle">
                      {tip.date}
                    </text>
                    <text x={tx + TW/2} y={ty + 21} fontSize={10} fontWeight="700" fill={tip.color} textAnchor="middle">
                      {tip.value}{tip.unit}
                    </text>
                  </g>
                )
              })()}
            </svg>
          )
        }

        const statsTabs = [
          ['calendar', t('📅 Calendar')],
          ['strength', '🏋️ ' + t('Forță')],
          ['cardio', t('🏃 Cardio')],
          ['nutrition', t('🥗 Nutriție')],
          ['sleep', t('😴 Somn')],
          ['corp', '⚖️ ' + t('Corp')],
          ['health', t('❤️ Sănătate')],
        ]

        return (
          <div style={{ position: 'relative', zIndex: 0 }}>
            {/* ── Grafic auriu — se desenează animat în fundal, în dreptul scorului general ── */}
            <style>{`
              @keyframes statGrpFade{0%{opacity:1}84%{opacity:1}99%{opacity:0}100%{opacity:0}}
              @keyframes statRingDraw{0%{stroke-dashoffset:100}55%,100%{stroke-dashoffset:0}}
              @keyframes statLineDraw{0%,32%{stroke-dashoffset:100}72%,100%{stroke-dashoffset:0}}
              @keyframes statBg1{0%,8%{transform:scaleY(0)}22%,100%{transform:scaleY(1)}}
              @keyframes statBg2{0%,18%{transform:scaleY(0)}32%,100%{transform:scaleY(1)}}
              @keyframes statBg3{0%,28%{transform:scaleY(0)}42%,100%{transform:scaleY(1)}}
              @keyframes statArrShow{0%,66%{opacity:0}76%,100%{opacity:1}}
            `}</style>
            <div aria-hidden="true" style={{ position: 'absolute', top: 8, right: -6, width: 120, height: 120, zIndex: -1, pointerEvents: 'none', opacity: 0.10 }}>
              <svg width="120" height="120" viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', animation: 'statGrpFade 8s linear infinite' }}>
                <defs><linearGradient id="statChartGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c8940f"/><stop offset="50%" stopColor="#ffd54a"/><stop offset="100%" stopColor="#fff2b0"/>
                </linearGradient></defs>
                <circle cx="50" cy="52" r="42" pathLength="100" stroke="url(#statChartGrad)" strokeWidth="3" strokeLinecap="round" transform="rotate(-95 50 52)" strokeDasharray="100" style={{ animation: 'statRingDraw 8s ease-out infinite' }}/>
                <rect x="34" y="64" width="9" height="22" rx="1" stroke="url(#statChartGrad)" strokeWidth="2.6" style={{ transformOrigin: '38px 86px', animation: 'statBg1 8s ease-out infinite' }}/>
                <rect x="46" y="54" width="9" height="32" rx="1" stroke="url(#statChartGrad)" strokeWidth="2.6" style={{ transformOrigin: '50px 86px', animation: 'statBg2 8s ease-out infinite' }}/>
                <rect x="58" y="44" width="9" height="42" rx="1" stroke="url(#statChartGrad)" strokeWidth="2.6" style={{ transformOrigin: '62px 86px', animation: 'statBg3 8s ease-out infinite' }}/>
                <path d="M26 68 L40 55 L48 62 L72 33" pathLength="100" stroke="url(#statChartGrad)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" style={{ animation: 'statLineDraw 8s ease-out infinite' }}/>
                <path d="M72 33 L60 35 M72 33 L70 45" stroke="url(#statChartGrad)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'statArrShow 8s ease-out infinite' }}/>
              </svg>
            </div>

            {/* ── Hero card Statistici ── */}
            {(() => {
              const _trainScore = Math.min(100, Math.round((strengthSessions / Math.max(statsPeriod || 30, 1)) * 7 * 100))
              const _nutritionScore = Math.min(100, loggedDays > 0 ? Math.round((loggedDays / Math.max(statsPeriod || 30, 1)) * 100) : 0)
              const _sleepScore = combinedSleep?.score || 0
              const _overallScore = Math.round((_trainScore + _nutritionScore + _sleepScore) / 3)
              const R = 38, CX = 50, CY = 50, CIRC = 2 * Math.PI * R
              const arc = (pct) => CIRC * (1 - pct / 100)
              return (
                <div style={{ background: 'transparent', border: 'none', borderRadius: c.radius, padding: '0.5rem 0.25rem 1rem', marginBottom: '1.25rem', boxShadow: 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.9rem' }}>{t('Progres general')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Ring SVG */}
                    <div style={{ flexShrink: 0 }}>
                      <svg width="100" height="100" viewBox="0 0 100 100">
                        {/* Track */}
                        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8"/>
                        {/* Arc */}
                        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth="8"
                          strokeDasharray={CIRC} strokeDashoffset={arc(_overallScore)}
                          strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`}
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
                        <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="inherit">{_overallScore}</text>
                        <text x={CX} y={CY + 13} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="inherit">{t('scor general')}</text>
                      </svg>
                    </div>
                    {/* Bars */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Antrenament', pct: _trainScore, color: '#a78bfa', icon: '🏋️' },
                        { label: 'Nutriție', pct: _nutritionScore, color: '#f59e0b', icon: '🥗' },
                        { label: 'Somn', pct: _sleepScore, color: '#60a5fa', icon: '😴' },
                      ].map(({ label, pct, color, icon }) => (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{icon} {t(label)}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{pct}%</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.5s ease' }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {statsPeriod > 0 ? (lang === 'en' ? `Last ${statsPeriod} days` : `Ultimele ${statsPeriod} zile`) : (lang === 'en' ? 'All data' : 'Toate datele')}
                  </div>
                </div>
              )
            })()}

            {/* Selector perioadă — 6 taburi separate pe un rând */}
            <div style={{ display: 'flex', gap: 5, marginBottom: '1rem' }}>
              {periodOptions.map(([val, label]) => {
                const active = statsPeriod === val
                return (
                  <button key={val} onClick={() => setStatsPeriod(val)}
                    style={{
                      flex: 1, padding: '8px 2px', fontSize: 11.5, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                      whiteSpace: 'nowrap', textAlign: 'center',
                      background: active ? 'rgba(124,58,237,0.9)' : 'rgba(124,58,237,0.12)',
                      color: active ? '#ffffff' : '#c4b5fd',
                      border: active ? '1px solid rgba(124,58,237,0.9)' : '0.5px solid rgba(167,139,250,0.3)',
                      fontWeight: active ? 700 : 500,
                      transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Sub-tabs categorii */}
            <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', overflowX: 'auto' }}>
              {statsTabs.map(([id, label]) => (
                <button key={id} onClick={() => setStatsSubTab(id)}
                  style={{ padding: '7px 14px', fontSize: 12, borderRadius: c.radiusSm, border: 'none', background: statsSubTab===id ? c.green3 : c.card, color: statsSubTab===id ? c.green : c.text3, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, boxShadow: statsSubTab===id ? 'none' : c.shadowCard }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── SUMAR — toate categoriile pe scurt ── */}
            {/* ── FORȚĂ — antrenamente Hevy ── */}
            {statsSubTab === 'strength' && (
              <>
                <div style={grid4}>
                  <MetricCard label="Sesiuni" value={strengthSessions} delta={statsPeriod>0?(lang==='en'?`in ${statsPeriod} days`:`în ${statsPeriod} zile`):(lang==='en'?'total':'total')} c={c}/>
                  <MetricCard label="Volum total" value={strengthVolume>0?`${Math.round(strengthVolume/1000)}t`:'—'} c={c}/>
                  <MetricCard label="Durată medie" value={avgDuration} unit="min" c={c}/>
                  <MetricCard label="PR-uri" value={weeklyStats.prs||0} c={c}/>
                </div>
                {/* ── Recuperare musculară ── */}
                {(() => {
                  const RECOVERY = {
                    chest:48, back:48, shoulders:48, biceps:36, triceps:36,
                    quads:72, hamstrings:72, calves:24, core:24, traps:36, glutes:48,
                  }
                  const CARDIO_MUSCLES = {
                    Walk:['calves','quads','core'], Run:['calves','quads','hamstrings','core'],
                    Ride:['quads','hamstrings','calves'], Hike:['quads','hamstrings','calves','core'],
                    VirtualRide:['quads','hamstrings','calves'],
                  }
                  const lastTrained = {}
                  for (const w of workouts) {
                    if (!w.hours_ago) continue
                    for (const g of (w.muscle_groups || [])) {
                      if (!lastTrained[g] || w.hours_ago < lastTrained[g]) lastTrained[g] = w.hours_ago
                    }
                  }
                  for (const act of filterMFP(intervalsData?.activities)) {
                    const hoursAgo = (Date.now() - new Date(act.start_time || act.date)) / 3600000
                    for (const g of (CARDIO_MUSCLES[act.type] || [])) {
                      if (!lastTrained[g] || hoursAgo < lastTrained[g]) lastTrained[g] = hoursAgo
                    }
                  }
                  const LABELS = { chest:t('Piept'), back:t('Spate / lats'), shoulders:t('Umeri'), biceps:t('Biceps'), triceps:t('Triceps'), quads:t('Cvadriceps'), hamstrings:t('Ischiogambieri'), calves:t('Gambe'), core:t('Core / oblici'), traps:t('Trapez'), glutes:t('Fesier') }
                  const groups = Object.entries(RECOVERY).map(([g, needed]) => {
                    const since = lastTrained[g] ?? 999
                    const pct = Math.min(100, Math.round((since / needed) * 100))
                    return { g, label: LABELS[g], pct, hoursLeft: Math.max(0, Math.round(needed - since)) }
                  }).sort((a, b) => a.pct - b.pct)
                  const overall = Math.round(groups.reduce((s, g) => s + g.pct, 0) / groups.length)
                  const clr = p => p >= 80 ? c.green : p >= 50 ? c.orange : c.red

                  return (
                    <Acc title="💪 Recuperare musculară" defaultOpen c={c}>
                    <div style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={s.sectionLabel}>{t('Recuperare musculară')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20, fontWeight: 700, color: clr(overall) }}>{overall}%</span>
                          <span style={{ fontSize: 11, color: c.text4 }}>{t('global')}</span>
                          <button
                            onClick={() => {
                              const KEY_MAP = { chest:'chest', back:'lats', shoulders:'shoulders', biceps:'biceps', triceps:'triceps', quads:'quads', hamstrings:'hamstrings', calves:'calves', core:'abs', traps:'traps', glutes:'glutes' }
                              const data = {}
                              groups.forEach(({ g, pct }) => { const k = KEY_MAP[g]; if (k) data[k] = pct })
                              setMuscleModalData(data)
                              setShowMuscleModal(true)
                            }}
                            style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8, cursor:'pointer', color:'#60a5fa', padding:'4px 10px', fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}
                          >{t('🫀 Siluetă')}</button>
                        </div>
                      </div>

                      {/* Etichete zone */}
                      <div style={{ display: 'flex', marginLeft: 146, marginRight: 44, marginBottom: 4 }}>
                        <div style={{ width: '50%', textAlign: 'center', fontSize: 9, color: c.red, fontWeight: 600 }}>{lang === 'en' ? '<50% tired' : '<50% obosit'}</div>
                        <div style={{ width: '30%', textAlign: 'center', fontSize: 9, color: c.orange, fontWeight: 600 }}>{lang === 'en' ? '50–79%' : '50–79%'}</div>
                        <div style={{ width: '20%', textAlign: 'center', fontSize: 9, color: c.green, fontWeight: 600 }}>≥80%</div>
                      </div>

                      {/* Zona cu fundal colorat + bare */}
                      <div style={{ position: 'relative' }}>
                        {/* Fundal 3 zone */}
                        <div style={{ position: 'absolute', top: 0, left: 146, right: 44, bottom: 0, borderRadius: 8, overflow: 'hidden', opacity: 0.1, pointerEvents: 'none' }}>
                          <div style={{ position: 'absolute', left: 0, width: '50%', top: 0, bottom: 0, background: c.red }}/>
                          <div style={{ position: 'absolute', left: '50%', width: '30%', top: 0, bottom: 0, background: c.orange }}/>
                          <div style={{ position: 'absolute', left: '80%', width: '20%', top: 0, bottom: 0, background: c.green }}/>
                        </div>
                        {/* Linii separatoare */}
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(146px + (100% - 190px) * 0.5)`, width: 1, background: c.orange, opacity: 0.3, pointerEvents: 'none' }}/>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(146px + (100% - 190px) * 0.8)`, width: 1, background: c.green, opacity: 0.3, pointerEvents: 'none' }}/>

                        {/* Bare muschi */}
                        {groups.map(({ g, label, pct, hoursLeft }) => (
                          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, position: 'relative', zIndex: 1 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: clr(pct), flexShrink: 0 }}/>
                            <div style={{ width: 130, fontSize: 13, color: c.text3, flexShrink: 0 }}>{label}</div>
                            <div style={{ flex: 1, height: 7, background: 'rgba(128,128,128,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: clr(pct), borderRadius: 4 }}/>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: clr(pct), width: 36, textAlign: 'right', flexShrink: 0 }}>{pct}%</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 12, fontSize: 11, color: c.text4 }}>{t('Forță (Hevy) + cardio (walking, bike, hiking)')}</div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                        {[[c.green,t('≥80% recuperat')],[c.orange,t('50–79% parțial')],[c.red,t('<50% obosit')]].map(([col,lbl])=>(
                          <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: c.text4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' }}/>
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                    </Acc>
                  )
                })()}

                {/* ── Radar grupe musculare ── */}
                {(() => {
                  const _rCounts = {}
                  periodWorkouts.forEach(w => (w.muscle_groups||[]).forEach(g => { _rCounts[g] = (_rCounts[g]||0)+1 }))
                  if (Object.keys(_rCounts).length === 0) return null
                  return <RadarChart counts={_rCounts} sessions={strengthSessions} cardStyle={s.card} c={c} />
                })()}
                                {topMuscleGroups.length > 0 && (
                  <Acc title="📊 Distribuție grupe musculare" c={c}>
                    <div style={s.card}>
                      <div style={s.sectionLabel}>{t('Distribuție grupe musculare')}</div>
                      {topMuscleGroups.map(([group, count]) => (
                        <MiniBar key={group} label={group} value={count} max={Math.max(...topMuscleGroups.map(g=>g[1]))} color={c.green} c={c}/>
                      ))}
                    </div>
                  </Acc>
                )}
                {/* Trend volum săptămânal */}
                {(() => {
                  // Grupează antrenamentele pe săptămâni
                  const weekMap = {}
                  periodWorkouts.forEach(w => {
                    if (!w.date) return
                    const d = new Date(w.date)
                    const day = d.getDay() // 0=Sun
                    const monday = new Date(d)
                    monday.setDate(d.getDate() - ((day+6)%7))
                    const wk = monday.toISOString().slice(0,10)
                    if (!weekMap[wk]) weekMap[wk] = { vol:0, sessions:0, date:wk }
                    weekMap[wk].vol += w.volume_kg || 0
                    weekMap[wk].sessions += 1
                  })
                  const weeks = Object.values(weekMap).sort((a,b)=>a.date.localeCompare(b.date))
                  if (weeks.length < 2) return null
                  return (
                    <Acc title="📦 Volum săptămânal (kg)" c={c}>
                    <div style={s.card}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={s.sectionLabel}>{t('Volum săptămânal (kg)')}</div>
                        <div style={{ fontSize:11, color:c.text4 }}>{weeks.length} săptămâni</div>
                      </div>
                      <SplineChart
                        data={weeks.map(w=>Math.round(w.vol))}
                        dates={weeks.map(w=>w.date)}
                        color={c.green}
                        height={70}
                        c={c}
                        showDots={weeks.length<=8}
                        formatValue={v=>`${Math.round(v).toLocaleString()} kg`}
                      />
                      <div style={{ display:'flex', gap:16, marginTop:8, fontSize:10, color:c.text4 }}>
                        <span>Sesiuni: {weeks.map(w=>w.sessions).join(' · ')}</span>
                      </div>
                    </div>
                    </Acc>
                  )
                })()}
                {/* Top exerciții după volum */}
                {(() => {
                  const exMap = {}
                  periodWorkouts.forEach(w => {
                    (w.exercises||[]).forEach(ex => {
                      if (!exMap[ex.name]) exMap[ex.name] = { vol:0, sets:0, maxW:0 }
                      const exVol = (ex.sets||[]).reduce((s,st)=>s+(st.weight_kg||0)*(st.reps||0),0)
                      exMap[ex.name].vol += exVol
                      exMap[ex.name].sets += (ex.sets||[]).length
                      const mx = Math.max(...(ex.sets||[]).map(st=>st.weight_kg||0))
                      if (mx > exMap[ex.name].maxW) exMap[ex.name].maxW = mx
                    })
                  })
                  const topEx = Object.entries(exMap).sort((a,b)=>b[1].vol-a[1].vol).slice(0,5)
                  if (!topEx.length) return null
                  const maxVol = topEx[0][1].vol
                  return (
                    <Acc title="🏆 Top exerciții (volum)" c={c}>
                    <div style={s.card}>
                      <div style={s.sectionLabel}>{t('Top exerciții (volum)')}</div>
                      <div style={{ marginTop:8 }}>
                        {topEx.map(([name, ex]) => (
                          <div key={name} style={{ marginBottom:8 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                              <span style={{ fontSize:12, color:c.text }}>{name}</span>
                              <span style={{ fontSize:11, color:c.text4 }}>{Math.round(ex.vol).toLocaleString()} kg · max {ex.maxW}kg</span>
                            </div>
                            <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:3 }}>
                              <div style={{ height:5, background:c.green, borderRadius:3, width:`${(ex.vol/maxVol)*100}%` }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    </Acc>
                  )
                })()}
                {/* Calendar antrenamente forță — heatmap săptămânal */}
                {(() => {
                  const wByDate = {}
                  periodWorkouts.forEach(w => {
                    if (!w.date) return
                    if (!wByDate[w.date]) wByDate[w.date] = { volume: 0, sessions: 0 }
                    wByDate[w.date].volume += w.volume_kg || 0
                    wByDate[w.date].sessions += 1
                  })
                  const maxVol = Math.max(1, ...Object.values(wByDate).map(d => d.volume))
                  const todaySt = new Date().toISOString().slice(0,10)
                  const DAYS_RO = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']
                  const sd = new Date(cutoffDate + 'T12:00:00')
                  const d0 = sd.getDay(); sd.setDate(sd.getDate() - (d0===0?6:d0-1))
                  const ed = new Date(todaySt + 'T12:00:00')
                  const d1 = ed.getDay(); ed.setDate(ed.getDate() + (d1===0?0:7-d1))
                  const heatWeeks = []
                  const hCur = new Date(sd)
                  while (hCur <= ed) {
                    const wk = []
                    for (let i=0;i<7;i++) { wk.push(new Date(hCur).toISOString().slice(0,10)); hCur.setDate(hCur.getDate()+1) }
                    heatWeeks.push(wk)
                  }
                  const CELL=15, HGAP=3
                  return (
                    <Acc title="📅 Calendar antrenamente forță" c={c}>
                    <div style={s.card}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={s.sectionLabel}>{t('Calendar antrenamente forță')}</div>
                        <div style={{ fontSize:11, color:c.text4 }}>{strengthSessions} sesiuni{statsPeriod>0?' · '+statsPeriod+' zile':''}</div>
                      </div>
                      <div style={{ overflowX:'auto' }}>
                        <div style={{ display:'flex', gap:HGAP }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:HGAP, paddingTop:CELL+HGAP }}>
                            {DAYS_RO.map((d,i)=>(
                              <div key={i} style={{ width:16, height:CELL, fontSize:8.5, color:c.text4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>{d}</div>
                            ))}
                          </div>
                          {heatWeeks.map((wk,wi)=>{
                            const prev=wi>0?heatWeeks[wi-1]:null
                            const showM=!prev||prev[0].slice(0,7)!==wk[0].slice(0,7)
                            const mLbl=showM?new Date(wk[0]+'T12:00:00').toLocaleDateString('ro-RO',{month:'short'}):''
                            return (
                              <div key={wi} style={{ display:'flex', flexDirection:'column', gap:HGAP }}>
                                <div style={{ height:CELL, fontSize:8.5, color:c.text4, whiteSpace:'nowrap' }}>{mLbl}</div>
                                {wk.map(ds=>{
                                  const wd=wByDate[ds]
                                  const isFut=ds>todaySt
                                  const isToday=ds===todaySt
                                  let bg
                                  if(isFut) bg='transparent'
                                  else if(wd){
                                    const intensity=Math.max(0.35,wd.volume/maxVol)
                                    bg=`rgba(74,222,128,${intensity.toFixed(2)})`
                                  } else bg='rgba(128,128,128,0.12)'
                                  return (
                                    <div key={ds}
                                      title={wd?`${ds}: ${wd.sessions} sesiune · ${Math.round(wd.volume).toLocaleString()} kg volum`:ds}
                                      style={{ width:CELL,height:CELL,borderRadius:3,background:bg,
                                        border:isToday?`1.5px solid ${c.text3}`:'1px solid rgba(128,128,128,0.08)',
                                        boxSizing:'border-box', opacity:isFut?0:1 }}
                                    />
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:14, marginTop:6, fontSize:10, color:c.text4, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:10,height:10,borderRadius:2,background:'rgba(74,222,128,0.9)'}}/> {t('Sesiune forță')}</span>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:10,height:10,borderRadius:2,background:'rgba(128,128,128,0.12)',border:'1px solid rgba(128,128,128,0.25)'}}/> Repaus</span>
                        <span style={{ color:c.text4 }}>— intensitate = volum antrenament</span>
                      </div>
                    </div>
                    </Acc>
                  )
                })()}
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <button onClick={() => window.location.href='/workout'} style={{ fontSize: 12, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Vezi PR-uri detaliate & program AI →
                  </button>
                </div>
              </>
            )}

            {/* ── CARDIO — pași, calorii arse, activitate ── */}
            {statsSubTab === 'cardio' && (() => {
              const distDays = periodFitDays.filter(d => d.distance_m != null && d.distance_m > 0)
              const totalDistKm = distDays.reduce((s,d)=>s+(d.distance_m||0),0)/1000
              const avgDistKm = distDays.length>0 ? (totalDistKm/distDays.length).toFixed(1) : null
              const calDays = periodFitDays.filter(d => d.calories_burned != null && d.calories_burned > 0)
              const avgCal = calDays.length>0 ? Math.round(calDays.reduce((s,d)=>s+d.calories_burned,0)/calDays.length) : null
              const stepsTarget = userProfile?.steps_target || 8000
              const stepsAboveTarget = periodFitDays.filter(d=>(d.steps||0)>=stepsTarget).length
              return (
                <>
                  <div style={grid4}>
                    <MetricCard label="Pași total" value={totalSteps.toLocaleString()} delta={statsPeriod>0?`${statsPeriod} zile`:'total'} c={c}/>
                    <MetricCard label="Medie zilnică" value={avgStepsP.toLocaleString()} deltaPos={avgStepsP>=stepsTarget} delta={`țintă ${stepsTarget.toLocaleString()}`} c={c}/>
                    <MetricCard label="Zile active (≥8k)" value={activeDays} delta={`din ${periodFitDays.length}`} deltaPos={activeDays>periodFitDays.length/2} c={c}/>
                    <MetricCard label={'Calorii arse'} value={totalCalBurned>0?Math.round(totalCalBurned).toLocaleString():'—'} unit={totalCalBurned>0?"kcal":''} delta={avgCal?`~${avgCal} kcal/zi`:null} c={c}/>
                  </div>
                  {/* Pași pe zi */}
                  {periodFitDays.length > 1 && (
                    <Acc title="👣 Pași pe zi" defaultOpen c={c}>
                      <div style={s.card}>
                        {(() => {
                          const MAX_Y = 40000
                          const SEG_STEPS = [
                            { key:'morning',   label:'Dimineață 06–12', color:'#818cf8' },
                            { key:'noon',      label:'Prânz 12–16',     color:'#f59e0b' },
                            { key:'afternoon', label:'Dupămasă 16–18',  color:'#f97316' },
                            { key:'evening',   label:'Seară 18–22',     color:'#ec4899' },
                          ]
                          const sourceDays = (statsPeriod > 0 ? periodFitDays.slice(-statsPeriod) : periodFitDays).filter(d => (d.steps||0) > 0)
                          if (!sourceDays.length) return <div style={{ color:c.text4, fontSize:12, textAlign:'center', padding:'16px 0' }}>{t('Fără date pași')}</div>

                          // Index activities by date (exclude strength; use all step-gen activity sources)
                          const STEP_EXCL = /weight|strength|gym|crossfit|yoga|pilates|stretching|lift|workout/i
                          const actsByDateS = {}
                          ;(intervalsData?.activities || []).filter(a => !STEP_EXCL.test(a.type||'')).forEach(a => {
                            const aDate = a.date || a.start_date_local?.slice(0,10) || a.start_time?.slice(0,10)
                            if (!aDate) return
                            ;(actsByDateS[aDate] = actsByDateS[aDate] || []).push(a)
                          })

                          // Build segments per day — works even when elapsed_time=0
                          const chartDaysS = sourceDays.map(day => {
                            const total = day.steps || 0
                            const dayKeyS = day.date || day.start_date_local?.slice(0,10)
                            const acts  = actsByDateS[dayKeyS] || []
                            const segs  = { morning:0, noon:0, afternoon:0, evening:0 }
                            if (acts.length > 0) {
                              const segW = { morning:0, noon:0, afternoon:0, evening:0 }
                              acts.forEach(a => {
                                try {
                                  const startDT = a.start_time || a.start_date_local
                                  if (!startDT) return
                                  const h = new Date(startDT).getHours()
                                  const w = Math.max(a.elapsed_time || a.moving_time || 0, 1)
                                  if      (h >= 18) segW.evening   += w
                                  else if (h >= 16) segW.afternoon += w
                                  else if (h >= 12) segW.noon      += w
                                  else              segW.morning   += w
                                } catch {}
                              })
                              const totalW = Object.values(segW).reduce((s,v)=>s+v, 0)
                              if (totalW > 0) {
                                const actFrac  = Math.min(0.85, 0.30 + acts.length * 0.15)
                                const actSteps = Math.round(total * actFrac)
                                Object.keys(segs).forEach(k => {
                                  segs[k] = segW[k] > 0 ? Math.round(actSteps * segW[k] / totalW) : 0
                                })
                              }
                            }
                            segs.morning += Math.max(0, total - segs.morning - segs.noon - segs.afternoon - segs.evening)
                            return { date: day.date, total, segs }
                          })

                          const avgSt    = Math.round(chartDaysS.reduce((s,d)=>s+d.total,0)/chartDaysS.length)
                          const bestSt   = chartDaysS.reduce((b,d)=>d.total>b.total?d:b, chartDaysS[0])
                          const goalDays = chartDaysS.filter(d=>d.total>=stepsTarget).length
                          const goalPct2 = Math.min(stepsTarget/MAX_Y*100, 98)
                          const fmtDt    = dateStr => { const d=new Date(dateStr+'T12:00:00'); return ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'][d.getDay()]+' '+d.getDate() }
                          const showTipS = (e, html) => {
                            e.preventDefault()
                            let t = window._fTip
                            if (!t) { t = document.createElement('div'); t.style.cssText='position:fixed;z-index:99999;background:rgba(15,15,25,0.93);color:#fff;padding:9px 12px;border-radius:10px;font-size:11px;pointer-events:none;max-width:190px;text-align:left;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,0.4)'; document.body.appendChild(t); window._fTip=t }
                            const r=e.currentTarget.getBoundingClientRect(); t.innerHTML=html; t.style.display='block'
                            const l=Math.min(Math.max(r.left+r.width/2-95,6),window.innerWidth-196)
                            t.style.left=l+'px'; t.style.top=(r.top>80?r.top-t.offsetHeight-8:r.bottom+8)+'px'
                            clearTimeout(window._fTipT); window._fTipT=setTimeout(()=>{t.style.display='none'},2500)
                          }

                          return (
                            <>
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
                                {[{label:'Medie',val:avgSt.toLocaleString()+' p'},{label:'Record',val:bestSt.total.toLocaleString()+' p'},{label:'Zile obiectiv',val:`${goalDays}/${chartDaysS.length}`}].map(({label,val})=>(
                                  <div key={label} style={{ background:c.card2, borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
                                    <div style={{ fontSize:13, fontWeight:700, color:c.text }}>{val}</div>
                                    <div style={{ fontSize:10, color:c.text4, marginTop:2 }}>{label}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display:'flex', gap:0 }}>
                                <div style={{ width:34, flexShrink:0, position:'relative', height:180, marginBottom:18 }}>
                                  {[0,10000,20000,30000,40000].map(v=>(
                                    <div key={v} style={{ position:'absolute', bottom:`${v/MAX_Y*100}%`, right:5, transform:'translateY(50%)', fontSize:9, color:c.text4, whiteSpace:'nowrap' }}>
                                      {v===0?'0':(v/1000)+'k'}
                                    </div>
                                  ))}
                                </div>
                                <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                                  <div style={{ position:'relative', height:180 }}>
                                    {[0,10000,20000,30000,40000].map(v=>(
                                      <div key={v} style={{ position:'absolute', left:0, right:0, bottom:`${v/MAX_Y*100}%`, borderTop:`1px solid ${v===0?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.05)'}`, pointerEvents:'none' }} />
                                    ))}
                                    <div style={{ position:'absolute', left:0, right:0, bottom:`${goalPct2}%`, borderTop:'1px dashed rgba(129,140,248,0.35)', zIndex:1, pointerEvents:'none' }}>
                                      <span style={{ position:'absolute', right:2, fontSize:8, color:'#818cf8', transform:'translateY(-100%)', whiteSpace:'nowrap' }}>{(stepsTarget/1000).toFixed(0)}k</span>
                                    </div>
                                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', gap:chartDaysS.length>20?1:2, padding:'0 2px', zIndex:2 }}>
                                      {chartDaysS.map((day,i)=>{
                                        const pct = Math.min(day.total/MAX_Y*100, 100)
                                        const tipHtmlS = `<b>${fmtDt(day.date)}</b> — ${day.total.toLocaleString()} pași<br/>${SEG_STEPS.filter(s=>day.segs[s.key]>0).map(s=>`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${s.color};margin-right:4px;vertical-align:middle"></span>${s.label.split(' ')[0]}: ${day.segs[s.key].toLocaleString()}`).join('<br/>')}`
                                        return (
                                          <div key={i} title={`${fmtDt(day.date)}: ${day.total.toLocaleString()} ${lang==='en'?'steps':'pași'}`} onTouchStart={e=>showTipS(e,tipHtmlS)} style={{ flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                                            <div style={{ width:'100%', height:`${Math.max(pct,0.5)}%`, display:'flex', flexDirection:'column-reverse', borderRadius:'3px 3px 0 0', overflow:'hidden' }}>
                                              {SEG_STEPS.map(seg=>{
                                                const v=day.segs[seg.key]||0
                                                if(!v) return null
                                                return <div key={seg.key} style={{ flex:v, background:seg.color }} />
                                              })}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  {chartDaysS.length <= 14 && (
                                    <div style={{ display:'flex', gap:chartDaysS.length>20?1:2, marginTop:3, padding:'0 2px' }}>
                                      {chartDaysS.map((day,i)=>(
                                        <div key={i} style={{ flex:1, textAlign:'center', fontSize:8, color:c.text4, overflow:'hidden' }}>{fmtDt(day.date)}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', marginTop:8 }}>
                                {SEG_STEPS.map(seg=>(
                                  <div key={seg.key} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:c.text4 }}>
                                    <div style={{ width:8, height:8, borderRadius:2, background:seg.color, flexShrink:0 }} />
                                    {t(seg.label)}
                                  </div>
                                ))}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </Acc>
                  )}
                  {/* ── Activități cardio — timeline 24h ── */}
                  <Acc title="🏃 Activități cardio" defaultOpen c={c}>
                    <div style={s.card}>
                      {(() => {
                        const CARDIO_MAP = {
                          Run:         { color:'#22c55e', label:t('Alergare')   },
                          Walk:        { color:'#64748b', label:t('Plimbare')   },
                          Ride:        { color:'#3b82f6', label:t('Ciclism')    },
                          VirtualRide: { color:'#3b82f6', label:t('Ciclism V.') },
                          Swim:        { color:'#06b6d4', label:t('Înot')       },
                          Row:         { color:'#f59e0b', label:t('Rowing')     },
                          Hike:        { color:'#22c55e', label:t('Drumeție')   },
                          Kayaking:    { color:'#06b6d4', label:t('Caiac')      },
                        }
                        const STRENGTH_RE = /weight|strength|gym|crossfit|yoga|pilates|stretching|lift|workout/i
                        const H_START = 5, H_END = 23, H_RANGE = H_END - H_START
                        const CHART_H = 200

                        // Filter activities to period, exclude strength
                        const allCardioActs = filterMFP(intervalsData?.activities || []).filter(a => {
                          const aDate = a.date || a.start_date_local?.slice(0,10) || a.start_time?.slice(0,10)
                          if (!aDate || (!a.start_time && !a.start_date_local)) return false
                          if (STRENGTH_RE.test(a.type || '')) return false
                          if (cutoffDate && aDate < cutoffDate) return false
                          return true
                        })

                        // Group by date
                        const actsByDateC = {}
                        allCardioActs.forEach(a => {
                          const aDate = a.date || a.start_date_local?.slice(0,10) || a.start_time?.slice(0,10)
                          ;(actsByDateC[aDate] = actsByDateC[aDate] || []).push(a)
                        })
                        const datesC = Object.keys(actsByDateC).sort()

                        if (!datesC.length) return (
                          <div style={{ color:c.text4, fontSize:12, textAlign:'center', padding:'18px 0' }}>
                            Nicio activitate cardio în perioada selectată
                          </div>
                        )

                        const hourToY  = h => { const cl=Math.min(Math.max(h,H_START),H_END); return (cl-H_START)/H_RANGE*CHART_H }
                        const getCol   = t => CARDIO_MAP[t]?.color || '#8b5cf6'
                        const getLbl   = t => CARDIO_MAP[t]?.label || (t || 'Altele')
                        const fmtDtC   = d => { const dt=new Date(d+'T12:00:00'); return ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'][dt.getDay()]+' '+dt.getDate() }

                        const bandTintsC = [
                          {from:5, to:12, col:'rgba(129,140,248,0.06)'},
                          {from:12,to:16, col:'rgba(245,158,11,0.06)' },
                          {from:16,to:18, col:'rgba(249,115,22,0.06)' },
                          {from:18,to:23, col:'rgba(236,72,153,0.06)' },
                        ]
                        const usedTypes = [...new Set(allCardioActs.map(a => a.type || 'other'))]
                        const gapPx = datesC.length > 25 ? 1 : datesC.length > 14 ? 2 : 3
                        const showTipC = (e, html) => {
                          e.preventDefault()
                          let t = window._fTip
                          if (!t) { t = document.createElement('div'); t.style.cssText='position:fixed;z-index:99999;background:rgba(15,15,25,0.93);color:#fff;padding:9px 12px;border-radius:10px;font-size:11px;pointer-events:none;max-width:190px;text-align:left;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,0.4)'; document.body.appendChild(t); window._fTip=t }
                          const r=e.currentTarget.getBoundingClientRect(); t.innerHTML=html; t.style.display='block'
                          const l=Math.min(Math.max(r.left+r.width/2-95,6),window.innerWidth-196)
                          t.style.left=l+'px'; t.style.top=(r.top>80?r.top-t.offsetHeight-8:r.bottom+8)+'px'
                          clearTimeout(window._fTipT); window._fTipT=setTimeout(()=>{t.style.display='none'},2500)
                        }

                        return (
                          <div>
                            <div style={{ display:'flex', gap:0 }}>
                              {/* Y axis — hours */}
                              <div style={{ width:36, flexShrink:0, position:'relative', height:CHART_H }}>
                                {[6,10,14,18,22].map(h=>(
                                  <div key={h} style={{ position:'absolute', top:hourToY(h), right:5, transform:'translateY(-50%)', fontSize:9, color:c.text4, whiteSpace:'nowrap' }}>{h}:00</div>
                                ))}
                              </div>
                              <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                                <div style={{ position:'relative', height:CHART_H }}>
                                  {bandTintsC.map((b,i)=>(
                                    <div key={i} style={{ position:'absolute', left:0, right:0, top:hourToY(b.from), height:hourToY(b.to)-hourToY(b.from), background:b.col, pointerEvents:'none' }} />
                                  ))}
                                  {[6,10,14,18,22].map(h=>(
                                    <div key={h} style={{ position:'absolute', left:0, right:0, top:hourToY(h), borderTop:'1px solid rgba(255,255,255,0.07)', pointerEvents:'none', zIndex:1 }} />
                                  ))}
                                  <div style={{ position:'absolute', inset:0, display:'flex', gap:gapPx, padding:'0 2px', zIndex:2 }}>
                                    {datesC.map((dateStr,i)=>{
                                      const acts = actsByDateC[dateStr] || []
                                      return (
                                        <div key={i} style={{ flex:1, position:'relative', height:'100%' }}>
                                          {acts.map((a,j)=>{
                                            try {
                                              const startDT = a.start_time || a.start_date_local
                                              if (!startDT) return null
                                              const d = new Date(startDT)
                                              const startH = d.getHours() + d.getMinutes()/60
                                              // Duration: elapsed_time (seconds) → if 0, estimate from distance
                                              const rawDur = a.elapsed_time || a.moving_time || 0
                                              const SPD = {Run:10,Ride:25,VirtualRide:30,Walk:4.5,Swim:2,Row:5,Hike:4}
                                              const distH = (a.distance_m||a.distance||0)/1000/(SPD[a.type]||5)
                                              const durH  = rawDur > 0 ? rawDur/3600 : (distH > 0 ? distH : 0.75)
                                              const topPx  = hourToY(startH)
                                              const endH   = startH + durH
                                              const htPx   = Math.max(hourToY(endH) - topPx, 8)
                                              const tip    = `${getLbl(a.type)}\n${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} · ${Math.round(durH*60)} min`
                                              const tipHtmlC = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${getCol(a.type)};margin-right:5px;vertical-align:middle"></span><b>${getLbl(a.type)}</b><br/>${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} · ${Math.round(durH*60)} min`
                                              return (
                                                <div key={j} title={tip} onTouchStart={e=>showTipC(e,tipHtmlC)} style={{ position:'absolute', left:1, right:1, top:topPx, height:htPx, background:getCol(a.type), borderRadius:3, opacity:0.88 }} />
                                              )
                                            } catch { return null }
                                          })}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                                {datesC.length <= 14 && (
                                  <div style={{ display:'flex', gap:gapPx, marginTop:4, padding:'0 2px' }}>
                                    {datesC.map((d,i)=>(
                                      <div key={i} style={{ flex:1, textAlign:'center', fontSize:8, color:c.text4, overflow:'hidden' }}>{fmtDtC(d)}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', marginTop:8 }}>
                              {usedTypes.map(t=>(
                                <div key={t} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:c.text4 }}>
                                  <div style={{ width:8, height:8, borderRadius:2, background:getCol(t), flexShrink:0 }} />
                                  {getLbl(t)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </Acc>

                  {/* Calorii arse */}
                  {calDays.length > 1 && (
                    <Acc title="🔥 Calorii arse pe zi" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <div style={s.sectionLabel}>{t('Calorii arse pe zi')}</div>
                          <div style={{ fontSize:11, color:c.text4 }}>kcal</div>
                        </div>
                        <SplineChart
                          data={calDays.map(d => d.calories_burned)}
                          dates={calDays.map(d => d.date)}
                          color="#f97316"
                          height={70}
                          c={c}
                          showDots={false}
                          formatValue={v => `${Math.round(v)} kcal`}
                        />
                      </div>
                    </Acc>
                  )}
                  {/* Distanță (dacă disponibilă) */}
                  {distDays.length > 1 && (
                    <Acc title="📍 Distanță pe zi" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <div style={s.sectionLabel}>{t('Distanță pe zi')}</div>
                          <div style={{ fontSize:11, color:c.text4 }}>Total: {totalDistKm.toFixed(1)} km</div>
                        </div>
                        <SplineChart
                          data={distDays.map(d => d.distance_m/1000)}
                          dates={distDays.map(d => d.date)}
                          color="#22d3ee"
                          height={70}
                          c={c}
                          showDots={false}
                          formatValue={v => `${v.toFixed(1)} km`}
                        />
                      </div>
                    </Acc>
                  )}
                  {/* Calendar activitate cardio — heatmap săptămânal */}
                  {(() => {
                    const todaySc = new Date().toISOString().slice(0,10)
                    const DAYS_ROc = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']
                    const cByDate = {}
                    periodFitDays.forEach(d => { if(d.date) cByDate[d.date]=d })
                    const sdc = new Date(cutoffDate+'T12:00:00')
                    const dc0=sdc.getDay(); sdc.setDate(sdc.getDate()-(dc0===0?6:dc0-1))
                    const edc = new Date(todaySc+'T12:00:00')
                    const dc1=edc.getDay(); edc.setDate(edc.getDate()+(dc1===0?0:7-dc1))
                    const cHeatWeeks=[]
                    const cCur=new Date(sdc)
                    while(cCur<=edc){
                      const wkc=[]
                      for(let i=0;i<7;i++){wkc.push(new Date(cCur).toISOString().slice(0,10));cCur.setDate(cCur.getDate()+1)}
                      cHeatWeeks.push(wkc)
                    }
                    const CCELL=15, CGAP=3
                    const stT=stepsTarget
                    return (
                      <Acc title="🗓 Calendar activitate cardio" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <div style={s.sectionLabel}>{t('Calendar activitate cardio')}</div>
                          <div style={{ fontSize:11, color:c.text4 }}>{stepsAboveTarget} {lang==='en'?'days':'zile'} ≥ {stT.toLocaleString()} {lang==='en'?'steps':'pași'}</div>
                        </div>
                        <div style={{ overflowX:'auto' }}>
                          <div style={{ display:'flex', gap:CGAP }}>
                            <div style={{ display:'flex', flexDirection:'column', gap:CGAP, paddingTop:CCELL+CGAP }}>
                              {DAYS_ROc.map((d,i)=>(
                                <div key={i} style={{ width:16,height:CCELL,fontSize:8.5,color:c.text4,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:4 }}>{d}</div>
                              ))}
                            </div>
                            {cHeatWeeks.map((wkc,wi)=>{
                              const prevc=wi>0?cHeatWeeks[wi-1]:null
                              const showMc=!prevc||prevc[0].slice(0,7)!==wkc[0].slice(0,7)
                              const mLblc=showMc?new Date(wkc[0]+'T12:00:00').toLocaleDateString('ro-RO',{month:'short'}):''
                              return (
                                <div key={wi} style={{ display:'flex', flexDirection:'column', gap:CGAP }}>
                                  <div style={{ height:CCELL, fontSize:8.5, color:c.text4, whiteSpace:'nowrap' }}>{mLblc}</div>
                                  {wkc.map(ds=>{
                                    const dd=cByDate[ds]
                                    const isFutc=ds>todaySc
                                    const isTodayc=ds===todaySc
                                    const steps=dd?.steps||0
                                    const pct=stT>0?steps/stT:0
                                    let bgc
                                    if(isFutc) bgc='transparent'
                                    else if(!dd||steps===0) bgc='rgba(128,128,128,0.12)'
                                    else if(pct>=1) bgc=`rgba(74,222,128,${Math.min(0.9,0.4+pct*0.35).toFixed(2)})`
                                    else if(pct>=0.5) bgc=`rgba(251,146,60,${(0.3+pct*0.5).toFixed(2)})`
                                    else bgc='rgba(251,146,60,0.2)'
                                    const lbl=dd?`${ds}: ${steps.toLocaleString()} pași (${Math.round(pct*100)}%)`:ds
                                    return (
                                      <div key={ds}
                                        title={lbl}
                                        style={{ width:CCELL,height:CCELL,borderRadius:3,background:bgc,
                                          border:isTodayc?`1.5px solid ${c.text3}`:'1px solid rgba(128,128,128,0.08)',
                                          boxSizing:'border-box', opacity:isFutc?0:1 }}
                                      />
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:12, marginTop:6, fontSize:10, color:c.text4, flexWrap:'wrap' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(74,222,128,0.85)'}}/> ≥{stT.toLocaleString()} {lang==='en'?'steps':'pași'}</span>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(251,146,60,0.6)'}}/> 50–99%</span>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(251,146,60,0.2)'}}/> &lt;50%</span>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(128,128,128,0.12)',border:'1px solid rgba(128,128,128,0.2)'}}/> {t('nicio dată')}</span>
                        </div>
                      </div>
                      </Acc>
                    )
                  })()}

                </>
              )
            })()}

            {/* ── NUTRIȚIE ── */}
            {statsSubTab === 'nutrition' && (() => {
              const nutSorted = periodNutrition.slice().sort((a,b)=>a.date.localeCompare(b.date))
              const calData = nutSorted.filter(d=>d.calories>0)
              const protData = nutSorted.filter(d=>d.protein_g>0)
              const carbData = nutSorted.filter(d=>d.carbs_g>0)
              const fatData  = nutSorted.filter(d=>d.fat_g>0)
              const avgCarbs  = carbData.length>0 ? Math.round(carbData.reduce((s,d)=>s+(d.carbs_g||0),0)/carbData.length) : 0
              const avgFat    = fatData.length>0  ? Math.round(fatData.reduce((s,d)=>s+(d.fat_g||0),0)/fatData.length)   : 0
              const calTarget = nutritionTargets?.calories || 0
              const protTarget = nutritionTargets?.protein_g || 0
              const _nutDayRange = statsPeriod===0 && nutSorted.length>1
                ? Math.max(1, Math.round((new Date(nutSorted[nutSorted.length-1].date).getTime()-new Date(nutSorted[0].date).getTime())/86400000)+1)
                : statsPeriod
              const consistencyPct = _nutDayRange>0 ? Math.round((loggedDays/_nutDayRange)*100) : 0
              return (
                <>
                  <div style={grid4}>
                    <MetricCard label="Zile logate" value={loggedDays} delta={`${consistencyPct}% din ${statsPeriod>0?statsPeriod+' zile':'total'}`} deltaPos={consistencyPct>=70} c={c}/>
                    <MetricCard label="Calorii medii" value={avgCalories||'—'} unit={avgCalories?'kcal':''} delta={calTarget?`țintă ${calTarget} kcal`:null} deltaPos={calTarget&&avgCalories ? Math.abs(avgCalories-calTarget)<200 : null} c={c}/>
                    <MetricCard label="Proteine medii" value={avgProtein||'—'} unit={avgProtein?'g':''} delta={protTarget?`țintă ${protTarget}g`:null} deltaPos={protTarget&&avgProtein ? avgProtein>=protTarget*0.9 : null} c={c}/>
                    <MetricCard label="Proteine/kg" value={body?.weight_kg && avgProtein ? (avgProtein/body.weight_kg).toFixed(1) : '—'} unit={body?.weight_kg && avgProtein?'g/kg':''} deltaPos={body?.weight_kg && avgProtein ? (avgProtein/body.weight_kg)>=1.6 : null} c={c}/>
                  </div>
                  {/* Trend calorii */}
                  {calData.length > 1 && (
                    <Acc title="🔥 Calorii zilnice" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <div style={s.sectionLabel}>{t('Calorii zilnice')}</div>
                          {calTarget>0 && <div style={{ fontSize:11, color:c.text4 }}>🎯 {calTarget} kcal</div>}
                        </div>
                        <SplineChart
                          data={calData.map(d=>d.calories)}
                          dates={calData.map(d=>d.date)}
                          color="#f59e0b"
                          height={80}
                          c={c}
                          showDots={calData.length<=14}
                          formatValue={v=>`${Math.round(v)} kcal`}
                        />
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c.text4, marginTop:4 }}>
                          <span>Min: {Math.min(...calData.map(d=>d.calories))} kcal</span>
                          <span>{lang === 'en' ? 'Avg' : 'Medie'}: {avgCalories} kcal</span>
                          <span>Max: {Math.max(...calData.map(d=>d.calories))} kcal</span>
                        </div>
                      </div>
                    </Acc>
                  )}
                  {/* Trend proteine */}
                  {protData.length > 1 && (
                    <Acc title="💪 Proteine zilnice" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <div style={s.sectionLabel}>{t('Proteine zilnice')}</div>
                          {protTarget>0 && <div style={{ fontSize:11, color:c.text4 }}>🎯 {protTarget}g</div>}
                        </div>
                        <SplineChart
                          data={protData.map(d=>d.protein_g)}
                          dates={protData.map(d=>d.date)}
                          color="#a78bfa"
                          height={70}
                          c={c}
                          showDots={false}
                          formatValue={v=>`${Math.round(v)}g proteine`}
                        />
                      </div>
                    </Acc>
                  )}
                  {/* Rezumat macros medii */}
                  {(avgCarbs>0 || avgFat>0) && (() => {
                    const totalProt = Math.round(nutSorted.reduce((s,d)=>s+(d.protein_g||0),0))
                    const totalCarbs = Math.round(nutSorted.reduce((s,d)=>s+(d.carbs_g||0),0))
                    const totalFat = Math.round(nutSorted.reduce((s,d)=>s+(d.fat_g||0),0))
                    // Agregate meal entries by name for the period
                    const periodMeals = allMealEntries.filter(m => m.date >= cutoffDate && m.name)
                    const mealSources = {}
                    periodMeals.forEach(m => {
                      const key = (m.name || '').trim()
                      if (!key) return
                      if (!mealSources[key]) mealSources[key] = { name:key, protein_g:0, carbs_g:0, fat_g:0, calories:0, count:0 }
                      mealSources[key].protein_g += m.protein_g || 0
                      mealSources[key].carbs_g   += m.carbs_g   || 0
                      mealSources[key].fat_g     += m.fat_g     || 0
                      mealSources[key].calories  += m.calories  || 0
                      mealSources[key].count     += 1
                    })
                    const mealSourceList = Object.values(mealSources)
                    const MACRO_INFO = {
                      protein: {
                        key:'protein', label:'Proteine', val:avgProtein, total:totalProt, unit:'g', cal:avgProtein*4, color:'#a78bfa',
                        icon:'💪', role:'Construiesc și repară musculatura, susțin sistemul imunitar și produc enzime și hormoni.',
                        macroKey:'protein_g',
                        avoid:'Evită sursele procesate (cârnați, mezeluri) — conțin sodiu și grăsimi saturate în exces.',
                        target: nutritionTargets?.protein_g || 0,
                      },
                      carbs: {
                        key:'carbs', label:'Carbohidrați', val:avgCarbs, total:totalCarbs, unit:'g', cal:avgCarbs*4, color:'#fbbf24',
                        icon:'⚡', role:'Sunt sursa principală de energie. Carbohidrații compleși oferă energie susținută; cei simpli dau energie rapidă dar pot cauza vârfuri glicemice.',
                        macroKey:'carbs_g',
                        avoid:'Limitează: zahăr alb, sucuri, pâine albă, paste rafinate — cresc glicemia rapid.',
                        target: 0,
                      },
                      fat: {
                        key:'fat', label:'Grăsimi', val:avgFat, total:totalFat, unit:'g', cal:avgFat*9, color:'#fb923c',
                        icon:'🫀', role:'Esențiale pentru absorbția vitaminelor A, D, E, K, producția de hormoni și sănătatea creierului. Alege grăsimi nesaturate.',
                        macroKey:'fat_g',
                        avoid:'Evită: grăsimi trans (produse prăjite, fast-food, margarină), grăsimi saturate în exces.',
                        target: 0,
                      },
                    }
                    const macros = [MACRO_INFO.protein, MACRO_INFO.carbs, MACRO_INFO.fat]
                    return (
                      <>
                        <Acc title="🥗 Macros medii / zi" c={c}>
                        <div style={s.card}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                            <div style={s.sectionLabel}>{t('Macros medii / zi')}</div>
                            <div style={{ fontSize:10, color:c.text4 }}>{t('Apasă pentru detalii')}</div>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                            {macros.map(m => {
                              const pct = avgCalories>0 ? Math.round(m.cal/avgCalories*100) : 0
                              return (
                                <div key={m.key} onClick={() => setMacroDetailMacro(m.key)}
                                  style={{ background:c.bg, borderRadius:10, padding:'8px 10px', cursor:'pointer', border:'1px solid rgba(255,255,255,0.04)', WebkitTapHighlightColor:'transparent' }}>
                                  <div style={{ fontSize:9, color:c.text3, textTransform:'uppercase', letterSpacing:0.5 }}>{t(m.label)}</div>
                                  <div style={{ fontSize:17, fontWeight:700, color:m.color, marginTop:2 }}>{m.val||'—'}{m.val?m.unit:''}</div>
                                  {pct>0 && <div style={{ fontSize:9, color:c.text4 }}>{pct}% calorii</div>}
                                  <div style={{ height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, marginTop:4 }}>
                                    <div style={{ height:3, background:m.color, borderRadius:2, width:`${pct}%`}}/>
                                  </div>
                                  <div style={{ fontSize:9, color:m.color, opacity:0.7, marginTop:3 }}>Total: {m.total}g</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        </Acc>

                        {/* Macro Detail Bottom Sheet */}
                        {macroDetailMacro && (() => {
                          const m = MACRO_INFO[macroDetailMacro]
                          if (!m) return null
                          const pct = avgCalories>0 ? Math.round(m.cal/avgCalories*100) : 0
                          return (
                            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:400, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
                              onClick={() => setMacroDetailMacro(null)}>
                              <div style={{ background:c.card, borderRadius:'20px 20px 0 0', padding:'1.25rem', width:'100%', maxWidth:480, maxHeight:'85vh', overflowY:'auto' }}
                                onClick={e => e.stopPropagation()}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <span style={{ fontSize:22 }}>{m.icon}</span>
                                    <div>
                                      <div style={{ fontSize:16, fontWeight:700, color:m.color }}>{t(m.label)}</div>
                                      <div style={{ fontSize:11, color:c.text4 }}>medie {m.val||0}{m.unit}/zi · {pct}% din calorii</div>
                                    </div>
                                  </div>
                                  <button onClick={() => setMacroDetailMacro(null)}
                                    style={{ background:'transparent', border:'none', color:c.text4, fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:'1rem' }}>
                                  <div style={{ background:c.bg, borderRadius:10, padding:'10px 12px' }}>
                                    <div style={{ fontSize:10, color:c.text4 }}>{statsPeriod>0?'Total '+statsPeriod+' zile':'Total'}</div>
                                    <div style={{ fontSize:18, fontWeight:700, color:m.color }}>{m.total}g</div>
                                  </div>
                                  <div style={{ background:c.bg, borderRadius:10, padding:'10px 12px' }}>
                                    <div style={{ fontSize:10, color:c.text4 }}>{t('Medie / zi')}</div>
                                    <div style={{ fontSize:18, fontWeight:700, color:c.text }}>{m.val||0}g</div>
                                    {m.target>0 && <div style={{ fontSize:10, color: m.val>=m.target*0.9 ? c.green2 : '#f87171' }}>
                                      {m.val>=m.target*0.9 ? '✓' : '↓'} țintă {m.target}g
                                    </div>}
                                  </div>
                                </div>
                                <div style={{ background:c.bg, borderRadius:10, padding:'10px 12px', marginBottom:'1rem' }}>
                                  <div style={{ fontSize:10, color:c.text4, marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 }}>{t('Rol în organism')}</div>
                                  <div style={{ fontSize:13, color:c.text3, lineHeight:1.5 }}>{m.role}</div>
                                </div>
                                {(() => {
                                  const mk = m.macroKey
                                  const sorted = mealSourceList
                                    .filter(s => s[mk] > 0.5)
                                    .sort((a,b) => b[mk] - a[mk])
                                    .slice(0, 10)
                                  const totalVal = sorted.reduce((s,x) => s + x[mk], 0)
                                  return sorted.length > 0 ? (
                                    <div style={{ marginBottom:'1rem' }}>
                                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                                        <div style={{ fontSize:11, color:c.text4, textTransform:'uppercase', letterSpacing:0.5 }}>{t('Din mâncarea ta')}</div>
                                        <div style={{ fontSize:10, color:c.text4 }}>{statsPeriod>0?statsPeriod+' zile':'Total'}</div>
                                      </div>
                                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                        {sorted.map((src,i) => {
                                          const val = Math.round(src[mk])
                                          const barPct = totalVal > 0 ? Math.round(src[mk]/totalVal*100) : 0
                                          return (
                                            <div key={i} style={{ background:c.bg, borderRadius:10, padding:'8px 12px' }}>
                                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                                                <div style={{ fontSize:13, fontWeight:600, color:c.text }}>{src.name}</div>
                                                <div style={{ fontSize:12, fontWeight:700, color:m.color }}>{val}g</div>
                                              </div>
                                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                                                <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
                                                  <div style={{ height:3, background:m.color, borderRadius:2, width:`${barPct}%` }}/>
                                                </div>
                                                <div style={{ fontSize:10, color:c.text4, minWidth:32, textAlign:'right' }}>{src.count}x · {barPct}%</div>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ marginBottom:'1rem', background:c.bg, borderRadius:10, padding:'10px 12px' }}>
                                      <div style={{ fontSize:12, color:c.text4 }}>{t('Nu există mese înregistrate în această perioadă.')}</div>
                                    </div>
                                  )
                                })()}
                                <div style={{ background:'rgba(248,113,113,0.08)', borderRadius:10, padding:'10px 12px', borderLeft:'3px solid #f87171' }}>
                                  <div style={{ fontSize:11, color:'#f87171', marginBottom:3 }}>{t('⚠️ De evitat')}</div>
                                  <div style={{ fontSize:12, color:c.text3, lineHeight:1.5 }}>{m.avoid}</div>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </>
                    )
                  })()}
                  {/* ── Card Fasting — calculat din allMealEntries ── */}
                  {(() => {
                    // ── Pas 1: timestamp fiabil per masă ──────────────────────
                    const DAY_START_H = 4
                    const getMealTs = m => {
                      if (m.time && m.date) {
                        const t = m.time.length === 5 ? m.time + ':00' : m.time
                        const h = parseInt(t.split(':')[0], 10)
                        if (h < 6 && m.created_at) {
                          const createdDate = new Date(m.created_at).toISOString().slice(0, 10)
                          if (createdDate > m.date) {
                            const ts = new Date(`${createdDate}T${t}`).getTime()
                            if (!isNaN(ts)) return ts
                          }
                        }
                        const ts = new Date(`${m.date}T${t}`).getTime()
                        if (!isNaN(ts)) return ts
                      }
                      if (m.created_at) { const ts = new Date(m.created_at).getTime(); if (!isNaN(ts)) return ts }
                      return new Date(`${m.date}T20:00:00`).getTime()
                    }
                    const entriesTs = allMealEntries
                      .filter(m => m.date)
                      .map(m => ({ ...m, ts: getMealTs(m) }))
                      .sort((a, b) => a.ts - b.ts)

                    // ── Pas 2: calculează fasting zi-cu-zi ────────────────────
                    const allDatesSet = [...new Set(entriesTs.map(m => m.date))].sort()
                    const allFasts = []
                    for (let i = 1; i < allDatesSet.length; i++) {
                      const today = allDatesSet[i]
                      const prev  = allDatesSet[i - 1]
                      const todayCutoff = new Date(`${today}T0${DAY_START_H}:00:00`).getTime()
                      const prevMeals = entriesTs.filter(m =>
                        m.date === prev || (m.date === today && m.ts < todayCutoff)
                      )
                      if (prevMeals.length === 0) continue
                      const lastPrevTs = Math.max(...prevMeals.map(m => m.ts))
                      const todayReal = entriesTs.filter(m => m.date === today && m.ts >= todayCutoff)
                      if (todayReal.length === 0) continue
                      const firstTodayTs = Math.min(...todayReal.map(m => m.ts))
                      const fastHours = (firstTodayTs - lastPrevTs) / 3600000
                      if (fastHours >= 2 && fastHours < 48) {
                        allFasts.push({
                          date:    today,
                          hours:   Math.round(fastHours * 10) / 10,
                          started: new Date(lastPrevTs).toISOString(),
                          ended:   new Date(firstTodayTs).toISOString(),
                        })
                      }
                    }

                    // ── Pas 3: filtrare pe perioada selectată ─────────────────
                    const fastFiltered = allFasts.filter(f =>
                      statsPeriod === 0 ? true : f.date >= cutoffDate
                    ).sort((a, b) => a.date.localeCompare(b.date))

                    // ── Clasificare metodă & puncte ────────────────────────────
                    const fastMethod = h => {
                      if (h >= 16) return { label: '16:8',  pts: 3, color: '#22c55e', name: 'Metoda 16:8'  }
                      if (h >= 14) return { label: '14:10', pts: 2, color: '#34d399', name: 'Metoda 14:10' }
                      if (h >= 12) return { label: '12:12', pts: 1, color: '#86efac', name: 'Metoda 12:12' }
                      return             { label: '< 12h',  pts: 0, color: '#6b7280', name: 'Sub 12h'      }
                    }
                    const totalPoints = fastFiltered.reduce((s, f) => s + fastMethod(f.hours).pts, 0)

                    // ── Banner dimineață — înainte de prima masă ───────────────
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const todayCutoff4am = new Date(`${todayStr}T04:00:00`).getTime()
                    const nowTs = Date.now()
                    const todayMealsAfter4 = entriesTs.filter(m => m.ts >= todayCutoff4am && m.ts <= nowTs)
                    let morningFasting = null
                    if (todayMealsAfter4.length === 0) {
                      const prevAll = entriesTs.filter(m => m.ts < todayCutoff4am)
                      if (prevAll.length > 0) {
                        const lastMealTs = Math.max(...prevAll.map(m => m.ts))
                        const fastingNowH = (nowTs - lastMealTs) / 3600000
                        if (fastingNowH >= 2) {
                          morningFasting = { hours: fastingNowH, method: fastMethod(fastingNowH) }
                        }
                      }
                    }

                    // ── Statistici ─────────────────────────────────────────────
                    const avgFast = fastFiltered.length > 0 ? fastFiltered.reduce((s, f) => s + (f.hours || 0), 0) / fastFiltered.length : 0
                    const maxFast = fastFiltered.length > 0 ? Math.max(...fastFiltered.map(f => f.hours || 0)) : 0
                    const minFast = fastFiltered.length > 0 ? Math.min(...fastFiltered.map(f => f.hours || 0)) : 0
                    const above16 = fastFiltered.filter(f => f.hours >= 16).length
                    const above14 = fastFiltered.filter(f => f.hours >= 14).length
                    const above12 = fastFiltered.filter(f => f.hours >= 12).length
                    const pct16   = fastFiltered.length > 0 ? Math.round((above16 / fastFiltered.length) * 100) : 0

                    // ── Date grafic bare verticale ─────────────────────────────
                    const byDate = {}
                    fastFiltered.forEach(f => {
                      if (!byDate[f.date] || f.hours > byDate[f.date]) byDate[f.date] = f.hours
                    })
                    const chartDates = Object.keys(byDate).sort()
                    const chartHours = chartDates.map(d => byDate[d])
                    const chartMax   = Math.max(...chartHours, 18)

                    const fmtH = h => {
                      const hh = Math.floor(h), mm = Math.round((h - hh) * 60)
                      return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`
                    }

                    return (
                      <>
                        {/* Banner dimineață — înainte de prima masă */}
                        {morningFasting && (
                          <div style={{ background: morningFasting.method.pts > 0 ? `${morningFasting.method.color}18` : 'rgba(107,114,128,0.12)', border: `1px solid ${morningFasting.method.pts > 0 ? morningFasting.method.color + '55' : 'rgba(107,114,128,0.3)'}`, borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 12, color: morningFasting.method.pts > 0 ? morningFasting.method.color : '#9ca3af', fontWeight: 700, marginBottom: 3 }}>
                                ⏳ În post de {fmtH(morningFasting.hours)}
                              </div>
                              <div style={{ fontSize: 11, color: c.text3 }}>
                                Dacă mănânci acum:{' '}
                                <span style={{ color: morningFasting.method.color, fontWeight: 600 }}>{morningFasting.method.name}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', background: morningFasting.method.pts > 0 ? morningFasting.method.color : '#6b7280', borderRadius: 8, padding: '5px 12px', flexShrink: 0 }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: '#000', lineHeight: 1.1 }}>{morningFasting.method.pts}</div>
                              <div style={{ fontSize: 8, color: '#00000099', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>pct</div>
                            </div>
                          </div>
                        )}

                        <Acc title={`⏱️ Fasting${fastFiltered.length > 0 ? ` · ${fastFiltered.length} înreg.` : ''}`} defaultOpen={false} c={c}>
                          <div style={s.card}>
                            {fastFiltered.length === 0 && (
                              <div style={{ textAlign: 'center', padding: '20px 0', color: c.text4, fontSize: 13 }}>
                                <div style={{ fontSize: 22, marginBottom: 8 }}>⏱️</div>
                                <div>{t('Nicio înregistrare fasting în perioada selectată.')}</div>
                                <div style={{ fontSize: 11, marginTop: 6, color: c.text4 }}>
                                  Deschide pagina Nutriție → înregistrările se salvează automat după prima masă a zilei.
                                </div>
                              </div>
                            )}
                            {fastFiltered.length > 0 && <>
                              {/* Metrici principale */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
                                {[
                                  { label: 'Medie post',   value: fmtH(avgFast),    color: fastMethod(avgFast).color },
                                  { label: 'Cel mai lung', value: fmtH(maxFast),    color: fastMethod(maxFast).color },
                                  { label: '≥ 16h',        value: `${above16}x`,    sub: `${pct16}%`, color: above16 > 0 ? '#22c55e' : c.text4 },
                                  { label: 'Total pct',    value: `${totalPoints}`, sub: `${fastFiltered.length} zile`, color: totalPoints > 0 ? '#22c55e' : c.text4 },
                                ].map((m, i) => (
                                  <div key={i} style={{ background: c.bg, borderRadius: 9, padding: '8px 9px' }}>
                                    <div style={{ fontSize: 9, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t(m.label)}</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                                    {m.sub && <div style={{ fontSize: 10, color: c.text4 }}>{m.sub}</div>}
                                  </div>
                                ))}
                              </div>

                              {/* Grafic bare verticale */}
                              {chartDates.length > 0 && (
                                <div style={{ marginBottom: 14 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <div style={{ fontSize: 11, color: c.text3, fontWeight: 600 }}>{t('Ore post / zi')}</div>
                                    <div style={{ fontSize: 10, color: c.text4 }}>Min: {fmtH(minFast)} · Max: {fmtH(maxFast)}</div>
                                  </div>
                                  {/* Container grafic */}
                                  <div style={{ position: 'relative', height: 110, marginBottom: 4 }}>
                                    {/* Linii referință 12h / 14h / 16h */}
                                    {[12, 14, 16].map(refH => {
                                      const pct = Math.min((refH / chartMax) * 100, 100)
                                      return (
                                        <div key={refH} style={{ position: 'absolute', left: 0, right: 24, bottom: `${pct}%`, borderTop: '1px dashed rgba(255,255,255,0.13)', zIndex: 1, pointerEvents: 'none' }}>
                                          <span style={{ position: 'absolute', right: -22, fontSize: 8, color: c.text4, lineHeight: 1, transform: 'translateY(-50%)' }}>{refH}h</span>
                                        </div>
                                      )
                                    })}
                                    {/* Bare */}
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: chartDates.length > 25 ? 1 : 2, height: '100%', paddingRight: 24, position: 'relative', zIndex: 2 }}>
                                      {chartDates.map((d, i) => {
                                        const h  = chartHours[i]
                                        const fm = fastMethod(h)
                                        const barPct = Math.min((h / chartMax) * 100, 100)
                                        const dateShort = new Date(d + 'T12:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
                                        return (
                                          <div
                                            key={d}
                                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
                                            title={`${dateShort}: ${fmtH(h)} · ${fm.name} · ${fm.pts} pct`}
                                          >
                                            <div style={{ width: '100%', minWidth: chartDates.length > 30 ? 2 : 4, background: fm.color, borderRadius: '3px 3px 0 0', height: `${barPct}%`, transition: 'height 0.3s ease' }} />
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                  {/* Etichete X — doar dacă ≤ 10 bare */}
                                  {chartDates.length <= 10 && (
                                    <div style={{ display: 'flex', gap: 2, paddingRight: 24 }}>
                                      {chartDates.map((d, i) => (
                                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: c.text4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                          {new Date(d + 'T12:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Legendă culori */}
                                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                                    {[
                                      { label: '16:8 · 3 pct',  color: '#22c55e' },
                                      { label: '14:10 · 2 pct', color: '#34d399' },
                                      { label: '12:12 · 1 pct', color: '#86efac' },
                                      { label: '< 12h · 0 pct', color: '#6b7280' },
                                    ].map(item => (
                                      <div key={t(item.label)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 10, height: 10, background: item.color, borderRadius: 2 }} />
                                        <span style={{ fontSize: 10, color: c.text4 }}>{t(item.label)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Distribuție metode */}
                              {(() => {
                                const methods = [
                                  { label: '16:8',  color: '#22c55e', count: above16 },
                                  { label: '14:10', color: '#34d399', count: above14 - above16 },
                                  { label: '12:12', color: '#86efac', count: above12 - above14 },
                                  { label: '< 12h', color: '#6b7280', count: fastFiltered.length - above12 },
                                ].filter(d => d.count > 0)
                                const mTotal = methods.reduce((s, d) => s + d.count, 0)
                                if (methods.length === 0) return null
                                return (
                                  <>
                                    <div style={{ fontSize: 11, color: c.text3, fontWeight: 600, marginBottom: 6 }}>{t('Distribuție metode')}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                                      {methods.map((d, i) => {
                                        const pct = Math.round((d.count / mTotal) * 100)
                                        return (
                                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 10, height: 10, background: d.color, borderRadius: 2, flexShrink: 0 }} />
                                            <div style={{ fontSize: 11, color: c.text3, minWidth: 44 }}>{t(d.label)}</div>
                                            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                                              <div style={{ height: 6, width: `${pct}%`, background: d.color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                                            </div>
                                            <div style={{ fontSize: 11, color: d.color, fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{d.count}x</div>
                                            <div style={{ fontSize: 10, color: c.text4, minWidth: 28 }}>{pct}%</div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </>
                                )
                              })()}

                              {/* Ultimele posturi */}
                              {fastFiltered.length >= 2 && (() => {
                                const recent = [...fastFiltered].reverse().slice(0, 5)
                                return (
                                  <div style={{ marginTop: 4 }}>
                                    <div style={{ fontSize: 11, color: c.text3, fontWeight: 600, marginBottom: 6 }}>{t('Ultimele posturi')}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {recent.map((f, i) => {
                                        const startDt  = f.started ? new Date(f.started) : null
                                        const endDt    = f.ended   ? new Date(f.ended)   : null
                                        const startStr = startDt ? startDt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—'
                                        const endStr   = endDt   ? endDt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : '—'
                                        const dateStr  = f.date ? new Date(f.date + 'T12:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) : '—'
                                        const fm       = fastMethod(f.hours)
                                        return (
                                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: c.bg, borderRadius: 8, padding: '6px 10px' }}>
                                            <div>
                                              <div style={{ fontSize: 11, color: c.text4 }}>{dateStr} · {startStr} → {endStr}</div>
                                              <div style={{ fontSize: 10, color: fm.color, marginTop: 1 }}>{fm.name}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                              <div style={{ fontSize: 12, fontWeight: 700, color: fm.color }}>{fmtH(f.hours)}</div>
                                              <div style={{ fontSize: 10, color: c.text4 }}>{fm.pts} {fm.pts === 1 ? 'punct' : 'puncte'}</div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })()}
                            </>}
                          </div>
                        </Acc>

                        {/* Total punctaj — sub card */}
                        {fastFiltered.length > 0 && (
                          <div style={{ background: totalPoints > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${totalPoints > 0 ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '10px 14px', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 11, color: c.text4, marginBottom: 3 }}>
                                🏆 Punctaj total fasting · {statsPeriod === 0 ? 'tot' : `${statsPeriod} zile`}
                              </div>
                              <div style={{ fontSize: 10, color: c.text4 }}>
                                {above16}x 16:8 &nbsp;·&nbsp; {above14 - above16}x 14:10 &nbsp;·&nbsp; {above12 - above14}x 12:12 &nbsp;·&nbsp; {fastFiltered.length - above12}x {'<'} 12h
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', minWidth: 48 }}>
                              <div style={{ fontSize: 24, fontWeight: 800, color: totalPoints > 0 ? '#22c55e' : c.text4, lineHeight: 1 }}>{totalPoints}</div>
                              <div style={{ fontSize: 9, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>puncte</div>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button onClick={() => window.location.href='/nutrition'} style={{ fontSize: 12, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Vezi jurnal mese & scanare AI →
                    </button>
                  </div>
                </>
              )
            })()}

{statsSubTab === 'sleep' && (
  <SleepStatsView 
    periodFitDays={periodFitDays}
    userProfile={userProfile}
    lang={lang}
    c={c}
    s={s}
    grid4={grid4}
    t={t}
    setTab={setTab}
  />
)}

            {/* ── SĂNĂTATE ── */}
            {/* ── CALENDAR — vizualizare lunară ── */}
            {statsSubTab === 'calendar' && (() => {
              const { year, month } = calendarMonth
              const firstDay = new Date(year, month, 1)
              const lastDay = new Date(year, month + 1, 0)
              const daysInMonth = lastDay.getDate()
              // Luni=0 ... Duminică=6
              const startWeekday = (firstDay.getDay() + 6) % 7
              const todayStr = new Date().toISOString().slice(0,10)

              function pad(n) { return n < 10 ? '0'+n : ''+n }
              function dateStr(d) { return `${year}-${pad(month+1)}-${pad(d)}` }

              // Agregă date per zi din sursele disponibile
              function getDayData(d) {
                const ds = dateStr(d)
                const workout = workouts.find(w => w.date === ds)
                const fit = (intervalsData?.days || []).find(x => x.date === ds)
                const nutr = nutritionHistory.find(n => n.date === ds)
                return { date: ds, workout, fit, nutr }
              }

              // Recalculate pe perioada selectată (7/30/90 zile), nu pe luna calendaristică afișată
              const periodWorkoutDays = new Set(workouts.filter(w => w.date && w.date >= cutoffDate).map(w => w.date))
              const periodWorkoutsList = workouts.filter(w => w.date && w.date >= cutoffDate)
              const periodActiveDaysCount = (intervalsData?.days || []).filter(d => d.date >= cutoffDate && d.steps >= 8000).length
              const periodNutritionDays = nutritionHistory.filter(n => n.date >= cutoffDate)

              const monthWorkoutDays = new Set(workouts.filter(w => w.date && w.date.startsWith(`${year}-${pad(month+1)}`)).map(w => w.date))
              const monthActiveDays = (intervalsData?.days || []).filter(d => d.date?.startsWith(`${year}-${pad(month+1)}`) && d.steps >= 8000).length

              const cells = []
              for (let i = 0; i < startWeekday; i++) cells.push(null)
              for (let d = 1; d <= daysInMonth; d++) cells.push(d)

              const monthNames = lang === 'en'
                ? ['January','February','March','April','May','June','July','August','September','October','November','December']
                : ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

              return (
                <>
                  <div style={grid4}>
                    <MetricCard label={'Antrenamente'} value={periodWorkoutDays.size} delta={statsPeriod>0?`${statsPeriod} ${lang==='en'?'days':'zile'}`:'total'} c={c}
                      onClick={() => setCalSummaryView(calSummaryView === 'workouts' ? null : 'workouts')}/>
                    <MetricCard label="Zile active" value={periodActiveDaysCount} delta={lang==='en'?'≥8k steps':'≥8k pași'} c={c}
                      onClick={() => setCalSummaryView(calSummaryView === 'active' ? null : 'active')}/>
                    <MetricCard label="Zile nutriție" value={periodNutritionDays.length} c={c}
                      onClick={() => setCalSummaryView(calSummaryView === 'nutrition' ? null : 'nutrition')}/>
                    <MetricCard label="Rată antrenament" value={statsPeriod>0?`${Math.round((periodWorkoutDays.size/statsPeriod)*100)}%`:`${periodWorkoutDays.size} ${lang==='en'?'days':'zile'}`} delta={statsPeriod>0?`${statsPeriod} ${lang==='en'?'days':'zile'}`:'total'} c={c}/>
                  </div>

                  {calSummaryView && (
                    <div style={{ background: c.card, borderRadius: c.radiusSm, padding: '1rem', marginBottom: '1.1rem', boxShadow: c.shadowCard }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {calSummaryView === 'workouts' ? (lang==='en'?`Workouts — ${statsPeriod>0?statsPeriod+' days':'total'} (${periodWorkoutsList.length})`:`Antrenamente — ${statsPeriod>0?statsPeriod+' zile':'total'} (${periodWorkoutsList.length})`) : calSummaryView === 'active' ? (lang==='en'?`Active days — ${statsPeriod>0?statsPeriod+' days':'total'} (${periodActiveDaysCount})`:`Zile active — ${statsPeriod>0?statsPeriod+' zile':'total'} (${periodActiveDaysCount})`) : (lang==='en'?`Days with logged nutrition — ${statsPeriod>0?statsPeriod+' days':'total'} (${periodNutritionDays.length})`:`Zile cu nutriție logată — ${statsPeriod>0?statsPeriod+' zile':'total'} (${periodNutritionDays.length})`)}
                        </div>
                        <button onClick={() => setCalSummaryView(null)} style={{ background: 'transparent', border: 'none', color: c.text4, fontSize: 16, cursor: 'pointer' }}>✕</button>
                      </div>

                      {calSummaryView === 'workouts' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {periodWorkoutsList.length === 0 ? (
                            <div style={{ fontSize: 12, color: c.text4 }}>{t('Niciun antrenament în această perioadă.')}</div>
                          ) : periodWorkoutsList.map((w, i) => {
                            const { value: wDuration, isEstimated: wDurEstimated } = estimateWorkoutDuration(w)
                            return (
                              <div key={w.id || i} style={{ background: c.card2, borderRadius: 10, padding: '10px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{w.title}</div>
                                    <div style={{ fontSize: 11, color: c.text4, marginTop: 2 }}>{w.date} · {wDuration}min{wDurEstimated ? ` (${lang === 'en' ? 'estimated' : 'estimat'})` : ''} · {w.volume_kg?.toLocaleString()}kg</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {calSummaryView === 'active' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(intervalsData?.days || []).filter(d => d.date >= cutoffDate && d.steps >= 8000).sort((a,b) => b.date.localeCompare(a.date)).map((d, i) => (
                            <div key={i} style={{ background: c.card2, borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, color: c.text }}>{d.date}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: c.green }}>{d.steps?.toLocaleString()} {lang==='en'?'steps':'pași'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {calSummaryView === 'nutrition' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {periodNutritionDays.sort((a,b) => b.date.localeCompare(a.date)).map((n, i) => (
                            <div key={i} style={{ background: c.card2, borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, color: c.text }}>{n.date}</span>
                              <span style={{ fontSize: 13, color: c.text3 }}>{n.calories || '—'} kcal · {n.protein_g || '—'}g prot.</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <button onClick={() => setCalendarMonth(p => p.month===0 ? {year:p.year-1,month:11} : {year:p.year,month:p.month-1})}
                        style={{ width: 34, height: 34, borderRadius: c.radiusSm, background: c.card2, border: 'none', color: c.text3, cursor: 'pointer', fontSize: 16, boxShadow: c.shadowCard }}>‹</button>
                      <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{monthNames[month]} {year}</div>
                      <button onClick={() => setCalendarMonth(p => p.month===11 ? {year:p.year+1,month:0} : {year:p.year,month:p.month+1})}
                        style={{ width: 34, height: 34, borderRadius: c.radiusSm, background: c.card2, border: 'none', color: c.text3, cursor: 'pointer', fontSize: 16, boxShadow: c.shadowCard }}>›</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
                      {(lang==='en'?['M','T','W','T','F','S','S']:['L','M','M','J','V','S','D']).map((d,i) => (
                        <div key={i} style={{ textAlign: 'center', fontSize: 10, color: c.text4, fontWeight: 600 }}>{d}</div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                      {cells.map((d, i) => {
                        if (d === null) return <div key={i}/>
                        const ds = dateStr(d)
                        const dayInfo = getDayData(d)
                        const hasWorkout = !!dayInfo.workout
                        const hasAnyData = hasWorkout || dayInfo.fit || dayInfo.nutr
                        const isToday = ds === todayStr
                        const isSelected = ds === selectedCalDay
                        const isFuture = ds > todayStr

                        // Detectare forță și cardio fără calcul caloric (calories_burned din Intervals = active cal, nu total)
                        const hasStrength = hasWorkout
                        const hasCardio = !!(dayInfo.fit && (
                          (dayInfo.fit.steps || 0) > 2000 ||
                          (dayInfo.fit.distance_m || 0) > 500 ||
                          (dayInfo.fit.calories_burned || 0) > 50
                        ))

                        // Proporție verde/albastru: durată + volum pentru forță, pași + distanță pentru cardio
                        const strengthW = hasStrength ? Math.max(1, (dayInfo.workout.duration_min || 30) + (dayInfo.workout.volume_kg || 0) / 500) : 0
                        const cardioW   = hasCardio   ? Math.max(1, (dayInfo.fit.steps || 0) / 3000 + (dayInfo.fit.distance_m || 0) / 2000) : 0
                        const totalW    = strengthW + cardioW
                        const greenPct  = totalW > 0 ? Math.round((strengthW / totalW) * 100) : 50

                        let cellBg = 'transparent'
                        if (hasStrength && hasCardio) {
                          cellBg = `linear-gradient(90deg, ${c.green}55 0%, ${c.green}55 ${greenPct}%, ${c.blue}40 ${greenPct}%, ${c.blue}40 100%)`
                        } else if (hasStrength) {
                          cellBg = `${c.green}55`
                        } else if (hasCardio) {
                          cellBg = `${c.blue}40`
                        } else if (hasAnyData) {
                          cellBg = `${c.text4}22`
                        }

                        return (
                          <div key={i} onClick={() => {
                              if (isFuture) return
                              const newSelected = isSelected ? null : ds
                              setSelectedCalDay(newSelected)
                              if (newSelected) loadSelectedDayExtra(newSelected)
                              else setSelectedDayExtra(null)
                            }}
                            style={{
                              aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              borderRadius: 8, cursor: isFuture ? 'default' : 'pointer',
                              background: isSelected ? c.green3 : isToday ? c.card2 : cellBg,
                              border: isToday ? `1px solid ${c.green2}` : isSelected ? `1px solid ${c.green4}` : '1px solid transparent',
                              opacity: isFuture ? 0.3 : 1,
                              position: 'relative', overflow: 'hidden',
                            }}>
                            <div style={{ fontSize: 12, color: isSelected ? c.green : c.text, fontWeight: isToday ? 700 : 400, zIndex: 1 }}>{d}</div>
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: 11, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.text4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: c.green+'55' }}/> {t('Forță (Hevy)')}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.text4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: c.blue+'40' }}/> Cardio</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.text4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: `linear-gradient(90deg, ${c.green}55 50%, ${c.blue}40 50%)` }}/> {t('Ambele (proporțional)')}</span>
                    </div>
                  </div>

                  {/* Card detaliu zi selectată — rezumat complet */}
                  {selectedCalDay && (() => {
                    const d = parseInt(selectedCalDay.slice(8,10), 10)
                    const info = getDayData(d)
                    const dateLabel = new Date(selectedCalDay).toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
                    const isToday = selectedCalDay === todayStr
                    const water = isToday ? waterToday?.total_ml : selectedDayExtra?.water
                    const waterTargetL = ((body?.weight_kg || userProfile?.weight_kg || 80) * 35 / 1000).toFixed(1)
                    const health = isToday ? { cardio_score: readiness.scores.health, hrv_rmssd: intervalsHrv } : selectedDayExtra?.health

                    // Estimare split calorii forță/cardio — folosește aceleași funcții unificate ca în WorkoutPage
                    // BMR zilnic complet (24h) — scădem din totalul brut Google Fit înainte de a separa forță/cardio
                    const dailyBmrFull = nutritionTargets.bmrDaily || 1800
                    const workoutDuration = info.workout ? estimateWorkoutDuration(info.workout) : null
                    const wCalInfo = info.workout ? formatCalories(info.workout) : null
                    const strengthCal = wCalInfo?.value || 0
                    // Calorii din activitati Intervals.icu pentru ziua selectata
                    const dayActivities = filterMFP(intervalsData?.activities).filter(a => a.date === info.date)
                    const totalBurnedRaw = dayActivities.reduce((s, a) => s + (a.calories || 0), 0)
                    const totalActiveCal = totalBurnedRaw
                    const cardioCal = Math.max(0, Math.round(totalActiveCal - strengthCal))
                    const totalBurned = totalActiveCal

                    return (
                      <div style={s.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: c.text, textTransform: 'capitalize' }}>
                            {dateLabel} {isToday && <span style={{ fontSize: 11, color: c.green, fontWeight: 500 }}>· azi</span>}
                          </div>
                          <button onClick={() => { setSelectedCalDay(null); setSelectedDayExtra(null) }} style={{ background: 'transparent', border: 'none', color: c.text4, fontSize: 16, cursor: 'pointer' }}>✕</button>
                        </div>

                        {/* ── ANTRENAMENT FORȚĂ ── */}
                        {info.workout ? (
                          <div style={{ background: c.green3, borderRadius: c.radiusSm, padding: '14px', marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: c.green }}>🏋️ {info.workout.title}</div>
                                <div style={{ fontSize: 11, color: c.text3, marginTop: 2 }}>{workoutDuration.value} min{workoutDuration.isEstimated ? ` (${lang==='en'?'estimated':'estimat'})` : ''} · {info.workout.volume_kg?.toLocaleString()}kg {lang==='en'?'volume':'volum'} · {wCalInfo?.isReal ? '' : '~'}{strengthCal} kcal{wCalInfo?.isReal ? ' · Intervals.icu' : ''}</div>
                              </div>
                              <MiniMuscleMap exercises={info.workout.exercises || []} />
                            </div>
                            {info.workout.muscle_groups?.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                {info.workout.muscle_groups.map(g => <span key={g} style={{ fontSize: 10, background: c.card2, color: c.text3, padding: '2px 7px', borderRadius: 5 }}>{g}</span>)}
                              </div>
                            )}
                            {info.workout.exercises?.length > 0 && (
                              <div style={{ borderTop: `0.5px solid ${c.green4}55`, paddingTop: 8, marginTop: 4 }}>
                                {info.workout.exercises.map((ex, j) => {
                                  const maxW = ex.sets?.length > 0 ? Math.max(...ex.sets.map(s => s.weight_kg || 0)) : 0
                                  return (
                                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.text3, padding: '3px 0' }}>
                                      <span>{ex.name}</span>
                                      <span style={{ color: c.text }}>{ex.sets?.length || 0} {lang==='en'?'sets':'seturi'}{maxW > 0 ? ` · ${maxW}kg max` : ''}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ background: c.card2, borderRadius: 12, padding: '12px', marginBottom: 10, fontSize: 12, color: c.text4 }}>
                            🏋️ {t('Fără antrenament de forță în această zi')}
                          </div>
                        )}

                        {/* ── ACTIVITATE ── */}
                        <div style={s.sectionLabel}>{t('🏃 Activitate')}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 12 }}>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>{t('Pași')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{info.fit?.steps?.toLocaleString() || '—'}</div>
                          </div>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>{t('Calorii arse (activitate)')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{totalBurned > 0 ? Math.round(totalBurned) : '—'}</div>
                          </div>
                        </div>

                        {/* ── NUTRIȚIE ── */}
                        <div style={s.sectionLabel}>{t('🥗 Nutriție')}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>{t('Calorii')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{info.nutr?.calories || '—'}</div>
                          </div>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>{t('Proteine')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{info.nutr?.protein_g ? `${info.nutr.protein_g}g` : '—'}</div>
                          </div>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>{t('Greutate')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{info.fit?.weight_kg ? `${parseFloat(info.fit.weight_kg).toFixed(1)}kg` : '—'}</div>
                          </div>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>{t('💧 Apă')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.blue }}>
                              {selectedDayLoading ? '...' : water != null ? `${(water/1000).toFixed(1)}/${waterTargetL}L` : '—'}
                            </div>
                          </div>
                        </div>

                        {/* ── SĂNĂTATE ── */}
                        <div style={s.sectionLabel}>{t('❤️ Sănătate')}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>{t('Scor cardio')}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                              {selectedDayLoading ? '...' : health?.cardio_score ? `${health.cardio_score}/100` : '—'}
                            </div>
                          </div>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>HRV RMSSD</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                              {selectedDayLoading ? '...' : (() => { const v = health?.hrv_rmssd || info.fit?.hrv; return v ? `${Math.round(v)}ms · Intervals.icu` : '—' })()}
                            </div>
                          </div>
                          <div style={{ background: c.card2, borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 10, color: c.text4 }}>SpO2</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                              {selectedDayLoading ? '...' : (() => { const v = health?.spo2 || info.fit?.spo2; return v ? `${Math.round(v)}%` : '—' })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </>
              )
            })()}

            
            {statsSubTab === 'corp' && (() => {
              // Surse greutate: Withings days > Intervals days (merge + dedup)
              const wDaysWithings = (withingsData?.days || []).filter(d => d.weight_kg != null)
              const wDaysIntervals = (intervalsData?.days || []).filter(d => d.weight_kg != null)
              const wDaysMerged = Object.values(
                [...wDaysWithings, ...wDaysIntervals].reduce((acc, d) => {
                  if (!acc[d.date] || wDaysWithings.find(x => x.date === d.date)) acc[d.date] = d
                  return acc
                }, {})
              ).sort((a, b) => a.date < b.date ? -1 : 1)
              // Weight days (pentru grafic greutate)
              const corpDays = wDaysMerged.filter(d => d.date >= cutoffDate)
              // All merged days in period (pt grăsime & musculatură)
              // Historical body composition from body_measurements table
              const todayStrC = new Date().toISOString().slice(0, 10)
              const bodySnap = withingsData?.body
              const bodyMeasHistory = (bodyMeasQ?.data || []).filter(d => d.date >= cutoffDate)
              // Merge body_measurements history with withings/intervals days for fat/muscle
              const fatMuscleMerged = Object.values(
                [...bodyMeasHistory,
                 ...(withingsData?.days || []).filter(d => d.fat_pct != null || d.muscle_kg != null),
                 ...(intervalsData?.days || []).filter(d => d.fat_pct != null || d.muscle_kg != null)
                ].reduce((acc, d) => {
                  if (!acc[d.date]) acc[d.date] = { ...d }
                  else acc[d.date] = { ...acc[d.date], ...Object.fromEntries(Object.entries(d).filter(([,v]) => v != null)) }
                  return acc
                }, {})
              ).filter(d => d.date >= cutoffDate).sort((a,b) => a.date < b.date ? -1 : 1)
              const hasTodayFat = fatMuscleMerged.some(d => d.date === todayStrC && d.fat_pct != null)
              const hasTodayMuscle = fatMuscleMerged.some(d => d.date === todayStrC && d.muscle_kg != null)
              const fatDays = [
                ...fatMuscleMerged.filter(d => d.fat_pct != null),
                ...(!hasTodayFat && bodySnap?.fat_pct ? [{ date: todayStrC, fat_pct: bodySnap.fat_pct }] : [])
              ].sort((a,b) => a.date < b.date ? -1 : 1)
              const muscleDays = [
                ...fatMuscleMerged.filter(d => d.muscle_kg != null),
                ...(!hasTodayMuscle && bodySnap?.muscle_kg ? [{ date: todayStrC, muscle_kg: bodySnap.muscle_kg }] : [])
              ].sort((a,b) => a.date < b.date ? -1 : 1)
              const corpTarget = userProfile?.target_weight_kg ?? null
              const { low: bmiLow, high: bmiHigh } = (() => {
                const hM = (userProfile?.height_cm || 170) / 100
                return { low: +(18.5 * hM * hM).toFixed(1), high: +(24.9 * hM * hM).toFixed(1) }
              })()
              // Greutate curentă: Withings body > ultimul din days > Intervals today
              const currentW = withingsData?.body?.weight_kg
                || corpDays[corpDays.length - 1]?.weight_kg
                || intervalsData?.today?.weight_kg
                || null
              const firstW = corpDays[0]?.weight_kg
              const lastW = corpDays[corpDays.length - 1]?.weight_kg
              const deltaW = (firstW && lastW && firstW !== lastW) ? +(lastW - firstW).toFixed(1) : null
              const latestBody = withingsData?.body
              // Câmpuri reale Withings: weight_kg, fat_pct, muscle_kg, pwv, bp_sys, hr_rest
              // Masă slabă calculată: greutate × (1 - grăsime%)
              const leanMassKg = (latestBody?.weight_kg && latestBody?.fat_pct)
                ? +(latestBody.weight_kg * (1 - latestBody.fat_pct / 100)).toFixed(1)
                : null
              const firstLean = (corpDays[0]?.weight_kg && corpDays[0]?.fat_pct)
                ? +(corpDays[0].weight_kg * (1 - corpDays[0].fat_pct / 100)).toFixed(1) : null
              const lastLean = (lastW && latestBody?.fat_pct)
                ? +(lastW * (1 - latestBody.fat_pct / 100)).toFixed(1) : null
              return (
                <>
                  {/* Summary row */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:'1rem' }}>
                    <div style={{ background:c.card, borderRadius:12, padding:'0.6rem 0.75rem' }}>
                      <div style={{ fontSize:11, color:c.text3 }}>{t('Greutate')}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:c.text }}>{currentW ? `${currentW} kg` : '—'}</div>
                      {deltaW !== null && <div style={{ fontSize:11, color: deltaW < 0 ? '#4ade80' : '#f87171' }}>{deltaW > 0 ? '+':''}{deltaW} kg</div>}
                    </div>
                    <div style={{ background:c.card, borderRadius:12, padding:'0.6rem 0.75rem' }}>
                      <div style={{ fontSize:11, color:c.text3 }}>{t('Grăsime')}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:'#fb923c' }}>{latestBody?.fat_pct ? `${latestBody.fat_pct}%` : '—'}</div>
                    </div>
                    <div style={{ background:c.card, borderRadius:12, padding:'0.6rem 0.75rem' }}>
                      <div style={{ fontSize:11, color:c.text3 }}>{t('Masă slabă')}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:'#34d399' }}>{leanMassKg ? `${leanMassKg} kg` : '—'}</div>
                    </div>
                  </div>

                  {/* Multi-metric chart */}
                  <Acc title="📈 Evoluție corp" defaultOpen c={c}>
                  <div style={{ background:c.card, borderRadius:14, padding:'0.75rem', marginBottom:'1rem' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:c.text }}>{t('Evoluție')}</div>
                      <div style={{ display:'flex', gap:4 }}>
                        {[
                          { key:'weight', label:'Greutate', color:'#a78bfa' },
                          { key:'fat',    label:'Grăsime',  color:'#fb923c' },
                          { key:'muscle', label:'Musculatură', color:'#60a5fa' },
                        ].map(m => (
                          <button key={m.key}
                            onClick={() => setCorpChartKeys(prev =>
                              prev.includes(m.key)
                                ? prev.length > 1 ? prev.filter(k => k !== m.key) : prev
                                : [...prev, m.key]
                            )}
                            style={{ padding:'3px 9px', borderRadius:20, border:'none', cursor:'pointer',
                              fontSize:10, fontFamily:'inherit',
                              background: corpChartKeys.includes(m.key) ? m.color : 'rgba(255,255,255,0.06)',
                              color: corpChartKeys.includes(m.key) ? '#000' : '#888',
                              fontWeight: corpChartKeys.includes(m.key) ? 700 : 400 }}>
                            {t(m.label)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <MiniBodyChart
                      series={[
                        { key:'weight', label:'Greutate', days:corpDays, color:'#a78bfa', fieldKey:'weight_kg', unit:'kg' },
                        { key:'fat',    label:'Grăsime',  days:fatDays,  color:'#fb923c', fieldKey:'fat_pct',   unit:'%'  },
                        { key:'muscle', label:'Musc.',    days:muscleDays, color:'#60a5fa', fieldKey:'muscle_kg', unit:'kg' },
                      ].filter(s => corpChartKeys.includes(s.key))}
                      low={bmiLow} high={bmiHigh} target={corpTarget}
                    />
                    <div style={{ display:'flex', gap:10, fontSize:10, color:'#888', marginTop:4, flexWrap:'wrap' }}>
                      {corpChartKeys.includes('weight') && <span style={{color:'#a78bfa'}}>— Greutate</span>}
                      {corpChartKeys.includes('fat') && <span style={{color:'#fb923c'}}>— {t('Grăsime')}</span>}
                      {corpChartKeys.includes('muscle') && <span style={{color:'#60a5fa'}}>— {t('Musculatură')}</span>}
                      {corpChartKeys.length === 1 && corpChartKeys[0] === 'weight' && (
                        <><span style={{color:'#a78bfa', opacity:0.6}}>·· Medie</span>
                        <span style={{color:'#4ade80'}}>— Interval BMI</span>
                        {corpTarget && <span style={{color:'#e879f9'}}>— Țintă {corpTarget}kg</span>}</>
                      )}
                    </div>
                    {corpDays.length === 0 && fatDays.length === 0 && (
                      <div style={{ fontSize:11, color:c.text3, marginTop:8, textAlign:'center' }}>
                        💡 Sincronizează greutatea în Intervals.icu sau activează istoricul Withings
                      </div>
                    )}
                  </div>
                  </Acc>

                  {/* Composition grid — câmpuri reale Withings */}
                  {latestBody && (
                    <Acc title="⚖️ Compoziție corporală" c={c}>
                    <div style={{ background:c.card, borderRadius:14, padding:'0.75rem', marginBottom:'1rem' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:c.text, marginBottom:8 }}>{t('Compoziție corporală · Withings')}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        {(() => {
                          // Apă: Withings poate returna hydration, water_pct, water_percent
                          const waterVal = latestBody.hydration ?? latestBody.water_pct ?? latestBody.water_percent ?? null
                          return [
                            { label:'Grăsime', value: latestBody.fat_pct, unit:'%', color:'#fb923c', max:40 },
                            { label:'Masă slabă', value: leanMassKg, unit:'kg', color:'#34d399', max:90 },
                            { label:'Musculatură', value: latestBody.muscle_kg, unit:'kg', color:'#60a5fa', max:70 },
                            { label:'Conținut apă', value: waterVal, unit:'%', color:'#38bdf8', max:70 },
                            { label:'HR odihnă', value: latestBody.hr_rest, unit:'bpm', color:'#a78bfa', max:80 },
                          ].filter(m => m.value != null)
                        })().map(m => (
                          <div key={t(m.label)} style={{ background:c.bg, borderRadius:10, padding:'0.5rem 0.6rem' }}>
                            <div style={{ fontSize:10, color:c.text3 }}>{t(m.label)}</div>
                            <div style={{ fontSize:17, fontWeight:700, color:m.color }}>{m.value}{m.unit}</div>
                            <div style={{ height:3, background:'rgba(255,255,255,0.08)', borderRadius:2, marginTop:4 }}>
                              <div style={{ height:3, background:m.color, borderRadius:2, width:`${Math.min(100,(m.value/m.max)*100)}%` }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    </Acc>
                  )}

                  {/* Tensiune + PWV */}
                  {(latestBody?.pwv || latestBody?.bp_sys) && (
                    <div style={{ display:'grid', gridTemplateColumns: latestBody.pwv && latestBody.bp_sys ? '1fr 1fr' : '1fr', gap:8, marginBottom:'1rem' }}>
                      {latestBody?.bp_sys && (
                        <div style={{ background:c.card, borderRadius:12, padding:'0.6rem 0.75rem' }}>
                          <div style={{ fontSize:11, color:c.text3 }}>Tensiune</div>
                          <div style={{ fontSize:20, fontWeight:700, color: latestBody.bp_sys > 130 ? '#f87171' : '#4ade80' }}>
                            {latestBody.bp_sys}/{latestBody.bp_dia}
                          </div>
                          <div style={{ fontSize:10, color:c.text3 }}>mmHg</div>
                        </div>
                      )}
                      {latestBody?.pwv && (
                        <div style={{ background:c.card, borderRadius:12, padding:'0.6rem 0.75rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ fontSize:11, color:c.text3 }}>{t('PWV arterial')}</div>
                            <div style={{ fontSize:20, fontWeight:700, color: latestBody.pwv > 7 ? '#f87171' : '#4ade80' }}>{latestBody.pwv} m/s</div>
                          </div>
                          <div style={{ fontSize:11, color:c.text3 }}>{latestBody.pwv <= 7 ? '✅' : '⚠️'}</div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}

{statsSubTab === 'health' && (() => {
              // ── Withings: ia ultima valoare înregistrată per câmp (nu doar snapshotul de azi) ──
              const _bmHist = (bodyMeasQ?.data || []).filter(Boolean).slice().sort((a,b) => (a.date < b.date ? 1 : -1)) // desc
              const lastMeas = (field) => {
                if (body?.[field] != null && body[field] !== 0) return body[field]
                const rec = _bmHist.find(d => d[field] != null && d[field] !== 0)
                return rec ? rec[field] : null
              }
              const hBody = {
                bp_sys: lastMeas('bp_sys'), bp_dia: lastMeas('bp_dia'), pwv: lastMeas('pwv'),
                weight_kg: lastMeas('weight_kg'), fat_pct: lastMeas('fat_pct'), muscle_kg: lastMeas('muscle_kg'), hr_rest: lastMeas('hr_rest'),
              }
              const hrvDaysH = periodFitDays.filter(d=>d.hrv!=null&&d.hrv>0)
              const hrDaysH  = periodFitDays.filter(d=>d.hr_rest!=null&&d.hr_rest>0)
              const avgHrvH  = hrvDaysH.length>0 ? Math.round(hrvDaysH.reduce((s,d)=>s+d.hrv,0)/hrvDaysH.length) : null
              const avgHrH   = hrDaysH.length>0  ? Math.round(hrDaysH.reduce((s,d)=>s+d.hr_rest,0)/hrDaysH.length) : null
              const hrvTrend = hrvDaysH.length>=5 ? (() => {
                const first3 = hrvDaysH.slice(0,Math.floor(hrvDaysH.length/3)).reduce((s,d)=>s+d.hrv,0) / Math.floor(hrvDaysH.length/3)
                const last3  = hrvDaysH.slice(-Math.floor(hrvDaysH.length/3)).reduce((s,d)=>s+d.hrv,0) / Math.floor(hrvDaysH.length/3)
                return last3-first3
              })() : null
              return (
                <>
                  <HRVMeasurement userId={user?.id} c={c} onHrvUpdate={(rmssd) => setPolarHrv(rmssd)} />
                  {polarHrv != null && (
                    <div style={{ fontSize: 11, color: '#4ade80', marginBottom: 8, textAlign: 'center' }}>
                      ✓ HRV din Polar H10: {polarHrv}ms RMSSD · suprascrie Intervals.icu pentru azi
                    </div>
                  )}
                  {/* ── Card istoricul măsurătorilor HRV Polar H10 ── */}
                  {(() => {
                    const today = new Date().toISOString().slice(0, 10)
                    const cutoffTs = statsPeriod === 0
                      ? 0
                      : Date.now() - statsPeriod * 86400000
                    const filtered = polarHrvHistory.filter(h => {
                      const d = h.measured_at ? h.measured_at.slice(0, 10) : null
                      if (!d) return false
                      if (statsPeriod === 1) return d === today
                      return new Date(h.measured_at).getTime() >= cutoffTs
                    })
                    const periodLabel = statsPeriod === 1 ? (lang === 'en' ? 'today' : 'azi') : statsPeriod === 0 ? (lang === 'en' ? 'all' : 'total') : `${statsPeriod} ${lang === 'en' ? 'days' : 'zile'}`
                    const scoreColor = s => !s ? c.text4 : s >= 70 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'
                    const metColor = (type, v) => {
                      if (v == null) return c.text4
                      if (type === 'rmssd' || type === 'sdnn') return v >= 50 ? '#22c55e' : v >= 30 ? '#f59e0b' : '#ef4444'
                      if (type === 'lfhf') return v <= 1.5 ? '#22c55e' : v <= 3 ? '#f59e0b' : '#ef4444'
                      if (type === 'si') return v <= 50 ? '#22c55e' : v <= 150 ? '#f59e0b' : '#ef4444'
                      return c.text
                    }
                    const fmt = v => v == null ? '—' : (Math.round(v * 10) / 10).toString()

                    return (
                      <Acc
                        title={`📊 ${lang === 'en' ? 'HRV Polar H10 measurements' : 'Măsurători HRV Polar H10'} · ${periodLabel}${filtered.length ? ` (${filtered.length})` : ''}`}
                        defaultOpen={false}
                        c={c}
                      >
                        {filtered.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: c.text4 }}>
                            {polarHrvHistoryLoaded ? `Nicio măsurătoare în intervalul selectat (${periodLabel})` : 'Se încarcă...'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filtered.map((h, i) => {
                              const dt = new Date(h.measured_at)
                              const dateStr = dt.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
                              const timeStr = dt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
                              return (
                                <div key={i} style={{ background: c.card, borderRadius: 12, padding: '12px 14px', border: `1px solid ${c.border}` }}>
                                  {/* header: data/ora · durata · device — scor */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontSize: 11, color: c.text3 }}>
                                      {dateStr}, {timeStr}
                                      {h.duration_min ? ` · ${h.duration_min}min` : ''}
                                      {h.device_name ? ` · ${h.device_name}` : ''}
                                    </div>
                                    {h.readiness_score != null && (
                                      <div style={{ fontSize: 14, fontWeight: 700, color: scoreColor(h.readiness_score) }}>
                                        {h.readiness_score}/100
                                      </div>
                                    )}
                                  </div>
                                  {/* grid metrici 4 coloane */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                                    {[
                                      { l: 'RMSSD', v: h.rmssd,         u: 'ms',  col: metColor('rmssd', h.rmssd) },
                                      { l: 'SDNN',  v: h.sdnn,          u: 'ms',  col: metColor('sdnn',  h.sdnn)  },
                                      { l: 'SD1',   v: h.sd1,           u: 'ms',  col: '#34d399'                  },
                                      { l: 'SD2',   v: h.sd2,           u: 'ms',  col: '#a78bfa'                  },
                                      { l: 'PNN50', v: h.pnn50,         u: '%',   col: c.text                     },
                                      { l: 'LF/HF', v: h.lf_hf_ratio,  u: '',    col: metColor('lfhf', h.lf_hf_ratio) },
                                      { l: 'SI',    v: h.stress_index,  u: '',    col: metColor('si',   h.stress_index) },
                                      { l: 'ARTEF.',v: h.artifact_pct != null ? fmt(h.artifact_pct) + '%' : null, u: '', col: c.text3 },
                                    ].map((m, j) => (
                                      <div key={j} style={{ background: c.bg, borderRadius: 7, padding: '6px 7px' }}>
                                        <div style={{ fontSize: 9, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{m.l}</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: m.v != null ? m.col : c.text4 }}>
                                          {m.v != null
                                            ? (typeof m.v === 'string' ? m.v : fmt(m.v) + (m.u ? ' ' + m.u : ''))
                                            : '—'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {/* footer calitate */}
                                  {(h.quality || h.rr_count) && (
                                    <div style={{ fontSize: 10, color: c.text4, marginTop: 7 }}>
                                      {h.quality ? `Calitate: ${h.quality}` : ''}
                                      {h.quality && h.rr_count ? ' · ' : ''}
                                      {h.rr_count ? `${h.rr_count} intervale RR` : ''}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </Acc>
                    )
                  })()}
                  <div style={grid4}>
                    <MetricCard label="Scor cardiovascular" value={cardioScoreNow||'—'} unit={cardioScoreNow?'/100':''} deltaPos={cardioScoreNow>=70} c={c}/>
                    <MetricCard label="HRV mediu" value={avgHrvH||'—'} unit={avgHrvH?'ms':''} deltaPos={avgHrvH!=null&&avgHrvH>=40}
                      delta={hrvTrend!=null ? (lang==='en' ? (hrvTrend>0?`↑ +${Math.round(hrvTrend)}ms vs start`:`↓ ${Math.round(hrvTrend)}ms vs start`) : (hrvTrend>0?`↑ +${Math.round(hrvTrend)}ms față de început`:`↓ ${Math.round(hrvTrend)}ms față de început`)) : null}
                      c={c}/>
                    <MetricCard label={'Vârstă biologică'} icon="🧬" value={bioAge||'—'} unit={bioAge?(lang==='en'?'yrs':'ani'):''} c={c}/>
                    <MetricCard label="PWV arterial" value={hBody.pwv||'—'} unit={hBody.pwv?'m/s':''} deltaPos={hBody.pwv!=null&&hBody.pwv<=7} c={c}/>
                  </div>
                  {/* Trend HRV */}
                  {hrvDaysH.length > 1 && (
                    <Acc title="💓 HRV (Intervals.icu)" defaultOpen c={c}>
                    <div style={s.card}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <div style={s.sectionLabel}>HRV (Intervals.icu)</div>
                        <div style={{ fontSize:11, color:c.text4 }}>ms · baseline {intervalsData?.athlete?.hrv_baseline ? `${intervalsData.athlete.hrv_baseline}ms` : '—'}</div>
                      </div>
                      <SplineChart
                        data={hrvDaysH.map(d=>d.hrv)}
                        dates={hrvDaysH.map(d=>d.date)}
                        color="#34d399"
                        height={80}
                        c={c}
                        showDots={false}
                        formatValue={v=>`${Math.round(v)} ms`}
                      />
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c.text4, marginTop:4 }}>
                        <span>Min: {Math.min(...hrvDaysH.map(d=>d.hrv))} ms</span>
                        <span>{lang === 'en' ? 'Avg' : 'Medie'}: {avgHrvH} ms</span>
                        <span>Max: {Math.max(...hrvDaysH.map(d=>d.hrv))} ms</span>
                      </div>
                    </div>
                    </Acc>
                  )}
                  {/* Trend puls odihnă */}
                  {hrDaysH.length > 1 && (
                    <Acc title="❤️ Puls odihnă" c={c}>
                    <div style={s.card}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <div style={s.sectionLabel}>{t('Puls odihnă')}</div>
                        <div style={{ fontSize:11, color:c.text4 }}>bpm</div>
                      </div>
                      <SplineChart
                        data={hrDaysH.map(d=>d.hr_rest)}
                        dates={hrDaysH.map(d=>d.date)}
                        color="#f472b6"
                        height={70}
                        c={c}
                        showDots={false}
                        formatValue={v=>`${Math.round(v)} bpm`}
                      />
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c.text4, marginTop:4 }}>
                        <span>Min: {Math.min(...hrDaysH.map(d=>d.hr_rest))} bpm</span>
                        <span>{lang === 'en' ? 'Avg' : 'Medie'}: {avgHrH} bpm</span>
                        <span>Max: {Math.max(...hrDaysH.map(d=>d.hr_rest))} bpm</span>
                      </div>
                    </div>
                    </Acc>
                  )}
                  {/* Tensiune + PWV Withings (ultima citire înregistrată) */}
                  {(hBody.bp_sys || hBody.pwv) && (
                    <div style={{ display:'grid', gridTemplateColumns:hBody.pwv&&hBody.bp_sys?'1fr 1fr':'1fr', gap:8, marginBottom:'0.75rem' }}>
                      {hBody.bp_sys && (
                        <div style={{ background:c.card, borderRadius:12, padding:'0.75rem' }}>
                          <div style={{ fontSize:11, color:c.text3, marginBottom:4 }}>{t('🩺 Tensiune arterială')}</div>
                          <div style={{ fontSize:24, fontWeight:700, color:hBody.bp_sys>130?c.red:c.green }}>{hBody.bp_sys}/{hBody.bp_dia}</div>
                          <div style={{ fontSize:10, color:c.text3 }}>mmHg · {hBody.bp_sys<=120&&hBody.bp_dia<=80?'Normal':hBody.bp_sys<=130?'Ușor ridicată':'Ridicată'}</div>
                        </div>
                      )}
                      {hBody.pwv && (
                        <div style={{ background:c.card, borderRadius:12, padding:'0.75rem' }}>
                          <div style={{ fontSize:11, color:c.text3, marginBottom:4 }}>💓 PWV arterial</div>
                          <div style={{ fontSize:24, fontWeight:700, color:hBody.pwv>7?c.red:c.green }}>{hBody.pwv} m/s</div>
                          <div style={{ fontSize:10, color:c.text3 }}>{hBody.pwv<=7?(lang==='en'?'✅ Normal (≤7 m/s)':'✅ Normal (≤7 m/s)'):(lang==='en'?'⚠️ Elevated (>7 m/s)':'⚠️ Elevat (>7 m/s)')}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* ── Card Istoric ECG Withings ── */}
                  {(() => {
                    const now = Date.now()
                    const cutoffMs = statsPeriod === 0 ? 0 : now - statsPeriod * 86400000
                    const todayStr = new Date().toISOString().slice(0,10)
                    const filteredEcg = ecgRecords.filter(r => {
                      const ecgDate = r.measured_at || r.uploaded_at
                      if (!ecgDate) return false
                      if (statsPeriod === 1) return ecgDate.slice(0,10) === todayStr
                      return new Date(ecgDate).getTime() >= cutoffMs
                    })
                    const ecgStatusColor = (s, col) => {
                      if (col) return col
                      if (s === 'normal')    return '#22c55e'
                      if (s === 'attention') return '#f59e0b'
                      if (s === 'critical')  return '#ef4444'
                      if (s === 'analyzing') return '#818cf8'
                      return c.text4
                    }
                    const periodLabel = statsPeriod === 1 ? (lang === 'en' ? 'today' : 'azi') : statsPeriod === 0 ? (lang === 'en' ? 'all' : 'total') : `${statsPeriod} ${lang === 'en' ? 'days' : 'zile'}`
                    const normalCount   = filteredEcg.filter(r => r.status === 'normal').length
                    const attentionCount = filteredEcg.filter(r => r.status === 'attention').length
                    const criticalCount = filteredEcg.filter(r => r.status === 'critical').length
                    const bpmValues = filteredEcg.filter(r => r.bpm_avg).map(r => r.bpm_avg)
                    const avgBpm = bpmValues.length ? Math.round(bpmValues.reduce((s,v)=>s+v,0)/bpmValues.length) : null

                    return (
                      <Acc
                        title={`💓 ${lang==='en'?'Withings ECG history':'Istoric ECG Withings'} · ${periodLabel}${filteredEcg.length ? ` (${filteredEcg.length})` : ''}`}
                        defaultOpen={filteredEcg.length > 0}
                        c={c}
                      >
                        {/* Sumar statistici */}
                        {filteredEcg.length > 0 && (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
                            {[
                              { l:t('Normale'), v:normalCount, col:'#22c55e' },
                              { l:t('Atenție'), v:attentionCount, col:'#f59e0b' },
                              { l:t('Critice'), v:criticalCount, col:'#ef4444' },
                              { l:'bpm avg', v:avgBpm||'—', col:c.text },
                            ].map(item => (
                              <div key={item.l} style={{ background:c.card, borderRadius:9, padding:'8px 4px', textAlign:'center' }}>
                                <div style={{ fontSize:18, fontWeight:700, color:item.col }}>{item.v}</div>
                                <div style={{ fontSize:9, color:c.text4, marginTop:1 }}>{item.l}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {filteredEcg.length === 0 ? (
                          <div style={{ textAlign:'center', padding:'20px 0', fontSize:13, color:c.text4 }}>
                            {ecgRecords.length === 0
                              ? 'Niciun ECG încărcat. Adaugă primul din pagina Azi.'
                              : `Niciun ECG în intervalul ${periodLabel}.`}
                          </div>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {filteredEcg.map(r => {
                              const col = ecgStatusColor(r.status, r.result_color)
                              const dt = new Date(r.measured_at || r.uploaded_at)
                              const dateStr = dt.toLocaleDateString('ro-RO', { day:'2-digit', month:'short' })
                              const timeStr = dt.toLocaleTimeString('ro-RO', { hour:'2-digit', minute:'2-digit' })
                              const isExpanded = ecgExpandedId === r.id
                              const tags = Array.isArray(r.result_tags) ? r.result_tags : (() => { try { return JSON.parse(r.result_tags || '[]') } catch { return [] } })()
                              return (
                                <div key={r.id}>
                                  <div
                                    onClick={() => setEcgExpandedId(isExpanded ? null : r.id)}
                                    style={{ background:c.card, borderRadius:11, padding:'10px 12px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', border:`1px solid ${c.border}` }}
                                  >
                                    <div style={{ width:34, height:34, borderRadius:9, background:`${col}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                    </div>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                          <span style={{ fontSize:12, fontWeight:600, color:c.text }}>{dateStr} · {timeStr}</span>
                                          {r.device_brand && r.device_brand !== 'Necunoscut' && (
                                            <span style={{ fontSize:9, padding:'1px 5px', borderRadius:8, background:`${col}15`, color:col, fontWeight:600 }}>{r.device_brand}</span>
                                          )}
                                        </div>
                                        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                                          <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:`${col}18`, color:col, fontWeight:600 }}>
                                            {r.status === 'analyzing' ? (lang==='en'?'⏳ Analyzing...':'⏳ Analiză...') : r.status === 'normal' ? t('Normal') : r.status === 'attention' ? t('Atenție') : r.status === 'critical' ? (lang==='en'?'Critical':'Critic') : r.status === 'error' ? t('Eroare') : r.status}
                                          </span>
                                          <button
                                            onClick={e => { e.stopPropagation(); handleEcgDelete(r.id, r.storage_path) }}
                                            style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px', borderRadius:5, color:c.text4, display:'flex', alignItems:'center' }}
                                            title="Șterge"
                                          >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                      <div style={{ fontSize:10, color:c.text4, marginTop:2 }}>
                                        {(r.result_label ? t(r.result_label) : null) || r.file_name}{r.bpm_avg ? ` · ${r.bpm_avg} bpm` : ''}
                                      </div>
                                    </div>
                                  </div>
                                  {/* Detalii expandate */}
                                  {isExpanded && r.status !== 'analyzing' && (
                                    <div style={{ background:isDark?'rgba(0,0,0,0.2)':'rgba(0,0,0,0.03)', borderRadius:'0 0 10px 10px', padding:'10px 12px', border:`1px solid ${c.border}`, borderTop:'none', marginTop:-1 }}>
                                      {r.result_summary && (
                                        <div style={{ fontSize:11, color:c.text3, lineHeight:1.55, marginBottom:8 }}>{r.result_summary}</div>
                                      )}
                                      {tags.length > 0 && (
                                        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:8 }}>
                                          {tags.map((tag, ti) => (
                                            <span key={ti} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:`${col}12`, color:col, fontWeight:600 }}>✓ {tag}</span>
                                          ))}
                                        </div>
                                      )}
                                      <div style={{ fontSize:10, color:c.text4 }}>📄 {r.file_name}</div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Buton adaugă ECG din secțiunea Sănătate */}
                        <div style={{ marginTop:10 }}>
                          <input ref={ecgFileRef} type="file" accept="application/pdf,.pdf" style={{ display:'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) { handleEcgUpload(f); setTab('today') } }}/>
                          <button
                            onClick={() => ecgFileRef.current?.click()}
                            disabled={ecgUploading || ecgAnalyzing}
                            style={{ width:'100%', background:`${c.red}10`, border:`1.5px dashed ${c.red}50`, borderRadius:9, padding:'8px 0', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontFamily:'inherit' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.red} strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <span style={{ fontSize:11, fontWeight:600, color:c.red }}>{t('Încarcă ECG nou')}</span>
                          </button>
                        </div>
                      </Acc>
                    )
                  })()}

                  {/* Disclaimer medical */}
                  {ecgRecords.length > 0 && (
                    <div style={{ background:c.card, borderRadius:9, padding:'9px 12px', display:'flex', gap:7, alignItems:'flex-start', marginBottom:'0.5rem' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.text4} strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <div style={{ fontSize:10, color:c.text4, lineHeight:1.5 }}>{t('Analiza AI nu înlocuiește consultul medical. Rezultatele au caracter informativ. Consultați un medic cardiolog pentru orice îngrijorare.')}</div>
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button onClick={() => window.location.href='/health'} style={{ fontSize: 12, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Vezi tendințe cardiovascular detaliate →
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        )
      })()}

      {/* Modal Recovery Detail */}
      <RecoveryDetailModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        readiness={readiness}
        lastWorkout={lastWorkout}
        c={c}
      />

      {/* Modal Siluetă Musculară */}
      {showMuscleModal && (
        <MuscleMapModal
          recoveryData={muscleModalData}
          c={c}
          onClose={() => setShowMuscleModal(false)}
        />
      )}

      {/* Modal partajare */}
      {showShare && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowShare(false)}>
          <div style={{ background: c.bg, borderRadius: 20, padding: '1.25rem', maxWidth: 420, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <ShareCard
              user={user}
              steps={intervalsData?.today?.steps || 0}
              hrv={intervalsHrv}
              body={body}
              userName={userName}
            />
          </div>
        </div>
      )}
      <AchievementToast achievement={achievement} onClose={() => setAchievement(null)} />

      {/* ── BOTTOM NAV ── */}
      {isMobile && (() => {
        const navScore = readiness.score || 0
        const navColor = navScore >= 70 ? c.green : navScore >= 50 ? c.orange : c.red
        const r = 28
        const circ = 2 * Math.PI * r
        const offset = circ * (1 - navScore / 100)
        const isDark = theme === 'dark'
        // Culoarea navBar depinde de tab-ul activ
        const _navColors = {
          activitate: {
            bg:     isDark ? '#162b1c' : '#e8f5e9',
            border: isDark ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.40)',
          },
          sleep: {
            bg:     isDark ? '#142135' : '#e1f0fd',
            border: isDark ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.40)',
          },
          history: {
            bg:     isDark ? '#1e1430' : '#f0e8fd',
            border: isDark ? 'rgba(139,92,246,0.35)' : 'rgba(139,92,246,0.40)',
          },
          nutrition: {
            bg:     isDark ? '#2d2410' : '#fdf4dc',
            border: isDark ? 'rgba(217,119,6,0.35)' : 'rgba(217,119,6,0.40)',
          },
          today: {
            bg:     isDark
              ? navScore >= 70 ? '#1f3328' : navScore >= 50 ? '#332818' : '#331e1e'
              : navScore >= 70 ? '#eef8e6' : navScore >= 50 ? '#fef7e8' : '#fef0f0',
            border: isDark
              ? navScore >= 70 ? 'rgba(29,158,117,0.35)' : navScore >= 50 ? 'rgba(230,150,10,0.35)' : 'rgba(220,50,50,0.35)'
              : navScore >= 70 ? 'rgba(29,158,117,0.25)' : navScore >= 50 ? 'rgba(230,150,10,0.25)' : 'rgba(220,50,50,0.25)',
          },
        }
        const _nc = _navColors[tab] || _navColors.today
        const navBg = _nc.bg
        const navBorder = _nc.border
        const btnBg = isDark ? '#2A2F38' : '#F0F2F5'
        const btnBorderColor = isDark ? '#3a3a3c' : '#E8EBF0'
        const iconInactive = isDark ? '#6b7280' : '#9ca3af'
        const labelInactive = isDark ? '#4b5563' : '#9ca3af'
        // Perimetru path dreptunghi 44×44, rx=12, inset 1px: 2*(18+18) + 2*π*12 ≈ 147.4
        const NAV_ARC_PERIM = 147.4

        const navBtn = (id, icon, label, activeColor) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontFamily: 'inherit' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: btnBg,
                position: 'relative',
                border: `1px solid ${active ? activeColor + '55' : btnBorderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: active
                  ? (isDark ? `0 0 0 3px ${activeColor}33` : `0 3px 12px ${activeColor}4d`)
                  : (isDark ? 'none' : '0 3px 10px rgba(0,0,0,0.15)'),
              }}>
                {/* Arc animat de la ora 12 în sensul acelor de ceasornic */}
                {active && (
                  <svg key={`arc-${id}-${tab}`}
                    viewBox="0 0 44 44" width="44" height="44"
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <path
                      d="M22,1 L31,1 A12,12,0,0,1,43,13 L43,31 A12,12,0,0,1,31,43 L13,43 A12,12,0,0,1,1,31 L1,13 A12,12,0,0,1,13,1 Z"
                      fill="none"
                      stroke={activeColor}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        strokeDasharray: NAV_ARC_PERIM,
                        strokeDashoffset: NAV_ARC_PERIM,
                        animation: 'navArcFill 0.45s cubic-bezier(.4,0,.2,1) forwards',
                      }}
                    />
                  </svg>
                )}
                {icon(active)}
              </div>
              <span style={{ fontSize: 9, color: active ? activeColor : labelInactive, fontWeight: active ? 700 : 400 }}>{label}</span>
            </button>
          )
        }

        return (
          <>
            <style>{`@keyframes navArcFill { to { stroke-dashoffset: 0; } }`}</style>
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
              background: navBg,
              borderTop: `1px solid ${navBorder}`,
              paddingBottom: 'env(safe-area-inset-bottom, 10px)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
                maxWidth: 520, margin: '0 auto',
                paddingLeft: 4, paddingRight: 4,
                marginTop: -22,
              }}>

                {/* Activitate */}
                {navBtn('activitate', (active) => (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? c.green : iconInactive} strokeWidth="1.8" strokeLinecap="round">
                    <path d="M3 12h3l3-8 3 16 3-10 3 4h3"/>
                  </svg>
                ), t('Activitate'), c.green)}

                {/* Somn */}
                {navBtn('sleep', (active) => (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? c.blue : iconInactive} strokeWidth="1.8" strokeLinecap="round">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                  </svg>
                ), t('Somn'), c.blue)}

                {/* CENTRU - cerc arc readiness -> Astazi, cu animatie drain→fill la apasare */}
                <button onClick={() => {
                  setTab('today')
                  setTodayArcAnim(true)
                  setTimeout(() => setTodayArcAnim(false), 820)
                }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginTop: -14 }}>
                  <div style={{ position: 'relative', width: 64, height: 64 }}>
                    <svg viewBox="0 0 64 64" width="64" height="64">
                      <circle cx="32" cy="32" r={r} fill={isDark ? '#0a0a0a' : '#f9fafb'} stroke={isDark ? '#222222' : '#e5e7eb'} strokeWidth="4"/>
                      <circle cx="32" cy="32" r={r} fill="none" stroke={navColor} strokeWidth="5.5"
                        strokeDasharray={circ}
                        strokeDashoffset={todayArcAnim ? circ : offset}
                        strokeLinecap="round"
                        transform="rotate(-90 32 32)"
                        style={{ transition: todayArcAnim ? 'stroke-dashoffset 0.75s ease-in' : 'stroke-dashoffset 0.75s cubic-bezier(.4,0,.2,1), stroke 0.4s ease' }}/>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: c.text, lineHeight: 1 }}>{navScore || '—'}</span>
                      <span style={{ fontSize: 7, color: iconInactive }}>/100</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: navColor, fontWeight: 700 }}>{t('Astăzi')}</span>
                </button>

                {/* Nutritie */}
                {navBtn('nutrition', (active) => (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? c.orange : iconInactive} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 010 8h-1"/>
                    <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
                    <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                  </svg>
                ), t('Nutriție'), c.orange)}

                {/* Statistici */}
                {navBtn('history', (active) => (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="12" width="4" height="9" rx="1" fill={active ? '#8B5CF6' : iconInactive}/>
                    <rect x="10" y="7" width="4" height="14" rx="1" fill={active ? '#8B5CF6' : iconInactive}/>
                    <rect x="17" y="3" width="4" height="18" rx="1" fill={active ? '#8B5CF6' : iconInactive}/>
                  </svg>
                ), t('Statistici'), '#8B5CF6')}

              </div>
            </div>
          </>
        )
      })()}

    </div>
  )
}
