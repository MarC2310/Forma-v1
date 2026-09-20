// src/components/AICoach.jsx — AI Daily Coach cu salvare rapoarte
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const GOALS_MAP = {
  hipertrofie: 'hipertrofie musculară (creștere masă)',
  forta: 'creștere forță (1RM pe lifturi principale)',
  slabit: 'slăbit și reducere masă grasă',
  sanatate: 'sănătate generală și longevitate',
  rezistenta: 'rezistență și anduranță cardiovasculară',
  recompozitie: 'recompozitie corporală (masă + slăbit simultan)',
}

// Fundal meteo animat pentru briefing
function WeatherBanner({ weather, mode }) {
  if (!weather) return null
  const temp      = weather.temperature_c != null ? Math.round(weather.temperature_c) : null
  const label     = weather.weather_label || ''
  const humidity  = weather.humidity_pct  != null ? `${weather.humidity_pct}%`            : null
  const wind      = weather.wind_speed_kmh != null ? `${weather.wind_speed_kmh} km/h`     : null
  const pressure  = weather.pressure_hpa   != null ? `${weather.pressure_hpa} hPa`        : null
  const uvIndex   = weather.uv_index       ?? null
  const icon      = weather.weather_icon   || '🌤'

  const uvColor = uvIndex == null ? '#aaa'
    : uvIndex >= 11 ? '#C53030'
    : uvIndex >= 8  ? '#E05820'
    : uvIndex >= 6  ? '#F0A020'
    : uvIndex >= 3  ? '#D4B000'
    : '#4A9E48'

  const stats = [
    humidity != null && { icon: '💧', label: 'Umiditate', val: humidity },
    wind     != null && { icon: '💨', label: 'Vânt',      val: wind     },
    uvIndex  != null && { icon: '☀️', label: 'UV',        val: uvIndex.toFixed(1), col: uvColor },
    pressure != null && { icon: '🌡️', label: 'Presiune',  val: pressure },
  ].filter(Boolean)

  return (
    <div style={{ background: 'linear-gradient(135deg,#1A2E44 0%,#0D1E32 100%)',
      borderRadius: '10px 10px 0 0', padding: '16px 16px 14px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          {temp != null && (
            <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
              {temp}°C
            </div>
          )}
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{label}</div>
        </div>
        <div style={{ fontSize: 44, lineHeight: 1, marginTop: 2, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}>
          {icon}
        </div>
      </div>
      {stats.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          {stats.map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                {item.icon} {item.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.col || 'rgba(255,255,255,0.9)' }}>
                {item.val}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function renderMarkdown(text, c) {
  if (!c) c = { text: '#E8E8E4', text2: '#9A9EA8', text3: '#6B6F7A', text4: '#4A4E5A', accent: '#C0DD97', border: '#2A2D38', card2: '#1E2028', green: '#97C459' }
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 15, fontWeight: 700, color: c.accent, marginTop: 14, marginBottom: 6 }}>{line.replace('## ', '')}</div>
    if (line.startsWith('### ')) return <div key={i} style={{ fontSize: 13, fontWeight: 600, color: c.text, marginTop: 10, marginBottom: 4 }}>{line.replace('### ', '')}</div>
    if (line.startsWith('- ') || line.startsWith('· ')) return <div key={i} style={{ fontSize: 13, color: c.text2, paddingLeft: 12, marginBottom: 3, lineHeight: 1.5 }}>· {line.replace(/^[-·] /, '')}</div>
    if (line.trim() === '') return <div key={i} style={{ height: 5 }}/>
    return <div key={i} style={{ fontSize: 13, color: c.text2, lineHeight: 1.6, marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</div>
  })
}

export default function AICoach({ user, data, c, isMobile }) {
  if (!c) return null
  if (!c) c = { bg: '#0F1117', card: '#16181F', card2: '#1E2028', border: '#2A2D38', border2: '#1E2028', text: '#E8E8E4', text2: '#9A9EA8', text3: '#6B6F7A', text4: '#4A4E5A', green: '#97C459', green2: '#639922', green3: '#1A3A0A', green4: '#2A5A1A', orange: '#F0A830', red: '#E24B4A', blue: '#4A9EE8', accent: '#C0DD97' }

  const today = new Date().toISOString().slice(0, 10)
  const hour = new Date().getHours()
  const defaultMode = hour >= 5 && hour < 13 ? 'morning' : 'evening'

  const [mode, setMode] = useState(defaultMode)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const [savedReports, setSavedReports] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const autoTriggered = useRef(false)
  const autoTriggeredEvening = useRef(false)

  useEffect(() => {
    if (user?.id) {
      loadTodayReport(defaultMode)
      loadSavedReports()
    }
  }, [user])

  useEffect(() => {
    if (!user?.id || autoTriggered.current) return
    if (hour < 8 || hour >= 11) return
    const timer = setTimeout(async () => {
      if (autoTriggered.current) return
      try {
        const { data: rep } = await supabase
          .from('ai_reports')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', today)
          .eq('type', 'morning')
          .limit(1)
          .maybeSingle()
        if (!rep) {
          autoTriggered.current = true
          generateReport('morning')
        }
      } catch { /* ignore */ }
    }, 4000)
    return () => clearTimeout(timer)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || autoTriggeredEvening.current) return
    if (hour !== 23) return
    const timer = setTimeout(async () => {
      if (autoTriggeredEvening.current) return
      try {
        const { data: rep } = await supabase
          .from('ai_reports')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', today)
          .eq('type', 'evening')
          .limit(1)
          .maybeSingle()
        if (!rep) {
          autoTriggeredEvening.current = true
          generateReport('evening')
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearTimeout(timer)
  }, [user?.id])

  async function loadTodayReport(m) {
    try {
      const { data: rep } = await supabase
        .from('ai_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .eq('type', m)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (rep) {
        setReport({ text: rep.content, mode: m, generatedAt: new Date(rep.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }), id: rep.id })
        setExpanded(false)
      }
    } catch { /* no report yet */ }
  }

  async function loadSavedReports() {
    try {
      const { data: reps } = await supabase
        .from('ai_reports')
        .select('id, date, type, created_at, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (reps) setSavedReports(reps)
    } catch (err) { console.warn('Load reports:', err.message) }
  }

  async function saveReport(text, m) {
    setSaving(true)
    try {
      const { data: saved } = await supabase
        .from('ai_reports')
        .insert({ user_id: user.id, date: today, type: m, content: text })
        .select()
        .maybeSingle()
      await loadSavedReports()
      return saved?.id
    } catch (err) { console.error('Save report:', err) }
    finally { setSaving(false) }
  }

  async function deleteReport(id) {
    try {
      await supabase.from('ai_reports').delete().eq('id', id)
      setSavedReports(prev => prev.filter(r => r.id !== id))
      if (selectedReport?.id === id) setSelectedReport(null)
      if (report?.id === id) setReport(null)
    } catch (err) { console.error('Delete:', err) }
  }

  async function generateReport(selectedMode) {
    setLoading(true)
    setError(null)
    setReport(null)
    setExpanded(false)

    try {
      const {
        sleep, body, workouts, nutrition, nutritionYesterday,
        fitData, profile, readiness, injuries, waterToday,
        weather, bioAge, bodyBattery, fastingData,
        cardioFitness, polarHrvToday
      } = data

      const todayLabel = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

      // ── Scoruri Readiness ─────────────────────────────────────────────────────
      const vitalitate  = readiness?.scores?.vitality   ?? readiness?.scores?.vitality_score ?? '—'
      const scorSomn    = readiness?.scores?.sleep       ?? '—'
      const scorSubiect = readiness?.scores?.subjective  ?? '—'
      const scorNutritie= readiness?.scores?.nutrition   ?? '—'
      const scorRecup   = readiness?.scores?.recovery    ?? '—'
      const scorHRV     = readiness?.scores?.hrv         ?? '—'
      const scorSanat   = readiness?.scores?.health      ?? readiness?.scores?.health_score ?? '—'
      const scorTotal   = readiness?.score               ?? '—'

      // ── Somn ──────────────────────────────────────────────────────────────────
      const somnInfo = sleep
        ? `${sleep.total_h?.toFixed(1)}h, scor ${sleep.score || '—'}/100, HRV ${sleep.hrv || '—'}ms, HR nocturn ${sleep.hr ? Math.round(sleep.hr) : '—'}bpm, SpO2 ${sleep.spo2 || '—'}%`
        : fitData?.today?.sleep_min > 0
          ? `${(fitData.today.sleep_min / 60).toFixed(1)}h (Google Fit)`
          : 'indisponibil'

      // ── Nutriție ieri ─────────────────────────────────────────────────────────
      const nutritieIeri = nutritionYesterday
        ? `${nutritionYesterday.calories}kcal | P: ${nutritionYesterday.protein_g}g | C: ${nutritionYesterday.carbs_g}g | G: ${nutritionYesterday.fat_g}g`
        : nutrition
          ? `${nutrition.calories}kcal | P: ${nutrition.protein_g}g | C: ${nutrition.carbs_g}g | G: ${nutrition.fat_g}g (parțial — zi curentă)`
          : 'indisponibil'

      // ── Apă ieri ─────────────────────────────────────────────────────────────
      const apaIeri = waterToday?.yesterday_ml != null && waterToday?.target_ml
        ? `${waterToday.yesterday_ml}ml din ${waterToday.target_ml}ml (${Math.round((waterToday.yesterday_ml / waterToday.target_ml) * 100)}%)`
        : waterToday?.total_ml != null && waterToday?.target_ml
          ? `${waterToday.total_ml}ml din ${waterToday.target_ml}ml azi (${Math.round(((waterToday.total_ml || 0) / waterToday.target_ml) * 100)}%)`
          : 'indisponibil'

      // ── Corp & Sănătate ───────────────────────────────────────────────────────
      const corpInfo = body
        ? `Greutate ${body.weight_kg}kg, Masă grasă ${body.fat_pct || '—'}%, Masă musculară ${body.muscle_kg || '—'}kg, TA ${body.bp_sys ? `${body.bp_sys}/${body.bp_dia}mmHg` : '—'}, PWV ${body.pwv || '—'}m/s`
        : 'indisponibil'

      // ── Cardio Fitness ────────────────────────────────────────────────────────
      const cardioInfo = cardioFitness
        ? (typeof cardioFitness === 'object'
          ? `VO2max ${cardioFitness.vo2max || '—'}, scor ${cardioFitness.score || '—'}, nivel ${cardioFitness.level || '—'}`
          : `${cardioFitness}`)
        : 'indisponibil'

      // ── HRV Polar 10 azi ──────────────────────────────────────────────────────
      const polarInfo = polarHrvToday
        ? (typeof polarHrvToday === 'object'
          ? `RMSSD ${polarHrvToday.rmssd || '—'}ms, SDNN ${polarHrvToday.sdnn || '—'}ms, LF/HF ${polarHrvToday.lf_hf || '—'}`
          : `${polarHrvToday}`)
        : 'nemăsurat azi'

      // ── Fasting ───────────────────────────────────────────────────────────────
      const fastingInfo = (() => {
        if (!fastingData || fastingData.length === 0) return 'fără date înregistrate'
        const latest = [...fastingData].sort((a, b) => new Date(b.startedAt || b.date) - new Date(a.startedAt || a.date))[0]
        if (!latest) return 'fără date'
        if (latest.startedAt && !latest.endedAt) {
          const elapsed = Math.round((Date.now() - new Date(latest.startedAt)) / 3600000 * 10) / 10
          const target = latest.hours || 16
          const remaining = Math.max(0, target - elapsed).toFixed(1)
          const startStr = new Date(latest.startedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
          return `ACTIV — ${elapsed}h din ${target}h (început ${startStr}, ${remaining}h rămase)`
        }
        return `ultimul: ${latest.hours?.toFixed(1) || '—'}h pe ${latest.date || 'dată necunoscută'} — niciun fasting activ`
      })()

      // ── Body Battery ──────────────────────────────────────────────────────────
      const bbInfo = bodyBattery?.current != null ? `${bodyBattery.current}%` : '—'

      // ── Profil ────────────────────────────────────────────────────────────────
      const profileInfo = profile
        ? `Obiectiv: ${GOALS_MAP[profile.goal] || profile.goal}, Nivel: ${profile.level}, ${profile.days_per_week} zile/săpt, Vârstă: ${profile.age || '—'}ani, ${profile.height_cm || '—'}cm`
        : 'profil incomplet'

      // ── Accidentări ───────────────────────────────────────────────────────────
      const injuryInfo = injuries?.length > 0
        ? `⚠️ ACTIVE: ${injuries.map(i => `${i.description}${i.zone ? ` (${i.zone})` : ''}`).join('; ')}`
        : 'nicio accidentare activă'

      // ── Activitate azi ────────────────────────────────────────────────────────
      const activityInfo = fitData?.today
        ? `Pași ${fitData.today.steps?.toLocaleString() || '—'}, Calorii ${Math.round(fitData.today.calories_burned || 0)}kcal, HR mediu ${fitData.today.hr_avg || '—'}bpm`
        : 'indisponibil'

      // ── Antrenamente ──────────────────────────────────────────────────────────
      const lastW = workouts?.[0]
      const antrenamentInfo = lastW
        ? `${lastW.title} acum ${lastW.hours_ago}h, ${lastW.volume_kg?.toLocaleString()}kg volum, ${lastW.duration_min}min`
        : 'niciun antrenament recent'

      const cutoff = new Date(Date.now() - 7 * 86400000)
      const thisWeek = workouts?.filter(w => w.date && new Date(w.date) >= cutoff) || []
      const weekInfo = `${thisWeek.length} antrenamente săptămâna aceasta, volum total ${thisWeek.reduce((s, w) => s + (w.volume_kg || 0), 0).toLocaleString()}kg`

      // ── Nutriție azi (pentru seară) ───────────────────────────────────────────
      const nutritieAzi = nutrition
        ? `${nutrition.calories}kcal | P: ${nutrition.protein_g}g | C: ${nutrition.carbs_g}g | G: ${nutrition.fat_g}g`
        : 'indisponibil'

      const apaAzi = waterToday?.target_ml
        ? `${waterToday.total_ml || 0}ml din ${waterToday.target_ml}ml (${Math.round(((waterToday.total_ml || 0) / waterToday.target_ml) * 100)}%)`
        : 'indisponibil'

      // ── Context meteo cu ferestre outdoor ────────────────────────────────────
      const weatherContext = (() => {
        if (!weather) return 'indisponibil'
        let ctx = `${weather.temperature_c}°C, ${weather.weather_label}, umiditate ${weather.humidity_pct}%, vânt ${weather.wind_speed_kmh}km/h`
        if (weather.pressure_delta_24h != null && Math.abs(weather.pressure_delta_24h) >= 6) {
          ctx += ` | ⚠️ Variație presiune ${weather.pressure_delta_24h > 0 ? '+' : ''}${weather.pressure_delta_24h}hPa/24h`
        }
        if (weather.today_forecast?.length > 0) {
          const fc = weather.today_forecast
          const dryHours = fc.filter(h => h.precip_prob < 30).map(h => h.hour)
          const rainStart = fc.find(h => h.precip_prob >= 40)
          if (dryHours.length > 0) ctx += ` | Fereastră uscată: ${dryHours[0]}:00–${dryHours[dryHours.length - 1] + 1}:00`
          if (rainStart) ctx += ` | ⛈ Ploaie probabilă de la ${rainStart.hour}:00 (${rainStart.precip_prob}%)`
          const highWind = fc.find(h => h.wind_kmh >= 40)
          if (highWind) ctx += ` | 💨 Vânt puternic ~${highWind.hour}:00`
        }
        // Vestimentație
        const t = weather.temperature_c
        const vestim = t < 5 ? 'geacă groasă + fular' : t < 12 ? 'geacă' : t < 18 ? 'hanorac/bluzon' : t < 24 ? 'tricou + strat ușor' : 'tricou ușor'
        const umbrela = (weather.weather_label || '').match(/ploaie|burniță|averse/i) || weather.today_forecast?.some(h => h.precip_prob >= 50)
        ctx += ` | Vestimentație: ${vestim}${umbrela ? ' + umbrelă ☂️' : ''}`
        return ctx
      })()

      // ════════════════════════════════════════════════════════════════════════
      // PROMPT DIMINEAȚĂ
      // ════════════════════════════════════════════════════════════════════════
      const promptMorning = `Ești coach personal de sănătate și fitness. Scrie briefingul matinal în română, concis și motivant.

DATA: ${todayLabel}
PROFIL: ${profileInfo}

DATE DIN ZIUA PRECEDENTĂ (toate valorile de mai jos sunt din ieri/noaptea trecută):

VITALITATE: scor ${vitalitate}/100
SOMN: ${somnInfo}
SUBIECTIV: scor ${scorSubiect}/100
NUTRIȚIE IERI: ${nutritieIeri}
APĂ IERI: ${apaIeri}
RECUPERARE: scor ${scorRecup}/100
HRV: scor ${scorHRV}/100 | HRV nocturn ${sleep?.hrv || '—'}ms
SĂNĂTATE: scor ${scorSanat}/100 | ${corpInfo}
READINESS TOTAL: ${scorTotal}/100 | Body Battery: ${bbInfo}

DATE ACTUALE AZI:
CARDIO FITNESS: ${cardioInfo}
FASTING: ${fastingInfo}
MĂSURĂTORI HRV POLAR 10 AZI: ${polarInfo}

ACCIDENTĂRI: ${injuryInfo}
METEO: ${weatherContext}

Structură obligatorie (respectă exact ordinea, fii concis — max 2-3 fraze per secțiune):

## 🌅 Bună dimineața! — ${todayLabel}

### 💪 Vitalitate
[Interpretează scorul de vitalitate. Ce înseamnă pentru energia de azi?]

### 😴 Somn
[Evaluează calitatea somnului (ore, HRV, SpO2, scor). Impact direct pe performanța de azi.]

### 🧠 Stare subiectivă
[Interpretează scorul subiectiv. Cum te simți față de normal?]

### 🥗 Nutriție & 💧 Apă — ieri
[Evaluează dacă caloriile și macronutrienții de ieri au fost adecvați. Hidratarea a fost ok?]

### 🔄 Recuperare
[Evaluează recuperarea. Ești pregătit pentru efort intens sau e zi de recuperare?]

### 📊 HRV
[Interpretează HRV-ul nocturn + scorul HRV. Tendința e pozitivă sau negativă?]

### ❤️ Sănătate & Cardio Fitness
[Evaluează sănătatea generală (corp, TA, PWV dacă există). Comentează Cardio Fitness și HRV Polar 10 de azi dacă sunt disponibile.]

### 🩺 Corolar — sinteza zilei de azi
[2-3 fraze care integrează toate datele de mai sus. Mesajul principal: ce prioritizezi azi și de ce, ținând cont de Fasting (${fastingInfo}), Cardio Fitness și HRV Polar 10.]

### ⚡ Ce faci azi
[Recomandare specifică: tip antrenament sau odihnă activă (cu justificare), target calorii + proteine, target apă. Dacă există accidentări — OBLIGATORIU exclude exercițiile pentru zona afectată.]

### 🌦️ Activități outdoor — fereastra zilei
[Pe baza meteo, spune EXACT: "Activitățile outdoor sunt recomandate între orele X:00–Y:00 datorită [condiție meteo]. De la Z:00 [motivul: ploaie/vânt/căldură]. Vestimentație: [recomandare]."  Fii specific ca un prieten care știe vremea locală.]

Zi minunată! ✨`

      // ════════════════════════════════════════════════════════════════════════
      // PROMPT SEARĂ
      // ════════════════════════════════════════════════════════════════════════
      const promptEvening = `Ești coach personal de sănătate și fitness. Scrie raportul de seară în română, onest și concis.

DATA: ${todayLabel}
PROFIL: ${profileInfo}

CE S-A ÎNTÂMPLAT AZI:
ANTRENAMENT: ${antrenamentInfo}
SĂPTĂMÂNĂ: ${weekInfo}
NUTRIȚIE AZI: ${nutritieAzi}
APĂ AZI: ${apaAzi}
ACTIVITATE: ${activityInfo}
FASTING: ${fastingInfo}
READINESS: ${scorTotal}/100 | Vitalitate: ${vitalitate} | Recuperare: ${scorRecup} | HRV: ${scorHRV}
SOMN NOAPTEA TRECUTĂ: ${somnInfo}
BODY BATTERY: ${bbInfo}
ACCIDENTĂRI: ${injuryInfo}
METEO AZI: ${weatherContext}

Structură obligatorie (max 2-3 fraze per secțiune, fii direct și sincer):

## 🌙 Seară bună! — ${todayLabel}

### 📊 Ce ai realizat azi
[Rezumă activitățile cheie ale zilei: antrenament, pași, nutriție, hidratare, fasting. Fapte concrete, nu generalități.]

### ✅ Ce ai făcut bine
[2-3 lucruri concrete și specifice pe care le-ai făcut bine azi, bazate pe date reale.]

### ⚠️ Unde se putea face mai bine
[1-2 lucruri specifice cu recomandare concretă pentru mâine. Fii constructiv, nu critic.]

### 😴 Îndrumări de somn
[Instrucțiuni personalizate bazate pe datele de azi:
- Ora recomandată de culcare
- Ce să eviți în ultimele 2 ore (cafeină, ecrane, mâncare grea)
- O tehnică concretă de relaxare potrivită pentru datele de azi (dacă HRV scăzut → respirație 4-7-8 sau magneziu; dacă zi intensă → relaxare musculară progresivă)
- Durata recomandată de somn în funcție de efortul zilei]

Noapte bună! 🌙`

      const prompt = selectedMode === 'morning' ? promptMorning : promptEvening

      const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-coach', {
        body: { prompt, max_tokens: 4096 }
      })

      if (fnError) throw new Error(fnError.message)
      if (!fnData?.ok) throw new Error(fnData?.error || 'Eroare AI Coach')

      const text = fnData.text || ''
      const time = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })

      const savedId = await saveReport(text, selectedMode)
      setReport({ text, mode: selectedMode, generatedAt: time, id: savedId })
      setExpanded(true)
      await loadSavedReports()

    } catch (err) {
      setError('Eroare: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleModeChange(m) {
    setMode(m)
    setReport(null)
    setExpanded(false)
    setError(null)
    setSelectedReport(null)
    loadTodayReport(m)
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { }
  }

  function shareReport(text, reportMode, date) {
    const title = `FORMA AI Coach — ${reportMode === 'morning' ? 'Briefing Matinal' : 'Raport de Seară'} ${date}`
    if (navigator.share) {
      navigator.share({ title, text })
    } else {
      copyToClipboard(title + '\n\n' + text)
    }
  }

  const displayReport = selectedReport
    ? { text: selectedReport.content, mode: selectedReport.type, generatedAt: new Date(selectedReport.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }), date: selectedReport.date, id: selectedReport.id }
    : report

  return (
    <div style={{ background: c.card, borderRadius: c.radius, padding: isMobile ? '1.1rem' : '1.3rem 1.5rem', marginBottom: '1.1rem', boxShadow: c.shadowCard }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: displayReport && expanded ? '1rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: c.green3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {mode === 'morning' ? '🌅' : '🌙'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
              AI Coach {mode === 'morning' ? '— Briefing Matinal' : '— Raport de Seară'}
            </div>
            <div style={{ fontSize: 11, color: c.text4 }}>
              {displayReport ? `Generat la ${displayReport.generatedAt}${displayReport.date && displayReport.date !== today ? ` · ${displayReport.date}` : ''}` : 'Analiză personalizată'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 3, background: c.card2, borderRadius: 8, padding: 3 }}>
            {[['morning', '🌅'], ['evening', '🌙']].map(([m, icon]) => (
              <button key={m} onClick={() => handleModeChange(m)}
                style={{ padding: isMobile ? '4px 8px' : '4px 10px', fontSize: isMobile ? 11 : 12, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: mode === m ? c.green3 : 'transparent', color: mode === m ? c.green : c.text4 }}>
                {icon} {!isMobile && (m === 'morning' ? 'Dimineață' : 'Seară')}
              </button>
            ))}
          </div>

          <button onClick={() => { setShowHistory(!showHistory); setSelectedReport(null) }}
            style={{ padding: '6px 12px', fontSize: 11, borderRadius: 10, border: 'none', background: showHistory ? c.green3 : c.card2, color: showHistory ? c.green : c.text4, cursor: 'pointer', fontFamily: 'inherit' }}>
            📋 {savedReports.length}
          </button>

          <button onClick={() => generateReport(mode)} disabled={loading}
            style={{ padding: isMobile ? '6px 12px' : '7px 14px', background: loading ? c.card2 : c.green2, border: 'none', borderRadius: 8, color: loading ? c.green : '#fff', fontSize: 12, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {loading ? '⏳' : displayReport ? '↻' : '✨ Generează'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '1.25rem', textAlign: 'center', borderTop: `0.5px solid ${c.border2}`, marginTop: '0.75rem' }}>
          <div style={{ fontSize: 13, color: c.text4, marginBottom: 8 }}>FORMA analizează datele tale...</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c.green2, animation: `pulse 1.2s ${i*0.2}s infinite` }}/>)}
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#2E1A1A', borderRadius: c.radiusSm, padding: '11px 13px', marginTop: '0.8rem', fontSize: 13, color: c.red }}>
          {error}
        </div>
      )}

      {/* Istoric rapoarte */}
      {showHistory && !selectedReport && (
        <div style={{ borderTop: `0.5px solid ${c.border2}`, marginTop: '0.75rem', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Rapoarte salvate</div>
          {savedReports.length === 0 ? (
            <div style={{ fontSize: 13, color: c.text4, textAlign: 'center', padding: '1rem' }}>Nu există rapoarte salvate încă.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {savedReports.map(rep => (
                <div key={rep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', background: c.card2, borderRadius: 10, cursor: 'pointer' }}
                  onClick={() => { setSelectedReport(rep); setShowHistory(false); setExpanded(true) }}>
                  <span style={{ fontSize: 16 }}>{rep.type === 'morning' ? '🌅' : '🌙'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.text }}>
                      {rep.type === 'morning' ? 'Briefing Matinal' : 'Raport de Seară'}
                      {rep.date === today && <span style={{ fontSize: 10, color: c.green, marginLeft: 6 }}>azi</span>}
                    </div>
                    <div style={{ fontSize: 11, color: c.text4 }}>{rep.date} · {new Date(rep.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteReport(rep.id) }}
                    style={{ fontSize: 11, padding: '4px 9px', background: c.card3, border: 'none', borderRadius: 8, color: c.text4, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raport selectat din istoric */}
      {selectedReport && (
        <div style={{ borderTop: `0.5px solid ${c.border2}`, marginTop: '0.75rem', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
            <button onClick={() => { setSelectedReport(null); setShowHistory(true) }}
              style={{ fontSize: 12, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
              ← Înapoi la listă
            </button>
            <div style={{ flex: 1 }}/>
            <button onClick={() => shareReport(selectedReport.content, selectedReport.type, selectedReport.date)}
              style={{ fontSize: 11, padding: '5px 12px', background: c.card2, border: 'none', borderRadius: 10, color: c.text3, cursor: 'pointer', fontFamily: 'inherit' }}>
              {copied ? '✓ Copiat' : '↗ Share'}
            </button>
            <button onClick={() => copyToClipboard(selectedReport.content)}
              style={{ fontSize: 11, padding: '5px 12px', background: c.card2, border: 'none', borderRadius: 10, color: c.text3, cursor: 'pointer', fontFamily: 'inherit' }}>
              📋 Copiază
            </button>
            <button onClick={() => deleteReport(selectedReport.id)}
              style={{ fontSize: 11, padding: '5px 12px', background: '#2E1A1A', border: 'none', borderRadius: 10, color: c.red, cursor: 'pointer', fontFamily: 'inherit' }}>
              Șterge
            </button>
          </div>
          <div style={{ fontSize: 11, color: c.text4, marginBottom: '0.75rem' }}>
            {selectedReport.date} · {selectedReport.type === 'morning' ? 'Briefing Matinal' : 'Raport de Seară'} · {new Date(selectedReport.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {renderMarkdown(selectedReport.content, c)}
        </div>
      )}

      {/* Raport curent */}
      {displayReport && !selectedReport && !loading && (
        <>
          <div style={{ borderTop: `0.5px solid ${c.border2}`, marginTop: '0.75rem', paddingTop: '0.75rem' }}>
            {expanded ? (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <button onClick={() => shareReport(displayReport.text, displayReport.mode, today)}
                    style={{ fontSize: 11, padding: '6px 14px', background: c.card2, border: 'none', borderRadius: 10, color: c.text3, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                    ↗ Share
                  </button>
                  <button onClick={() => copyToClipboard(displayReport.text)}
                    style={{ fontSize: 11, padding: '6px 14px', background: copied ? c.green3 : c.card2, border: 'none', borderRadius: 10, color: copied ? c.green : c.text3, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {copied ? '✓ Copiat' : '📋 Copiază text'}
                  </button>
                  {saving && <span style={{ fontSize: 11, color: c.text4, alignSelf: 'center' }}>Se salvează...</span>}
                </div>

                {/* WeatherBanner — fixat în partea superioară */}
                <WeatherBanner weather={data?.weather} mode={displayReport.mode} />

                {/* Conținut raport */}
                {renderMarkdown(displayReport.text, c)}

                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: `0.5px solid ${c.border2}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: c.green3 }}>Generat de FORMA AI Coach · salvat automat</div>
                  <button onClick={() => setExpanded(false)} style={{ fontSize: 12, color: c.text4, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Restrânge ↑
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => setExpanded(true)} style={{ fontSize: 13, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {displayReport.mode === 'morning' ? '🌅' : '🌙'} Vezi {displayReport.mode === 'morning' ? 'briefingul matinal' : 'raportul de seară'} · {displayReport.generatedAt} ↓
              </button>
            )}
          </div>
        </>
      )}

    </div>
  )
}
