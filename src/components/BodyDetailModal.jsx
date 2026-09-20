import React, { useState, useMemo } from 'react'

// ── helpers ────────────────────────────────────────────────────────────────
function calcNormalRange(heightM) {
  if (!heightM) return { low: 18.5, high: 24.9 }
  const h2 = heightM * heightM
  return { low: +(18.5 * h2).toFixed(1), high: +(24.9 * h2).toFixed(1) }
}

function trendLabel(slope) {
  if (slope === null || slope === undefined) return null
  if (Math.abs(slope) < 0.02) return 'Stabil'
  return slope > 0 ? '↑ Creștere' : '↓ Scădere'
}

// ── mini SVG chart ─────────────────────────────────────────────────────────
function TrendChart({ data = [], normalLow, normalHigh, color = '#a78bfa', target = null }) {
  const W = 340, H = 130, pl = 42, pr = 20, pt = 12, pb = 26
  const pts = data.filter(d => d.v != null)
  if (pts.length < 2) return (
    <div style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: '2rem 0' }}>
      Date insuficiente
    </div>
  )
  const allV = pts.map(d => d.v).concat([normalLow, normalHigh, ...(target != null ? [target] : [])])
  const minV = Math.min(...allV)
  const maxV = Math.max(...allV)
  const pad = (maxV - minV) * 0.12 || 1
  const lo = minV - pad, hi = maxV + pad
  const cw = W - pl - pr, ch = H - pt - pb
  const x = i => pl + (i / (pts.length - 1)) * cw
  const y = v => pt + ch - ((v - lo) / (hi - lo)) * ch
  const pathD = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join(' ')
  const avgV = pts.reduce((s, d) => s + d.v, 0) / pts.length
  // slope via linear regression
  const n = pts.length
  const sumX = pts.reduce((s, _, i) => s + i, 0)
  const sumY = pts.reduce((s, d) => s + d.v, 0)
  const sumXY = pts.reduce((s, d, i) => s + i * d.v, 0)
  const sumX2 = pts.reduce((s, _, i) => s + i * i, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

  const yNL = y(normalLow), yNH = y(normalHigh)
  const yAvg = y(avgV)
  const yTgt = target != null ? y(target) : null
  const lastX = x(pts.length - 1)

  // tick labels
  const tickCount = Math.min(5, pts.length)
  const tickIdxs = Array.from({ length: tickCount }, (_, i) => Math.round(i * (pts.length - 1) / (tickCount - 1)))

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* normal range band */}
        <rect x={pl} y={yNH} width={cw} height={yNL - yNH} fill="rgba(74,222,128,0.10)" />
        <line x1={pl} y1={yNL} x2={pl + cw} y2={yNL} stroke="#4ade80" strokeWidth={1} strokeDasharray="4,3" opacity={0.5}/>
        <line x1={pl} y1={yNH} x2={pl + cw} y2={yNH} stroke="#4ade80" strokeWidth={1} strokeDasharray="4,3" opacity={0.5}/>
        {/* avg line */}
        <line x1={pl} y1={yAvg} x2={pl + cw} y2={yAvg} stroke="#fbbf24" strokeWidth={1} strokeDasharray="5,4" opacity={0.7}/>
        {/* target line */}
        {yTgt != null && (
          <>
            <line x1={pl} y1={yTgt} x2={pl + cw} y2={yTgt} stroke="#e879f9" strokeWidth={1.5} strokeDasharray="6,3"/>
            <circle cx={lastX} cy={yTgt} r={3} fill="#e879f9"/>
            <text x={lastX - 4} y={yTgt - 5} fontSize={9} fill="#e879f9" textAnchor="end">{target}</text>
          </>
        )}
        {/* data path */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {/* dots */}
        {pts.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.v)} r={3} fill={color}/>
        ))}
        {/* x-axis ticks */}
        {tickIdxs.map(i => (
          <text key={i} x={x(i)} y={H - 4} fontSize={9} fill="#888" textAnchor="middle">
            {pts[i].label}
          </text>
        ))}
        {/* y-axis ticks */}
        {[lo, (lo + hi) / 2, hi].map((v, i) => (
          <text key={i} x={pl - 4} y={y(v) + 3} fontSize={9} fill="#888" textAnchor="end">
            {v.toFixed(1)}
          </text>
        ))}
      </svg>
      {/* legend */}
      <div style={{ display: 'flex', gap: '1rem', fontSize: 11, color: '#888', marginTop: 4, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: color, borderRadius: 2 }}/>
          Valoare
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#fbbf24', borderRadius: 2 }}/>
          Medie {avgV.toFixed(1)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ display: 'inline-block', width: 16, height: 2, background: '#4ade80', borderRadius: 2 }}/>
          Interval normal
        </span>
        {target != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 16, height: 2, background: '#e879f9', borderRadius: 2 }}/>
            Țintă {target} kg
          </span>
        )}
      </div>
      {slope !== undefined && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          Tendință: <strong style={{ color: Math.abs(slope) < 0.02 ? '#4ade80' : slope > 0 ? '#f87171' : '#60a5fa' }}>
            {trendLabel(slope)}
          </strong> {Math.abs(slope).toFixed(2)} /zi
        </div>
      )}
    </div>
  )
}

