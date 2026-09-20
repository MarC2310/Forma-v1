// src/components/CaloriesBarChart.jsx
// Grafic bare verticale calorii consumate vs TDEE recomandat
// Props:
//   data  — array de { date: 'YYYY-MM-DD', calories: number }
//   tdee  — number (kcal recomandate/zi din profilul utilizatorului)
//   c     — obiect culori tema FORMA

import { useState } from 'react'

const PERIODS = [
  { label: '1Z',   days: 1  },
  { label: '14Z',  days: 14 },
  { label: '1L',   days: 30 },
  { label: '3L',   days: 90 },
]

// Câte labels X afișăm în funcție de perioadă
function labelStep(days) {
  if (days <= 1)  return 1
  if (days <= 14) return 2
  if (days <= 30) return 5
  return 15
}

export default function CaloriesBarChart({ data = [], tdee = 2000, c }) {
  const [period, setPeriod]   = useState(14)
  const [tooltip, setTooltip] = useState(null) // { i, cal, date, x, y }

  // ── Construiește array de zile (toate, chiar și fără date) ────────────────
  const todayStr = new Date().toISOString().slice(0, 10)
  const days = []
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const found   = data.find(r => r.date === dateStr)
    days.push({ date: dateStr, calories: found?.calories ?? null, isToday: dateStr === todayStr })
  }

  // ── Dimensiuni grafic SVG ─────────────────────────────────────────────────
  const VW        = 320   // viewBox width
  const VH        = 110   // viewBox height
  const PAD_L     = 28    // spațiu pentru labels Y
  const PAD_R     = 28    // spațiu pentru "TDEE" text
  const PAD_T     = 8
  const PAD_B     = 20    // spațiu pentru labels X
  const chartW    = VW - PAD_L - PAD_R
  const chartH    = VH - PAD_T - PAD_B

  const maxLogged = Math.max(...days.map(d => d.calories || 0), 10)
  const maxCal    = Math.ceil(Math.max(tdee * 1.35, maxLogged * 1.1) / 100) * 100

  // ── Y = 0 este jos, crește în sus ─────────────────────────────────────────
  const toY = (val) => PAD_T + chartH * (1 - val / maxCal)

  const tdeeY   = toY(tdee)
  const step    = labelStep(period)
  const barSlot = chartW / days.length
  const barW    = Math.max(2, Math.min(barSlot * 0.65, 18))

  // ── Culoare bara ─────────────────────────────────────────────────────────
  function barColor(cal) {
    if (!cal) return c.border
    const r = cal / tdee
    if (r > 1.15) return c.orange || '#F0A830'
    if (r < 0.75) return c.blue  || '#4A9EE8'
    return c.green || '#97C459'
  }

  // ── Formatare label X ─────────────────────────────────────────────────────
  function xLabel(dateStr) {
    const d = new Date(dateStr)
    if (period === 1) return 'Azi'
    if (period <= 14) return `${d.getDate()}/${d.getMonth() + 1}`
    // 30/90 zile: afișăm doar ziua
    return `${d.getDate()}`
  }

  // ── Y-axis ticks: 0, tdee, max ───────────────────────────────────────────
  const yTicks = Array.from(new Set([0, Math.round(tdee / 2), tdee, maxCal]))
    .filter(v => v >= 0 && v <= maxCal)
    .sort((a, b) => a - b)

  // ── View: 1 zi ────────────────────────────────────────────────────────────
  if (period === 1) {
    const today = days[0]
    const cal   = today?.calories ?? 0
    const pct   = tdee > 0 ? Math.round(cal / tdee * 100) : 0
    const diff  = cal - tdee
    const color = cal > tdee * 1.15 ? (c.orange || '#F0A830') : cal < tdee * 0.75 ? (c.blue || '#4A9EE8') : (c.green || '#97C459')

    return (
      <div>
        {/* Selector perioadă */}
        <PeriodSelector period={period} setPeriod={setPeriod} c={c} />

        {cal === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: c.text4, fontSize: 12 }}>
            Nu ai logat mâncare azi
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Bar mare */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: c.text }}>{cal.toLocaleString()} kcal</span>
                  <span style={{ fontSize: 11, color: c.text4 }}>{pct}% din TDEE</span>
                </div>
                <div style={{ height: 10, background: c.card2, borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 5, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: c.text4 }}>0</span>
                  <span style={{ fontSize: 10, color: c.orange || '#F0A830' }}>TDEE: {tdee.toLocaleString()} kcal</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: color, fontWeight: 600 }}>
              {diff > 0 ? `+${diff.toLocaleString()} kcal surplus` : `${diff.toLocaleString()} kcal deficit`}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── View: 14Z / 1L / 3L — grafic bare SVG ────────────────────────────────
  return (
    <div>
      {/* Selector perioadă */}
      <PeriodSelector period={period} setPeriod={setPeriod} c={c} />

      {/* SVG chart */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          style={{ overflow: 'visible', display: 'block' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* ── Grid linii orizontale ── */}
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
                <text
                  x={PAD_L - 4} y={y + 3.5}
                  fontSize={6.5} fill={c.text4} textAnchor="end"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                </text>
              </g>
            )
          })}

          {/* ── Linie TDEE ── */}
          <line
            x1={PAD_L} y1={tdeeY}
            x2={PAD_L + chartW} y2={tdeeY}
            stroke={c.orange || '#F0A830'}
            strokeWidth={1.2}
            strokeDasharray="5,3"
          />
          {/* Label TDEE la dreapta */}
          <text
            x={PAD_L + chartW + 3} y={tdeeY + 3}
            fontSize={6} fill={c.orange || '#F0A830'}
            fontWeight="600"
          >
            TDEE
          </text>

          {/* ── Bare ── */}
          {days.map((day, i) => {
            const cal  = day.calories
            const x    = PAD_L + i * barSlot + (barSlot - barW) / 2
            const showLabel = i % step === 0 || i === days.length - 1

            if (!cal) {
              // Zi fără date: linie mică la bază
              return (
                <g key={day.date}>
                  <rect
                    x={x} y={toY(0) - 2}
                    width={barW} height={2}
                    fill={c.border} rx={1}
                    opacity={0.5}
                  />
                  {showLabel && (
                    <text
                      x={x + barW / 2} y={VH - PAD_B + 10}
                      fontSize={6} fill={c.text4} textAnchor="middle"
                    >
                      {xLabel(day.date)}
                    </text>
                  )}
                </g>
              )
            }

            const barH = Math.max(2, chartH * cal / maxCal)
            const barY = toY(cal)
            const bc   = barColor(cal)

            return (
              <g
                key={day.date}
                onMouseEnter={() => setTooltip({ i, cal, date: day.date, x: x + barW / 2, y: barY })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Bara principală */}
                <rect
                  x={x} y={barY}
                  width={barW} height={barH}
                  fill={bc}
                  rx={Math.min(2, barW / 3)}
                  opacity={tooltip?.i === i ? 1 : 0.82}
                />
                {/* Highlight today */}
                {day.isToday && (
                  <rect
                    x={x - 1} y={barY - 1}
                    width={barW + 2} height={barH + 1}
                    fill="none"
                    stroke={bc}
                    strokeWidth={1}
                    rx={Math.min(2, barW / 3)}
                    opacity={0.5}
                  />
                )}
                {/* Label X */}
                {showLabel && (
                  <text
                    x={x + barW / 2} y={VH - PAD_B + 10}
                    fontSize={6} fill={day.isToday ? bc : c.text4}
                    textAnchor="middle"
                    fontWeight={day.isToday ? '700' : '400'}
                  >
                    {xLabel(day.date)}
                  </text>
                )}
              </g>
            )
          })}

          {/* ── Tooltip ── */}
          {tooltip && (() => {
            const tw   = 52
            const th   = 26
            const tx   = Math.min(Math.max(tooltip.x - tw / 2, PAD_L), PAD_L + chartW - tw)
            const ty   = Math.max(PAD_T + 2, tooltip.y - th - 4)
            const diff = tooltip.cal - tdee
            const sign = diff >= 0 ? '+' : ''
            return (
              <g>
                <rect x={tx} y={ty} width={tw} height={th} rx={4}
                  fill={c.card || '#1E2028'} stroke={c.border} strokeWidth={0.5} />
                <text x={tx + tw / 2} y={ty + 9} fontSize={7} fill={c.text} textAnchor="middle" fontWeight="600">
                  {Math.round(tooltip.cal).toLocaleString()} kcal
                </text>
                <text x={tx + tw / 2} y={ty + 19} fontSize={6} fill={diff >= 0 ? (c.orange || '#F0A830') : (c.blue || '#4A9EE8')} textAnchor="middle">
                  {sign}{Math.round(diff).toLocaleString()} vs TDEE
                </text>
              </g>
            )
          })()}
        </svg>
      </div>

      {/* ── Legendă ── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 10, color: c.text4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: c.green, display: 'inline-block' }}/>
          În target
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: c.orange || '#F0A830', display: 'inline-block' }}/>
          Surplus {'>'} 15%
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: c.blue || '#4A9EE8', display: 'inline-block' }}/>
          Deficit {'>'} 25%
        </span>
        <span style={{ marginLeft: 'auto', color: c.orange || '#F0A830', fontWeight: 600 }}>
          — TDEE: {tdee.toLocaleString()} kcal
        </span>
      </div>
    </div>
  )
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
            color: period === p.days ? c.green : c.text4,
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
