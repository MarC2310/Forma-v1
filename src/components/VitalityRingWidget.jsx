// src/components/VitalityRingWidget.jsx
// Ring animat cu gradient conic roșu→portocaliu→verde
// Segment-by-segment rendering — rezoluție maximă retina, fără createConicGradient
import { useRef, useEffect } from 'react'

const CX = 72, CY = 72, R = 58, LW = 13
const START_ANG = -Math.PI / 2
const SEGS = 240   // segmente fine → gradient ultra-smooth

function lerpColor(a, b, t) {
  const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
  const [ar, ag, ab] = p(a)
  const [br, bg, bb] = p(b)
  return '#' + [ar+(br-ar)*t, ag+(bg-ag)*t, ab+(bb-ab)*t]
    .map(v => Math.round(v).toString(16).padStart(2,'0')).join('')
}

// Culoare interpolată de-a lungul gradientului (t ∈ [0,1])
function gradColor(t) {
  if (t <= 0.30) return lerpColor('#E24B4A', '#F97316', t / 0.30)
  if (t <= 0.60) return lerpColor('#F97316', '#EF9F27', (t - 0.30) / 0.30)
  return lerpColor('#EF9F27', '#5AAD1E', (t - 0.60) / 0.40)
}

function drawRing(canvas, pct, isDark) {
  if (!canvas) return

  // Rezoluție nativă ecran (retina = 2x, ProMotion = 3x)
  const dpr  = Math.min(window.devicePixelRatio || 1, 3)
  const SIZE = 144
  canvas.width  = SIZE * dpr
  canvas.height = SIZE * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, SIZE, SIZE)

  // ── Track ──────────────────────────────────────────────────────────────────
  ctx.beginPath()
  ctx.arc(CX, CY, R, 0, 2 * Math.PI)
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.09)'
  ctx.lineWidth   = LW
  ctx.lineCap     = 'butt'
  ctx.stroke()

  if (pct < 0.3) return

  const endAng = START_ANG + 2 * Math.PI * Math.min(pct, 100) / 100
  const span   = endAng - START_ANG

  // ── Arc segment-cu-segment → gradient perfect fără API conic ──────────────
  ctx.lineWidth = LW
  ctx.lineCap   = 'butt'
  for (let i = 0; i < SEGS; i++) {
    const a0 = START_ANG + span * i       / SEGS
    const a1 = START_ANG + span * (i + 1) / SEGS
    const t  = (pct / 100) * (i + 0.5)   / SEGS   // pozitia in gradient 0→pct/100
    ctx.beginPath()
    ctx.arc(CX, CY, R, a0, a1)
    ctx.strokeStyle = gradColor(t)
    ctx.stroke()
  }

  // ── Cap START — solid roșu (#E24B4A) ──────────────────────────────────────
  ctx.beginPath()
  ctx.arc(
    CX + R * Math.cos(START_ANG),
    CY + R * Math.sin(START_ANG),
    LW / 2, 0, 2 * Math.PI
  )
  ctx.fillStyle = '#E24B4A'
  ctx.fill()

  // ── Cap END — culoarea gradientului la scorul curent ──────────────────────
  ctx.beginPath()
  ctx.arc(
    CX + R * Math.cos(endAng),
    CY + R * Math.sin(endAng),
    LW / 2, 0, 2 * Math.PI
  )
  ctx.fillStyle = gradColor(pct / 100)
  ctx.fill()
}

export default function VitalityRingWidget({ score = 0, isDark = false }) {
  const canvasRef    = useRef(null)
  const animRef      = useRef(null)
  const displayedRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (animRef.current) cancelAnimationFrame(animRef.current)
    const from   = displayedRef.current
    const target = score
    const t0     = performance.now()
    const dur    = Math.max(900, 400 + Math.abs(target - from) * 10)

    function step(ts) {
      const p   = Math.min((ts - t0) / dur, 1)
      const e   = 1 - Math.pow(1 - p, 3)           // ease-out cubic
      const cur = from + (target - from) * e
      drawRing(canvas, Math.max(0, cur), isDark)
      if (p < 1) {
        animRef.current = requestAnimationFrame(step)
      } else {
        displayedRef.current = target
      }
    }

    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score, isDark])

  const mainColor = score >= 70 ? '#3B6D11' : score >= 50 ? '#BA7517' : '#A32D2D'

  return (
    <div style={{ position: 'relative', width: 144, height: 144, flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ width: 144, height: 144, display: 'block' }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 2, pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 42, fontWeight: 900,
          color: mainColor,
          letterSpacing: '-0.03em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {score || '—'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(150,150,150,0.7)', letterSpacing: '0.1em', fontWeight: 600 }}>
          / 100
        </span>
      </div>
    </div>
  )
}
