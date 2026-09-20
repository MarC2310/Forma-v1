// src/components/ShareCard.jsx — Partajare raport zilnic ca imagine
import { useState, useRef } from 'react'
import { useTheme, getColors } from '../lib/theme.jsx'

export default function ShareCard({ readiness, sleep, steps, hrv, body, userName }) {
  const { theme } = useTheme()
  const c = getColors(theme)
  const cardRef = useRef(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const today = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const score = readiness?.score || 0
  const scoreColor = score >= 80 ? '#97C459' : score >= 60 ? '#F0A830' : '#E24B4A'
  const label = score >= 82 ? 'Zi excelentă' : score >= 65 ? 'Antrenament moderat' : score >= 48 ? 'Antrenament ușor' : 'Zi de odihnă'

  async function captureAndShare() {
    setSharing(true)
    try {
      // Folosim html2canvas dacă e disponibil, altfel text sharing
      if (window.html2canvas) {
        const canvas = await window.html2canvas(cardRef.current, {
          backgroundColor: '#0F1117',
          scale: 2,
          useCORS: true,
          logging: false,
        })
        canvas.toBlob(async blob => {
          const file = new File([blob], `forma-${new Date().toISOString().slice(0,10)}.png`, { type: 'image/png' })
          if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'FORMA — Scor Readiness', text: `Scorul meu de readiness azi: ${score}/100` })
          } else {
            // Fallback: download
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = file.name; a.click()
            URL.revokeObjectURL(url)
          }
        }, 'image/png')
      } else {
        // Fallback text share
        const text = generateTextReport()
        if (navigator.share) {
          await navigator.share({ title: 'FORMA — Scor Readiness', text })
        } else {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }
      }
    } catch (err) {
      console.warn('Share failed:', err)
    } finally {
      setSharing(false)
    }
  }

  function generateTextReport() {
    return `📊 FORMA — Readiness ${today}

🎯 Scor: ${score}/100 — ${label}

😴 Somn: ${sleep?.total_h ? sleep.total_h.toFixed(1) + 'h' : '—'} ${sleep?.score ? `(${sleep.score}/100)` : ''}
❤️ HRV: ${hrv || '—'} ms
🏃 Pași: ${steps ? steps.toLocaleString() : '—'}
⚖️ Greutate: ${body?.weight_kg ? body.weight_kg + 'kg' : '—'}

Generat cu FORMA · Daily Readiness Intelligence
https://project-4e2e1.vercel.app`
  }

  return (
    <div>
      {/* Card vizual pentru captură */}
      <div ref={cardRef} style={{
        background: 'linear-gradient(135deg, #0F1117 0%, #1A2010 100%)',
        border: '0.5px solid #2A2D38',
        borderRadius: 20,
        padding: '1.5rem',
        marginBottom: '1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.15em', color: '#C0DD97' }}>FORMA</div>
            <div style={{ fontSize: 10, color: '#639922', letterSpacing: '0.06em' }}>Daily Readiness Intelligence</div>
          </div>
          <div style={{ fontSize: 11, color: '#4A4E5A' }}>{today}</div>
        </div>

        {/* Score ring + info */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          {/* Ring SVG */}
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <svg width="100" height="100" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#1A3A0A" strokeWidth="10"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor} strokeWidth="10"
                strokeDasharray="314" strokeDashoffset={314 * (1 - score/100)}
                strokeLinecap="round" transform="rotate(-90 60 60)"/>
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 9, color: '#4A4E5A' }}>/100</div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E8E8E4', marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                ['😴', 'Somn', sleep?.total_h ? sleep.total_h.toFixed(1) + 'h' : '—', readiness?.scores?.sleep],
                ['❤️', 'HRV', hrv ? hrv + ' ms' : '—', readiness?.scores?.hrv],
                ['💪', 'Recuperare', readiness?.scores?.recovery ? readiness.scores.recovery + '/100' : '—', readiness?.scores?.recovery],
                ['🥗', 'Nutriție', readiness?.scores?.nutrition ? readiness.scores.nutrition + '/100' : '—', readiness?.scores?.nutrition],
              ].map(([icon, label, val, sc]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9A9EA8' }}>
                  <span>{icon}</span>
                  <span style={{ width: 70 }}>{label}</span>
                  <span style={{ color: '#E8E8E4', fontWeight: 500 }}>{val}</span>
                  {sc && <span style={{ fontSize: 10, color: sc >= 70 ? '#97C459' : sc >= 50 ? '#F0A830' : '#E24B4A', marginLeft: 4 }}>{sc}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metrici extra */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: '1rem' }}>
          {[
            ['🏃', 'Pași', steps ? steps.toLocaleString() : '—'],
            ['⚖️', 'Greutate', body?.weight_kg ? body.weight_kg + ' kg' : '—'],
            ['🌊', 'PWV', body?.pwv ? body.pwv + ' m/s' : '—'],
          ].map(([icon, label, val]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E8E4' }}>{val}</div>
              <div style={{ fontSize: 10, color: '#4A4E5A' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '0.5px solid #1E2028', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: '#2A3A1A' }}>FORMA · project-4e2e1.vercel.app</div>
          <div style={{ fontSize: 10, color: '#4A4E5A' }}>
            {new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Buton share */}
      <button onClick={captureAndShare} disabled={sharing}
        style={{ width: '100%', padding: '11px', background: sharing ? c.card2 : c.green2, border: 'none', borderRadius: 10, color: sharing ? c.green : '#fff', fontSize: 13, fontWeight: 600, cursor: sharing ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {sharing ? '⏳ Se pregătește...' : copied ? '✓ Copiat în clipboard!' : '↗ Partajează scorul de azi'}
      </button>

      {/* Load html2canvas dinamic */}
      <script
        src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        onLoad={() => console.log('[ShareCard] html2canvas loaded')}
      />
    </div>
  )
}
