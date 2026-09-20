// src/components/FormaChart.jsx
// Grafic unificat pentru FORMA — înlocuiește implementările separate din
// SplineChart, LineChart (ProgressPage), BarChart (ProgressPage)
// SVG nativ, zero dependențe externe, tooltip touch-friendly

import { useState, useRef, useCallback, useMemo } from 'react'

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildSpline(pts) {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`
  }
  return d
}

function shortDate(str) {
  if (!str) return ''
  const m = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','nov','dec']
  const [,mo,d] = str.split('-')
  return `${parseInt(d)} ${m[parseInt(mo)-1]}`
}

// ── FormaChart ─────────────────────────────────────────────────────────────────
export default function FormaChart({
  data = [],          // array de valori numerice (null = lipsă)
  labels = [],        // array de string-uri (date sau etichete)
  color,              // culoare linie + gradient
  c,                  // tema FORMA
  height = 120,       // înălțimea graficului în px
  type = 'line',      // 'line' | 'bar' | 'area'
  unit = '',          // unit afișat în tooltip
  label = '',         // titlu grafic (opțional)
  showDots = false,   // puncte pe linie
  showMA = false,     // medie mobilă 7 zile
  showGrid = true,    // linii orizontale de ghidaj
  animate = true,     // animație la montare
  formatValue,        // funcție custom format tooltip
  todayMarker = false,// marchează ultima valoare ca "azi"
  target,             // linie target orizontală
  style = {},
}) {
  const [tooltip, setTooltip] = useState(null)
  const svgRef  = useRef(null)
  const uid     = useRef(Math.random().toString(36).slice(2))

  const clr = color || c?.green || '#97C459'

  // Filtrăm null-urile pentru calcule
  const validData = data.map((v, i) => ({ v, i })).filter(d => d.v != null)
  const minVal = validData.length ? Math.min(...validData.map(d => d.v)) : 0
  const maxVal = validData.length ? Math.max(...validData.map(d => d.v)) : 1
  const range  = maxVal - minVal || 1
  const padMin = minVal - range * 0.1
  const padMax = maxVal + range * 0.1

  const W = 600  // viewBox width (scalat de SVG)
  const H = height
  const PL = 4, PR = 4, PT = 8, PB = 24

  // Medie mobilă 7 zile
  const maData = useMemo(() => {
    if (!showMA) return []
    const win = 7
    return data.map((_, i) => {
      const slice = data.slice(Math.max(0, i-win+1), i+1).filter(v => v != null)
      return slice.length >= 2 ? slice.reduce((a, b) => a + b, 0) / slice.length : null
    })
  }, [data, showMA])

  function toX(i) { return PL + (i / (data.length - 1 || 1)) * (W - PL - PR) }
  function toY(v) { return PT + (1 - (v - padMin) / (padMax - padMin)) * (H - PT - PB) }

  // Puncte SVG
  const pts    = data.map((v, i) => v != null ? { x: toX(i), y: toY(v) } : null)
  const maPts  = maData.map((v, i) => v != null ? { x: toX(i), y: toY(v) } : null)
  const validPts   = pts.filter(Boolean)
  const validMaPts = maPts.filter(Boolean)

  // Grid lines
  const gridVals = useMemo(() => {
    if (!showGrid) return []
    const steps = 3
    return Array.from({ length: steps + 1 }, (_, i) => padMin + (padMax - padMin) * (i / steps))
  }, [padMin, padMax, showGrid])

  // Tooltip handler — unificat pentru mouse și touch
  function handlePointer(clientX) {
    if (!svgRef.current || !validData.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (clientX - rect.left) / rect.width * W
    const closest = data.reduce((best, v, i) => {
      if (v == null) return best
      const d = Math.abs(toX(i) - relX)
      return d < best.dist ? { i, d } : best
    }, { i: -1, dist: Infinity })
    if (closest.i >= 0) {
      setTooltip({ i: closest.i, x: toX(closest.i), y: toY(data[closest.i]) })
    }
  }

  const fmt = formatValue || ((v) => `${Math.round(v * 10) / 10}${unit}`)

  const areaPath = validPts.length > 1
    ? `${buildSpline(validPts)} L${validPts[validPts.length-1].x},${H-PB} L${validPts[0].x},${H-PB} Z`
    : ''
  const linePath = validPts.length > 1 ? buildSpline(validPts) : ''
  const maPath   = validMaPts.length > 1 ? buildSpline(validMaPts) : ''

  const barW = Math.max(2, (W - PL - PR) / (data.length * 1.4))

  if (!data.length) return null

  return (
    <div style={{ position: 'relative', ...style }}>
      {label && <div style={{ fontSize: 11, color: c.text4, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%" height={H}
        style={{ overflow: 'visible', display: 'block' }}
        onMouseMove={e => handlePointer(e.clientX)}
        onMouseLeave={() => setTooltip(null)}
        onTouchStart={e => { e.preventDefault(); handlePointer(e.touches[0].clientX) }}
        onTouchMove={e => { e.preventDefault(); handlePointer(e.touches[0].clientX) }}
        onTouchEnd={() => setTimeout(() => setTooltip(null), 1200)}
      >
        <defs>
          <linearGradient id={`fg-${uid.current}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={clr} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={clr} stopOpacity="0.01"/>
          </linearGradient>
          {animate && (
            <style>{`@keyframes fc-draw-${uid.current}{from{stroke-dashoffset:3000}to{stroke-dashoffset:0}}`}</style>
          )}
        </defs>

        {/* Grid */}
        {showGrid && gridVals.map((gv, gi) => (
          <g key={gi}>
            <line x1={PL} x2={W-PR} y1={toY(gv)} y2={toY(gv)} stroke={c?.border2 || '#2A2D38'} strokeWidth="0.5" strokeDasharray="3 4"/>
            <text x={PL} y={toY(gv) - 3} fontSize="9" fill={c?.text4 || '#4A4E5A'} textAnchor="start">
              {Math.round(gv * 10) / 10}
            </text>
          </g>
        ))}

        {/* Target line */}
        {target != null && (
          <line x1={PL} x2={W-PR} y1={toY(target)} y2={toY(target)}
            stroke={clr} strokeWidth="1" strokeDasharray="6 4" opacity="0.5"/>
        )}

        {/* BAR type */}
        {type === 'bar' && data.map((v, i) => v != null ? (
          <rect key={i} x={toX(i) - barW/2} y={toY(v)} width={barW} height={H - PB - toY(v)}
            rx="2" fill={clr} opacity={tooltip?.i === i ? 1 : 0.7}/>
        ) : null)}

        {/* AREA */}
        {type !== 'bar' && areaPath && (
          <path d={areaPath} fill={`url(#fg-${uid.current})`}/>
        )}

        {/* LINE */}
        {type !== 'bar' && linePath && (
          <path d={linePath} fill="none" stroke={clr} strokeWidth="2" strokeLinecap="round"
            style={animate ? { strokeDasharray: 3000, animation: `fc-draw-${uid.current} 1.2s ease-out forwards` } : {}}
          />
        )}

        {/* Moving average */}
        {maPath && (
          <path d={maPath} fill="none" stroke={clr} strokeWidth="1" strokeDasharray="4 3" opacity="0.6"/>
        )}

        {/* Dots */}
        {showDots && validPts.map((pt, i) => pt && (
          <circle key={i} cx={pt.x} cy={pt.y} r="3" fill={clr} stroke={c?.card || '#16181F'} strokeWidth="1.5"/>
        ))}

        {/* Today marker */}
        {todayMarker && validPts.length > 0 && (() => {
          const last = validPts[validPts.length - 1]
          return <circle cx={last.x} cy={last.y} r="5" fill={clr} stroke={c?.card || '#16181F'} strokeWidth="2"/>
        })()}

        {/* Labels X */}
        {labels.length > 0 && (() => {
          const step = Math.max(1, Math.floor(data.length / 5))
          return data.map((_, i) => i % step === 0 ? (
            <text key={i} x={toX(i)} y={H - 4} fontSize="9" fill={c?.text4 || '#4A4E5A'} textAnchor="middle">
              {shortDate(labels[i]) || labels[i]}
            </text>
          ) : null)
        })()}

        {/* Tooltip vertical line */}
        {tooltip && (
          <>
            <line x1={tooltip.x} x2={tooltip.x} y1={PT} y2={H-PB}
              stroke={clr} strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>
            <circle cx={tooltip.x} cy={tooltip.y} r="5" fill={clr} stroke={c?.card || '#16181F'} strokeWidth="2"/>
          </>
        )}
      </svg>

      {/* Tooltip box */}
      {tooltip && data[tooltip.i] != null && (
        <div style={{
          position: 'absolute',
          left: `${(tooltip.x / W) * 100}%`,
          top: 0,
          transform: (tooltip.x / W) > 0.7 ? 'translate(-110%, 0)' : 'translate(8px, 0)',
          background: c?.card3 || '#1E2028',
          border: `0.5px solid ${c?.border || '#2A2D38'}`,
          borderRadius: 8, padding: '5px 10px',
          fontSize: 12, color: c?.text || '#E8E8E4',
          pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, color: clr }}>{fmt(data[tooltip.i])}</div>
          {labels[tooltip.i] && <div style={{ fontSize: 10, color: c?.text4, marginTop: 2 }}>{shortDate(labels[tooltip.i]) || labels[tooltip.i]}</div>}
        </div>
      )}
    </div>
  )
}
