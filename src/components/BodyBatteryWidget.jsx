// src/components/BodyBatteryWidget.jsx
import { useState } from 'react'
import { translate } from '../lib/i18n'

function BatteryIcon({ pct, c, size = 64 }) {
  const color = pct >= 60 ? c.green : pct >= 30 ? c.orange : c.red
  const fillH = (pct / 100) * (size * 0.78)
  return (
    <svg width={size * 0.55} height={size} viewBox="0 0 36 64">
      <rect x="10" y="0" width="16" height="6" rx="2" fill={c.text4}/>
      <rect x="2" y="6" width="32" height="58" rx="6" fill="none" stroke={c.text4} strokeWidth="2.5"/>
      <rect x="5.5" y={6 + (58 - 3 - fillH)} width="25" height={fillH} rx="3" fill={color}/>
    </svg>
  )
}

function actEmoji(type) {
  const t = (type || '').toLowerCase()
  if (/weight|strength|gym|workout|muscl|lift|forca|forta/i.test(t)) return '🏋️'
  if (/walk|plimb|mers/i.test(t)) return '🚶'
  if (/run|jog|alerg/i.test(t)) return '🏃'
  if (/ride|cycl|bike|bicicl/i.test(t)) return '🚴'
  if (/swim|inot/i.test(t)) return '🏊'
  if (/yoga|stretch|flex|pilates/i.test(t)) return '🧘'
  if (/hike|trail|munte/i.test(t)) return '🥾'
  if (/tennis|padel/i.test(t)) return '🎾'
  if (/soccer|fotbal|football/i.test(t)) return '⚽'
  if (/basket/i.test(t)) return '🏀'
  if (/box|combat|martial/i.test(t)) return '🥊'
  if (/ski|snow/i.test(t)) return '⛷️'
  return '🏃'
}

function actColors(type) {
  const t = (type || '').toLowerCase()
  if (/weight|strength|gym|workout|muscl|lift|forca|forta/i.test(t))
    return { fill: 'rgba(239,68,68,0.15)', stroke: 'rgba(239,68,68,0.7)' }
  if (/walk|plimb|mers/i.test(t))
    return { fill: 'rgba(34,197,94,0.15)', stroke: 'rgba(34,197,94,0.7)' }
  if (/run|jog|alerg/i.test(t))
    return { fill: 'rgba(249,115,22,0.15)', stroke: 'rgba(249,115,22,0.7)' }
  if (/ride|cycl|bike/i.test(t))
    return { fill: 'rgba(59,130,246,0.15)', stroke: 'rgba(59,130,246,0.7)' }
  if (/swim|inot/i.test(t))
    return { fill: 'rgba(6,182,212,0.15)', stroke: 'rgba(6,182,212,0.7)' }
  if (/yoga|stretch|flex|pilates/i.test(t))
    return { fill: 'rgba(168,85,247,0.15)', stroke: 'rgba(168,85,247,0.7)' }
  return { fill: 'rgba(156,163,175,0.15)', stroke: 'rgba(156,163,175,0.7)' }
}

