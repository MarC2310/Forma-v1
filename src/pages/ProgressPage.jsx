// src/pages/ProgressPage.jsx — Grafice progres 30/90 zile
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import { supabase } from '../lib/supabase'
import { fetchRecentWorkouts } from '../lib/hevy'
import { fetchWithingsAll } from '../lib/withings'
import { fetchIntervalsData } from '../lib/intervals'

// ── Utilități ─────────────────────────────────────────────────────────────────
function movingAverage(data, window = 7) {
  return data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1).filter(v => v != null)
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : null
  })
}

function trendLine(values) {
  const validIdx = values.map((v, i) => v != null ? i : null).filter(i => i !== null)
  if (validIdx.length < 2) return null
  const n = validIdx.length
  const xs = validIdx
  const ys = validIdx.map(i => values[i])
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept, first: slope * xs[0] + intercept, last: slope * xs[xs.length-1] + intercept }
}

// ── Componente grafice ────────────────────────────────────────────────────────
function LineChart({ data, color, label, unit, showMA = true, c, height = 120 }) {
  const [tooltip, setTooltip] = useState(null)
  const values = data.map(d => d.value)
  const validValues = values.filter(v => v != null)
  if (validValues.length < 2) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 12, color: c.text4 }}>Date insuficiente</div>
    </div>
  )

  const max = Math.max(...validValues) * 1.05
  const min = Math.min(...validValues) * 0.95
  const range = max - min || 1
  const maValues = showMA ? movingAverage(values) : null
  const trend = trendLine(values)
  const W = 600, H = height

  const toY = v => v == null ? null : H - ((v - min) / range) * (H - 20) - 10
  const toX = i => (i / (data.length - 1)) * (W - 20) + 10

  let path = ''
  let maPath = ''
  data.forEach((d, i) => {
    const x = toX(i), y = toY(d.value)
    if (y != null) path += `${path ? 'L' : 'M'}${x},${y} `
    if (maValues) {
      const my = toY(maValues[i])
      if (my != null) maPath += `${maPath ? 'L' : 'M'}${x},${my} `
    }
  })

  const first = validValues[0]
  const last = validValues[validValues.length - 1]
  const change = last - first
  const changePct = Math.round((change / first) * 100)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: 12, color: change > 0 ? c.green : change < 0 ? c.red : c.text4 }}>
          {change > 0 ? '+' : ''}{change.toFixed(1)}{unit} ({changePct > 0 ? '+' : ''}{changePct}%)
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}
          onMouseLeave={() => setTooltip(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map(pct => (
            <g key={pct}>
              <line x1="10" y1={H - pct * (H-20) - 10} x2={W-10} y2={H - pct * (H-20) - 10}
                stroke={c.border} strokeWidth="0.5" strokeDasharray="4,4"/>
              <text x="0" y={H - pct * (H-20) - 6} fontSize="9" fill={c.text4} textAnchor="start">
                {Math.round(min + pct * range)}{unit}
              </text>
            </g>
          ))}
          {trend && (
            <line x1={toX(0)} y1={toY(trend.first)} x2={toX(data.length-1)} y2={toY(trend.last)}
              stroke={color} strokeWidth="1" strokeDasharray="6,3" opacity="0.4"/>
          )}
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
          {maPath && <path d={maPath} fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" strokeLinejoin="round"/>}
          {data.map((d, i) => {
            if (d.value == null) return null
            const x = toX(i), y = toY(d.value)
            return (
              <circle key={i} cx={x} cy={y} r="4" fill={color} opacity="0"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setTooltip({ x, y, value: d.value, date: d.date, label })}/>
            )
          })}
          {tooltip && (
            <g>
              <rect x={Math.min(tooltip.x - 40, W - 100)} y={tooltip.y - 36} width="90" height="30" rx="4"
                fill={c.card} stroke={c.border} strokeWidth="0.5"/>
              <text x={Math.min(tooltip.x - 40, W - 100) + 45} y={tooltip.y - 22} fontSize="10" fill={c.text} textAnchor="middle" fontWeight="600">
                {tooltip.value.toFixed(1)}{unit}
              </text>
              <text x={Math.min(tooltip.x - 40, W - 100) + 45} y={tooltip.y - 10} fontSize="9" fill={c.text4} textAnchor="middle">
                {tooltip.date?.slice(5)}
              </text>
            </g>
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: c.text4, marginTop: 4 }}>
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[Math.floor(data.length/2)]?.date?.slice(5)}</span>
        <span>{data[data.length-1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

function BarChart({ data, color, label, unit, c, height = 100 }) {
  const values = data.map(d => d.value).filter(v => v != null && v > 0)
  if (values.length < 2) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 12, color: c.text4 }}>Date insuficiente</div>
    </div>
  )
  const max = Math.max(...values)
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: 12, color: c.text3 }}>Medie: <strong style={{ color: c.text }}>{avg.toLocaleString()}{unit}</strong></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * (height - 16)) : 2
          const isAboveAvg = d.value >= avg
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', height: `${h}px`, background: isAboveAvg ? color : color + '55', borderRadius: 2 }}/>
              {data.length <= 30 && i % 7 === 0 && (
                <div style={{ fontSize: 8, color: c.text4 }}>{d.date?.slice(5)}</div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: c.text4, marginTop: 4 }}>
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length-1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, sub, color, c }) {
  return (
    <div style={{ background: c.card2, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || c.text }}>{value}</div>
      {unit && <div style={{ fontSize: 11, color: c.text4 }}>{unit}</div>}
      {sub && <div style={{ fontSize: 11, color: c.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Pagina principală ─────────────────────────────────────────────────────────
export default function ProgressPage({ onBack }) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const c = getColors(theme)

  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('weight')

  const [weightData, setWeightData]       = useState([])
  const [volumeData, setVolumeData]       = useState([])
  const [stepsData, setStepsData]         = useState([])
  const [nutritionData, setNutritionData] = useState([])
  const [hrvData, setHrvData]             = useState([])

  useEffect(() => {
    if (user?.id) loadAllData()
  }, [user, period])

  async function loadAllData() {
    setLoading(true)
    try {
      await Promise.all([
        loadWeightData(),
        loadWorkoutVolume(),
        loadStepsData(),
        loadNutritionData(),
        loadHRVData(),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadWeightData() {
    try {
      // Sursa 1: Intervals.icu wellness (weight_kg per zi)
      const intervals = await fetchIntervalsData(user.id, period + 5)
      const cutoff = new Date(Date.now() - period * 86400000).toISOString().slice(0, 10)

      let data = []
      if (intervals?.days) {
        data = intervals.days
          .filter(d => d.date >= cutoff && d.weight_kg)
          .map(d => ({ date: d.date, value: parseFloat(d.weight_kg) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }

      // Sursa 2: Withings (daca Intervals nu are suficiente date)
      if (data.length < 3) {
        const withings = await fetchWithingsAll(user.id)
        if (withings?.body?.weight_kg) {
          const today = new Date().toISOString().slice(0, 10)
          // Adaugam ultima masurare Withings daca nu e deja in date
          if (!data.find(d => d.date === today)) {
            data.push({ date: today, value: withings.body.weight_kg })
          }
        }
      }

      setWeightData(data)
    } catch(e) { console.warn('Weight data:', e) }
  }

  async function loadWorkoutVolume() {
    try {
      const workouts = await fetchRecentWorkouts(10)
      const byDate = {}
      for (const w of workouts) {
        if (w.date) {
          if (!byDate[w.date]) byDate[w.date] = 0
          byDate[w.date] += w.volume_kg || 0
        }
      }
      const cutoff = new Date(Date.now() - period * 86400000).toISOString().slice(0, 10)
      const data = Object.entries(byDate)
        .filter(([date]) => date >= cutoff)
        .map(([date, value]) => ({ date, value: Math.round(value) }))
        .sort((a, b) => a.date.localeCompare(b.date))
      setVolumeData(data)
    } catch(e) { console.warn('Volume data:', e) }
  }

  async function loadStepsData() {
    try {
      // Sursa: Intervals.icu wellness (steps per zi)
      const intervals = await fetchIntervalsData(user.id, period + 5)
      const cutoff = new Date(Date.now() - period * 86400000).toISOString().slice(0, 10)

      if (intervals?.days) {
        const data = intervals.days
          .filter(d => d.date >= cutoff && d.steps > 0)
          .map(d => ({ date: d.date, value: d.steps }))
          .sort((a, b) => a.date.localeCompare(b.date))
        setStepsData(data)
      }
    } catch(e) { console.warn('Steps data:', e) }
  }

  async function loadNutritionData() {
    try {
      const cutoff = new Date(Date.now() - period * 86400000).toISOString().slice(0, 10)

      // Combina nutrition_logs + meal_entries
      const [logsRes, mealsRes] = await Promise.all([
        supabase.from('nutrition_logs').select('date, calories, protein_g').eq('user_id', user.id).gte('date', cutoff).order('date'),
        supabase.from('meal_entries').select('date, calories, protein_g').eq('user_id', user.id).gte('date', cutoff),
      ])

      const byDate = {}
      for (const m of (mealsRes.data || [])) {
        if (!byDate[m.date]) byDate[m.date] = { calories: 0, protein_g: 0 }
        byDate[m.date].calories  += m.calories  || 0
        byDate[m.date].protein_g += m.protein_g || 0
      }
      for (const l of (logsRes.data || [])) {
        if (!byDate[l.date]) byDate[l.date] = { calories: 0, protein_g: 0 }
        byDate[l.date].calories  += l.calories  || 0
        byDate[l.date].protein_g += l.protein_g || 0
      }

      const data = Object.entries(byDate)
        .map(([date, v]) => ({ date, value: Math.round(v.calories), protein: Math.round(v.protein_g) }))
        .filter(d => d.value > 0)
        .sort((a, b) => a.date.localeCompare(b.date))

      setNutritionData(data)
    } catch(e) { console.warn('Nutrition data:', e) }
  }

  async function loadHRVData() {
    try {
      // Sursa: Intervals.icu (HRV zilnic)
      const intervals = await fetchIntervalsData(user.id, period + 5)
      const cutoff = new Date(Date.now() - period * 86400000).toISOString().slice(0, 10)

      if (intervals?.days) {
        const data = intervals.days
          .filter(d => d.date >= cutoff && d.hrv != null && d.hrv > 0)
          .map(d => ({ date: d.date, value: Math.round(d.hrv) }))
          .sort((a, b) => a.date.localeCompare(b.date))
        setHrvData(data)
      }
    } catch(e) { console.warn('HRV data:', e) }
  }

  const s = {
    page: { minHeight: '100vh', background: c.bg, padding: '0.75rem 1rem', fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 900, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `0.5px solid ${c.border}` },
    card: { background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' },
    sectionLabel: { fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' },
    tab: { padding: '6px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer', color: c.text3, border: 'none', background: 'transparent', fontFamily: 'inherit', whiteSpace: 'nowrap' },
    tabActive: { background: c.bg, color: c.text, fontWeight: 500, border: `0.5px solid ${c.border}` },
  }

  const weightTrend = weightData.length >= 2 ? weightData[weightData.length-1].value - weightData[0].value : null
  const avgSteps    = stepsData.length > 0 ? Math.round(stepsData.reduce((s, d) => s + d.value, 0) / stepsData.length) : null
  const totalVolume = volumeData.reduce((s, d) => s + d.value, 0)
  const workoutDays = volumeData.filter(d => d.value > 0).length

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button onClick={onBack} style={{ fontSize: 13, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Dashboard</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: c.text, letterSpacing: '0.1em' }}>📈 PROGRES</div>
        <div style={{ display: 'flex', gap: 4, background: c.card, padding: 3, borderRadius: 8 }}>
          {[30, 90].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ ...s.tab, ...(period === p ? s.tabActive : {}), padding: '4px 10px', fontSize: 11 }}>
              {p}z
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: c.text4 }}>
          ⏳ Se încarcă datele din ultimele {period} zile...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1rem' }}>
            <StatCard label="Greutate" value={weightData.length > 0 ? weightData[weightData.length-1].value : '—'} unit="kg"
              sub={weightTrend != null ? `${weightTrend > 0 ? '+' : ''}${weightTrend.toFixed(1)}kg în ${period}z` : ''}
              color={weightTrend != null ? (weightTrend < 0 ? c.green : c.orange) : null} c={c}/>
            <StatCard label="Pași medie" value={avgSteps ? avgSteps.toLocaleString() : '—'} unit="pași/zi"
              sub={avgSteps >= 10000 ? '✓ target atins' : avgSteps ? `${10000 - avgSteps} până la 10k` : ''}
              color={avgSteps >= 10000 ? c.green : null} c={c}/>
            <StatCard label="Antrenamente" value={workoutDays} unit={`sesiuni / ${period}z`}
              sub={`${Math.round(totalVolume/1000)}t volum total`} color={c.orange} c={c}/>
            <StatCard label="Volum mediu" value={workoutDays > 0 ? Math.round(totalVolume/workoutDays).toLocaleString() : '—'} unit="kg/sesiune"
              color={c.blue} c={c}/>
          </div>

          <div style={{ display: 'flex', gap: 4, background: c.card, padding: 4, borderRadius: 10, marginBottom: '1rem', overflowX: 'auto' }}>
            {[['weight','⚖️ Greutate'],['steps','🏃 Pași'],['volume','💪 Volum'],['nutrition','🥗 Nutriție'],['hrv','❤️ HRV']].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ ...s.tab, ...(activeTab===id?s.tabActive:{}), flexShrink: 0 }}>{label}</button>
            ))}
          </div>

          {activeTab === 'weight' && (
            <div style={s.card}>
              <div style={s.sectionLabel}>Evoluție greutate — {period} zile · Intervals.icu / Withings</div>
              {weightData.length < 2 ? (
                <div style={{ fontSize: 13, color: c.text4, textAlign: 'center', padding: '2rem' }}>
                  Date insuficiente — cântărește-te zilnic cu Withings pentru grafic complet.
                </div>
              ) : (
                <>
                  <LineChart data={weightData} color={c.blue} label="Greutate" unit="kg" c={c} height={140}/>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: '1rem' }}>
                    <StatCard label="Start" value={weightData[0].value} unit="kg" c={c}/>
                    <StatCard label="Curent" value={weightData[weightData.length-1].value} unit="kg" color={c.blue} c={c}/>
                    <StatCard label="Diferență" value={`${weightTrend > 0 ? '+' : ''}${weightTrend?.toFixed(1)}`} unit="kg"
                      color={weightTrend < 0 ? c.green : c.orange} c={c}/>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'steps' && (
            <div style={s.card}>
              <div style={s.sectionLabel}>Pași zilnici — {period} zile · Intervals.icu (Garmin)</div>
              {stepsData.length < 2 ? (
                <div style={{ fontSize: 13, color: c.text4, textAlign: 'center', padding: '2rem' }}>
                  Date insuficiente din Intervals.icu. Asigură-te că Garmin e sincronizat.
                </div>
              ) : (
                <>
                  <BarChart data={stepsData} color={c.green} label="Pași" unit="" c={c} height={120}/>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: '1rem' }}>
                    <StatCard label="Medie" value={avgSteps?.toLocaleString() || '—'} unit="pași/zi" color={c.green} c={c}/>
                    <StatCard label="Record" value={Math.max(...stepsData.map(d=>d.value)).toLocaleString()} unit="pași" c={c}/>
                    <StatCard label="Zile ≥10k" value={stepsData.filter(d=>d.value>=10000).length} unit={`din ${stepsData.length}`}
                      color={c.green} c={c}/>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'volume' && (
            <div style={s.card}>
              <div style={s.sectionLabel}>Volum antrenament — {period} zile · Hevy</div>
              {volumeData.length < 2 ? (
                <div style={{ fontSize: 13, color: c.text4, textAlign: 'center', padding: '2rem' }}>Date insuficiente din Hevy.</div>
              ) : (
                <>
                  <BarChart data={volumeData} color={c.orange} label="Volum" unit="kg" c={c} height={120}/>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: '1rem' }}>
                    <StatCard label="Total volum" value={`${Math.round(totalVolume/1000)}t`} unit={`în ${period} zile`} color={c.orange} c={c}/>
                    <StatCard label="Sesiuni" value={workoutDays} unit="antrenamente" c={c}/>
                    <StatCard label="Record sesiune" value={Math.max(...volumeData.map(d=>d.value)).toLocaleString()} unit="kg" color={c.green} c={c}/>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'nutrition' && (
            <div style={s.card}>
              <div style={s.sectionLabel}>Calorii zilnice — {period} zile · FORMA</div>
              {nutritionData.length < 2 ? (
                <div style={{ fontSize: 13, color: c.text4, textAlign: 'center', padding: '2rem' }}>
                  Date insuficiente — fotografiază mesele sau adaugă manual în tab Nutriție.
                </div>
              ) : (
                <>
                  <BarChart data={nutritionData} color="#4A7EB5" label="Calorii" unit=" kcal" c={c} height={120}/>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: '1rem' }}>
                    <StatCard label="Medie calorii" value={Math.round(nutritionData.reduce((s,d)=>s+d.value,0)/nutritionData.length)} unit="kcal/zi" color="#4A7EB5" c={c}/>
                    <StatCard label="Medie proteine" value={Math.round(nutritionData.reduce((s,d)=>s+(d.protein||0),0)/nutritionData.length)} unit="g/zi" color={c.green} c={c}/>
                    <StatCard label="Zile logate" value={nutritionData.length} unit={`din ${period}`} c={c}/>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'hrv' && (
            <div style={s.card}>
              <div style={s.sectionLabel}>HRV — {period} zile · Intervals.icu (Garmin)</div>
              {hrvData.length < 2 ? (
                <div style={{ fontSize: 13, color: c.text4, textAlign: 'center', padding: '2rem' }}>
                  Date insuficiente HRV din Intervals.icu.
                  <br/>
                  <button onClick={() => window.location.href='/health'}
                    style={{ marginTop: 12, padding: '8px 16px', background: c.green2, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ❤️ Mergi la Sănătate →
                  </button>
                </div>
              ) : (
                <>
                  <LineChart data={hrvData} color="#97C459" label="HRV (ms)" unit="ms" c={c} height={140}/>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: '1rem' }}>
                    <StatCard label="Medie HRV" value={Math.round(hrvData.reduce((s,d)=>s+d.value,0)/hrvData.length)} unit="ms" color={c.green} c={c}/>
                    <StatCard label="Cel mai bun" value={Math.max(...hrvData.map(d=>d.value))} unit="ms" color={c.green} c={c}/>
                    <StatCard label="Zile măsurate" value={hrvData.length} unit={`din ${period}`} c={c}/>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
