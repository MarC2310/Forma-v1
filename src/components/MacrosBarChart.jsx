// src/components/MacrosBarChart.jsx
// Grafic macronutrienți — bare verticale grupate (Proteine / Carbohidrați / Grăsimi)
// cu linii orizontale pentru valorile recomandate (ținte din profil)
//
// Props:
//   data    — array { date:'YYYY-MM-DD', protein_g, carbs_g, fat_g }
//   targets — { protein_g, carbs_g, fat_g }  (din nutritionTargets)
//   c       — obiect culori temă FORMA

import { useState } from 'react'

// ── Perioade disponibile ───────────────────────────────────────────────────────
const PERIODS = [
  { label: '1Z',  days: 1  },
  { label: '7Z',  days: 7  },
  { label: '14Z', days: 14 },
  { label: '1L',  days: 30 },
  { label: '3L',  days: 90 },
]

// 1L și 3L agregă pe săptămâni (prea multe zile altfel)
const WEEKLY_PERIODS = new Set([30, 90])

// ── Macro-uri și proprietățile lor ────────────────────────────────────────────
// Culorile se iau din `c` la runtime pentru a respecta tema
function getMacros(c) {
  return [
    { key: 'protein_g', label: 'Proteine',     unit: 'g', color: c.green  || '#97C459' },
    { key: 'carbs_g',   label: 'Carbohidrați', unit: 'g', color: c.blue   || '#4A9EE8' },
    { key: 'fat_g',     label: 'Grăsimi',      unit: 'g', color: c.orange || '#F0A830' },
  ]
}

// ── Utilitar: construiește zilele din intervalul selectat ─────────────────────
function buildDays(data, period) {
  const today = new Date()
  const days  = []
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const found   = data.find(r => r.date === dateStr)
    days.push({
      date:      dateStr,
      isToday:   i === 0,
      protein_g: found?.protein_g ?? null,
      carbs_g:   found?.carbs_g   ?? null,
      fat_g:     found?.fat_g     ?? null,
    })
  }
  return days
}

// ── Utilitar: agregă zilele pe săptămâni (medie) ─────────────────────────────
function aggregateWeekly(days) {
  const weeks = []
  let i = 0
  while (i < days.length) {
    const chunk = days.slice(i, i + 7)
    const logged = chunk.filter(d => d.protein_g != null)

    if (logged.length === 0) {
      // Săptămână fără date
      weeks.push({ label: chunk[0]?.date?.slice(5) || '', protein_g: null, carbs_g: null, fat_g: null })
    } else {
      const avg = (key) => Math.round(logged.reduce((s, d) => s + (d[key] || 0), 0) / logged.length)
      const startDate = new Date(chunk[0].date)
      const label     = `${startDate.getDate()}/${startDate.getMonth() + 1}`
      weeks.push({ label, protein_g: avg('protein_g'), carbs_g: avg('carbs_g'), fat_g: avg('fat_g') })
    }
    i += 7
  }
  return weeks
}

