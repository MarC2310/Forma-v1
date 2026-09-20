// src/components/RecoveryDetailModal.jsx
import { useState, useEffect } from 'react'

function scoreColor(score, c) {
  if (!c) return '#888'
  if (!score) return c.text4
  if (score >= 80) return c.green
  if (score >= 60) return c.orange
  return c.red
}

function getLabel(s) {
  if (s >= 80) return 'Excelent'
  if (s >= 65) return 'Bun'
  if (s >= 45) return 'Moderat'
  return 'Obosit'
}
function getMsg(s) {
  if (s >= 80) return 'Corpul tau e odihnit. Zi perfecta pentru antrenament intens.'
  if (s >= 65) return 'Conditie buna. Antrenament moderat sau intensitate medie.'
  if (s >= 45) return 'Corpul tau e putin obosit. Miscare usoara recomandata.'
  return 'Ai nevoie de odihna. Pauza activa = progres real.'
}
function getReco(s) {
  if (s >= 80) return { text: 'Antrenament intens recomandat', icon: '🏋️' }
  if (s >= 65) return { text: 'Antrenament moderat recomandat', icon: '🚴' }
  if (s >= 45) return { text: 'Recuperare activa sau cardio usor', icon: '🚶' }
  return { text: 'Odihna recomandata astazi', icon: '🛌' }
}

function AnimatedRing({ score, c }) {
  const circumference = 283  // 2 * PI * 45
  const targetOffset = circumference * (1 - score / 100)
  const [displayScore, setDisplayScore] = useState(0)
  const [displayOffset, setDisplayOffset] = useState(circumference)

  useEffect(() => {
    let start = null
    const duration = 1600
    function frame(ts) {
      if (!start) start = ts
      const t = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 4)
      setDisplayScore(Math.round(ease * score))
      setDisplayOffset(circumference - ease * (circumference - targetOffset))
      if (t < 1) requestAnimationFrame(frame)
    }
    const id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [score])

  const color = scoreColor(score, c)

  return (
    <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <defs>
          <linearGradient id="recovGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.55"/>
          </linearGradient>
          <filter id="recovGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="65" cy="65" r="45" fill="none" stroke={c.card2} strokeWidth="10"/>
        <circle cx="65" cy="65" r="45" fill="none"
          stroke="url(#recovGrad)" strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={displayOffset}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          filter="url(#recovGlow)"
          style={{ transition: 'stroke-dashoffset 0.05s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: c.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {displayScore}
        </div>
        <div style={{ fontSize: 11, color: c.text4, marginTop: 3 }}>{'/100'}</div>
      </div>
    </div>
  )
}

export default function RecoveryDetailModal({ isOpen, onClose, readiness, lastWorkout, c }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const muscleScore = readiness.scores.recovery ?? 70
  const sleepScore  = readiness.scores.sleep    ?? 65
  const hrvScore    = readiness.scores.hrv      ?? 65

  const mainColor = scoreColor(muscleScore, c)
  const reco = getReco(muscleScore)

  const bars = [
    { label: 'HRV', icon: '💜', value: hrvScore,    color: '#7c6bf5' },
    { label: 'Somn', icon: '😴', value: sleepScore,  color: '#4a9eff' },
    { label: 'Muschi', icon: '💪', value: muscleScore, color: mainColor },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: c.bg, borderRadius: 20, padding: '1.5rem',
          maxWidth: 380, width: '100%',
          border: `0.5px solid ${c.border2}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {'Recuperare musculara'}
            </div>
            <div style={{ fontSize: 12, color: c.text4, marginTop: 2 }}>
              {'Contextul complet: HRV · Somn · Muschi'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text3, fontSize: 22, lineHeight: 1, padding: '0 4px' }}
          >
            {'×'}
          </button>
        </div>

        {/* Ring centrat */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <AnimatedRing score={muscleScore} c={c} />
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: mainColor }}>{getLabel(muscleScore)}</div>
            <div style={{ fontSize: 12, color: c.text3, marginTop: 4, lineHeight: 1.5 }}>{getMsg(muscleScore)}</div>
          </div>
        </div>

        {/* Bare componente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {bars.map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{b.icon}</span>
              <div style={{ fontSize: 11, color: c.text3, width: 56, flexShrink: 0 }}>{b.label}</div>
              <div style={{ flex: 1, height: 5, background: c.card2, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: (b.value != null ? b.value : 0) + '%',
                  background: b.color,
                  borderRadius: 10,
                  transition: 'width 1s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: c.text4, width: 32, textAlign: 'right', flexShrink: 0 }}>
                {b.value != null ? b.value : '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Chip recomandare */}
        <div style={{
          background: c.card2, borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          border: `0.5px solid ${mainColor}44`,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{reco.icon}</span>
          <div style={{ fontSize: 13, color: c.text3 }}>{reco.text}</div>
        </div>

        {/* Context ultimul antrenament */}
        {lastWorkout && (
          <div style={{ marginTop: 12, fontSize: 11, color: c.text4, textAlign: 'center' }}>
            {'Ultimul antrenament: '}{lastWorkout.title}{' · '}{lastWorkout.hours_ago}{'h in urma'}
          </div>
        )}
      </div>
    </div>
  )
}
