// src/pages/Profile.jsx — FORMA Profil & Setări cu Supabase + Withings + MFP
import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { startWithingsAuth } from '../lib/withings'
import { useTheme, getColors } from '../lib/theme.jsx'
import { useI18n, setLang as setAppLang, translate } from '../lib/i18n'
import {
  useHevyQuery, useWithingsQuery, useIntervalsQuery,
} from '../hooks/useFormaQueries'

const GOALS = [
  { id: 'hipertrofie', label: 'Hipertrofie', icon: '💪', desc: 'Creștere masă musculară' },
  { id: 'forta', label: 'Forță', icon: '🏋️', desc: 'Creștere 1RM pe lifturi principale' },
  { id: 'slabit', label: 'Slăbit', icon: '🔥', desc: 'Reducere masă grasă' },
  { id: 'sanatate', label: 'Sănătate', icon: '❤️', desc: 'Wellness general & longevitate' },
  { id: 'rezistenta', label: 'Rezistență', icon: '🏃', desc: 'Cardio & anduranță' },
  { id: 'recompozitie', label: 'Recompozitie', icon: '⚖️', desc: 'Masă musculară + slăbit simultan' },
]

// Goal → recommended caloric level
const GOAL_CALORIC_MAP = {
  hipertrofie: 'Surplus mic',
  forta: 'Surplus mic',
  slabit: 'Deficit',
  sanatate: 'Menținere',
  rezistenta: 'Menținere',
  recompozitie: 'Menținere',
}

const LEVELS = [
  { id: 'incepator', label: 'Începător', desc: 'Sub 1 an antrenament' },
  { id: 'intermediar', label: 'Intermediar', desc: '1–3 ani antrenament' },
  { id: 'avansat', label: 'Avansat', desc: 'Peste 3 ani antrenament' },
]

const DEFAULT_PROFILE = {
  fullName: '',
  birth_date: '',
  age: '',
  weight_kg: '',
  height_cm: '',
  goal: 'hipertrofie',
  level: 'intermediar',
  gender: 'M',
  language: 'ro',
  smoker: false,
  diabetes: false,
  bp_sys: '',
  days_per_week: 4,
  hevy_api_key: '',
  withings_connected: false,
  mfp_username: '',
  mfp_password: '',
  mfp_connected: false,
  target_steps: '10000',
  target_weight_kg: '',
  target_sleep_hours: '8',
  target_calories_burned: '500',
  target_water_ml: '2500',
  intervals_api_key: '',
  intervals_athlete_id: '',
}

