// src/components/SplineChart.jsx — Grafic organic cu linie curbă (spline) + gradient sub curbă
// Reutilizabil pentru orice evoluție în timp: HRV, pași, calorii etc.
// Suportă: tooltip interactiv la hover/touch, marcator "azi", date asociate pentru tooltip.

import { useState, useRef } from 'react'

function buildSplinePath(points) {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const months = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','nov','dec']
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  const day = parseInt(parts[2], 10)
  const month = parseInt(parts[1], 10) - 1
  return `${day} ${months[month] || ''}`
}

export default function SplineChart({
  data,
  labels,
  dates,
  color,
  height = 90,
  c,
  showDots = true,
  highlightLast = true,
  formatValue,
  emptyLabel = 'Date insuficiente',
}) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)

  const validIndices = data.map((v, i) => v != null ? i : null).filter(v => v !== null)
  if (validIndices.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: c.text4 }}>
        {emptyLabel}
      </div>
    )
  }

  const values = validIndices.map(i => data[i])
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = (max - min) || 1
  const padY = 8
  const w = 100
  const innerH = height - padY * 2

  const n = data.length
  const stepX = n > 1 ? w / (n - 1) : w

  const points = validIndices.map(i => ({
    x: i * stepX,
    y: padY + innerH - ((data[i] - min) / range) * innerH,
    idx: i,
  }))

  const linePath = buildSplinePath(points)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  const gradId = `splineGrad-${color.replace('#', '')}-${height}`
  const glowId = `splineGlow-${color.replace('#', '')}-${height}`

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayIdx = dates ? dates.findIndex(d => d === todayStr) : (highlightLast ? n - 1 : -1)
  const todayX = todayIdx >= 0 ? todayIdx * stepX : null

  function handleMove(clientX) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * w
    let closest = 0
    let closestDist = Infinity
    validIndices.forEach(i => {
      const dist = Math.abs(i * stepX - relX)
      if (dist < closestDist) { closestDist = dist; closest = i }
    })
    setHoverIdx(closest)
  }

  const hoverPoint = hoverIdx != null ? points.find(p => p.idx === hoverIdx) : null
  const hoverValue = hoverIdx != null ? data[hoverIdx] : null
  const hoverDate = hoverIdx != null && dates ? dates[hoverIdx] : null

  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none"
          style={{ overflow: 'visible', display: 'block', touchAction: 'pan-y' }}
          onMouseMove={e => handleMove(e.clientX)}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchStart={e => handleMove(e.touches[0].clientX)}
          onTouchMove={e => handleMove(e.touches[0].clientX)}
          onTouchEnd={() => setHoverIdx(null)}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
              <stop offset="60%" stopColor={color} stopOpacity="0.08"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" vectorEffect="non-scaling-stroke"/>

          {todayX != null && (
            <line x1={todayX} y1={0} x2={todayX} y2={height} stroke={c.text4} strokeWidth="1" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" opacity="0.5"/>
          )}

          {hoverPoint && (
            <>
              <line x1={hoverPoint.x} y1={0} x2={hoverPoint.x} y2={height} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.35"/>
              <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4} fill={color} stroke={c.bg} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
            </>
          )}

          <path d={linePath} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" filter={`url(#${glowId})`}/>

          {showDots && points.map((p, i) => {
            const isLast = highlightLast && i === points.length - 1 && hoverIdx == null
            // Folosim rect in loc de circle — nu se deformeaza cu preserveAspectRatio=none
            const sz = isLast ? 2.8 : 1.6
            return (
              <rect key={i}
                x={p.x - sz/2} y={p.y - sz/2}
                width={sz} height={sz}
                rx={sz/2} ry={sz/2}
                fill={isLast ? color : c.bg}
                stroke={color} strokeWidth={isLast ? 0 : 1.0}
                vectorEffect="non-scaling-stroke"/>
            )
          })}
        </svg>

        {hoverPoint && hoverValue != null && (
          <div style={{
            position: 'absolute',
            left: `${hoverPoint.x}%`,
            top: 0,
            transform: `translate(${hoverPoint.x < 15 ? '0%' : hoverPoint.x > 85 ? '-100%' : '-50%'}, -100%)`,
            background: c.card3, color: c.text, fontSize: 12, fontWeight: 700,
            padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap', boxShadow: c.shadowCard,
            pointerEvents: 'none', zIndex: 2, marginTop: -6,
          }}>
            {hoverDate ? `${formatDateShort(hoverDate)} · ` : ''}{formatValue ? formatValue(hoverValue) : hoverValue}
          </div>
        )}

        {todayX != null && todayX > 6 && (
          <div style={{
            position: 'absolute', left: `${todayX}%`, bottom: -2, transform: 'translateX(-50%)',
            fontSize: 8, color: c.text4, whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            azi
          </div>
        )}
      </div>

      {labels && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {labels.map((lbl, i) => (
            (i === 0 || i === labels.length - 1 || i % Math.ceil(labels.length / 6) === 0) ? (
              <span key={i} style={{ fontSize: 9, color: c.text4 }}>{lbl}</span>
            ) : null
          ))}
        </div>
      )}

      {formatValue && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.text4, marginTop: 8 }}>
          <span>Min: <strong style={{ color: c.text3 }}>{formatValue(min)}</strong></span>
          <span>Medie: <strong style={{ color: c.text3 }}>{formatValue(values.reduce((a,b)=>a+b,0)/values.length)}</strong></span>
          <span>Max: <strong style={{ color: c.text3 }}>{formatValue(max)}</strong></span>
        </div>
      )}
    </div>
  )
}
