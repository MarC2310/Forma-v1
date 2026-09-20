// src/components/PMCChart.jsx — Performance Management Chart (model Banister)
// Afișează CTL + ATL suprapuse (aceeași scală) și TSB ca bare verzi/roșii pe axă secundară.
// Suportă mod fullscreen (landscape forțat pe mobil prin rotație CSS) pentru analiză detaliată.

import { useState, useRef, useEffect } from 'react'

function buildSplinePath(points) {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
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
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1] || ''}`
}

// ── Corpul efectiv al graficului — reutilizat atât în card normal cât și fullscreen ──
function PMCChartInner({ history, c, height, w = 100 }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)

  const ctlValues = history.map(d => d.ctl)
  const atlValues = history.map(d => d.atl)
  const tsbValues = history.map(d => d.tsb)

  const lineMax = Math.max(...ctlValues, ...atlValues, 10)
  const lineMin = 0
  const tsbAbsMax = Math.max(...tsbValues.map(Math.abs), 10)

  const padY = 6
  const lineAreaH = height * 0.62
  const tsbAreaH = height * 0.30
  const gapH = height * 0.08
  const tsbTop = lineAreaH + gapH

  const n = history.length
  const stepX = n > 1 ? w / (n - 1) : w

  function yForLine(v) {
    return padY + (lineAreaH - padY) * (1 - (v - lineMin) / (lineMax - lineMin))
  }
  function yForTsb(v) {
    const mid = tsbTop + tsbAreaH / 2
    return mid - (v / tsbAbsMax) * (tsbAreaH / 2)
  }

  const ctlPoints = history.map((d, i) => ({ x: i * stepX, y: yForLine(d.ctl) }))
  const atlPoints = history.map((d, i) => ({ x: i * stepX, y: yForLine(d.atl) }))

  const ctlPath = buildSplinePath(ctlPoints)
  const atlPath = buildSplinePath(atlPoints)
  const ctlAreaPath = `${ctlPath} L ${ctlPoints[ctlPoints.length-1].x} ${lineAreaH} L ${ctlPoints[0].x} ${lineAreaH} Z`

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayIdx = history.findIndex(d => d.date === todayStr)
  const todayX = todayIdx >= 0 ? todayIdx * stepX : null

  function handleMove(clientX) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * w
    let closest = 0, closestDist = Infinity
    history.forEach((_, i) => {
      const dist = Math.abs(i * stepX - relX)
      if (dist < closestDist) { closestDist = dist; closest = i }
    })
    setHoverIdx(closest)
  }

  const hoverData = hoverIdx != null ? history[hoverIdx] : null
  const hoverX = hoverIdx != null ? hoverIdx * stepX : null
  const barW = Math.max(0.6, (w / n) * 0.55)
  const gradId = `ctlGrad-${height}`

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
              <stop offset="0%" stopColor={c.green} stopOpacity="0.30"/>
              <stop offset="100%" stopColor={c.green} stopOpacity="0"/>
            </linearGradient>
          </defs>

          <line x1={0} y1={tsbTop + tsbAreaH/2} x2={w} y2={tsbTop + tsbAreaH/2} stroke={c.text4} strokeWidth="0.5" opacity="0.4" vectorEffect="non-scaling-stroke"/>

          {todayX != null && (
            <line x1={todayX} y1={0} x2={todayX} y2={tsbTop + tsbAreaH} stroke={c.text4} strokeWidth="1" strokeDasharray="2,2" opacity="0.5" vectorEffect="non-scaling-stroke"/>
          )}

          {history.map((d, i) => {
            const x = i * stepX
            const yZero = tsbTop + tsbAreaH / 2
            const yVal = yForTsb(d.tsb)
            const barH = Math.abs(yVal - yZero)
            const barY = d.tsb >= 0 ? yVal : yZero
            return (
              <rect key={i} x={x - barW/2} y={barY} width={barW} height={Math.max(0.3, barH)}
                fill={d.tsb >= 0 ? c.green : c.red} opacity={hoverIdx === i ? 0.95 : 0.55} rx="0.5"/>
            )
          })}

          <path d={ctlAreaPath} fill={`url(#${gradId})`} stroke="none"/>

          {hoverX != null && (
            <line x1={hoverX} y1={0} x2={hoverX} y2={lineAreaH} stroke={c.text3} strokeWidth="1" opacity="0.4" vectorEffect="non-scaling-stroke"/>
          )}

          <path d={atlPath} fill="none" stroke={c.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" strokeDasharray="3,2"/>
          <path d={ctlPath} fill="none" stroke={c.green} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>

          {hoverIdx != null && (
            <>
              <circle cx={ctlPoints[hoverIdx].x} cy={ctlPoints[hoverIdx].y} r={3} fill={c.green} stroke={c.bg} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
              <circle cx={atlPoints[hoverIdx].x} cy={atlPoints[hoverIdx].y} r={3} fill={c.orange} stroke={c.bg} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
            </>
          )}
        </svg>

        {hoverData && (
          <div style={{
            position: 'absolute', left: `${hoverX}%`, top: 0,
            transform: `translate(${hoverX < 15 ? '0%' : hoverX > 85 ? '-100%' : '-50%'}, -100%)`,
            background: c.card3, color: c.text, fontSize: 11, fontWeight: 600,
            padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap', boxShadow: c.shadowCard,
            pointerEvents: 'none', zIndex: 2, marginTop: -6, lineHeight: 1.5,
          }}>
            <div style={{ fontSize: 10, color: c.text4, marginBottom: 2 }}>{formatDateShort(hoverData.date)}</div>
            <div style={{ color: c.green }}>CTL {Math.round(hoverData.ctl)}</div>
            <div style={{ color: c.orange }}>ATL {Math.round(hoverData.atl)}</div>
            <div style={{ color: hoverData.tsb >= 0 ? c.green : c.red }}>TSB {hoverData.tsb > 0 ? '+' : ''}{Math.round(hoverData.tsb)}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10, color: c.text4, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: c.green, display: 'inline-block', borderRadius: 1 }}/> CTL (fitness)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 2, background: c.orange, display: 'inline-block', borderRadius: 1, opacity: 0.8 }}/> ATL (oboseală)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: c.green, display: 'inline-block', borderRadius: 2, opacity: 0.6 }}/> TSB +/− (formă)</span>
      </div>
    </div>
  )
}