// ── Heart Age (vârsta vasculară) — Framingham non-laborator (BMI), D'Agostino 2008 ──
// Coeficienți specifici pe sexe. Rezultat informativ, validat pentru 30–74 ani.
// Vârsta (ani întregi) din data nașterii — null dacă lipsește/invalidă.
function calcAge(dateStr) {
  if (!dateStr) return null
  const b = new Date(dateStr)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

function framinghamHeartAge({ gender, age, bmi, sbp, smoker, diabetes, bpTreated = false }) {
  if (!age || !bmi || !sbp) return null
  const a = parseFloat(age), b = parseFloat(bmi), s = parseFloat(sbp)
  if (!(a > 0) || !(b > 0) || !(s > 0)) return null
  const male = (gender || 'M') === 'M'
  const K = male
    ? { bAge: 3.11296, bBMI: 0.79277, bSBPu: 1.85508, bSBPt: 1.92672, bSmoke: 0.70953, bDiab: 0.53160, S0: 0.88431, mean: 23.9388 }
    : { bAge: 2.72107, bBMI: 0.51125, bSBPu: 2.81291, bSBPt: 2.88267, bSmoke: 0.61868, bDiab: 0.77763, S0: 0.94833, mean: 26.0145 }
  const bSBP = bpTreated ? K.bSBPt : K.bSBPu
  // Predictor liniar cu factorii reali
  const L = K.bAge * Math.log(a) + K.bBMI * Math.log(b) + bSBP * Math.log(s)
    + (smoker ? K.bSmoke : 0) + (diabetes ? K.bDiab : 0)
  const risk = 1 - Math.pow(K.S0, Math.exp(L - K.mean))
  const riskPct = Math.max(0, Math.min(100, Math.round(risk * 1000) / 10))
  // Heart age = vârsta unei persoane de același sex cu factori normali (nefumător, fără diabet,
  // TA netratată 125, IMC 22.5) care are ACELAȘI risc → rezolvăm ln(vârstă)
  const BMI_REF = 22.5, SBP_REF = 125
  const lnAgeStar = (L - K.bBMI * Math.log(BMI_REF) - K.bSBPu * Math.log(SBP_REF)) / K.bAge
  let heartAge = Math.round(Math.exp(lnAgeStar))
  if (!isFinite(heartAge)) return null
  heartAge = Math.max(20, Math.min(95, heartAge))
  return { heartAge, riskPct, delta: heartAge - Math.round(a), inRange: a >= 30 && a <= 74 }
}

export default function Profile({ onBack }) {
  const { user, userName, userAvatar, userEmail, signOut, refreshAvatar } = useAuth()
  const { theme } = useTheme()
  const { t } = useI18n()
  const c = getColors(theme)
  const qc = useQueryClient()

  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [activeSection, setActiveSection] = useState('personal')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [mfpSyncing, setMfpSyncing] = useState(false)
  const [mfpResult, setMfpResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [withingsBp, setWithingsBp] = useState(null)     // { bp_sys, date } — ultima citire Withings


  // ── React Query — status live sincronizare ────────────────────────────────
  const hevyQ      = useHevyQuery(user?.id)
  const withingsQ  = useWithingsQuery(user?.id)
  const intervalsQ = useIntervalsQuery(user?.id)

  const hevyOk      = !hevyQ.error && !hevyQ.isLoading && !!hevyQ.data
  const withingsOk  = !withingsQ.error && !!withingsQ.data
  const intervalsOk = !!intervalsQ.data?.today

  const hevyVal     = hevyQ.isLoading ? '…' : hevyQ.error ? '⚠' : `✓ ${(hevyQ.data?.workouts||[]).length} sesiuni`
  const withingsVal = withingsQ.isLoading ? '…' : withingsOk ? '✓ Activ' : '⚠'
  const intervalsVal = intervalsQ.isLoading ? '…' : intervalsOk
    ? `✓ ${(intervalsQ.data.today.steps||0).toLocaleString()} pași`
    : '—'

  async function syncAll() {
    setSyncing(true)
    await qc.invalidateQueries()
    setTimeout(() => setSyncing(false), 1500)
  }

  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  // ── Tensiune sistolică din Withings — ULTIMA citire înregistrată (oricând, nu doar azi) ──
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const { data } = await supabase.from('body_measurements')
          .select('bp_sys,date')
          .eq('user_id', user.id)
          .gt('bp_sys', 0)                       // ignoră null și 0
          .order('date', { ascending: false })   // cea mai recentă înregistrare din tot istoricul
          .limit(1)
        if (data && data[0]?.bp_sys) setWithingsBp({ bp_sys: data[0].bp_sys, date: data[0].date })
      } catch (_) {}
    })()
  }, [user?.id])

  async function loadProfile() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setProfile({
          fullName: data.full_name || userName || '',
          birth_date: data.birth_date || '',
          age: (data.birth_date ? calcAge(data.birth_date) : data.age)?.toString() || '',
          weight_kg: data.weight_kg?.toString() || '',
          height_cm: data.height_cm?.toString() || '',
          smoker: !!data.smoker,
          diabetes: !!data.diabetes,
          bp_sys: data.bp_sys?.toString() || '',
          goal: data.goal || 'hipertrofie',
          level: data.level || 'intermediar',
          gender: data.gender || 'M',
          language: data.language || 'ro',
          days_per_week: data.days_per_week || 4,
          hevy_api_key: data.hevy_api_key || '',
          withings_connected: data.withings_connected || false,
          mfp_username: data.mfp_username || '',
          mfp_password: data.mfp_password || '',
          mfp_connected: data.mfp_connected || false,
          target_steps: data.target_steps?.toString() || '10000',
          target_weight_kg: data.target_weight_kg?.toString() || '',
          target_sleep_hours: data.target_sleep_hours?.toString() || '8',
          target_calories_burned: data.target_calories_burned?.toString() || '500',
          target_water_ml: data.target_water_ml?.toString() || '2500',
          intervals_api_key: data.intervals_api_key || '',
          intervals_athlete_id: data.intervals_athlete_id || '',
        })
      } else {
        setProfile(p => ({ ...p, fullName: userName || '' }))
      }
    } catch (err) {
      setError('Nu s-a putut încărca profilul: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        id: user.id,
        full_name: profile.fullName,
        birth_date: profile.birth_date || null,
        age: calcAge(profile.birth_date) ?? (profile.age ? parseInt(profile.age) : null),
        weight_kg: profile.weight_kg ? parseFloat(profile.weight_kg) : null,
        height_cm: profile.height_cm ? parseInt(profile.height_cm) : null,
        smoker: !!profile.smoker,
        diabetes: !!profile.diabetes,
        bp_sys: profile.bp_sys ? parseInt(profile.bp_sys) : null,
        goal: profile.goal,
        level: profile.level,
        gender: profile.gender || 'M',
        language: profile.language || 'ro',
        days_per_week: profile.days_per_week,
        hevy_api_key: profile.hevy_api_key || null,
        mfp_username: profile.mfp_username || null,
        mfp_password: profile.mfp_password || null,
        target_steps: profile.target_steps ? parseInt(profile.target_steps) : null,
        target_weight_kg: profile.target_weight_kg ? parseFloat(profile.target_weight_kg) : null,
        target_sleep_hours: profile.target_sleep_hours ? parseFloat(profile.target_sleep_hours) : null,
        target_calories_burned: profile.target_calories_burned ? parseInt(profile.target_calories_burned) : null,
        target_water_ml: profile.target_water_ml ? parseInt(profile.target_water_ml) : 2500,
        intervals_api_key: profile.intervals_api_key || null,
        intervals_athlete_id: profile.intervals_athlete_id || null,
        updated_at: new Date().toISOString(),
      }

      // Upsert rezilient: dacă schema nu are unele coloane opționale (smoker, diabetes,
      // bp_sys etc.), le scoatem pe rând din payload și reîncercăm până trece.
      const attemptPayload = { ...payload }
      let error = null
      for (let i = 0; i < 12; i++) {
        const res = await supabase.from('profiles').upsert(attemptPayload, { onConflict: 'id' })
        error = res.error
        if (!error) break
        if (!/column|schema cache/i.test(error.message || '')) break
        const m = (error.message || '').match(/'([a-z_0-9]+)' column/i)
        const missing = m ? m[1] : null
        if (missing && missing in attemptPayload && missing !== 'id') {
          delete attemptPayload[missing]
        } else break  // nu putem identifica coloana → oprim
      }

      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError('Eroare la salvare: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function syncMFP() {
    setMfpSyncing(true)
    setMfpResult(null)
    try {
      await save()
      const { data, error } = await supabase.functions.invoke('mfp-sync', {
        body: { userId: user.id }
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error || 'Eroare MFP')
      setMfpResult({ ok: true, nutrition: data.data?.nutrition })
      setProfile(p => ({ ...p, mfp_connected: true }))
    } catch (err) {
      setMfpResult({ ok: false, error: err.message })
    } finally {
      setMfpSyncing(false)
    }
  }

  function update(key, val) {
    setProfile(p => ({ ...p, [key]: val }))
    setSaved(false)
  }

  const SOURCES = [
    { id: 'hevy', label: 'Hevy', desc: 'Antrenamente forță', icon: '🏋️', color: '#E8A830', connected: !!profile.hevy_api_key },
    { id: 'withings', label: 'Withings', desc: 'Somn, greutate, PWV', icon: '⌚', color: '#4A9EE8', connected: profile.withings_connected },
    { id: 'mfp', label: 'MyFitnessPal', desc: 'Nutriție & calorii', icon: '🥗', color: '#4A8A3A', connected: profile.mfp_connected },
    { id: 'intervals', label: 'Intervals.icu', desc: 'HRV, somn, CTL/ATL nativ', icon: '📈', color: '#FC4C02', connected: !!profile.intervals_api_key },
    { id: 'garmin', label: 'Garmin', desc: 'Activități & pași', icon: '🏃', color: '#1A6EA8', connected: false },
    { id: 'apple', label: 'Apple Health', desc: 'Date generale sănătate', icon: '🍎', color: '#E84A4A', connected: false },
    { id: 'zepp', label: 'Zepp / Amazfit', desc: 'Ceas sport', icon: '⌚', color: '#8A4AE8', connected: false },
  ]

  const bmi = profile.weight_kg && profile.height_cm
    ? (parseFloat(profile.weight_kg) / Math.pow(parseFloat(profile.height_cm) / 100, 2)).toFixed(1)
    : null
  const bmr = profile.weight_kg && profile.height_cm && profile.age
    ? Math.round(88.36 + 13.4 * parseFloat(profile.weight_kg) + 4.8 * parseFloat(profile.height_cm) - 5.7 * parseFloat(profile.age))
    : null
  const tdee = bmr ? Math.round(bmr * (1 + profile.days_per_week * 0.075)) : null

  if (loading) return (
    <div style={{ minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid #1A3A0A', borderTopColor: c.green, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }}/>
        <div style={{ fontSize: 13, color: c.text4 }}>Se încarcă profilul...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Validare
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Format acceptat: JPG, PNG sau WebP')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Dimensiune maximă: 2MB')
      return
    }

    setAvatarUploading(true)
    setAvatarError(null)

    // Preview local instant
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)

    try {
      // Upload în Supabase Storage bucket 'avatars'
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr

      // URL public
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      // Adaugă timestamp pentru cache-busting
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      // Salvează în profiles
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
      if (dbErr) throw dbErr

      // Actualizează avatarul în toată aplicația fără refresh
      refreshAvatar(publicUrl)
      setAvatarPreview(publicUrl)
    } catch (err) {
      setAvatarError('Eroare upload: ' + err.message)
      setAvatarPreview(null)
    } finally {
      setAvatarUploading(false)
    }
  }


  return (
    <div style={{ minHeight: '100vh', background: c.bg, padding: '1rem 1.25rem', fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '0.5px solid ' + c.border }}>
        <button onClick={onBack} style={{ fontSize: 13, color: c.green, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Dashboard</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: c.text, letterSpacing: '0.1em' }}>{t('PROFIL')}</div>
        <button onClick={save} disabled={saving} style={{ fontSize: 13, fontWeight: 600, padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', background: saved ? c.green3 : saving ? '#2A4A1A' : c.green, color: saved ? c.green2 : c.bg }}>
          {saving ? t('Se salvează...') : saved ? t('✓ Salvat') : t('Salvează')}
        </button>
      </div>

      {error && (
        <div style={{ background: c.red + '22', border: '0.5px solid #5A2A2A', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, color: c.red }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <label htmlFor="avatar-upload" style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: c.card2, border: '3px solid #639922', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {avatarUploading ? (
                <div style={{ fontSize: 20 }}>⏳</div>
              ) : (avatarPreview || userAvatar) ? (
                <img src={avatarPreview || userAvatar} alt="" width="72" height="72" style={{ objectFit: 'cover', width: '100%', height: '100%' }}/>
              ) : (
                <span style={{ fontSize: 28, fontWeight: 700, color: '#C0DD97' }}>{(profile.fullName || userName || 'U')[0].toUpperCase()}</span>
              )}
              {/* Overlay la hover */}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <span style={{ fontSize: 20 }}>📷</span>
              </div>
            </div>
            {/* Badge cameră */}
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, background: c.green, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, boxShadow: '0 0 0 2px #16181F' }}>
              {avatarUploading ? '⏳' : '📷'}
            </div>
          </label>
          <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload} style={{ display: 'none' }}/>
          {avatarError && (
            <div style={{ position: 'absolute', top: 78, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: c.red, whiteSpace: 'nowrap', background: '#2E1A1A', padding: '3px 8px', borderRadius: 6 }}>
              {avatarError}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: c.text }}>{profile.fullName || userName || t('Utilizator FORMA')}</div>
          <div style={{ fontSize: 13, color: c.text4, marginTop: 2 }}>{userEmail}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, background: c.green3, color: c.green2, padding: '3px 10px', borderRadius: 6 }}>
              {t(GOALS.find(g => g.id === profile.goal)?.label || 'Hipertrofie')}
            </span>
            <span style={{ fontSize: 11, background: c.card2, color: c.text4, padding: '3px 10px', borderRadius: 6 }}>
              {t(LEVELS.find(l => l.id === profile.level)?.label || 'Intermediar')}
            </span>
            <span style={{ fontSize: 11, background: c.card2, color: c.text4, padding: '3px 10px', borderRadius: 6 }}>
              {profile.days_per_week} {t('zile/săpt')}
            </span>
          </div>
        </div>
        {bmi && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: c.text4, marginBottom: 2 }}>BMI</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: parseFloat(bmi) < 25 ? c.green2 : '#F0A830' }}>{bmi}</div>
            {tdee && <div style={{ fontSize: 11, color: c.text4, marginTop: 4 }}>TDEE ~{tdee} kcal</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, background: c.card, padding: 4, borderRadius: 10, marginBottom: '1.25rem', overflowX: 'auto' }}>
        {[['personal', 'Date personale'], ['goal', 'Obiectiv'], ['training', 'Antrenament'], ['sources', 'Surse date']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveSection(id)}
            style={{ flex: 1, padding: '7px 8px', fontSize: 12, borderRadius: 7, cursor: 'pointer', border: activeSection === id ? '0.5px solid ' + c.border : 'none', background: activeSection === id ? c.card2 : 'transparent', color: activeSection === id ? c.text : c.text4, fontWeight: activeSection === id ? 500 : 400, fontFamily: 'inherit', textAlign: 'center', whiteSpace: 'nowrap' }}>
            {t(label)}
          </button>
        ))}
      </div>

      {activeSection === 'personal' && (
        <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1.25rem' }}>
          {/* Limbă / Language */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: 12, color: c.text4, fontWeight: 500, display: 'block', marginBottom: 6 }}>Limbă · Language</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['ro', '🇷🇴 Română'], ['en', '🇬🇧 English']].map(([code, lbl]) => {
                const active = (profile.language || 'ro') === code
                return (
                  <button key={code} type="button"
                    onClick={() => { update('language', code); setAppLang(code) }}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                      border: active ? `1px solid ${c.green}` : '0.5px solid ' + c.border,
                      background: active ? (c.green3 || 'rgba(151,196,89,0.15)') : c.bg,
                      color: active ? c.green : c.text3 }}>
                    {lbl}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: '1rem', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>{t('Nume complet')}</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} value={profile.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Marcel Curiman"/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>{t('Data nașterii')}</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="date" max={new Date().toISOString().slice(0, 10)} value={profile.birth_date || ''} onChange={e => { const v = e.target.value; setProfile(p => ({ ...p, birth_date: v, age: (calcAge(v) ?? '').toString() })) }}/>
              {calcAge(profile.birth_date) != null && <div style={{ fontSize: 11, color: c.green }}>{t('Vârstă')}: {calcAge(profile.birth_date)} {t('ani')}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>{t('Greutate (kg)')}</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="number" step="0.1" value={profile.weight_kg} onChange={e => update('weight_kg', e.target.value)} placeholder="82.4"/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>{t('Înălțime (cm)')}</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="number" value={profile.height_cm} onChange={e => update('height_cm', e.target.value)} placeholder="178"/>
            </div>
          </div>
          {bmi && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: '0.5rem' }}>
              {[
                ['BMI', bmi, parseFloat(bmi) < 18.5 ? 'Subponderal' : parseFloat(bmi) < 25 ? 'Normal ✓' : parseFloat(bmi) < 30 ? 'Supraponderal' : 'Obezitate'],
                ['BMR', bmr ? `${bmr} kcal` : '—', 'Metabolism bazal'],
                ['TDEE', tdee ? `${tdee} kcal` : '—', 'Necesar caloric zilnic'],
              ].map(([label, val, desc]) => (
                <div key={label} style={{ background: c.card2, borderRadius: 10, padding: '0.75rem' }}>
                  <div style={{ fontSize: 10, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{val}</div>
                  <div style={{ fontSize: 11, color: c.text4, marginTop: 2 }}>{t(desc)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Factori cardiovasculari pentru Heart Age (Framingham) ── */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '0.5px solid ' + c.border }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              ❤️ {t('Vârsta inimii — factori')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
              {/* Fumat DA/NU */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>🚬 {t('Fumător')}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['NU', false], ['DA', true]].map(([lbl, val]) => (
                    <div key={lbl} onClick={() => update('smoker', val)}
                      style={{ flex: 1, padding: '9px', textAlign: 'center', cursor: 'pointer', borderRadius: 8,
                        background: profile.smoker === val ? (val ? '#F0A83022' : c.green3) : c.card2,
                        border: `0.5px solid ${profile.smoker === val ? (val ? '#F0A830' : c.green) : c.border}`,
                        color: profile.smoker === val ? (val ? '#F0A830' : '#C0DD97') : c.text3, fontSize: 13, fontWeight: 600 }}>
                      {t(lbl)}
                    </div>
                  ))}
                </div>
              </div>
              {/* Diabet DA/NU */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>🩸 {t('Diabet')}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['NU', false], ['DA', true]].map(([lbl, val]) => (
                    <div key={lbl} onClick={() => update('diabetes', val)}
                      style={{ flex: 1, padding: '9px', textAlign: 'center', cursor: 'pointer', borderRadius: 8,
                        background: profile.diabetes === val ? (val ? '#F0A83022' : c.green3) : c.card2,
                        border: `0.5px solid ${profile.diabetes === val ? (val ? '#F0A830' : c.green) : c.border}`,
                        color: profile.diabetes === val ? (val ? '#F0A830' : '#C0DD97') : c.text3, fontSize: 13, fontWeight: 600 }}>
                      {t(lbl)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {(() => {
              const autoSbp = withingsBp?.bp_sys ?? withingsQ.data?.body?.bp_sys ?? withingsQ.data?.body?.systolic ?? null
              return autoSbp ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: c.card2, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: c.text4 }}>{t('Tensiune sistolică')}</span>
                  <span style={{ fontSize: 13, color: c.text, fontWeight: 600 }}>{autoSbp} mmHg <span style={{ fontSize: 10, color: c.green2 }}>· Withings{withingsBp?.date ? ' ' + withingsBp.date : ''}</span></span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>{t('Tensiune sistolică (mmHg)')} <span style={{ color: c.text4, fontWeight: 400 }}>{t('— se ia automat din Withings când există o citire')}</span></label>
                  <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                    type="number" value={profile.bp_sys} onChange={e => update('bp_sys', e.target.value)} placeholder="ex: 125"/>
                </div>
              )
            })()}

            {/* Card rezultat Heart Age */}
            {(() => {
              const autoSbp = withingsBp?.bp_sys ?? withingsQ.data?.body?.bp_sys ?? withingsQ.data?.body?.systolic ?? null
              const effSbp = autoSbp ?? (profile.bp_sys || null)
              const ha = framinghamHeartAge({ gender: profile.gender, age: profile.age, bmi, sbp: effSbp, smoker: profile.smoker, diabetes: profile.diabetes })
              if (!ha) return (
                <div style={{ background: c.card2, borderRadius: 10, padding: '0.9rem', fontSize: 12, color: c.text4 }}>
                  {t('Completează vârstă, greutate, înălțime și tensiunea sistolică pentru a calcula vârsta inimii.')}
                </div>
              )
              const younger = ha.delta <= 0
              const col = ha.delta <= -3 ? c.green2 : ha.delta <= 2 ? c.green2 : ha.delta <= 8 ? '#F0A830' : '#E24B4A'
              return (
                <div style={{ background: c.card2, borderRadius: 12, padding: '1rem', border: `0.5px solid ${col}44` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 10, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('Vârsta inimii')}</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: col, lineHeight: 1 }}>{ha.heartAge} <span style={{ fontSize: 14, fontWeight: 600, color: c.text4 }}>{t('ani')}</span></div>
                      <div style={{ fontSize: 12, color: col, marginTop: 4, fontWeight: 600 }}>
                        {ha.delta === 0 ? t('Egală cu vârsta ta') : younger ? `${t('Cu')} ${Math.abs(ha.delta)} ${t('ani mai tânără')} ✓` : `${t('Cu')} ${ha.delta} ${t('ani mai bătrână')}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t('Risc CV 10 ani')}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: c.text }}>{ha.riskPct}%</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: c.text4, marginTop: 10, lineHeight: 1.5, fontStyle: 'italic' }}>
                    {!ha.inRange && t('⚠ Model validat pentru 30–74 ani; în afara acestui interval e orientativ. ')}
                    {t('Estimare informativă (Framingham 2008, model non-laborator). Nu înlocuiește consultul medical.')}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {activeSection === 'goal' && (
        <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Obiectiv principal</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1.5rem' }}>
            {GOALS.map(g => (
              <div key={g.id} onClick={() => {
                  update('goal', g.id)
                  if (tdee) {
                    const cals = { hipertrofie: Math.round(tdee * 1.1), forta: Math.round(tdee * 1.1), slabit: Math.round(tdee * 0.85), sanatate: tdee, rezistenta: tdee, recompozitie: tdee }
                    update('target_calories', cals[g.id] || tdee)
                  }
                }}
                style={{ position: 'relative', padding: '1rem', background: profile.goal === g.id ? c.green3 : c.bg, border: '0.5px solid ' + (profile.goal === g.id ? c.green : c.border), borderRadius: 12, cursor: 'pointer' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{g.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: profile.goal === g.id ? '#C0DD97' : c.text }}>{g.label}</div>
                <div style={{ fontSize: 12, color: c.text4, marginTop: 3 }}>{g.desc}</div>
                {profile.goal === g.id && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, background: c.green, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: c.bg }}>✓</div>
                )}
              </div>
            ))}
          </div>
          {tdee && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Target caloric</div>
              <div style={{ background: c.card2, borderRadius: 10, padding: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  {[['Deficit', Math.round(tdee * 0.85), '#F0A830'], ['Menținere', tdee, '#4A9EE8'], ['Surplus mic', Math.round(tdee * 1.1), c.green2], ['Surplus mare', Math.round(tdee * 1.2), '#C0DD97']].map(([label, val, color]) => {
                    const isRec = GOAL_CALORIC_MAP[profile.goal] === label
                    return (
                      <div key={label} style={{ flex: 1, minWidth: 80, textAlign: 'center', borderRadius: 8, padding: '0.5rem 0.25rem', background: isRec ? color + '22' : 'transparent', border: isRec ? '1.5px solid ' + color : '1.5px solid transparent', transition: 'all 0.2s', position: 'relative' }}>
                        {isRec && <div style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: 700, color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>recomandat</div>}
                        <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
                        <div style={{ fontSize: 11, color: isRec ? color : c.text4, marginTop: 2, fontWeight: isRec ? 600 : 400 }}>{label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', marginTop: '1.5rem' }}>Obiective personale</div>
          <div style={{ fontSize: 12, color: c.text4, marginBottom: '1rem', lineHeight: 1.5 }}>
            Aceste ținte se compară cu datele tale reale în pagina Activitate.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: '1rem', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>👣 Pași zilnic (țintă)</label>
              <input type="number" step="500" value={profile.target_steps} onChange={e => update('target_steps', e.target.value)} placeholder="10000" style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>⚖️ Greutate țintă (kg)</label>
              <input type="number" step="0.1" value={profile.target_weight_kg} onChange={e => update('target_weight_kg', e.target.value)} placeholder="ex: 82" style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>😴 Somn țintă (ore)</label>
              <input type="number" step="0.5" value={profile.target_sleep_hours} onChange={e => update('target_sleep_hours', e.target.value)} placeholder="8" style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>🔥 Calorii arse — activitate (țintă)</label>
              <input type="number" step="50" value={profile.target_calories_burned} onChange={e => update('target_calories_burned', e.target.value)} placeholder="500" style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>💧 Apă zilnică (ml)</label>
              <input type="number" step="100" value={profile.target_water_ml} onChange={e => update('target_water_ml', e.target.value)} placeholder="2500" style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}/>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'training' && (
        <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Gen</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
            {[['M', '♂ Masculin'], ['F', '♀ Feminin']].map(([val, label]) => (
              <div key={val} onClick={() => update('gender', val)}
                style={{ flex: 1, padding: '0.875rem', background: (profile.gender || 'M') === val ? c.green3 : c.card2, border: `0.5px solid ${(profile.gender || 'M') === val ? c.green : c.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{val === 'M' ? '♂' : '♀'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: (profile.gender || 'M') === val ? '#C0DD97' : c.text }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Nivel de experiență</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
            {LEVELS.map(l => (
              <div key={l.id} onClick={() => update('level', l.id)}
                style={{ flex: 1, padding: '0.875rem', background: profile.level === l.id ? c.green3 : c.card2, border: `0.5px solid ${profile.level === l.id ? c.green : c.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: profile.level === l.id ? '#C0DD97' : c.text }}>{l.label}</div>
                <div style={{ fontSize: 11, color: c.text4, marginTop: 3 }}>{l.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Zile / săptămână</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
            {[2,3,4,5,6].map(n => (
              <div key={n} onClick={() => update('days_per_week', n)}
                style={{ flex: 1, padding: '0.875rem', background: profile.days_per_week === n ? c.green3 : c.card2, border: `0.5px solid ${profile.days_per_week === n ? c.green : c.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: profile.days_per_week === n ? '#C0DD97' : c.text }}>{n}</div>
                <div style={{ fontSize: 10, color: c.text4 }}>zile</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Split recomandat</div>
          <div style={{ background: c.card2, borderRadius: 10, padding: '1rem' }}>
            {profile.days_per_week <= 3 && <div><div style={{ fontSize: 13, fontWeight: 600, color: '#C0DD97', marginBottom: 8 }}>Full Body × {profile.days_per_week}</div>{['Luni: Full Body A', 'Miercuri: Full Body B', 'Vineri: Full Body C'].slice(0, profile.days_per_week).map(d => <div key={d} style={{ fontSize: 12, color: c.text4, marginBottom: 4 }}>· {d}</div>)}</div>}
            {profile.days_per_week === 4 && <div><div style={{ fontSize: 13, fontWeight: 600, color: '#C0DD97', marginBottom: 8 }}>Upper / Lower × 2</div>{['Luni: Upper A', 'Marți: Lower A', 'Joi: Upper B', 'Vineri: Lower B'].map(d => <div key={d} style={{ fontSize: 12, color: c.text4, marginBottom: 4 }}>· {d}</div>)}</div>}
            {profile.days_per_week === 5 && <div><div style={{ fontSize: 13, fontWeight: 600, color: '#C0DD97', marginBottom: 8 }}>Push / Pull / Legs × 5</div>{['Luni: Push', 'Marți: Pull', 'Miercuri: Legs', 'Joi: Push B', 'Vineri: Pull B'].map(d => <div key={d} style={{ fontSize: 12, color: c.text4, marginBottom: 4 }}>· {d}</div>)}</div>}
            {profile.days_per_week === 6 && <div><div style={{ fontSize: 13, fontWeight: 600, color: '#C0DD97', marginBottom: 8 }}>PPL × 2</div>{['Luni: Push', 'Marți: Pull', 'Miercuri: Legs', 'Joi: Push', 'Vineri: Pull', 'Sâmbătă: Legs'].map(d => <div key={d} style={{ fontSize: 12, color: c.text4, marginBottom: 4 }}>· {d}</div>)}</div>}
          </div>
        </div>
      )}

      {activeSection === 'sources' && (
        <div style={{ background: c.card, border: '0.5px solid ' + c.border, borderRadius: 14, padding: '1.25rem' }}>

          {/* ── Status sincronizare live ── */}
          <div style={{ marginBottom: '1.5rem', background: c.card2, borderRadius: 10, padding: '0.875rem 1rem', border: `0.5px solid ${c.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Status sincronizare</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                ['Hevy', hevyVal, hevyOk],
                ['Withings', withingsVal, withingsOk],
                ['Intervals', intervalsVal, intervalsOk],
              ].map(([name, val, ok]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '5px 11px', borderRadius: 8, background: c.card, color: c.text3, border: `0.5px solid ${ok ? c.green + '55' : c.border}` }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: ok ? c.green : c.orange, flexShrink: 0 }}/>
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  <span style={{ color: ok ? c.green2 : c.text4 }}>{val}</span>
                </div>
              ))}
              <button onClick={syncAll} disabled={syncing}
                style={{ fontSize: 11, padding: '5px 13px', borderRadius: 8, border: `0.5px solid ${c.border}`, background: c.card, color: c.text3, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: syncing ? 0.6 : 1 }}>
                {syncing ? '…' : '↻ Sincronizează'}
              </button>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Surse conectate</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
            {SOURCES.map(function(ss) { return (
              <div key={ss.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: c.card2, border: `0.5px solid ${ss.connected ? '#2A3A1A' : c.border}`, borderRadius: 12, padding: '0.875rem 1rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: ss.connected ? ss.color + '22' : c.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {ss.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>{ss.label}</div>
                  <div style={{ fontSize: 12, color: c.text4 }}>{ss.desc}</div>
                </div>
                {ss.id === 'withings' ? (
                  <div onClick={!ss.connected ? startWithingsAuth : undefined}
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, cursor: ss.connected ? 'default' : 'pointer', background: ss.connected ? c.green3 : '#1A2A3A', color: ss.connected ? c.green2 : '#4A9EE8', border: `0.5px solid ${ss.connected ? '#2A5A1A' : '#2A4A5A'}` }}>
                    {ss.connected ? '✓ Conectat' : 'Conectează →'}
                  </div>
                ) : ss.id === 'mfp' ? (
                  <div onClick={syncMFP}
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', background: ss.connected ? c.green3 : '#1A2A1A', color: ss.connected ? c.green2 : '#4A8A3A', border: `0.5px solid ${ss.connected ? '#2A5A1A' : '#2A4A2A'}` }}>
                    {mfpSyncing ? 'Se sincronizează...' : ss.connected ? '↻ Sync MFP' : 'Conectează →'}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: ss.connected ? c.green3 : c.card, color: ss.connected ? c.green2 : c.text4, border: `0.5px solid ${ss.connected ? '#2A5A1A' : c.border}` }}>
                    {ss.connected ? '✓ Conectat' : 'În curând'}
                  </div>
                )}
              </div>
            ) })
          }
          </div>

          {/* Rezultat MFP sync */}
          {mfpResult && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: '1rem', fontSize: 13, background: mfpResult.ok ? c.green3 : '#2A1A1A', border: `0.5px solid ${mfpResult.ok ? '#2A5A1A' : c.red + '44'}`, color: mfpResult.ok ? c.green2 : c.red }}>
              {mfpResult.ok
                ? mfpResult.nutrition
                  ? `✓ MFP sincronizat — ${mfpResult.nutrition.calories} kcal · ${mfpResult.nutrition.protein_g}g proteine`
                  : '✓ MFP conectat — date indisponibile pentru azi'
                : `⚠ ${mfpResult.error}`
              }
            </div>
          )}

          {/* Credențiale MFP */}
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>MyFitnessPal — credențiale</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>Email / Username MFP</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="email" value={profile.mfp_username}
                onChange={e => update('mfp_username', e.target.value)}
                placeholder="email@exemplu.com"/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>Parolă MFP</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="password" value={profile.mfp_password}
                onChange={e => update('mfp_password', e.target.value)}
                placeholder="Parola contului MFP"/>
            </div>
          </div>
          <div style={{ fontSize: 11, color: c.text4, marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Credențialele sunt stocate securizat în Supabase și folosite doar pentru sincronizarea datelor nutriționale. Apasă <strong style={{ color: '#4A8A3A' }}>Salvează</strong> înainte de Sync.
          </div>

          {/* Hevy API Key */}
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Hevy API Key</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="password" value={profile.hevy_api_key}
              onChange={e => update('hevy_api_key', e.target.value)}
              placeholder="Obții din hevy.com/settings → API Keys"/>
            <div style={{ fontSize: 11, color: c.text4, marginTop: 5 }}>
              Cheia e stocată securizat și folosită doar pentru sincronizarea antrenamentelor.
            </div>
          </div>

          {/* Intervals.icu API Key + Athlete ID */}
          <div style={{ fontSize:11,fontWeight:600,color:c.text4,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.75rem',marginTop:'1.25rem' }}>Intervals.icu</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>API Key</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="password" value={profile.intervals_api_key}
                onChange={e => update('intervals_api_key', e.target.value)}
                placeholder="Din intervals.icu/settings → Developer"/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: c.text4, fontWeight: 500 }}>Athlete ID</label>
              <input style={{ padding: '9px 12px', background: c.bg, border: '0.5px solid ' + c.border, borderRadius: 8, color: c.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }} type="text" value={profile.intervals_athlete_id}
                onChange={e => update('intervals_athlete_id', e.target.value)}
                placeholder="ex: i123456"/>
            </div>
          </div>
          <div style={{ fontSize: 11, color: c.text4, marginTop: 5, marginBottom: '1rem' }}>
            HRV, puls de repaus, somn și CTL/ATL nativ calculat de Intervals.icu — sursă mai stabilă decât Google Fit pentru wellness.
          </div>
        </div>
      )}

      <div style={{ borderTop: '0.5px solid #1E2028', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#2A3A1A' }}>FORMA · Daily Readiness Intelligence</div>
        <button onClick={signOut} style={{ fontSize: 13, color: c.text4, background: 'transparent', border: '0.5px solid #2A2D38', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Deconectare
        </button>
      </div>

    </div>
  )
}

// stilurile sunt acum dinamice - folosite inline cu c (colors)
