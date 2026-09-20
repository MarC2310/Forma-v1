// src/components/AchievementToast.jsx
// Card vizual care apare când userul atinge un target de fitness
// Folosit din Dashboard.jsx via state: achievement / setAchievement

import { useEffect, useState } from 'react'

const DURATION = 5000 // ms cât rămâne vizibil

export default function AchievementToast({ achievement, onClose }) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!achievement) return

    setVisible(true)
    setProgress(100)

    // Animăm bara de progres
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100)
      setProgress(remaining)
      if (remaining === 0) clearInterval(interval)
    }, 50)

    // Auto-close
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300) // așteptăm animația de ieșire
    }, DURATION)

    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [achievement])

  if (!achievement) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '120px'})`,
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: 9999,
        width: 'min(340px, calc(100vw - 32px))',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Glow background bazat pe tip */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: achievement.type === 'pasi'
              ? 'radial-gradient(ellipse at top left, rgba(59,130,246,0.15) 0%, transparent 70%)'
              : 'radial-gradient(ellipse at top left, rgba(249,115,22,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: '44px', height: '44px',
              borderRadius: '12px',
              background: achievement.type === 'pasi'
                ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                : 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
              boxShadow: achievement.type === 'pasi'
                ? '0 4px 15px rgba(59,130,246,0.4)'
                : '0 4px 15px rgba(249,115,22,0.4)',
            }}
          >
            {achievement.type === 'pasi' ? '🚶' : '🔥'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '15px',
              lineHeight: '1.2',
              marginBottom: '2px',
            }}>
              {achievement.title}
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              lineHeight: '1.3',
            }}>
              {achievement.body}
            </div>
          </div>

          {/* Buton închide */}
          <button
            onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '8px',
              width: '28px', height: '28px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            ✕
          </button>
        </div>

        {/* Badge target atins */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: achievement.type === 'pasi'
            ? 'rgba(59,130,246,0.2)'
            : 'rgba(249,115,22,0.2)',
          borderRadius: '6px',
          padding: '3px 8px',
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '11px' }}>🎯</span>
          <span style={{
            color: achievement.type === 'pasi' ? '#93c5fd' : '#fdba74',
            fontSize: '12px',
            fontWeight: '600',
          }}>
            Target atins!
          </span>
        </div>

        {/* Progress bar auto-close */}
        <div style={{
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: achievement.type === 'pasi'
              ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
              : 'linear-gradient(90deg, #f97316, #fb923c)',
            borderRadius: '2px',
            transition: 'width 0.05s linear',
          }} />
        </div>
      </div>
    </div>
  )
}