function fmtDur(sec) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m > 0 ? m + 'min' : ''}`.trim()
  return `${m}min`
}

export default function BodyBatteryWidget({ data, activities = [], sleepHours, prevDayBattery, c }) {
  if (!c || !data) return null
  const [hoverIdx, setHoverIdx] = useState(null)
  const [hoveredZone, setHoveredZone] = useState(null) // index of hovered zone
  const { startLevel, current, hourlyLevels } = data

  const validIdx = hourlyLevels.map((v, i) => v != null ? i : null).filter(v => v !== null)
  const w = 100, height = 70, padY = 6
  const stepX = w / 23

  // Oră fracționată → procent CSS (0-100%) = coordonată SVG (viewBox 0-100)
  const toX = (h) => Math.min(100, Math.max(0, (h / 23) * 100))

  const points = validIdx.map(i => ({
    x: i * stepX,
    y: padY + (height - padY * 2) * (1 - hourlyLevels[i] / 100),
  }))

  function buildPath(pts) {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`
    return d
  }
  const linePath = buildPath(points)
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`
    : ''

  const color = current >= 60 ? c.green : current >= 30 ? c.orange : c.red

  function handleSvgMove(clientX, svgEl) {
    const rect = svgEl.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * w
    let closest = validIdx[0], closestDist = Infinity
    validIdx.forEach(i => {
      const d = Math.abs(i * stepX - relX)
      if (d < closestDist) { closestDist = d; closest = i }
    })
    setHoverIdx(closest)
    // Verifică dacă suntem peste o zonă
    const overZone = allZones.findIndex(z => relX >= z.x1 && relX <= z.x2)
    setHoveredZone(overZone >= 0 ? overZone : null)
  }

  // ── Zona de somn ─────────────────────────────────────────────────────────
  const sleepZones = []
  if (sleepHours != null && sleepHours > 0) {
    const wakeHour = Math.min(9, Math.max(5, 7 - (sleepHours - 7) * 0.3))
    const sleepStart = Math.max(0, wakeHour - sleepHours)
    sleepZones.push({
      x1: toX(sleepStart), x2: toX(wakeHour),
      midX: toX((sleepStart + wakeHour) / 2),
      colors: { fill: 'rgba(139,92,246,0.12)', stroke: 'rgba(139,92,246,0.55)' },
      emoji: '🌙',
      label: 'Somn',
      detail: `${sleepHours.toFixed(1)}h`,
    })
  }

  // ── Zone de activitate ────────────────────────────────────────────────────
  const actZones = (activities || [])
    .filter(a => {
      const dt = a.start_time || a.start_date_local
      return dt && dt.length > 10 // trebuie să aibă ora, nu doar data
    })
    .map(a => {
      const dt = new Date(a.start_time || a.start_date_local)
      const startH = dt.getHours() + dt.getMinutes() / 60
      const durSec = a.elapsed_time || a.moving_time || a.duration || 3600
      const durH = Math.max(0.25, durSec / 3600)
      const endH = Math.min(23.99, startH + durH)
      const x1 = toX(startH)
      const x2 = Math.max(x1 + 1.5, toX(endH)) // lățime minimă vizibilă
      return {
        x1, x2,
        midX: (x1 + x2) / 2,
        colors: actColors(a.type),
        emoji: actEmoji(a.type),
        label: a.name || a.type || '',
        detail: fmtDur(durSec) + (a.calories ? ` · ${a.calories} kcal` : ''),
        startStr: `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`,
      }
    })

  const allZones = [...sleepZones, ...actZones]
  const EMOJI_H = allZones.length > 0 ? 24 : 0 // spațiu rezervat deasupra graficului

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <BatteryIcon pct={current} c={c} size={60}/>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {current}<span style={{ fontSize: 15, fontWeight: 600, color: c.text4 }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: c.text4, marginTop: 4 }}>
            {translate('start')} {startLevel}% · {current >= 60 ? translate('energie bună') : current >= 30 ? translate('energie moderată') : translate('energie scăzută')}
            {prevDayBattery != null && (
              <span style={{ marginLeft: 8, color: current >= prevDayBattery ? c.green : c.text4 }}>
                {current >= prevDayBattery ? '↑' : '↓'}{Math.abs(current - prevDayBattery)}% {translate('vs ieri')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grafic cu emoji-uri HTML deasupra */}
      <div style={{ position: 'relative' }}>

        {/* Rândul de emoji-uri (HTML pur, nu SVG — evită distorsionarea) */}
        {EMOJI_H > 0 && (
          <div style={{ position: 'relative', height: EMOJI_H, marginBottom: 0 }}>
            {allZones.map((z, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${z.midX}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 14,
                lineHeight: 1,
                userSelect: 'none',
                pointerEvents: 'none',
              }}>
                {z.emoji}
              </div>
            ))}
          </div>
        )}

        {/* SVG grafic */}
        <svg
          width="100%" height={height}
          viewBox={`0 0 ${w} ${height}`}
          preserveAspectRatio="none"
          style={{ overflow: 'visible', display: 'block' }}
          onMouseMove={e => handleSvgMove(e.clientX, e.currentTarget)}
          onMouseLeave={() => { setHoverIdx(null); setHoveredZone(null) }}
          onTouchStart={e => handleSvgMove(e.touches[0].clientX, e.currentTarget)}
          onTouchMove={e => handleSvgMove(e.touches[0].clientX, e.currentTarget)}
          onTouchEnd={() => { setHoverIdx(null); setHoveredZone(null) }}
        >
          <defs>
            <linearGradient id="bbGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.32"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>

          {/* Grilă */}
          {[25, 50, 75].map(pct => (
            <line key={pct}
              x1={0} y1={padY + (height - padY * 2) * (1 - pct / 100)}
              x2={w} y2={padY + (height - padY * 2) * (1 - pct / 100)}
              stroke={c.text4} strokeWidth="0.4" opacity="0.25"
            />
          ))}

          {/* Zone de activitate */}
          {allZones.map((z, i) => (
            <rect key={i}
              x={z.x1} y={padY - 1}
              width={Math.max(0.5, z.x2 - z.x1)}
              height={height - padY * 2 + 2}
              fill={hoveredZone === i ? z.colors.fill.replace('0.15', '0.28').replace('0.12', '0.25') : z.colors.fill}
              stroke={z.colors.stroke}
              strokeWidth="0.7"
              rx="1.5"
              style={{ cursor: 'pointer' }}
            />
          ))}

          {/* Arie gradient */}
          {areaPath && <path d={areaPath} fill="url(#bbGrad)" stroke="none"/>}

          {/* Linie principală */}
          {linePath && (
            <path d={linePath} fill="none" stroke={color} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
          )}

          {/* Punct hover */}
          {hoverIdx != null && hourlyLevels[hoverIdx] != null && (
            <circle
              cx={hoverIdx * stepX}
              cy={padY + (height - padY * 2) * (1 - hourlyLevels[hoverIdx] / 100)}
              r="3" fill={color} stroke={c.bg} strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Tooltip zonă activitate (hover) */}
        {hoveredZone != null && (() => {
          const z = allZones[hoveredZone]
          const tipLeft = z.midX < 15 ? `${z.x1}%` : z.midX > 85 ? `${z.x2}%` : `${z.midX}%`
          const tipAlign = z.midX < 15 ? '0%' : z.midX > 85 ? '-100%' : '-50%'
          return (
            <div style={{
              position: 'absolute',
              left: tipLeft,
              top: EMOJI_H,
              transform: `translate(${tipAlign}, -100%)`,
              background: c.card3 || '#2A2F38',
              color: c.text,
              fontSize: 11,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 8,
              whiteSpace: 'nowrap',
              boxShadow: c.shadowCard || '0 2px 12px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
              zIndex: 10,
              lineHeight: 1.5,
            }}>
              <div>{z.emoji} {z.label}</div>
              {z.detail && <div style={{ color: c.text4, fontSize: 10 }}>{z.startStr ? `${z.startStr} · ` : ''}{z.detail}</div>}
            </div>
          )
        })()}

        {/* Tooltip oră (hover pe linie) */}
        {hoveredZone == null && hoverIdx != null && hourlyLevels[hoverIdx] != null && (
          <div style={{
            position: 'absolute',
            left: `${hoverIdx * stepX}%`,
            top: EMOJI_H,
            transform: `translate(${hoverIdx * stepX < 15 ? '0%' : hoverIdx * stepX > 85 ? '-100%' : '-50%'}, -100%)`,
            background: c.card3 || '#2A2F38',
            color: c.text,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 9px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
            boxShadow: c.shadowCard || '0 2px 12px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            marginTop: -4,
          }}>
            {hoverIdx}:00 · {hourlyLevels[hoverIdx]}%
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: c.text4 }}>00:00</span>
        <span style={{ fontSize: 9, color: c.text4 }}>12:00</span>
        <span style={{ fontSize: 9, color: c.text4 }}>23:00</span>
      </div>
    </div>
  )
}