// ── metric config ───────────────────────────────────────────────────────────
function buildMetrics(body, heightM) {
  const { low: wLow, high: wHigh } = calcNormalRange(heightM)
  return [
    { key: 'weight',   label: 'Greutate',    unit: 'kg',  value: body?.weight_kg,   normalLow: wLow,  normalHigh: wHigh,  color: '#a78bfa', decimals: 1 },
    { key: 'fat',      label: 'Grăsime',     unit: '%',   value: body?.fat_pct,      normalLow: 10,    normalHigh: 20,     color: '#fb923c', decimals: 1 },
    { key: 'lean',     label: 'Masă slabă',  unit: 'kg',  value: body?.lean_mass_kg, normalLow: null,  normalHigh: null,   color: '#34d399', decimals: 1 },
    { key: 'muscle',   label: 'Musculatură', unit: 'kg',  value: body?.muscle_mass_kg, normalLow: null, normalHigh: null,  color: '#60a5fa', decimals: 1 },
    { key: 'water',    label: 'Apă',         unit: '%',   value: body?.water_pct,    normalLow: 50,    normalHigh: 65,     color: '#38bdf8', decimals: 1 },
    { key: 'bone',     label: 'Os',          unit: 'kg',  value: body?.bone_mass_kg, normalLow: null,  normalHigh: null,   color: '#e2e8f0', decimals: 2 },
    { key: 'pwv',      label: 'PWV',         unit: 'm/s', value: body?.pwv,          normalLow: null,  normalHigh: 7,      color: '#f472b6', decimals: 1 },
  ].filter(m => m.value != null)
}

function metricStatus(value, low, high) {
  if (low == null && high == null) return null
  if (high != null && value > high) return { label: 'Peste normal', color: '#f87171' }
  if (low != null && value < low) return { label: 'Sub normal', color: '#60a5fa' }
  return { label: 'Normal', color: '#4ade80' }
}

function coachingText(metric, value, low, high) {
  const { key } = metric
  if (key === 'weight') {
    if (high && value > high) return `Greutatea curentă (${value} kg) depășește intervalul normal. Activitate aerobică moderată și deficit caloric ușor pot ajuta.`
    if (low && value < low) return `Greutatea curentă (${value} kg) este sub interval. Asigură-te că ai un aport caloric adecvat.`
    return `Greutatea ta (${value} kg) se află în intervalul normal. Continuă obiceiurile actuale!`
  }
  if (key === 'fat') {
    if (high && value > high) return `Procentul de grăsime (${value}%) este ridicat. Combinația antrenamente de forță + cardio este eficientă.`
    if (low && value < low) return `Procentul de grăsime (${value}%) este scăzut — excelent pentru performanță.`
    return `Procentul de grăsime (${value}%) este în parametri optimi.`
  }
  if (key === 'water') {
    if (value < 50) return `Hidratare scăzută (${value}%). Consumă cel puțin 2L de apă zilnic.`
    return `Hidratare bună (${value}%). Menține ritmul!`
  }
  if (key === 'pwv') {
    if (high && value > high) return `PWV ${value} m/s — rigiditate arterială crescută. Activitate aerobică regulată poate îmbunătăți elasticitatea.`
    return `PWV ${value} m/s — elasticitate arterială bună.`
  }
  return null
}

