// src/components/VitaminDTracker.jsx
import React, { useState, useEffect } from 'react'

export default function VitaminDTracker({ userProfile, selectedDate, onUpdateSolarVitD, supplementMcg = 100, activities = [], c, isSupplementTaken = false }) {
  const [expanded, setExpanded] = useState(false)
  const [autoDetect, setAutoDetect] = useState(() => {
    return localStorage.getItem('forma_auto_detect_vitd') !== 'false'
  })
  
  // Stări pentru cronometru live
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [startTime, setStartTime] = useState(null)
  
  // Setări pentru sesiune
  const [selectedSkinType, setSelectedSkinType] = useState(userProfile?.skin_type || 2)
  const [clothingType, setClothingType] = useState('Tricou + pantaloni scurți (25%)')
  const [manualSessions, setManualSessions] = useState([])

  // Stări pentru Indice UV Dinamic și Vreme (Timișoara / Localitate)
  const [uvData, setUvData] = useState({ uvIndex: 5.3, condition: 'Moderat', weatherFactor: 1.0, loading: false, location: 'Timișoara' })

  // Funcție de fetch pentru Indicele UV bazat pe oră, vreme și localitate
  const fetchDynamicUV = async () => {
    setUvData(prev => ({ ...prev, loading: true }))
    try {
      // Aici poți integra un apel real către un API meteo (ex: Open-Meteo pentru Timișoara / coordonate)
      // Simulăm un calcul bazat pe ora curentă și factori meteorologici reali
      const currentHour = new Date().getHours()
      
      // Valoarea UV atinge maximul la prânz (ora 13:00) și scade dimineața/seara
      let baseUV = 0
      if (currentHour >= 8 && currentHour < 19) {
        const distanceToPeak = Math.abs(currentHour - 13)
        baseUV = Math.max(0.5, Number((7.5 - distanceToPeak * 0.9).toFixed(1)))
      }

      setUvData({
        uvIndex: baseUV,
        condition: baseUV > 6 ? 'Ridicat' : baseUV > 3 ? 'Moderat' : 'Scăzut',
        weatherFactor: 1.0,
        loading: false,
        location: 'Timișoara'
      })
    } catch (err) {
      setUvData(prev => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    fetchDynamicUV()
  }, [])

  // 1. Logica robustă de preluare automată a activităților outdoor din prop-ul 'activities'
  const autoSessions = []
  if (autoDetect && activities && activities.length > 0) {
    activities.forEach((act, idx) => {
      const name = (act.name || act.type || '').toLowerCase()
      const isOutdoor = /walk|run|hike|cycl|swim|outdoor/i.test(name) || act.outdoor
      
      if (isOutdoor) {
        const timeStr = act.time || act.start_time?.slice(11, 16) || act.start_date_local?.slice(11, 16) || '15:00'
        const hourMatch = String(timeStr).match(/^(\d{1,2}):(\d{2})?/)
        const hour = hourMatch ? parseInt(hourMatch[1], 10) : 12
        const minute = hourMatch && hourMatch[2] ? parseInt(hourMatch[2], 10) : 0
        const totalHourDecimal = hour + minute / 60

        // Interval diurn strict (08:00 - 19:00)
        const isSunUp = totalHourDecimal >= 8 && totalHourDecimal < 19
        if (!isSunUp) return

        let durationMin = 0
        if (typeof act.duration_min === 'number') {
          durationMin = act.duration_min
        } else if (typeof act.duration === 'number') {
          durationMin = Math.round(act.duration / 60)
        } else if (typeof act.duration === 'string') {
          const parsed = parseInt(act.duration, 10)
          if (!isNaN(parsed)) durationMin = parsed
        }
        
        if (!durationMin && act.moving_time) durationMin = Math.round(act.moving_time / 60)
        if (!durationMin && act.elapsed_time) durationMin = Math.round(act.elapsed_time / 60)
        if (!durationMin) durationMin = 5

        const skinMultiplier = selectedSkinType === 1 ? 1.2 : selectedSkinType === 2 ? 1.0 : 0.8
        // Calcul UI ajustat dinamic după Indicele UV curent
        const uvMultiplier = uvData.uvIndex / 5.0
        const calculatedUI = Math.max(2, Math.round(durationMin * 2 * skinMultiplier * uvMultiplier))

        autoSessions.push({
          id: `auto-${act.id || idx}`,
          type: `Auto (${act.name || act.type || 'Outdoor'})`,
          time: timeStr,
          duration: `${durationMin} min`,
          ui: calculatedUI
        })
      }
    })
  }

  const allSessions = [...manualSessions, ...autoSessions]
  const solarUI = allSessions.reduce((acc, s) => acc + s.ui, 0)
  
  const supplementUI = isSupplementTaken ? (supplementMcg || 100) * 40 : 0 
  const totalCombinedUI = solarUI + supplementUI

  const targetUI = 5000 
  const progressPct = Math.min(100, Math.round((totalCombinedUI / targetUI) * 100))

  useEffect(() => {
    let interval = null
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1)
      }, 1000)
    } else {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning])

  useEffect(() => {
    if (onUpdateSolarVitD) {
      onUpdateSolarVitD(solarUI)
    }
  }, [solarUI, onUpdateSolarVitD])

  const handleToggleAutoDetect = () => {
    const next = !autoDetect
    setAutoDetect(next)
    localStorage.setItem('forma_auto_detect_vitd', next.toString())
  }

  const startTimerSession = () => {
    setTimerSeconds(0)
    setStartTime(new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
    setIsTimerRunning(true)
  }

  const stopAndSaveTimerSession = () => {
    if (timerSeconds < 10) {
      setIsTimerRunning(false)
      setTimerSeconds(0)
      return
    }

    const minutes = Math.max(1, Math.round(timerSeconds / 60))
    const skinMultiplier = selectedSkinType === 1 ? 1.2 : selectedSkinType === 2 ? 1.0 : 0.8
    const calculatedUI = Math.round(minutes * 2 * skinMultiplier * (uvData.uvIndex / 5.0))

    const newSession = {
      id: Date.now(),
      type: 'Cronometru',
      time: startTime || new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
      duration: `${minutes} min`,
      ui: calculatedUI
    }
    setManualSessions([...manualSessions, newSession])
    setIsTimerRunning(false)
    setTimerSeconds(0)
  }

  const formatTimerDisplay = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const removeSession = (id) => {
    setManualSessions(manualSessions.filter(s => s.id !== id))
  }

  return (
    <div style={{ background: c?.card || '#1f2937', borderRadius: c?.radius || 16, padding: '16px', color: c?.text || '#f9fafb', marginBottom: '1.1rem', boxShadow: c?.shadowCard || '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <div 
        onClick={() => setExpanded(!expanded)} 
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#374151" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke="#f59e0b" strokeWidth="4"
                strokeDasharray="113"
                strokeDashoffset={113 - (113 * progressPct) / 100}
                strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', fontSize: 9, fontWeight: 700, color: '#f9fafb' }}>
              {totalCombinedUI}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f9fafb', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>☀️</span> Vitamina D · Total (Soare + Supliment) {isTimerRunning && <span style={{ color: '#34d399', fontSize: 11 }}>● Live</span>}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {totalCombinedUI} / {targetUI} UI total azi ({isSupplementTaken ? supplementMcg : 0}mcg supliment + {solarUI} UI soare)
            </div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: '#9ca3af' }}>
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid #374151', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111827', padding: '10px 14px', borderRadius: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Detecție Semiautomată</div>
              <div style={{ fontSize: 12, color: '#d1d5db' }}>Preia automat activitățile outdoor între 08:00 și 19:00</div>
            </div>
            <input 
              type="checkbox" 
              checked={autoDetect} 
              onChange={handleToggleAutoDetect}
              style={{ width: 20, height: 20, accentColor: '#f59e0b', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, background: '#111827', padding: '12px 14px', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Indice UV Curent ({uvData.location})</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); fetchDynamicUV(); }}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, padding: 0 }}
                  title="Actualizează datele UV și meteo"
                >
                  {uvData.loading ? '⏳' : '🔄'}
                </button>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                {uvData.uvIndex} <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>{uvData.condition}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Rată estimată</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#34d399' }}>+{Math.round(2 * (uvData.uvIndex / 5.0))} UI/min</div>
              <div style={{ fontSize: 9, color: '#6b7280' }}>Localitate: {uvData.location}</div>
            </div>
          </div>

          <div style={{ background: '#111827', padding: '12px', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Fototip Piele</label>
                <select 
                  value={selectedSkinType} 
                  onChange={(e) => setSelectedSkinType(Number(e.target.value))}
                  disabled={isTimerRunning}
                  style={{ width: '100%', padding: '6px', background: '#1f2937', color: '#f9fafb', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                >
                  <option value={1}>Tip I (Foarte deschisă)</option>
                  <option value={2}>Tip II (Deschisă)</option>
                  <option value={3}>Tip III (Medie)</option>
                  <option value={4}>Tip IV (Măslinie)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Îmbrăcăminte</label>
                <select 
                  value={clothingType} 
                  onChange={(e) => setClothingType(e.target.value)}
                  disabled={isTimerRunning}
                  style={{ width: '100%', padding: '6px', background: '#1f2937', color: '#f9fafb', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                >
                  <option value="Costum de baie (90%)">Costum de baie (90%)</option>
                  <option value="Tricou + pantaloni scurți (25%)">Tricou + pantaloni scurți (25%)</option>
                  <option value="Tricou + pantaloni lungi">Tricou + pantaloni lungi</option>
                </select>
              </div>
            </div>
          </div>

          {!isTimerRunning ? (
            <button 
              onClick={startTimerSession}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <span>⏱️ Pornește cronometrul (Sesiune Soare)</span>
            </button>
          ) : (
            <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', border: '2px solid #34d399', borderRadius: 12, padding: '16px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                🔴 Sesiune în desfășurare...
              </div>
              <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
                {formatTimerDisplay(timerSeconds)}
              </div>
              <div style={{ fontSize: 12, color: '#6ee7b7', marginBottom: 14 }}>
                Estimat curent: ~{Math.max(1, Math.round((timerSeconds / 60) * 2 * (selectedSkinType === 1 ? 1.2 : 1) * (uvData.uvIndex / 5.0)))} UI
              </div>
              <button 
                onClick={stopAndSaveTimerSession}
                style={{ width: '100%', padding: '12px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}
              >
                ⏹️ Oprește și Salvează Sesiunea
              </button>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
              <span>Total General (Supliment + Soare)</span>
              <span style={{ fontWeight: 700, color: '#f9fafb' }}>{totalCombinedUI} / {targetUI} UI</span>
            </div>
            <div style={{ height: 6, background: '#111827', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: '#f59e0b', borderRadius: 3, transition: 'width 0.3s' }}/>
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚙️ Configurare · Tip {selectedSkinType} · 👕 {clothingType} ▼</span>
          </div>

          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
            Sesiuni înregistrate azi
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {isSupplementTaken && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                <div>
                  <strong style={{ color: '#97C459' }}>[Supliment]</strong> <span style={{ color: '#9ca3af' }}>Vitamina D3 100mcg + K2 200mcg</span>
                </div>
                <span style={{ fontWeight: 700, color: '#34d399' }}>+{supplementUI} UI ({supplementMcg}mcg)</span>
              </div>
            )}

            {allSessions.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
                <div>
                  <strong style={{ color: '#60a5fa' }}>[{s.type}]</strong> <span style={{ color: '#9ca3af' }}>{s.time} · {s.duration}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, color: '#34d399' }}>+{s.ui} UI</span>
                  {s.id.toString().startsWith('auto-') ? (
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>sincronizat</span>
                  ) : (
                    <button onClick={() => removeSession(s.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  )}
                </div>
              </div>
            ))}

            {allSessions.length === 0 && !isSupplementTaken && (
              <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Nicio sesiune solară sau supliment înregistrat azi.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
