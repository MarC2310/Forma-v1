// src/components/BirthdayModal.jsx
// Modal festiv de felicitare de ziua de naștere.
// Apare când ziua+luna din birth_date == data curentă, la primele 3 deschideri ale zilei.
// Mesajul diferă de la an la an și de la persoană la persoană; traducere RO/EN din limbă.
import { useState, useEffect, useRef } from 'react'
import { getLang } from '../lib/i18n'

const MESSAGES = {
  ro: [
    'Îți dorim o zi plină de energie și un an cu recorduri noi! 💪',
    'Fie ca noul an să-ți aducă sănătate, forță și zile senine. 🎉',
    'Un an nou de viață — sărbătorește-l așa cum meriți! 🥳',
    'Sănătate, putere și multe PR-uri în anul care vine! 🏋️',
    'Să ai parte de un an plin de realizări și antrenamente reușite! ⚡',
    'La mulți ani! Continuă să fii cea mai bună versiune a ta. 🌟',
  ],
  en: [
    'We wish you a day full of energy and a year of new records! 💪',
    'May the new year bring you health, strength and bright days. 🎉',
    'A brand-new year of life — celebrate it the way you deserve! 🥳',
    'Health, power and many PRs in the year ahead! 🏋️',
    "Here's to a year full of achievements and great workouts! ⚡",
    'Happy birthday! Keep being the best version of yourself. 🌟',
  ],
}

function isBirthdayToday(birthDate) {
  if (!birthDate) return false
  const b = new Date(birthDate)
  if (isNaN(b.getTime())) return false
  const now = new Date()
  return b.getMonth() === now.getMonth() && b.getDate() === now.getDate()
}

function ageThisYear(birthDate) {
  const b = new Date(birthDate)
  const a = new Date().getFullYear() - b.getFullYear()
  return a >= 0 && a < 130 ? a : null
}

// hash stabil pentru a alege mesajul în funcție de user + an
function pickIndex(seed, len) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % len
}