// ── main component ──────────────────────────────────────────────────────────
export default function BodyDetailModal({ isOpen, onClose, body, heightM, historicDays = [], userProfile, c }) {
  const [period, setPeriod] = useState(30)
  const metrics = useMemo(() => buildMetrics(body, heightM), [body, heightM])
  const [activeKey, setActiveKey] = useState('weight')
  const active = metrics.find(m => m.key === activeKey) || metrics[0]

  const cutoff = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - period); return d
  }, [period])

  const chartData = useMemo(() => {
    if (!active) return []
    const field = active.key === 'weight' ? 'weight_kg'
                : active.key === 'fat'    ? 'fat_pct'
                : active.key === 'lean'   ? 'lean_mass_kg'
                : active.key === 'muscle' ? 'muscle_mass_kg'
                : active.key === 'water'  ? 'water_pct'
                : active.key === 'bone'   ? 'bone_mass_kg'
                : active.key === 'pwv'    ? 'pwv'
                : null
    if (!field) return []
    return historicDays
      .filter(d => new Date(d.date) >= cutoff && d[field] != null)
      .map(d => ({
        label: new Date(d.date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' }),
        v: d[field]
      }))
  }, [active, cutoff, historicDays])

  if (!isOpen) return null

  const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
  }
  const sheet = {
    background: c?.card || '#1e1e2e', borderRadius: '20px 20px 0 0',
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
    padding: '1.25rem 1rem 2rem'
  }

  const status = active ? metricStatus(active.value, active.normalLow, active.normalHigh) : null
  const coach = active ? coachingText(active, active.value, active.normalLow, active.normalHigh) : null

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: c?.text }}>⚖️ Compoziție corporală</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: c?.text3 }}>✕</button>
        </div>

        {/* metric selector pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
          {metrics.map(m => (
            <button key={m.key} onClick={() => setActiveKey(m.key)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontFamily: 'inherit',
                background: activeKey === m.key ? m.color : (c?.bg || '#111'),
                color: activeKey === m.key ? '#000' : (c?.text3 || '#aaa'),
                fontWeight: activeKey === m.key ? 700 : 400,
              }}>
              {m.label} {m.value?.toFixed?.(m.decimals) ?? m.value}{m.unit}
            </button>
          ))}
        </div>

        {/* current value + status */}
        {active && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: '0.5rem' }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: active.color }}>
              {active.value?.toFixed?.(active.decimals) ?? active.value}
            </span>
            <span style={{ fontSize: 16, color: c?.text3 }}>{active.unit}</span>
            {status && (
              <span style={{ fontSize: 12, background: status.color + '22', color: status.color, padding: '2px 8px', borderRadius: 10 }}>
                {status.label}
              </span>
            )}
          </div>
        )}

        {/* period selector */}
        <div style={{ display: 'flex', gap: 4, background: c?.bg, padding: 4, borderRadius: 8, marginBottom: '1rem' }}>
          {[7, 14, 30, 60].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ flex: 1, padding: '5px 0', fontSize: 12, borderRadius: 6, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                background: period === p ? c?.card : 'transparent',
                color: period === p ? c?.text : c?.text3,
                fontWeight: period === p ? 600 : 400 }}>
              {p}z
            </button>
          ))}
        </div>

        {/* chart */}
        {active && (
          <TrendChart
            data={chartData}
            normalLow={active.normalLow ?? 0}
            normalHigh={active.normalHigh ?? 100}
            color={active.color}
            target={active.key === 'weight' ? (userProfile?.target_weight_kg ?? null) : null}
          />
        )}

        {/* coaching */}
        {coach && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: c?.bg, borderRadius: 12, fontSize: 13, color: c?.text2, lineHeight: 1.5 }}>
            💡 {coach}
          </div>
        )}
      </div>
    </div>
  )
}
