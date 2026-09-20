// src/components/WaterTracker.jsx — Tracker hidratare zilnic cu animatie val
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const QUICK_AMOUNTS = [
  { ml: 200, label: '🥃 200ml', sub: 'pahar' },
  { ml: 330, label: '🥤 330ml', sub: 'cană' },
  { ml: 500, label: '🍶 500ml', sub: 'sticlă' },
  { ml: 750, label: '🧴 750ml', sub: 'sticlă mare' },
]

const WAVE_CSS = `
@keyframes wt1{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes wt2{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}
@keyframes wt3{0%{transform:translateX(0) scaleY(1)}50%{transform:translateX(-25%) scaleY(1.06)}100%{transform:translateX(-50%) scaleY(1)}}
.wt-a1{animation:wt1 2.4s linear infinite}
.wt-a2{animation:wt2 3.2s linear infinite}
.wt-a3{animation:wt3 2s ease-in-out infinite}
`

export default function WaterTracker({ c, weightKg, isMobile, onUpdate }) {
  if (!c) return null
  const [user, setUser]             = useState(null)
  const [todayTotal, setTodayTotal] = useState(0)
  const [logs, setLogs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [adding, setAdding]         = useState(false)
  const [customAmount, setCustomAmount] = useState('')

  const target = Math.round((weightKg || 80) * 35)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user))
  }, [])

  useEffect(() => {
    if (user?.id) loadToday()
  }, [user])

  async function loadToday() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('water_logs').select('*')
        .eq('user_id', user.id).eq('date', today).order('created_at', { ascending: true })
      if (data) {
        setLogs(data)
        setTodayTotal(data.reduce((s, l) => s + l.amount_ml, 0))
      }
    } catch (err) { console.warn('Water load:', err.message) }
    finally { setLoading(false) }
  }

  async function addWater(ml) {
    if (!user?.id || ml <= 0) return
    setAdding(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('water_logs').insert({ user_id: user.id, date: today, amount_ml: ml }).select().single()
      if (data) {
        setLogs(prev => [...prev, data])
        const newTotal = todayTotal + ml
        setTodayTotal(newTotal)
        if (onUpdate) onUpdate(newTotal)
      }
      setCustomAmount('')
    } catch (err) { console.warn('Water add:', err.message) }
    finally { setAdding(false) }
  }

  async function removeLastEntry() {
    if (logs.length === 0) return
    const last = logs[logs.length - 1]
    try {
      await supabase.from('water_logs').delete().eq('id', last.id)
      setLogs(prev => prev.slice(0, -1))
      const newTotal = todayTotal - last.amount_ml
      setTodayTotal(newTotal)
      if (onUpdate) onUpdate(newTotal)
    } catch (err) { console.warn(err) }
  }

  const pct    = Math.min(100, Math.round((todayTotal / target) * 100))
  const isOver = todayTotal > target

  return (
    <div style={{ position: 'relative', borderRadius: c.radiusMd || 16, marginBottom: '1.1rem', boxShadow: c.shadowCard || 'none', overflow: 'hidden', background: 'linear-gradient(135deg, #378ADD 0%, #185FA5 100%)', border: '0.5px solid #B5D4F4' }}>

      {/* Injectam CSS animatie val */}
      <style>{WAVE_CSS}</style>

      {/* ── Zona apă animată ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, transition: 'height 1.4s cubic-bezier(.4,0,.2,1)', overflow: 'hidden', zIndex: 0, opacity: 0.85 }}>
        {/* Fundal albastru de intensitate mai mare */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #185FA5 0%, #0C447C 100%)' }}/>
        {/* Val 1 */}
        <svg className="wt-a1" style={{ position: 'absolute', top: -20, left: 0, width: '200%', height: 30, pointerEvents: 'none' }}
          viewBox="0 0 400 30" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#378ADD" d="M0 15 C33 3 67 27 100 15 C133 3 167 27 200 15 C233 3 267 27 300 15 C333 3 367 27 400 15 L400 30 L0 30 Z"/>
        </svg>
        {/* Val 2 */}
        <svg className="wt-a2" style={{ position: 'absolute', top: -13, left: 0, width: '200%', height: 30, opacity: 0.6, pointerEvents: 'none' }}
          viewBox="0 0 400 30" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#185FA5" d="M0 20 C40 8 80 28 120 18 C160 8 200 30 240 18 C280 6 320 28 400 16 L400 30 L0 30 Z"/>
        </svg>
        {/* Val 3 - reflexie */}
        <svg className="wt-a3" style={{ position: 'absolute', top: -8, left: 0, width: '200%', height: 28, opacity: 0.28, pointerEvents: 'none' }}
          viewBox="0 0 400 28" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#B5D4F4" d="M0 22 C50 10 100 28 150 16 C200 4 250 26 300 18 C350 10 380 24 400 18 L400 28 L0 28 Z"/>
        </svg>
      </div>

      {/* ── Conținut ── */}
      <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '1.1rem' : '1.3rem 1.5rem' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            💧 Hidratare
          </div>
          {logs.length > 0 && (
            <button onClick={removeLastEntry}
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              ↩ anulează ultima
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none"
                stroke="rgba(255,255,255,0.25)" strokeWidth="7"/>
              <circle cx="32" cy="32" r="26" fill="none"
                stroke="#fff" strokeWidth="7"
                strokeDasharray={163.4} strokeDashoffset={163.4 * (1 - pct / 100)}
                strokeLinecap="round" transform="rotate(-90 32 32)"/>
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{pct}%</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
              {(todayTotal / 1000).toFixed(2)}
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
                {' '}/ {(target / 1000).toFixed(1)}L
              </span>
            </div>
            <div style={{ fontSize: 12, marginTop: 2, color: 'rgba(255,255,255,0.75)' }}>
              {isOver ? `✓ Target atins (+${Math.round(todayTotal - target)}ml)` : `${Math.round(target - todayTotal)}ml rămași`}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
          {QUICK_AMOUNTS.map(q => (
            <button key={q.ml} onClick={() => addWater(q.ml)} disabled={adding}
              style={{ padding: '8px 4px', background: 'rgba(255,255,255,0.15)',
                border: '0.5px solid rgba(255,255,255,0.2)',
                borderRadius: c.radiusSm || 8, cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{q.label}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>{q.sub}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="number"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            placeholder="ml personalizat..."
            style={{ flex: 1, padding: '8px 10px',
              background: 'rgba(255,255,255,0.15)',
              border: '0.5px solid rgba(255,255,255,0.2)',
              borderRadius: c.radiusSm || 8, color: '#fff',
              fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <button onClick={() => addWater(parseInt(customAmount) || 0)}
            disabled={!customAmount || adding}
            style={{ padding: '8px 16px',
              background: customAmount ? '#fff' : 'rgba(255,255,255,0.12)',
              border: 'none', borderRadius: c.radiusSm || 8,
              color: customAmount ? '#185FA5' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: 700, cursor: customAmount ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            + Adaugă
          </button>
        </div>

      </div>
    </div>
  )
}
