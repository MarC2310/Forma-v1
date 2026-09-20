// src/components/HealthCharts.jsx — Componente vizuale pentru Sănătate
import { useState } from 'react'

export function scoreColor(score, c) {
  if (!score) return c.text4
  if (score >= 80) return c.green
  if (score >= 60) return c.orange
  return c.red
}

export function scoreLabel(score) {
  if (!score) return 'Indisponibil'
  if (score >= 85) return 'Excelent'
  if (score >= 70) return 'Bun'
  if (score >= 55) return 'Moderat'
  if (score >= 40) return 'Slab'
  return 'Critic'
}

export function ScoreRing({ score, size = 100, label, c }) {
  const r = size * 0.4
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - (score || 0) / 100)
  const color = scoreColor(score, c)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id={`sg${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="1"/>
              <stop offset="100%" stopColor={color} stopOpacity="0.6"/>
            </linearGradient>
            <filter id={`sgf${size}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c.card2} strokeWidth={size*0.08}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#sg${size})`} strokeWidth={size*0.08}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
            filter={score ? `url(#sgf${size})` : undefined}/>
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: size*0.22, fontWeight: 800, color: score ? color : c.text4, lineHeight: 1, letterSpacing: '-0.02em' }}>{score || '—'}</div>
          <div style={{ fontSize: size*0.10, color: c.text4 }}>/100</div>
        </div>
      </div>
      {label && <div style={{ fontSize: 11, color: c.text3, textAlign: 'center', fontWeight: 500 }}>{label}</div>}
    </div>
  )
}

export function MetricRow({ icon, label, value, unit, status, note, src, c }) {
  const statusColor = status === 'good' ? c.green : status === 'warn' ? c.orange : status === 'bad' ? c.red : c.text4
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: `0.5px solid ${c.border2}` }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: c.text3 }}>{label}</div>
        {note && <div style={{ fontSize: 10, color: c.text4, marginTop: 1 }}>{note}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {src && <div style={{ fontSize: 9, color: c.text4, marginBottom: 2 }}>{src}</div>}
        <span style={{ fontSize: 16, fontWeight: 600, color: value != null ? statusColor : c.text4 }}>
          {value != null ? value : '—'}
        </span>
        {unit && value != null && <span style={{ fontSize: 12, color: c.text4, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  )
}

export function TrendChart({ data, keyName, color, label, unit, c }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  if (!data || data.length < 2) return null
  const validData = data.filter(d => d[keyName] != null)
  if (validData.length < 2) return null

  const recent = data.slice(-30)
  const values = recent.map(d => d[keyName]).filter(v => v != null)
  if (values.length === 0) return null

  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const avgV = values.reduce((a, b) => a + b, 0) / values.length
  const range = maxV - minV || 1

  const W = 600
  const H = 150
  const pl = 35, pr = 15, pt = 22, pb = 25
  const cw = W - pl - pr
  const ch = H - pt - pb

  const barWidth = Math.max(3, Math.floor(cw / recent.length) - 3)
  const activeItem = hoveredIdx !== null ? recent[hoveredIdx] : null

  return (
    <div style={{ marginBottom: '1.5rem', background: c.card2, borderRadius: 12, padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: c.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 11, color: c.text4, display: 'flex', gap: 10 }}>
          <span>Min: <strong style={{ color: c.text }}>{minV.toFixed(1)}{unit}</strong></span>
          <span>Med: <strong style={{ color: color }}>{avgV.toFixed(1)}{unit}</strong></span>
          <span>Max: <strong style={{ color: c.text }}>{maxV.toFixed(1)}{unit}</strong></span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        {[0, 0.5, 1].map((ratio, i) => {
          const yPos = pt + ch * (1 - ratio)
          const valAtRatio = minV + (maxV - minV) * ratio
          return (
            <g key={i}>
              <line x1={pl} y1={yPos} x2={W - pr} y2={yPos} stroke={c.border} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.5} />
              <text x={pl - 5} y={yPos + 3} fontSize={9} fill={c.text4} textAnchor="end">
                {valAtRatio.toFixed(0)}
              </text>
            </g>
          )
        })}

        {activeItem && activeItem[keyName] != null && (() => {
          const val = activeItem[keyName]
          const xPos = pl + hoveredIdx * (cw / recent.length) + (cw / recent.length) / 2
          return (
            <g transform={`translate(${xPos}, ${pt - 4})`}>
              <rect x="-35" y="-14" width="70" height="18" rx="4" fill={c.card} stroke={color} strokeWidth="1" />
              <text x="0" y="-2" fontSize="10" fill={c.text} fontWeight="bold" textAnchor="middle">
                {typeof val === 'number' ? val.toFixed(1) : val}{unit}
              </text>
            </g>
          )
        })()}

        {recent.map((d, i) => {
          const val = d[keyName]
          if (val == null) return null
          const x = pl + i * (cw / recent.length) + (cw / recent.length - barWidth) / 2
          const barH = Math.max(4, ((val - minV) / range) * (ch - 10) + 6)
          const y = pt + ch - barH
          const isHovered = hoveredIdx === i

          return (
            <g key={i}
               onMouseEnter={() => setHoveredIdx(i)}
               onMouseLeave={() => setHoveredIdx(null)}
               style={{ cursor: 'pointer' }}>
              <rect x={x - 2} y={pt} width={barWidth + 4} height={ch} fill="transparent" />
              <rect
                x={x} y={y} width={barWidth} height={barH}
                rx={Math.min(3, barWidth / 2)} fill={color}
                opacity={isHovered ? 1 : 0.8}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth={isHovered ? 1 : 0}
              />
              {(i === 0 || i === Math.floor(recent.length / 2) || i === recent.length - 1) && d.date && (
                <text x={x + barWidth / 2} y={H - 5} fontSize={9} fill={c.text4} textAnchor="middle">
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