// ── Detectare mobil — pentru a decide dacă forțăm rotație CSS landscape ──
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

export default function PMCChart({ history, c, height = 140 }) {
  if (!c) return null
  const [fullscreen, setFullscreen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!fullscreen) return
    function onKey(e) { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [fullscreen])

  if (!history || history.length < 3) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: c.text4 }}>Date insuficiente</div>
  }

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button onClick={() => setFullscreen(true)}
          style={{ position: 'absolute', top: -38, right: 0, fontSize: 11, padding: '5px 10px', background: c.card2, border: 'none', borderRadius: 8, color: c.text3, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, zIndex: 1 }}>
          ⛶ Extinde
        </button>
        <PMCChartInner history={history} c={c} height={height}/>
      </div>

      {fullscreen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setFullscreen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: c.bg,
              borderRadius: isMobile ? 0 : 20,
              padding: '1.5rem',
              boxShadow: c.shadowHero,
              // Pe mobil: rotim conținutul 90° și inversăm dimensiunile, simulând landscape
              ...(isMobile ? {
                width: '100vh',
                height: '100vw',
                transform: 'rotate(90deg)',
                position: 'fixed',
                top: '50%', left: '50%',
                marginTop: '-50vw', marginLeft: '-50vh',
              } : {
                width: '85vw',
                maxWidth: 900,
              }),
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fitness-Oboseală (Banister)</div>
              <button onClick={() => setFullscreen(false)}
                style={{ fontSize: 13, padding: '6px 14px', background: c.card2, border: 'none', borderRadius: 8, color: c.text3, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ Închide
              </button>
            </div>
            <PMCChartInner history={history} c={c} height={isMobile ? window.innerWidth * 0.45 : 320}/>
          </div>
        </div>
      )}
    </>
  )
}