export default function BirthdayModal({ birthDate, name, userId }) {
  const lang = getLang() === 'en' ? 'en' : 'ro'
  const [open, setOpen] = useState(false)
  const [age, setAge] = useState(null)
  const canvasRef = useRef(null)

  // Decide o singură dată, la montare, dacă se afișează (și incrementează contorul zilei)
  useEffect(() => {
    if (!isBirthdayToday(birthDate)) return
    const year = new Date().getFullYear()
    const key = 'forma_bday_' + year
    let shown = 0
    try { shown = parseInt(localStorage.getItem(key) || '0', 10) || 0 } catch (_) {}
    if (shown >= 3) return
    try { localStorage.setItem(key, String(shown + 1)) } catch (_) {}
    setAge(ageThisYear(birthDate))
    setOpen(true)
  }, [birthDate])

  // Confetti
  useEffect(() => {
    if (!open) return
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    let raf
    function resize() { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const colors = ['#22c55e', '#fbbf24', '#ec4899', '#38bdf8', '#f97316', '#a78bfa', '#ffffff']
    const P = []
    function spawn(n) {
      for (let i = 0; i < n; i++) P.push({
        x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.4,
        r: 4 + Math.random() * 5, c: colors[(Math.random() * colors.length) | 0],
        vy: 1.4 + Math.random() * 2.6, vx: -1 + Math.random() * 2,
        rot: Math.random() * 6.28, vr: -0.2 + Math.random() * 0.4, sh: Math.random() < 0.5,
      })
    }
    spawn(150)
    function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height)
      for (const p of P) {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c
        if (p.sh) ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6)
        else { ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7, 0, 6.28); ctx.fill() }
        ctx.restore()
        if (p.y > cv.height + 20) { p.y = -20; p.x = Math.random() * cv.width }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    // se oprește după 9s ca să nu consume baterie
    const stop = setTimeout(() => cancelAnimationFrame(raf), 9000)
    return () => { cancelAnimationFrame(raf); clearTimeout(stop); window.removeEventListener('resize', resize) }
  }, [open])

  if (!open) return null

  const firstName = (name || '').split(' ')[0]
  const msg = MESSAGES[lang][pickIndex(String(userId || '') + new Date().getFullYear(), MESSAGES[lang].length)]
  const T = {
    kicker: lang === 'en' ? 'Happy birthday' : 'La mulți ani',
    turns: age != null ? (lang === 'en'
      ? <>Today you turn <b style={{ color: '#fbbf24' }}>{age}</b>.</>
      : <>Astăzi împlinești <b style={{ color: '#fbbf24' }}>{age} de ani</b>.</>) : null,
    btn: lang === 'en' ? 'Thank you! 🎂' : 'Mulțumesc! 🎂',
  }

  return (
    <div onClick={() => setOpen(false)} style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(6,7,9,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        @keyframes fbdPop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.04);opacity:1}100%{transform:scale(1)}}
        @keyframes fbdBob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-8px) rotate(4deg)}}
        @keyframes fbdRing{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.12);opacity:1}}
        @keyframes fbdBtn{0%,100%{box-shadow:0 6px 18px rgba(34,197,94,.35)}50%{box-shadow:0 6px 26px rgba(34,197,94,.6)}}
        @keyframes fbdFloat{0%{transform:translateY(20px);opacity:0}12%{opacity:1}100%{transform:translateY(-90vh) translateX(var(--x));opacity:0}}
      `}</style>

      {/* Confetti */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

      {/* Baloane */}
      <div style={{ position: 'fixed', bottom: -40, left: '10%', fontSize: 34, '--x': '14px', animation: 'fbdFloat 6.5s ease-in 0s infinite', pointerEvents: 'none' }}>🎈</div>
      <div style={{ position: 'fixed', bottom: -40, left: '80%', fontSize: 34, '--x': '-16px', animation: 'fbdFloat 6.5s ease-in 1.1s infinite', pointerEvents: 'none' }}>🎈</div>
      <div style={{ position: 'fixed', bottom: -40, left: '46%', fontSize: 34, '--x': '10px', animation: 'fbdFloat 6.5s ease-in 2.2s infinite', pointerEvents: 'none' }}>🎈</div>

      {/* Modal */}
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', width: '86%', maxWidth: 340,
        background: 'linear-gradient(180deg,#171a20,#101216)',
        border: '1px solid rgba(34,197,94,.35)', borderRadius: 24,
        padding: '28px 22px 22px', textAlign: 'center',
        boxShadow: '0 18px 50px rgba(0,0,0,.55)', animation: 'fbdPop .6s cubic-bezier(.2,.9,.3,1.3) both',
      }}>
        <div onClick={() => setOpen(false)} style={{ position: 'absolute', top: 12, right: 14, color: '#6b7280', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</div>

        <div style={{ width: 96, height: 96, margin: '2px auto 14px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,.28),transparent 68%)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fbdRing 2.4s ease-in-out infinite' }}>
          <div style={{ fontSize: 56, animation: 'fbdBob 2.2s ease-in-out infinite' }}>🎂</div>
        </div>

        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#22c55e', fontWeight: 700, marginBottom: 6 }}>{T.kicker}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#f3f4f6', lineHeight: 1.15, marginBottom: 10 }}>{firstName ? `${firstName}! 🎉` : '🎉'}</div>
        {T.turns && <div style={{ fontSize: 14, color: '#c9ccd1', lineHeight: 1.5, marginBottom: 4 }}>{T.turns}</div>}
        <div style={{ fontSize: 13, color: '#8b9096', lineHeight: 1.5, marginBottom: 20 }}>{msg}</div>

        <button onClick={() => setOpen(false)} style={{
          width: '100%', padding: 13, border: 'none', borderRadius: 13,
          background: '#22c55e', color: '#0E0F12', fontSize: 15, fontWeight: 800,
          fontFamily: 'inherit', cursor: 'pointer', animation: 'fbdBtn 1.8s ease-in-out infinite',
        }}>{T.btn}</button>
      </div>
    </div>
  )
}