// ── Selector perioadă (refolosit) ─────────────────────────────────────────────
function PeriodSelector({ period, setPeriod, c }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: c.card2, borderRadius: 8, padding: 3, marginBottom: 10, width: 'fit-content' }}>
      {PERIODS.map(p => (
        <button
          key={p.days}
          onClick={() => setPeriod(p.days)}
          style={{
            padding: '3px 10px', fontSize: 11, borderRadius: 5, border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            background: period === p.days ? c.green3 : 'transparent',
            color:      period === p.days ? c.green  : c.text4,
            fontWeight: period === p.days ? 700 : 400,
            transition: 'all 0.15s',
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ── Componentă principală ─────────────────────────────────────────────────────
export default function MacrosBarChart({ data = [], targets = {}, c }) {
  const [period,  setPeriod]  = useState(7)
  const [tooltip, setTooltip] = useState(null)

  const macros   = getMacros(c)
  const tProtein = targets.protein_g || 160
  const tCarbs   = targets.carbs_g   || 200
  const tFat     = targets.fat_g     || 70
  const targetMap = { protein_g: tProtein, carbs_g: tCarbs, fat_g: tFat }

  // ── Pregătire date ─────────────────────────────────────────────────────────
  const allDays  = buildDays(data, period)
  const useWeekly = WEEKLY_PERIODS.has(period)
  const slots    = useWeekly
    ? aggregateWeekly(allDays)
    : allDays.map(d => ({
        label:     d.isToday ? 'Azi' : (() => { const dt = new Date(d.date); return `${dt.getDate()}/${dt.getMonth() + 1}` })(),
        protein_g: d.protein_g,
        carbs_g:   d.carbs_g,
        fat_g:     d.fat_g,
        isToday:   d.isToday,
      }))

  // ── View special: 1 zi ────────────────────────────────────────────────────
  if (period === 1) {
    const today = allDays[0]
    const hasData = today.protein_g != null || today.carbs_g != null || today.fat_g != null

    return (
      <div>
        <PeriodSelector period={period} setPeriod={setPeriod} c={c} />
        {!hasData ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: c.text4, fontSize: 12 }}>
            Nu ai logat macronutrienți azi
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {macros.map(m => {
              const val    = today[m.key] || 0
              const target = targetMap[m.key]
              const pct    = target > 0 ? Math.min(130, Math.round(val / target * 100)) : 0
              const diff   = val - target
              return (
                <div key={m.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: c.text, fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: 12, color: c.text4 }}>
                      <span style={{ color: m.color, fontWeight: 700 }}>{val}g</span>
                      {' / '}{target}g ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 8, background: c.card2, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width:  `${Math.min(100, pct)}%`,
                      background: m.color,
                      borderRadius: 4,
                      transition: 'width 0.4s',
                      opacity: pct >= 85 ? 1 : 0.6,
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: diff >= 0 ? c.green : c.text4, marginTop: 2, textAlign: 'right' }}>
                    {diff >= 0 ? `+${diff}g surplus` : `${diff}g sub țintă`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Grafic SVG ─────────────────────────────────────────────────────────────
  const VW      = 320
  const VH      = 120
  const PAD_L   = 28
  const PAD_R   = 4
  const PAD_T   = 8
  const PAD_B   = 20
  const chartW  = VW - PAD_L - PAD_R
  const chartH  = VH - PAD_T - PAD_B

  // Y max: cel mai mare dintre target + 35% și orice valoare logată
  const allValues = slots.flatMap(s => macros.map(m => s[m.key] || 0))
  const targetMax = Math.max(tProtein, tCarbs, tFat)
  const valMax    = Math.max(...allValues, 10)
  const axisMax   = Math.ceil(Math.max(targetMax * 1.35, valMax * 1.1) / 20) * 20

  const toY = (val) => PAD_T + chartH * (1 - val / axisMax)

  // ── Dimensiuni bare ────────────────────────────────────────────────────────
  const slotW     = chartW / slots.length
  const nMacros   = macros.length // 3
  const barGap    = Math.max(0.5, slotW * 0.04)
  const groupW    = slotW * 0.78
  const barW      = Math.max(1.5, (groupW - barGap * (nMacros - 1)) / nMacros)
  const groupOffset = (slotW - groupW) / 2

  // ── Label step X ──────────────────────────────────────────────────────────
  const step = period <= 7 ? 1 : period <= 14 ? 2 : 1 // weekly always shows 1

  // ── Y axis ticks ──────────────────────────────────────────────────────────
  const yTicks = Array.from(new Set([0, Math.round(axisMax / 2), axisMax]))
    .filter(v => v >= 0 && v <= axisMax)
    .sort((a, b) => a - b)

  return (
    <div>
      <PeriodSelector period={period} setPeriod={setPeriod} c={c} />
      {useWeekly && (
        <div style={{ fontSize: 10, color: c.text4, marginBottom: 6 }}>
          Medii săptămânale · {slots.length} săptămâni
        </div>
      )}

      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          style={{ overflow: 'visible', display: 'block' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* ── Grid + Y labels ── */}
          {yTicks.map(val => {
            const y = toY(val)
            return (
              <g key={val}>
                <line
                  x1={PAD_L} y1={y} x2={PAD_L + chartW} y2={y}
                  stroke={val === 0 ? c.border : (c.border2 || c.border)}
                  strokeWidth={val === 0 ? 0.8 : 0.4}
                  strokeDasharray={val === 0 ? 'none' : '2,4'}
                />
                <text x={PAD_L - 4} y={y + 3.5} fontSize={6.5} fill={c.text4} textAnchor="end">
                  {val}g
                </text>
              </g>
            )
          })}

          {/* ── Linii orizontale țintă (una pe macro) ── */}
          {macros.map(m => {
            const target = targetMap[m.key]
            const y      = toY(target)
            return (
              <g key={m.key + '_target'}>
                <line
                  x1={PAD_L} y1={y}
                  x2={PAD_L + chartW} y2={y}
                  stroke={m.color}
                  strokeWidth={1}
                  strokeDasharray="4,3"
                  opacity={0.8}
                />
              </g>
            )
          })}

          {/* ── Bare grupate ── */}
          {slots.map((slot, si) => {
            const hasData = macros.some(m => slot[m.key] != null)
            const slotX   = PAD_L + si * slotW + groupOffset
            const showLabel = step === 1 || si % step === 0 || si === slots.length - 1

            return (
              <g
                key={si}
                onMouseEnter={() => hasData && setTooltip({ si, slot, x: slotX + groupW / 2, y: PAD_T })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: hasData ? 'pointer' : 'default' }}
              >
                {/* Bara pentru fiecare macro */}
                {macros.map((m, mi) => {
                  const val   = slot[m.key]
                  const barX  = slotX + mi * (barW + barGap)
                  const target = targetMap[m.key]

                  if (!val) {
                    return (
                      <rect key={m.key}
                        x={barX} y={toY(0) - 2}
                        width={barW} height={2}
                        fill={c.border} rx={0.5} opacity={0.4}
                      />
                    )
                  }

                  const barH = Math.max(1.5, chartH * val / axisMax)
                  const barY = toY(val)
                  const pct  = val / target
                  // Opacitate: bine (>=85%) → full, sub target → 65%
                  const opacity = tooltip?.si === si ? 1 : (pct >= 0.85 ? 0.9 : 0.55)

                  return (
                    <rect key={m.key}
                      x={barX} y={barY}
                      width={barW} height={barH}
                      fill={m.color}
                      rx={Math.min(1.5, barW / 3)}
                      opacity={opacity}
                    />
                  )
                })}

                {/* Label X */}
                {showLabel && (
                  <text
                    x={slotX + groupW / 2} y={VH - PAD_B + 10}
                    fontSize={period <= 7 ? 6.5 : 5.5}
                    fill={slot.isToday ? (c.green || '#97C459') : c.text4}
                    textAnchor="middle"
                    fontWeight={slot.isToday ? '700' : '400'}
                  >
                    {slot.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* ── Tooltip ── */}
          {tooltip && (() => {
            const tw  = 72
            const th  = 44
            const tx  = Math.min(Math.max(tooltip.x - tw / 2, PAD_L), PAD_L + chartW - tw)
            const ty  = PAD_T + 2
            const s   = tooltip.slot
            return (
              <g>
                <rect x={tx} y={ty} width={tw} height={th} rx={4}
                  fill={c.card || '#1E2028'} stroke={c.border} strokeWidth={0.5} opacity={0.97}
                />
                <text x={tx + 4} y={ty + 9}  fontSize={5.5} fill={c.text4}>{tooltip.slot.label}</text>
                {macros.map((m, i) => {
                  const val    = s[m.key]
                  const target = targetMap[m.key]
                  if (!val) return null
                  const diff   = val - target
                  const sign   = diff >= 0 ? '+' : ''
                  return (
                    <g key={m.key}>
                      <circle cx={tx + 7}  cy={ty + 15 + i * 10} r={2.5} fill={m.color} />
                      <text x={tx + 12} y={ty + 18 + i * 10} fontSize={6} fill={c.text} fontWeight="600">
                        {m.label.substring(0,6)}: {val}g
                      </text>
                      <text x={tx + tw - 2} y={ty + 18 + i * 10} fontSize={5.5}
                        fill={diff >= 0 ? m.color : c.text4} textAnchor="end">
                        {sign}{diff}g
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })()}
        </svg>
      </div>

      {/* ── Legendă ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 10, color: c.text4, flexWrap: 'wrap', alignItems: 'center' }}>
        {macros.map(m => (
          <span key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 3, borderRadius: 1, background: m.color, display: 'inline-block' }}/>
            {m.label}
            <span style={{ color: m.color, marginLeft: 2, fontWeight: 600 }}>
              /{targetMap[m.key]}g
            </span>
          </span>
        ))}
      </div>

      {/* ── Sumar medie perioadă ── */}
      <MacrosSummary slots={slots} macros={macros} targetMap={targetMap} c={c} useWeekly={useWeekly} />
    </div>
  )
}

// ── Sumar: media perioadei vs ținte ──────────────────────────────────────────
function MacrosSummary({ slots, macros, targetMap, c, useWeekly }) {
  const loggedSlots = slots.filter(s => macros.some(m => s[m.key] != null))
  if (loggedSlots.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 6, marginTop: 10, padding: '8px 10px',
      background: c.card2, borderRadius: 8,
    }}>
      {macros.map(m => {
        const avg    = Math.round(loggedSlots.reduce((sum, s) => sum + (s[m.key] || 0), 0) / loggedSlots.length)
        const target = targetMap[m.key]
        const pct    = Math.round(avg / target * 100)
        const ok     = pct >= 85
        return (
          <div key={m.key} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: ok ? m.color : c.text3 }}>
              {avg}g
            </div>
            <div style={{ fontSize: 9, color: c.text4, marginTop: 1 }}>
              {m.label.substring(0, 5)} · {pct}%
            </div>
            <div style={{ fontSize: 8, color: c.text4 }}>
              țintă {target}g
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 6, borderLeft: `0.5px solid ${c.border}` }}>
        <div style={{ fontSize: 9, color: c.text4, textAlign: 'center' }}>
          {loggedSlots.length} {useWeekly ? 'săpt.' : 'zile'}
          <br/>logare
        </div>
      </div>
    </div>
  )
}
                                                                                                                                                                 
