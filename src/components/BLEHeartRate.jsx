// src/components/BLEHeartRate.jsx
import { useEffect, useRef, useState } from 'react'
import { useBLEHeartRate } from '../hooks/useBLEHeartRate'
import { translate } from '../lib/i18n'

export default function BLEHeartRateWidget({ c, isMobile }) {
  const {
    status, deviceName, hr, battery,
    hrHistory, hrLive, lastSync, error,
    autoConnecting, connect, disconnect,
  } = useBLEHeartRate()

  const isConnected  = status === 'connected'
  const isConnecting = status === 'connecting'

  function hrZone(bpm) {
    if (!bpm) return { label: '—', color: c.text4 }
    if (bpm < 60)  return { label: 'Repaus',  color: '#4FC3F7' }
    if (bpm < 100) return { label: 'Ușor',    color: '#81C784' }
    if (bpm < 140) return { label: 'Moderat', color: '#FFD54F' }
    if (bpm < 170) return { label: 'Intens',  color: '#FF8A65' }
    return               { label: 'Max',      color: '#EF5350' }
  }
  const zone = hrZone(hr)

  // ── Anunțuri vocale la schimbarea zonei de puls ──────────────────────
  const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem('forma_hr_voice') === 'true' } catch (_) { return false }
  })
  const prevZoneRef = useRef(null)
  const lastSpeakRef = useRef(0)

  function speak(text) {
    if (!voiceSupported) return
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ro-RO'
      const voices = window.speechSynthesis.getVoices() || []
      const ro = voices.find(v => /ro(-|_)?RO/i.test(v.lang) || /roman/i.test(v.name))
      if (ro) u.voice = ro
      u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch (_) {}
  }

  // Mesaj de coaching per zonă
  function zoneCue(label, bpm) {
    switch (label) {
      case 'Repaus':  return `Zona Repaus, ${bpm}. Recuperare.`
      case 'Ușor':    return `Zona Ușor, ${bpm}. Încălzire bună.`
      case 'Moderat': return `Zona Moderat, ${bpm}. Menține ritmul.`
      case 'Intens':  return `Zona Intens, ${bpm}. Împinge puțin.`
      case 'Max':     return `Zona Maximă, ${bpm}. Reduce puțin.`
      default:        return `${label}, ${bpm}`
    }
  }

  function toggleVoice() {
    const next = !voiceOn
    setVoiceOn(next)
    try { localStorage.setItem('forma_hr_voice', String(next)) } catch (_) {}
    // Deblochează audio pe mobil printr-un enunț scurt la activare
    if (next) speak('Anunțuri vocale activate')
  }

  useEffect(() => {
    if (!voiceOn || !isConnected || !hr) return
    const label = zone.label
    if (label === '—') return
    const prev = prevZoneRef.current
    if (prev === null) { prevZoneRef.current = label; return } // prima citire — doar memorăm
    if (label !== prev) {
      const now = Date.now()
      if (now - lastSpeakRef.current > 2500) {  // cooldown anti-oscilație
        speak(zoneCue(label, hr))
        lastSpeakRef.current = now
      }
      prevZoneRef.current = label
    }
  }, [hr, voiceOn, isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resetăm zona memorată când ne deconectăm
  useEffect(() => { if (!isConnected) prevZoneRef.current = null }, [isConnected])

  // Când suntem conectați și avem date live → folosim live buffer
  // Altfel → folosim istoricul zilei din localStorage
  const useLive = isConnected && hrLive.length > 1

  // Pregătim punctele pentru sparkline
  const sparkPts = useLive
    ? (() => {
        const t0 = hrLive[0].ts
        const t1 = hrLive[hrLive.length - 1].ts
        const span = Math.max(1, t1 - t0)
        return hrLive.map(d => ({ x: (d.ts - t0) / span, hr: d.hr }))
      })()
    : (() => {
        const sorted = [...hrHistory].sort((a, b) => a.hour - b.hour)
        return sorted.map(d => ({ x: d.hour / 24, hr: d.hr }))
      })()

  const allHR  = sparkPts.map(d => d.hr)
  const maxHR  = allHR.length > 0 ? Math.max(...allHR) : 180
  const minHR  = allHR.length > 0 ? Math.min(...allHR) : 40
  const rangeHR = Math.max(10, maxHR - minHR)

  // Pentru afișarea numărului de citiri în zona live
  const todayCount = [...hrHistory].length

  // Durata sesiunii live
  function liveDuration() {
    if (hrLive.length < 2) return ''
    const ms = hrLive[hrLive.length - 1].ts - hrLive[0].ts
    const m = Math.round(ms / 60000)
    return m >= 60 ? `${Math.floor(m/60)}h ${m%60}min` : `${m} min`
  }

  return (
    <div style={{ background: c.card, border: '0.5px solid ' + (isConnected ? '#81C78444' : c.border), borderRadius: 14, padding: '1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            📡 BLE Heart Rate
          </div>
          {deviceName && (
            <div style={{ fontSize: 10, color: c.text4, marginTop: 2 }}>
              {deviceName}{battery != null ? ' · 🔋' + battery + '%' : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Buton anunțuri vocale la schimbarea zonei */}
          {voiceSupported && (
            <button onClick={toggleVoice}
              title={voiceOn ? 'Anunțuri vocale: PORNIT (apasă pentru oprire)' : 'Anunțuri vocale la schimbarea zonei: OPRIT'}
              style={{
                width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontFamily: 'inherit',
                border: voiceOn ? '1px solid #81C784' : `1px solid ${c.border}`,
                background: voiceOn ? 'rgba(129,199,132,0.15)' : 'transparent',
                color: voiceOn ? '#81C784' : c.text4, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {voiceOn ? '🔊' : '🔇'}
            </button>
          )}
          {(isConnecting || autoConnecting) && (
            <div style={{ fontSize: 10, color: c.orange }}>⏳</div>
          )}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isConnected ? '#81C784' : (isConnecting || autoConnecting) ? c.orange : c.text4,
            boxShadow: isConnected ? '0 0 8px #81C784' : 'none',
            animation: isConnected ? 'pulse 2s infinite' : 'none',
          }}/>
          <span style={{ fontSize: 10, color: isConnected ? '#81C784' : (isConnecting || autoConnecting) ? c.orange : c.text4 }}>
            {isConnected ? 'Live' : (isConnecting || autoConnecting) ? translate('Conectare...') : translate('Deconectat')}
          </span>
        </div>
      </div>

      {/* HR live */}
      {isConnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, padding: '12px 14px', background: c.card2, borderRadius: 12 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: zone.color, lineHeight: 1, letterSpacing: '-2px' }}>
              {hr || '—'}
            </div>
            <div style={{ fontSize: 10, color: c.text4, position: 'absolute', bottom: -2, right: 0 }}>bpm</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: zone.color, marginBottom: 4 }}>{zone.label}</div>
            <div style={{ fontSize: 10, color: c.text4 }}>
              {hrLive.length > 1
                ? `${hrLive.length} citiri · ${liveDuration()}`
                : 'Prima citire în câteva secunde...'}
            </div>
            {allHR.length > 1 && (
              <div style={{ fontSize: 10, color: c.text4 }}>
                {minHR}–{maxHR} bpm · {lastSync ? `salvat ${lastSync}` : 'salvare la 5 min'}
              </div>
            )}
          </div>
          {/* Mini puls animat */}
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke={zone.color + '22'} strokeWidth="3"/>
            <circle cx="20" cy="20" r="16" fill="none" stroke={zone.color} strokeWidth="3"
              strokeDasharray="100" strokeDashoffset={hr ? (100 - Math.min(100, (hr / 200) * 100)).toFixed(0) : 60}
              transform="rotate(-90 20 20)" strokeLinecap="round"/>
            <text x="20" y="24" textAnchor="middle" fill={zone.color} fontSize="9" fontWeight="700" fontFamily="system-ui">❤</text>
          </svg>
        </div>
      )}

      {/* Nu e conectat — placeholder HR */}
      {!isConnected && !autoConnecting && !isConnecting && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, padding: '12px 14px', background: c.card2, borderRadius: 12, opacity: 0.5 }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: c.text4, lineHeight: 1 }}>—</div>
          <div style={{ fontSize: 12, color: c.text4 }}>
            {deviceName
              ? `${deviceName} ${translate('nu e conectat. Apasă „Conectează" pentru a autoriza conexiunea.')}`
              : translate('Niciun dispozitiv BLE imperecheat. Apasă „Conectează" pentru a adăuga unul.')}
          </div>
        </div>
      )}

      {/* Se conectează automat */}
      {(autoConnecting || isConnecting) && !isConnected && (
        <div style={{ marginBottom: 12, padding: '10px 12px', background: c.orange + '15', borderRadius: 10, fontSize: 11, color: c.orange }}>
          ⏳ {deviceName ? `Reconectare la ${deviceName}...` : 'Conectare la dispozitiv BLE...'}
        </div>
      )}

      {/* Sparkline — live sesiune sau istoric zi */}
      {sparkPts.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: c.text4 }}>
              {useLive
                ? `HR live — ${hrLive.length} citiri în ${liveDuration()}`
                : `HR azi — ${todayCount} înregistrări`}
            </div>
            {useLive && todayCount > 0 && (
              <div style={{ fontSize: 9, color: c.text4 }}>
                {todayCount} salvate azi
              </div>
            )}
          </div>
          <svg width="100%" height="56" viewBox="0 0 240 56" preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="bleGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={zone.color} stopOpacity="0.35"/>
                <stop offset="100%" stopColor={zone.color} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {(() => {
              const pts = sparkPts.map(d => [
                d.x * 238 + 1,
                50 - Math.round((d.hr - minHR) / rangeHR * 44)
              ])
              const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
              const area = path + ` L${pts[pts.length-1][0].toFixed(1)} 56 L${pts[0][0].toFixed(1)} 56 Z`
              return (
                <>
                  <path d={area} fill="url(#bleGrad2)"/>
                  <path d={path} fill="none" stroke={zone.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Punct live curent */}
                  {isConnected && (
                    <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="4" fill={zone.color} opacity="0.95">
                      <animate attributeName="opacity" values="0.95;0.3;0.95" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {/* Etichete min/max */}
                  {allHR.length > 2 && (
                    <>
                      <text x="2" y="8" fontSize="8" fill={c.text4} fontFamily="system-ui">{maxHR}</text>
                      <text x="2" y="53" fontSize="8" fill={c.text4} fontFamily="system-ui">{minHR}</text>
                    </>
                  )}
                </>
              )
            })()}
          </svg>
          {/* Axă timp */}
          {useLive ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: c.text4, marginTop: 2 }}>
              <span>{hrLive.length > 0 ? new Date(hrLive[0].ts).toLocaleTimeString('ro', {hour:'2-digit',minute:'2-digit'}) : ''}</span>
              <span>acum</span>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: c.text4, marginTop: 2 }}>
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
            </div>
          )}
        </div>
      )}

      {/* Eroare */}
      {error && (
        <div style={{ fontSize: 11, color: c.red, marginBottom: 10, padding: '8px 10px', background: c.red + '11', borderRadius: 8, lineHeight: 1.5 }}>
          ⚠ {error}
        </div>
      )}

      {/* Butoane */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!isConnected && !isConnecting && !autoConnecting && (
          <button onClick={connect}
            style={{ flex: 1, padding: '9px 12px', background: c.green2, color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            🔗 {translate('Conectează')}
          </button>
        )}
        {isConnected && (
          <button onClick={disconnect}
            style={{ flex: 1, padding: '9px 12px', background: c.card2, color: c.text4, border: '0.5px solid ' + c.border, borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ⏹ {translate('Deconectează')}
          </button>
        )}
        {(isConnecting || autoConnecting) && (
          <button disabled
            style={{ flex: 1, padding: '9px 12px', background: c.card2, color: c.text4, border: 'none', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', opacity: 0.6 }}>
            ⏳ {translate('Conectare...')}
          </button>
        )}
      </div>

      {/* Info */}
      {!isConnected && !deviceName && (
        <div style={{ fontSize: 10, color: c.text4, marginTop: 10, lineHeight: 1.6 }}>
          {translate('Prima conectare necesită aprobarea utilizatorului. Ulterior, aplicația se conectează automat. Graficul live se actualizează la fiecare 5 secunde; istoricul se salvează la 5 minute.')}
        </div>
      )}
    </div>
  )
}
