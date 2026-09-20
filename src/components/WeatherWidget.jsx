// src/components/WeatherWidget.jsx — Card meteo cu variație presiune atmosferică
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { translate as tr, getLang, useI18n } from '../lib/i18n'

// ── Fixed positions ──
const DROPS    = [[16,44,8,1.00,0.40],[24,46,7,0.90,0.95],[32,44,9,1.10,0.20],[40,45,7,0.85,1.40],[48,47,8,1.05,0.70],[55,44,6,1.00,1.15]]
const FLAKES   = [[17,44,8,1.50,0.30],[27,46,9,1.20,0.90],[36,44,7,1.40,0.10],[45,45,10,1.65,1.20],[54,47,8,1.30,0.60]]
const FOG_BARS = [[68,2.6,0.0,'fw-fog'],[56,3.1,0.5,'fw-fogr'],[64,2.3,1.0,'fw-fog'],[52,2.8,0.3,'fw-fogr'],[60,3.4,0.8,'fw-fog']]
const ST_CLEAR = [[12,8,1.2,0,3],[60,10,0.9,0.4,2],[22,20,1.5,0.8,3],[62,28,1.1,1.3,2],[40,5,1.8,0.2,2]]
const ST_SM    = [[10,6,1.1,0,2],[65,10,0.9,0.5,2],[68,32,1.2,0.8,2]]
const ST_1     = [[10,6,1.1,0,2]]
const MOON_BG  = '#0D1E32'

// ── CSS keyframes (rendered as <style> tag in JSX) ──
const FW_CSS = `
  @keyframes fw-spin   { to { transform:rotate(360deg) } }
  @keyframes fw-pulse  { 0%,100%{ box-shadow:0 0 0 0 rgba(255,200,0,.5),0 0 0 4px rgba(255,180,0,.18) } 50%{ box-shadow:0 0 0 8px rgba(255,200,0,.2),0 0 0 16px rgba(255,180,0,.07) } }
  @keyframes fw-bob    { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-5px) } }
  @keyframes fw-bob2   { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-7px) } }
  @keyframes fw-bob3   { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-3px) } }
  @keyframes fw-drop   { 0%{ transform:translateY(-4px);opacity:0 } 15%{ opacity:.85 } 100%{ transform:translateY(52px);opacity:0 } }
  @keyframes fw-flake  { 0%{ transform:translateY(-4px) rotate(0deg);opacity:0 } 15%{ opacity:.9 } 100%{ transform:translateY(52px) rotate(400deg);opacity:0 } }
  @keyframes fw-fog    { 0%{ transform:translateX(-8px);opacity:.35 } 100%{ transform:translateX(8px);opacity:.8 } }
  @keyframes fw-fogr   { 0%{ transform:translateX(8px);opacity:.35 } 100%{ transform:translateX(-8px);opacity:.8 } }
  @keyframes fw-twinkle{ 0%,100%{ opacity:.15 } 50%{ opacity:.85 } }
  @keyframes fw-shoot{ 0%{ opacity:0;transform:translate(0,0) } 5%{ opacity:.9 } 80%{ opacity:.5 } 100%{ opacity:0;transform:translate(120px,60px) } }
  @keyframes fw-moon   { 0%,100%{ filter:drop-shadow(0 0 5px rgba(230,190,60,.3)) } 50%{ filter:drop-shadow(0 0 12px rgba(230,190,60,.65)) } }
  @keyframes fw-flash  { 0%,79%,100%{ opacity:0 } 82%,88%{ opacity:1 } 85%,92%{ opacity:.1 } }
`

// ── Module-level sub-components (stable references — no unmount/remount) ──

function WRays({ r, dur }) {
  return (
    <div style={{ position:'absolute', inset:0, animation:`fw-spin ${dur}s linear infinite` }}>
      {[0,1,2,3,4,5,6,7].map(i => (
        <div key={i} style={{ position:'absolute', width:2.5, height:Math.round(r*.52),
          left:'50%', top:'50%', transformOrigin:'50% 100%', borderRadius:2, opacity:.7,
          background:'#FFD700',
          transform:`translateX(-50%) rotate(${i*45}deg) translateY(-${Math.round(r*1.1)}px)` }} />
      ))}
    </div>
  )
}

function WSun({ cx, cy, r, slow }) {
  return (
    <div style={{ position:'absolute', left:cx-r, top:cy-r, width:r*2, height:r*2 }}>
      <WRays r={r} dur={slow ? 14 : 10} />
      <div style={{ position:'absolute', width:r*1.12, height:r*1.12, borderRadius:'50%',
        background:'radial-gradient(circle at 38% 32%,#FFE566,#FFA500)',
        top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        animation:'fw-pulse 2.5s ease-in-out infinite' }} />
    </div>
  )
}

function WCloud({ cx, cy, sc, alpha, dark, snowCloud, bobAnim, zIndex }) {
  const bg = snowCloud ? `rgba(208,225,248,${alpha})` : dark ? `rgba(80,90,108,${alpha})` : `rgba(200,220,238,${alpha})`
  const sh = (w,h,l,t,br) => (
    <div style={{ position:'absolute', background:bg, width:w*sc, height:h*sc,
      left:cx+l*sc, top:cy+t*sc, borderRadius:br||'50%' }} />
  )
  return (
    <div style={{ position:'absolute', left:0, top:0, width:70, height:70,
      zIndex:zIndex||2, animation:bobAnim }}>
      {sh(42,18,-21,-5,'12px')}
      {sh(22,22,-20,-18)}
      {sh(17,17,-3,-15)}
    </div>
  )
}

function WMoon({ cx, cy, r, opacity }) {
  return (
    <div style={{ position:'absolute', left:cx-r, top:cy-r, width:r*2, height:r*2,
      zIndex:1, opacity:opacity||1, animation:'fw-moon 3s ease-in-out infinite' }}>
      <div style={{ width:r*2, height:r*2, borderRadius:'50%',
        background:'radial-gradient(circle at 35% 30%,#FFF5B0,#D4A820)' }} />
      <div style={{ position:'absolute', top:-r*.15, right:-r*.3,
        width:r*2*.9, height:r*2*.9, borderRadius:'50%', background:MOON_BG }} />
    </div>
  )
}

function WStars({ list }) {
  return list.map(([l,t,dur,dl,sz=3],i) => (
    <div key={i} style={{ position:'absolute', left:l, top:t, width:sz, height:sz,
      background:'#fff', borderRadius:'50%',
      animation:`fw-twinkle ${dur}s ease-in-out infinite alternate`,
      animationDelay:`-${dl}s` }} />
  ))
}

function WDrops({ rows, speedMul }) {
  return (rows||DROPS).map(([l,t,h,speed,dl],i) => (
    <div key={i} style={{ position:'absolute', left:l, top:t, width:2, height:h,
      borderRadius:2, background:'linear-gradient(180deg,rgba(100,165,220,0),rgba(100,165,220,.88))',
      animation:'fw-drop linear infinite',
      animationDuration:`${(speed*(speedMul||1)).toFixed(2)}s`,
      animationDelay:`-${dl}s` }} />
  ))
}

function WFlakes() {
  return FLAKES.map(([l,t,sz,dur,dl],i) => (
    <span key={i} style={{ position:'absolute', left:l, top:t, fontSize:sz,
      color:'rgba(195,220,255,.9)',
      animation:'fw-flake linear infinite',
      animationDuration:`${dur}s`,
      animationDelay:`-${dl}s` }}>❄</span>
  ))
}


// ── Animated sky cloud for SunMoonArc — drift left→right ──
function SkyCloud({ cy, sc, op, fill, dur, begin }) {
  const hw = Math.round(38 * sc) // half-width offset for smooth entry/exit
  return (
    <g opacity={op}>
      <animateTransform attributeName="transform" type="translate"
        from={`${-hw} ${cy}`}
        to={`${300 + hw} ${cy}`}
        dur={`${dur}s`}
        repeatCount="indefinite"
        begin={begin}/>
      {/* cloud shape: wide base ellipse + two puff ellipses */}
      <ellipse rx={22*sc} ry={8*sc} fill={fill}/>
      <ellipse cx={-12*sc} cy={-8*sc} rx={11*sc} ry={10*sc} fill={fill}/>
      <ellipse cx={4*sc} cy={-7*sc} rx={9*sc} ry={9*sc} fill={fill}/>
    </g>
  )
}

// ── Rain streaks falling from cloud area ──
function RainStreak({ x, delay, dur, heavy }) {
  const len = heavy ? 11 : 7
  const op  = heavy ? 0.70 : 0.48
  const sw  = heavy ? 1.0  : 0.7
  return (
    <line x1={0} y1={0} x2={-1.5} y2={len}
      stroke="rgba(140,190,255,0.85)" strokeWidth={sw} strokeLinecap="round">
      <animateTransform attributeName="transform" type="translate"
        from={`${x} 30`} to={`${x - 5} 96`}
        dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite"/>
      <animate attributeName="opacity"
        values={`0;${op};${op};0`} keyTimes="0;0.08;0.88;1"
        dur={`${dur}s`} begin={`-${delay}s`} repeatCount="indefinite"/>
    </line>
  )
}

// ── Lightning bolt + screen flash for storm ──
function LightningBolt({ x }) {
  return (
    <g>
      <rect width="300" height="122" fill="white" fillOpacity="0">
        <animate attributeName="fill-opacity"
          values="0;0;0;0.18;0.04;0;0;0;0;0.14;0.03;0;0;0;0"
          keyTimes="0;0.25;0.30;0.32;0.34;0.36;0.5;0.65;0.70;0.72;0.74;0.76;0.85;0.92;1"
          dur="5s" repeatCount="indefinite"/>
      </rect>
      <polyline
        points={`${x},28 ${x-9},50 ${x+5},50 ${x-7},78`}
        fill="none" stroke="rgba(255,255,180,0.95)" strokeWidth="2" strokeLinejoin="round"
        opacity="0">
        <animate attributeName="opacity"
          values="0;0;0;1;0;0;0;0;0;1;0;0;0;0;0"
          keyTimes="0;0.25;0.30;0.32;0.33;0.34;0.5;0.65;0.70;0.72;0.73;0.74;0.85;0.92;1"
          dur="5s" repeatCount="indefinite"/>
      </polyline>
    </g>
  )
}

// ── Moon phase fallback calculator (folosit când API returnează 0 sau null) ──
// Referință: 3 septembrie 2024 01:55 UTC = Lună nouă confirmată
function _computeMoonPhase(date) {
  const REF_MS  = new Date('2024-09-03T01:55:00Z').getTime()
  const PERIOD  = 29.530588853 * 86400000   // ms per ciclu lunar
  const elapsed = ((date.getTime() - REF_MS) % PERIOD + PERIOD) % PERIOD
  return elapsed / PERIOD  // 0 = Lună nouă, 0.5 = Lună plină
}

// ── Sun / Moon arc ──
function SunMoonArc({ sunrise, sunset, moonrise, moonPhase, wmoCode }) {
  const [tick, setTick] = useState(0)
  const [tip, setTip] = useState(null)   // 'sun' | 'moon' | null
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(iv)
  }, [])
  // Auto-close tooltip after 3.5s
  useEffect(() => {
    if (!tip) return
    const t = setTimeout(() => setTip(null), 3500)
    return () => clearTimeout(t)
  }, [tip])

  const nowTs = Date.now()
  const srTs  = sunrise  ? new Date(sunrise).getTime()  : null
  const ssTs  = sunset   ? new Date(sunset).getTime()   : null
  const mrTs  = moonrise ? new Date(moonrise).getTime() : null

  const h     = new Date().getHours()
  const isDay = srTs && ssTs ? nowTs >= srTs && nowTs <= ssTs : h >= 6 && h < 21
  const tSun  = srTs && ssTs ? Math.max(0, Math.min(1, (nowTs - srTs) / (ssTs - srTs))) : Math.max(0, Math.min(1, (h - 6) / 15))
  const msTs  = mrTs ? mrTs + 45000000 : null   // approx 12.5h moonset
  const tMoon = mrTs && msTs ? Math.max(0, Math.min(1, (nowTs - mrTs) / (msTs - mrTs))) : 0.32

  const CX = 150, CY = 108, RX = 126, RY = 100
  const arcPt = t => {
    const a = Math.PI * (1 - t)
    return { x: CX + RX * Math.cos(a), y: CY - RY * Math.sin(a) }
  }
  const buildPath = (t0, t1, n = 38) => {
    let d = ''
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n
      const p = arcPt(t)
      d += (i === 0 ? `M${p.x.toFixed(1)} ${p.y.toFixed(1)}` : ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    }
    return d
  }

  // Sun colour by horizon proximity
  const hor  = Math.min(tSun, 1 - tSun)
  const sunC = hor < 0.07 ? '#FF5218' : hor < 0.15 ? '#FF9040' : hor < 0.25 ? '#FFC830' : '#FFE066'
  const sunG = hor < 0.07 ? 'rgba(255,90,30,0.55)' : hor < 0.15 ? 'rgba(255,150,50,0.45)' : 'rgba(255,210,70,0.35)'
  const sunH = hor < 0.07 ? 'rgba(255,70,15,0.22)' : 'rgba(255,200,60,0.12)'

  // Moon phase geometry
  // Dacă API returnează 0 sau null, folosim calculatorul din dată
  // (prevenim afișarea "Lună nouă" când luna e de fapt crescândă)
  const phase = (() => {
    const api = moonPhase ?? 0
    if (api > 0.01) return api                          // API valid, folosim valoarea
    const computed = _computeMoonPhase(new Date())
    const isNear = computed < 0.05 || computed > 0.95   // chiar este aproape de lună nouă
    return isNear ? api : computed                      // fallback doar dacă nu e lână nouă reală
  })()
  const phi   = 2 * Math.PI * phase
  const cosV  = Math.cos(phi)
  const moonR = 13
  const isWax = phase <= 0.5
  const tRx   = moonR * Math.abs(cosV)

  // Which side of the moon disc is clipped for each element
  const termFill  = cosV > 0 ? '#05090F' : 'url(#fw-mg)'
  const termRight = isWax ? cosV > 0 : cosV < 0
  const termClip  = termRight ? 'url(#fw-mc-r)' : 'url(#fw-mc-l)'

  // Dynamic sky gradient helpers
  const lerpHex = (ca, cb, ct) => {
    const toRgb = s => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)]
    const [ar,ag,ab] = toRgb(ca)
    const [br,bg,bb] = toRgb(cb)
    const lr = Math.round(ar + (br-ar)*ct)
    const lg = Math.round(ag + (bg-ag)*ct)
    const lb = Math.round(ab + (bb-ab)*ct)
    return 'rgb(' + lr + ',' + lg + ',' + lb + ')'
  }
  const getSky = (t, day) => {
    if (!day) return { top: '#04080F', bot: '#020406' }
    const hor = Math.min(t, 1-t)           // 0=horizon, 0.5=midday
    if (hor < 0.07) {                       // golden hour / twilight
      return { top: lerpHex('#1A1040', '#4060A0', hor/0.07), bot: lerpHex('#FF6010', '#C06030', hor/0.07) }
    } else if (hor < 0.2) {                 // morning / afternoon
      const u = (hor - 0.07) / 0.13
      return { top: lerpHex('#4060A0', '#0060B0', u), bot: lerpHex('#C06030', '#2080D0', u) }
    } else {                                // midday
      return { top: '#0055A8', bot: '#0090E0' }
    }
  }
  // ── Sky mode from WMO code ──
  const skyMode = (() => {
    const wc = wmoCode
    if (wc == null || wc <= 1)           return 'clear'
    if (wc === 2)                         return 'partly'
    if (wc === 3)                         return 'overcast'
    if (wc >= 45 && wc <= 48)            return 'fog'
    if (wc >= 51 && wc <= 57)            return 'drizzle'
    if ((wc >= 61 && wc <= 67) || (wc >= 80 && wc <= 82)) return 'rain'
    if (wc >= 71 && wc <= 77)            return 'snow'
    if (wc >= 95)                         return 'storm'
    return 'clear'
  })()

  // Cloud tint — darkens for bad weather
  const baseCloudFill = !isDay
    ? 'rgba(70,90,130,0.38)'
    : hor < 0.07
      ? 'rgba(255,185,130,0.52)'
      : hor < 0.18
        ? 'rgba(240,240,255,0.50)'
        : 'rgba(255,255,255,0.58)'
  const cloudFill = skyMode === 'storm'    ? 'rgba(50,55,68,0.92)'
                  : skyMode === 'rain'     ? 'rgba(82,92,110,0.88)'
                  : skyMode === 'drizzle'  ? 'rgba(110,118,135,0.80)'
                  : skyMode === 'overcast' ? 'rgba(130,138,152,0.82)'
                  : skyMode === 'fog'      ? 'rgba(150,155,165,0.60)'
                  : baseCloudFill

  // Sky gradient override for bad weather (day only — night already dark)
  let { top: skyTop, bot: skyBot } = getSky(tSun, isDay)
  if (isDay) {
    if      (skyMode === 'storm')   { skyTop = '#1C2028'; skyBot = '#2A3040' }
    else if (skyMode === 'rain')    { skyTop = '#2E3848'; skyBot = '#3E4C5E' }
    else if (skyMode === 'drizzle') { skyTop = '#3A4858'; skyBot = '#4C5C6E' }
    else if (skyMode === 'overcast'){ skyTop = '#485260'; skyBot = '#5A6472' }
    else if (skyMode === 'fog')     { skyTop = '#6A7080'; skyBot = '#7A8090' }
  }


  // Moon phase name — must be BEFORE moonTipLines (esbuild merges consts → TDZ)
  const phaseName = (function() {
    if (phase < 0.04 || phase > 0.96) return tr('Lună nouă 🌑')
    if (phase < 0.23) return tr('Seceră cresc. 🌒')
    if (phase < 0.27) return tr('Primul pătrar 🌓')
    if (phase < 0.48) return tr('Gibos cresc. 🌔')
    if (phase < 0.52) return tr('Lună plină 🌕')
    if (phase < 0.73) return tr('Gibos desc. 🌖')
    if (phase < 0.77) return tr('Ultimul pătrar 🌗')
    return tr('Seceră desc. 🌘')
  })()
  const fmtTs = function(ts) {
    if (!ts) return '—'
    var d = new Date(ts)
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
  }

  // Format milliseconds → "Xh Ymin"
  const fmtRem = function(ms) {
    if (ms <= 0) return '0 min'
    var totalMin = Math.round(ms / 60000)
    var hh = Math.floor(totalMin / 60)
    var mm = totalMin % 60
    return hh > 0 ? (hh + 'h ' + mm + 'min') : (mm + ' min')
  }

  // Tooltip lines
  const sunTipLines = (() => {
    const apusTime = ssTs ? fmtTs(ssTs) : '—'
    const rasaritTime = srTs ? fmtTs(srTs) : '—'
    if (!ssTs) return [`${tr('Apus')}: —`, `${tr('Răsărit')}: ${rasaritTime}`]
    const rem = ssTs - nowTs
    if (rem <= 0) return [tr('Soarele a apus'), `${tr('Apus')}: ${apusTime}`]
    return [`${fmtRem(rem)} ${tr('până la apus')}`, `${tr('Apus')}: ${apusTime} · ${tr('Răsărit')}: ${rasaritTime}`]
  })()
  // Formula corectă: iluminare = (1 - cos(2π × phase)) / 2
  // sin(π × phase) era greșit — dădea valori duble față de realitate
  const moonIllum = Math.round((1 - Math.cos(2 * Math.PI * phase)) / 2 * 100)
  const moonTipLines = (() => {
    const lines = [phaseName, `${tr('Iluminare')}: ${moonIllum}%`]
    if (srTs) {
      const nextSr = srTs > nowTs ? srTs : srTs + 86400000
      lines.push(`${fmtRem(nextSr - nowTs)} ${tr('până la răsărit')}`)
    } else {
      lines.push(`${tr('Răsărit')}: —`)
    }
    return lines
  })()

  const sp = arcPt(tSun)
  const mp = arcPt(tMoon)



  // Tree colour
  const treeCol = isDay ? '#1A2E1A' : '#0B1A0B'

  return (
    <div>
      <svg viewBox="0 0 300 122" style={{ width:'100%', display:'block' }} onClick={() => setTip(null)}>
        <defs>
          {/* Moon disc gradient — userSpaceOnUse so it follows mp */}
          <radialGradient id="fw-mg" gradientUnits="userSpaceOnUse"
            cx={mp.x - moonR*0.3} cy={mp.y - moonR*0.35} r={moonR*1.35}>
            <stop offset="0%" stopColor="#FFF8C0"/>
            <stop offset="55%" stopColor="#D4B840"/>
            <stop offset="100%" stopColor="#8A6810"/>
          </radialGradient>
          {/* Moon left/right half clip paths (user space) */}
          <clipPath id="fw-mc-l">
            <rect x={mp.x - moonR - 0.5} y={mp.y - moonR - 1} width={moonR + 0.5} height={moonR*2 + 2}/>
          </clipPath>
          <clipPath id="fw-mc-r">
            <rect x={mp.x - 0.5} y={mp.y - moonR - 1} width={moonR + 0.5} height={moonR*2 + 2}/>
          </clipPath>
          <filter id="fw-sfx" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="fw-mfx" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="fw-sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyTop}/>
            <stop offset="100%" stopColor={skyBot}/>
          </linearGradient>
          <linearGradient id="fw-gnd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isDay ? (hor<0.1?'#213C10':'#1E6020') : '#0A1E06'}/>
            <stop offset="100%" stopColor={isDay ? '#0A2806' : '#040A02'}/>
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect width="300" height="122" fill="url(#fw-sky-grad)"/>

        {/* Clouds — count and density driven by skyMode */}
        {/* Base clouds always present */}
        {isDay ? (
          <>
            {/* clear / partly: 4 light clouds */}
            <SkyCloud cy={28} sc={0.55} op={skyMode==='clear'?0.60:0.82} fill={cloudFill} dur={skyMode==='storm'?28:skyMode==='rain'?34:45} begin="-6s"/>
            <SkyCloud cy={16} sc={0.42} op={skyMode==='clear'?0.45:0.72} fill={cloudFill} dur={skyMode==='storm'?22:skyMode==='rain'?28:62} begin="-28s"/>
            <SkyCloud cy={38} sc={0.36} op={skyMode==='clear'?0.35:0.65} fill={cloudFill} dur={skyMode==='storm'?32:skyMode==='rain'?40:80} begin="-50s"/>
            <SkyCloud cy={22} sc={0.30} op={skyMode==='clear'?0.25:0.55} fill={cloudFill} dur={skyMode==='storm'?25:skyMode==='rain'?32:55} begin="-14s"/>
            {/* overcast / drizzle / rain / storm: extra heavy clouds */}
            {(skyMode==='overcast'||skyMode==='drizzle'||skyMode==='rain'||skyMode==='storm') && (
              <>
                <SkyCloud cy={10} sc={0.70} op={0.90} fill={cloudFill} dur={skyMode==='storm'?20:30} begin="-5s"/>
                <SkyCloud cy={32} sc={0.60} op={0.85} fill={cloudFill} dur={skyMode==='storm'?24:36} begin="-18s"/>
                <SkyCloud cy={20} sc={0.50} op={0.80} fill={cloudFill} dur={skyMode==='storm'?18:26} begin="-40s"/>
              </>
            )}
            {/* storm: even more + very dark coverage */}
            {skyMode==='storm' && (
              <>
                <SkyCloud cy={14} sc={0.80} op={0.95} fill={cloudFill} dur={16} begin="-8s"/>
                <SkyCloud cy={36} sc={0.65} op={0.90} fill={cloudFill} dur={21} begin="-33s"/>
              </>
            )}
          </>
        ) : (
          <>
            <SkyCloud cy={20} sc={0.40} op={skyMode==='clear'?0.35:0.60} fill={cloudFill} dur={skyMode==='storm'?30:70} begin="-10s"/>
            <SkyCloud cy={32} sc={0.32} op={skyMode==='clear'?0.25:0.50} fill={cloudFill} dur={skyMode==='storm'?38:90} begin="-45s"/>
            {(skyMode==='rain'||skyMode==='storm'||skyMode==='overcast'||skyMode==='drizzle') && (
              <>
                <SkyCloud cy={14} sc={0.55} op={0.72} fill={cloudFill} dur={45} begin="-22s"/>
                <SkyCloud cy={28} sc={0.45} op={0.65} fill={cloudFill} dur={55} begin="-38s"/>
              </>
            )}
          </>
        )}

        {/* Rain streaks — drizzle / rain / storm */}
        {(skyMode==='drizzle'||skyMode==='rain'||skyMode==='storm') && (
          <>
            <RainStreak x={30}  delay={0.1} dur={0.9} heavy={skyMode!=='drizzle'}/>
            <RainStreak x={70}  delay={0.4} dur={0.8} heavy={skyMode!=='drizzle'}/>
            <RainStreak x={110} delay={0.7} dur={1.0} heavy={skyMode!=='drizzle'}/>
            <RainStreak x={150} delay={0.2} dur={0.85} heavy={skyMode!=='drizzle'}/>
            <RainStreak x={190} delay={0.55} dur={0.95} heavy={skyMode!=='drizzle'}/>
            <RainStreak x={230} delay={0.35} dur={0.75} heavy={skyMode!=='drizzle'}/>
            <RainStreak x={265} delay={0.65} dur={0.88} heavy={skyMode!=='drizzle'}/>
            {(skyMode==='rain'||skyMode==='storm') && (
              <>
                <RainStreak x={50}  delay={0.8} dur={0.82} heavy/>
                <RainStreak x={90}  delay={0.15} dur={0.92} heavy/>
                <RainStreak x={130} delay={0.5} dur={0.78} heavy/>
                <RainStreak x={170} delay={0.9} dur={0.96} heavy/>
                <RainStreak x={210} delay={0.3} dur={0.84} heavy/>
                <RainStreak x={250} delay={0.7} dur={0.88} heavy/>
              </>
            )}
          </>
        )}

        {/* Lightning bolt — storm only */}
        {skyMode==='storm' && <LightningBolt x={148}/>}

        {/* Stars (night) — fixed positions, calm opacity twinkle only */}
        {!isDay && (
          <g>
            {[[35,18,1.1],[78,10,0.9],[135,6,1.3],[188,14,1.0],[235,21,0.8],[268,8,1.2],[52,36,0.7],[172,4,1.1],[248,33,0.9],[100,28,0.8],[210,40,1.0]].map(([x,y,r],i) => (
              <circle key={i} cx={x} cy={y} r={r} fill="white"
                style={{ opacity:.5, animation:`fw-twinkle ${3+i*0.6}s ease-in-out infinite`, animationDelay:`-${i*0.7}s` }}/>
            ))}
            {/* Shooting star — appears every ~8s */}
            <line x1="20" y1="5" x2="26" y2="8" stroke="white" strokeWidth="0.8" strokeLinecap="round"
              style={{ opacity:0, animation:'fw-shoot 8s ease-in infinite', animationDelay:'-2s' }}/>
            <line x1="180" y1="12" x2="186" y2="15" stroke="white" strokeWidth="0.7" strokeLinecap="round"
              style={{ opacity:0, animation:'fw-shoot 11s ease-in infinite', animationDelay:'-7s' }}/>
          </g>
        )}

        {/* Dashed arc */}
        <path d={buildPath(0,1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="4 7"/>

        {/* Progress trail */}
        {isDay
          ? <path d={buildPath(0, Math.max(0.005, tSun))} fill="none" stroke="rgba(255,175,55,0.38)" strokeWidth="2" strokeLinecap="round"/>
          : <path d={buildPath(0,1)} fill="none" stroke="rgba(255,150,35,0.12)" strokeWidth="1.5"/>
        }

        {/* Time labels — float above tree silhouettes */}
        {/* Time labels — on dark ground at bottom */}
        {srTs && <text x="22" y="120" textAnchor="middle" fontSize="8" fontWeight="700" fill="rgba(255,215,100,0.90)">↑ {fmtTs(srTs)}</text>}
        {ssTs && <text x="278" y="120" textAnchor="middle" fontSize="8" fontWeight="700" fill="rgba(255,165,80,0.90)">{fmtTs(ssTs)} ↓</text>}

        {/* ── SUN ── */}
        {isDay && (
          <g filter="url(#fw-sfx)" onClick={e => { e.stopPropagation(); setTip(t => t==='sun' ? null : 'sun') }} style={{ cursor:'pointer' }}>
            <circle cx={sp.x} cy={sp.y} r="25" fill={sunH} style={{ animation:'fw-pulse 2.8s ease-in-out infinite' }}/>
            <circle cx={sp.x} cy={sp.y} r="16" fill={sunG}/>
            <circle cx={sp.x} cy={sp.y} r="10.5" fill={sunC}/>
            <circle cx={sp.x} cy={sp.y} r="6.5" fill="white" opacity="0.65"/>
          </g>
        )}

        {/* ── MOON ── */}
        {!isDay && (
          <g filter="url(#fw-mfx)" style={{ animation:'fw-moon 3.5s ease-in-out infinite' }}
            onClick={e => { e.stopPropagation(); setTip(t => t==='moon' ? null : 'moon') }} cursor="pointer">
            {/* Dark base disc */}
            <circle cx={mp.x} cy={mp.y} r={moonR} fill="#05090F"/>
            {/* Lit half (right=waxing, left=waning) */}
            <circle cx={mp.x} cy={mp.y} r={moonR} fill="url(#fw-mg)"
              clipPath={isWax ? 'url(#fw-mc-r)' : 'url(#fw-mc-l)'}/>
            {/* Terminator ellipse */}
            {tRx > 0.3 && (
              <ellipse cx={mp.x} cy={mp.y} rx={tRx} ry={moonR}
                fill={termFill} clipPath={termClip}/>
            )}
            {/* Craters */}
            <circle cx={mp.x - 4} cy={mp.y + 3} r="1.7" fill="rgba(0,0,0,0.14)"/>
            <circle cx={mp.x + 5} cy={mp.y - 5} r="1.2" fill="rgba(0,0,0,0.11)"/>
          </g>
        )}

        {/* Rolling ground */}
        <path d="M0,114 C22,109 52,115 82,111 C112,107 142,113 172,109 C202,105 232,111 262,107 C279,105 292,110 300,113 L300,122 L0,122 Z" fill="url(#fw-gnd)"/>

        {/* Left pine cluster */}
        <g fill={treeCol}>
          <polygon points="13,114 39,114 26,80"/>
          <polygon points="15,102 37,102 26,86"/>
          <polygon points="17,94  35,94  26,78"/>
          <polygon points="2,114  20,114 10,93"/>
          <polygon points="4,105  18,105 10,91"/>
          <polygon points="34,114 54,114 44,91"/>
          <polygon points="36,105 52,105 44,88"/>
          <ellipse cx={19} cy={113} rx={7} ry={4}/>
          <ellipse cx={36} cy={112} rx={5} ry={3.5}/>
        </g>

        {/* Right shrub cluster */}
        <g fill={treeCol}>
          <ellipse cx={254} cy={110} rx={11} ry={6}/>
          <ellipse cx={267} cy={108} rx={13} ry={7}/>
          <ellipse cx={280} cy={109} rx={11} ry={6.5}/>
          <ellipse cx={291} cy={110} rx={9}  ry={5.5}/>
          <ellipse cx={299} cy={112} rx={7}  ry={4.5}/>
          <polygon points="260,114 266,114 263,104"/>
          <polygon points="274,114 280,114 277,103"/>
        </g>

        {/* Sun tooltip */}
        {tip === 'sun' && (() => {
          const tx = Math.min(Math.max(sp.x, 70), 230)
          const ty = Math.max(sp.y - 44, 8)
          return (
            <g>
              <rect x={tx - 80} y={ty - 13} width="160" height="38" rx="11" fill="rgba(10,16,26,0.88)"/>
              <text x={tx} y={ty + 4}  textAnchor="middle" fontSize="9" fontWeight="700" fill="#FFD060">{sunTipLines[0]}</text>
              <text x={tx} y={ty + 19} textAnchor="middle" fontSize="8" fill="rgba(255,210,96,0.75)">{sunTipLines[1]}</text>
            </g>
          )
        })()}

        {/* Moon tooltip */}
        {tip === 'moon' && (() => {
          const tx = Math.min(Math.max(mp.x, 72), 228)
          const ty = Math.max(mp.y - 40, 4)
          return (
            <g>
              <rect x={tx - 70} y={ty - 13} width="140" height="54" rx="11" fill="rgba(10,16,26,0.88)"/>
              <text x={tx} y={ty + 4}  textAnchor="middle" fontSize="9" fontWeight="700" fill="#C8C0FF">{moonTipLines[0]}</text>
              <text x={tx} y={ty + 19} textAnchor="middle" fontSize="8.5" fill="rgba(200,200,255,0.75)">{moonTipLines[1]}</text>
              <text x={tx} y={ty + 33} textAnchor="middle" fontSize="8.5" fill="rgba(200,200,255,0.75)">{moonTipLines[2]}</text>
            </g>
          )
        })()}
      </svg>

      {/* Moon phase label (night only) */}
      {!isDay && moonPhase != null && (
        <div style={{ textAlign:'center', padding:'2px 0 8px', fontSize:10, color:'rgba(200,180,110,0.6)' }}>
          {phaseName}
        </div>
      )}
    </div>
  )
}


// ── WeatherIconSm — 28×28 SVG, animații native ──
function WeatherIconSm({ code, hour }) {
  const n  = hour < 6 || hour >= 21
  const tc = code == null ? 'clear'
    : code === 0 ? 'clear'
    : code <= 2  ? 'pc'
    : code === 3 ? 'ov'
    : code <= 48 ? 'fog'
    : (code <= 67 || (code >= 80 && code <= 82)) ? 'rain'
    : (code <= 77 || (code >= 85 && code <= 86)) ? 'snow'
    : code >= 95 ? 'storm' : 'clear'

  const dayCloudFill  = 'rgba(195,215,240,0.96)'
  const niteCloudFill = 'rgba(95,115,145,0.92)'
  const darkCloudFill = 'rgba(55,70,95,0.96)'
  const cf = n ? niteCloudFill : dayCloudFill

  // Nor (ellipse x3 + rect fill)
  const Cld = ({ x=14, y=20, s=1, dk=false }) => {
    const f = dk ? darkCloudFill : cf
    return (
      <>
        <ellipse cx={x-3.5*s} cy={y+s}    rx={4*s}   ry={3.2*s} fill={f}/>
        <ellipse cx={x+0.5*s} cy={y-0.5*s} rx={4.5*s} ry={4*s}  fill={f}/>
        <ellipse cx={x+4*s}   cy={y+s}    rx={3.5*s} ry={3*s}   fill={f}/>
        <rect    x={x-7.5*s}  y={y+1.5*s} width={15*s} height={3.5*s} rx={1.5*s} fill={f}/>
      </>
    )
  }

  // Soare cu raze rotitoare (animateTransform nativ SVG)
  const Sun = ({ x=14, y=11, r=5.5 }) => (
    <>
      <g transform={`translate(${x},${y})`}>
        <animateTransform attributeName="transform" type="rotate"
          from={`0 0 0`} to={`360 0 0`} dur="10s" repeatCount="indefinite" additive="sum"/>
        {[0,45,90,135,180,225,270,315].map((d,i) => (
          <line key={i} x1={0} y1={-(r+1.8)} x2={0} y2={-(r+3.8)}
            stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round"
            transform={`rotate(${d})`}/>
        ))}
      </g>
      <circle cx={x} cy={y} r={r}     fill="#FFE060"/>
      <circle cx={x} cy={y} r={r*0.5} fill="rgba(255,255,255,0.6)"/>
    </>
  )

  // Lună – seceră via SVG mask (ID unic per configurație → fără conflict de document)
  const Moon = ({ x=14, y=11, r=7 }) => {
    const mid = `sm-moon-${x}-${y}-${r}`
    return (
      <>
        <defs>
          <mask id={mid}>
            <circle cx={x} cy={y} r={r} fill="white"/>
            <circle cx={x+r*0.48} cy={y-r*0.27} r={r*0.86} fill="black"/>
          </mask>
        </defs>
        <circle cx={x} cy={y} r={r} fill="#D4B840" mask={`url(#${mid})`}
          style={{ animation:'fw-moon 3s ease-in-out infinite' }}/>
      </>
    )
  }

  // Picături ploaie cu animație SVG
  const Drops = () => (
    [[-4,0],[0,0.3],[4,0.15]].map(([dx,dl],i) => (
      <line key={i} x1={14+dx} y1={23} x2={14+dx-0.5} y2={27}
        stroke="#6AB8E8" strokeWidth="1.5" strokeLinecap="round" opacity={0}>
        <animateTransform attributeName="transform" type="translate"
          from="0 -4" to="0 4" dur="0.95s" begin={`-${dl}s`} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.9;0.9;0" dur="0.95s" begin={`-${dl}s`} repeatCount="indefinite"/>
      </line>
    ))
  )

  // Fulgi de zăpadă
  const Flakes = () => (
    [[-4.5,0],[1.5,0.35]].map(([dx,dl],i) => (
      <text key={i} x={14+dx} y={28} fontSize="7.5" fill="rgba(195,220,255,.92)"
        textAnchor="middle" opacity={0}>
        <animateTransform attributeName="transform" type="translate"
          from="0 -5" to="0 3" dur="1.3s" begin={`-${dl}s`} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0.9;0.9;0" dur="1.3s" begin={`-${dl}s`} repeatCount="indefinite"/>
      </text>
    ))
  )

  let icon = null
  if (tc === 'clear') {
    icon = n ? <Moon/> : <Sun/>
  } else if (tc === 'pc') {
    icon = n
      ? <><Moon x={18} y={9} r={5.5}/><Cld x={11} y={21} s={0.76}/></>
      : <><Sun  x={19} y={9} r={4.5}/><Cld x={11} y={21} s={0.76}/></>
  } else if (tc === 'ov') {
    icon = <>
      {n && <Moon x={14} y={7} r={5}/>}
      <Cld x={14} y={15} s={0.78}/>
      <Cld x={14} y={22} s={0.85}/>
    </>
  } else if (tc === 'fog') {
    icon = <>
      <Cld x={14} y={12} s={0.80}/>
      {[17,21,25].map((y,i) => (
        <rect key={i} x={2} y={y} width={24} height={2} rx={1}
          fill="rgba(200,210,225,0.52)">
          <animateTransform attributeName="transform" type="translate"
            from={i%2===0?'-3 0':'3 0'} to={i%2===0?'3 0':'-3 0'}
            dur="2.5s" repeatCount="indefinite" additive="sum"/>
        </rect>
      ))}
    </>
  } else if (tc === 'rain') {
    icon = <>
      {n && <Moon x={14} y={5} r={4.5}/>}
      <Cld x={14} y={14} s={0.88} dk/>
      <Drops/>
    </>
  } else if (tc === 'snow') {
    icon = <>
      {n && <Moon x={14} y={5} r={4.5}/>}
      <Cld x={14} y={14} s={0.88}/>
      <Flakes/>
    </>
  } else {
    icon = <>
      <Cld x={14} y={12} s={0.90} dk/>
      <polygon points="14,20 10.5,20 13,23.5 11,23.5 15,27.5 12.5,25 16.5,25"
        fill="#FFE055" opacity={0}>
        <animate attributeName="opacity" values="0;0;0;1;0.1;1;0.1;0" dur="3s" repeatCount="indefinite"/>
      </polygon>
    </>
  }

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" overflow="visible" style={{ display:'block' }}>
      {icon}
    </svg>
  )
}

// ── Main animated icon renderer ──
function WeatherAnimIcon({ code, hour, weatherIcon, scale }) {
  const isNight = hour < 6 || hour >= 21

  function wmoToType(c) {
    if (c === 0)                             return 'clear'
    if (c <= 2)                              return 'partlyCloud'
    if (c === 3)                             return 'overcast'
    if (c <= 48)                             return 'fog'
    if (c <= 67 || (c >= 80 && c <= 82))    return 'rain'
    if (c <= 77 || (c >= 85 && c <= 86))    return 'snow'
    if (c >= 95)                             return 'storm'
    return 'clear'
  }
  function emojiToType(icon) {
    if (icon==='☀️')              return 'clear'
    if (icon==='🌤️'||icon==='⛅') return 'partlyCloud'
    if (icon==='☁️')              return 'overcast'
    if (icon==='🌫️')             return 'fog'
    if (icon==='🌦️'||icon==='🌧️') return 'rain'
    if (icon==='❄️'||icon==='🌨️') return 'snow'
    if (icon==='⛈️')             return 'storm'
    if (icon==='🌙')              return 'clear'
    return 'clear'
  }

  const type = code != null ? wmoToType(code) : emojiToType(weatherIcon)
  const SZ = { position:'relative', width:70, height:70, overflow:'visible' }

  let icon = null

  if (type === 'clear') {
    icon = isNight
      ? <><WStars list={ST_CLEAR} /><WMoon cx={35} cy={35} r={22} /></>
      : <WSun cx={35} cy={35} r={23} />
  }
  else if (type === 'partlyCloud') {
    icon = isNight
      ? <><WStars list={ST_SM} /><WMoon cx={28} cy={18} r={19} opacity={0.9} />
          <WCloud cx={10} cy={28} sc={0.80} alpha={0.75} dark={false} bobAnim="fw-bob3 4s ease-in-out infinite" zIndex={3} /></>
      : <><div style={{ position:'absolute', left:10, top:5, width:48, height:48, zIndex:1 }}>
            <WSun cx={24} cy={24} r={18} slow />
          </div>
          <WCloud cx={8} cy={26} sc={0.84} alpha={0.93} dark={false} bobAnim="fw-bob2 3.5s ease-in-out infinite" zIndex={2} /></>
  }
  else if (type === 'overcast') {
    icon = <>
      {isNight && <WMoon cx={26} cy={14} r={15} opacity={0.5} />}
      <WCloud cx={-6}  cy={24} sc={0.68} alpha={0.70} dark={isNight} bobAnim="fw-bob3 4s ease-in-out infinite"   zIndex={2} />
      <WCloud cx={28}  cy={20} sc={0.70} alpha={0.70} dark={isNight} bobAnim="fw-bob 3s ease-in-out infinite"    zIndex={2} />
      <WCloud cx={-2}  cy={30} sc={0.86} alpha={0.92} dark={isNight} bobAnim="fw-bob2 3.5s ease-in-out infinite" zIndex={3} />
      <WCloud cx={24}  cy={28} sc={0.76} alpha={0.90} dark={isNight} bobAnim="fw-bob 3s ease-in-out infinite"    zIndex={3} />
    </>
  }
  else if (type === 'fog') {
    icon = <>
      {isNight && <WMoon cx={24} cy={14} r={14} opacity={0.28} />}
      <WCloud cx={-6}  cy={16} sc={0.68} alpha={0.65} dark={isNight} bobAnim="fw-bob3 4s ease-in-out infinite"   zIndex={2} />
      <WCloud cx={26}  cy={12} sc={0.70} alpha={0.65} dark={isNight} bobAnim="fw-bob 3s ease-in-out infinite"    zIndex={2} />
      <WCloud cx={-2}  cy={22} sc={0.84} alpha={0.90} dark={isNight} bobAnim="fw-bob2 3.5s ease-in-out infinite" zIndex={3} />
      <WCloud cx={22}  cy={20} sc={0.76} alpha={0.88} dark={isNight} bobAnim="fw-bob 3s ease-in-out infinite"    zIndex={3} />
      {FOG_BARS.map(([w,dur,dl,kf],i) => (
        <div key={i} style={{ position:'absolute', top:40+i*7, left:0, height:4, borderRadius:3, width:w, zIndex:5,
          background:'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.52),rgba(255,255,255,0))',
          animation:`${kf} ${dur}s ease-in-out infinite alternate`, animationDelay:`-${dl}s` }} />
      ))}
    </>
  }
  else if (type === 'rain') {
    icon = <>
      {isNight && <><WStars list={ST_1} /><WMoon cx={25} cy={10} r={16} opacity={0.55} /></>}
      <WCloud cx={10} cy={isNight?16:12} sc={0.92} alpha={0.90} dark bobAnim="fw-bob2 3.5s ease-in-out infinite" zIndex={2} />
      <WDrops />
    </>
  }
  else if (type === 'storm') {
    icon = <>
      {isNight && <WMoon cx={23} cy={8} r={14} opacity={0.35} />}
      <WCloud cx={8} cy={isNight?14:10} sc={0.98} alpha={0.95} dark bobAnim="fw-bob 3s ease-in-out infinite" zIndex={2} />
      <WDrops rows={DROPS.slice(0,4)} speedMul={0.85} />
      <div style={{ position:'absolute', left:32, top:40, zIndex:5, animation:'fw-flash 3s ease-in-out infinite' }}>
        <svg width="15" height="26" viewBox="0 0 15 26">
          <polygon points="9,0 3,14 7.5,14 6.5,26 12,10 7.5,10 11,0" fill="#FFE055" />
        </svg>
      </div>
    </>
  }
  else if (type === 'snow') {
    icon = <>
      {isNight && <><WStars list={ST_1} /><WMoon cx={25} cy={10} r={16} opacity={0.70} /></>}
      <WCloud cx={10} cy={isNight?14:10} sc={0.90} alpha={0.88} snowCloud bobAnim="fw-bob2 3.5s ease-in-out infinite" zIndex={2} />
      <WFlakes />
    </>
  }
  else {
    return <span style={{ fontSize:44, lineHeight:1 }}>{weatherIcon}</span>
  }

  if (scale && scale !== 1) {
    const px = Math.round(70 * scale)
    return (
      <div style={{ width:px, height:px, overflow:'hidden', flexShrink:0, position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, width:70, height:70,
          transform:`scale(${scale})`, transformOrigin:'top left' }}>
          {icon}
        </div>
      </div>
    )
  }
  return <div style={SZ}>{icon}</div>
}

// ── Main component ─────────────────────────────────────────────────────────
// Etichetă meteo din codul WMO (bilingv) — nu depindem de textul RO de la server
const WMO_LABELS = {
  0:  { ro: 'Senin',              en: 'Clear' },
  1:  { ro: 'Predominant senin',  en: 'Mainly clear' },
  2:  { ro: 'Parțial înnorat',    en: 'Partly cloudy' },
  3:  { ro: 'Cer acoperit',       en: 'Overcast' },
  45: { ro: 'Ceață',              en: 'Fog' },
  48: { ro: 'Ceață cu depunere',  en: 'Rime fog' },
  51: { ro: 'Burniță ușoară',     en: 'Light drizzle' },
  53: { ro: 'Burniță',            en: 'Drizzle' },
  55: { ro: 'Burniță deasă',      en: 'Dense drizzle' },
  56: { ro: 'Burniță înghețată',  en: 'Freezing drizzle' },
  57: { ro: 'Burniță înghețată',  en: 'Freezing drizzle' },
  61: { ro: 'Ploaie ușoară',      en: 'Light rain' },
  63: { ro: 'Ploaie',             en: 'Rain' },
  65: { ro: 'Ploaie puternică',   en: 'Heavy rain' },
  66: { ro: 'Ploaie înghețată',   en: 'Freezing rain' },
  67: { ro: 'Ploaie înghețată',   en: 'Freezing rain' },
  71: { ro: 'Ninsoare ușoară',    en: 'Light snow' },
  73: { ro: 'Ninsoare',           en: 'Snow' },
  75: { ro: 'Ninsoare abundentă', en: 'Heavy snow' },
  77: { ro: 'Grăunțe de zăpadă',  en: 'Snow grains' },
  80: { ro: 'Averse ușoare',      en: 'Light showers' },
  81: { ro: 'Averse',             en: 'Showers' },
  82: { ro: 'Averse violente',    en: 'Violent showers' },
  85: { ro: 'Averse de zăpadă',   en: 'Snow showers' },
  86: { ro: 'Averse de zăpadă',   en: 'Snow showers' },
  95: { ro: 'Furtună',            en: 'Thunderstorm' },
  96: { ro: 'Furtună cu grindină', en: 'Thunderstorm with hail' },
  99: { ro: 'Furtună cu grindină', en: 'Thunderstorm with hail' },
}
function wmoLabelText(code, fallback) {
  const m = WMO_LABELS[code]
  if (!m) return fallback || ''
  return getLang() === 'en' ? m.en : m.ro
}

export default function WeatherWidget({ c, onWeatherUpdate, transparent }) {
  if (!c) return null
  useI18n() // abonare la schimbarea limbii (re-render pe toggle RO/EN)
  const [weather, setWeather]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    loadWeather()
    const timer = setInterval(loadWeather, 30 * 60000)
    return () => clearInterval(timer)
  }, [])

  // Obține coordonate: GPS → ultima locație salvată → aproximativ după IP.
  // În APK/TWA geolocația poate fi refuzată, așa că avem fallback ca meteo să meargă.
  async function getCoords() {
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout:8000, maximumAge:1800000 })
        )
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        try { localStorage.setItem('forma_last_coords', JSON.stringify(c)) } catch (_) {}
        return c
      } catch (_) { /* trecem pe fallback */ }
    }
    try {
      const saved = JSON.parse(localStorage.getItem('forma_last_coords') || 'null')
      if (saved && saved.latitude && saved.longitude) return saved
    } catch (_) {}
    try {
      const r = await fetch('https://ipapi.co/json/')
      const j = await r.json()
      if (j && j.latitude && j.longitude) {
        const c = { latitude: Number(j.latitude), longitude: Number(j.longitude) }
        try { localStorage.setItem('forma_last_coords', JSON.stringify(c)) } catch (_) {}
        return c
      }
    } catch (_) {}
    throw new Error(tr('Locație indisponibilă'))
  }

  async function loadWeather() {
    try {
      const coords = await getCoords()
      const position = { coords }
      const { data:{ user } } = await supabase.auth.getUser()
      const { data, error:fnError } = await supabase.functions.invoke('weather-data', {
        body:{ userId:user?.id, latitude:position.coords.latitude, longitude:position.coords.longitude }
      })
      if (fnError) throw new Error(fnError.message)
      if (!data?.ok) throw new Error(data?.error || tr('Eroare meteo'))
      const baseWeather = data.weather
      let uvIndex=null, aqi=null, pm2_5=null, pm10=null, sunrise=null, sunset=null, moonrise=null, moonPhase=null
      try {
        const lat = position.coords.latitude.toFixed(4)
        const lon = position.coords.longitude.toFixed(4)

        // ── Dedicated sunrise/sunset fetch (independent, robust) ──
        // NOTE: only request sunrise+sunset here — moonrise is not valid for /v1/forecast
        try {
          const srssRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&daily=sunrise,sunset&forecast_days=1&timezone=auto`
          ).then(r => r.json())
          const srssDaily = srssRes?.daily ?? {}
          sunrise   = srssDaily.sunrise?.[0]    ?? null
          sunset    = srssDaily.sunset?.[0]     ?? null
        } catch { /* silent fallback */ }

        const [uvRes, aqiRes] = await Promise.allSettled([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index,weather_code,wind_speed_10m&daily=sunrise,sunset,moon_phase&forecast_days=1&timezone=auto`).then(r=>r.json()),
          fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi`).then(r=>r.json()),
        ])
        if (uvRes.status==='fulfilled') {
          const _uvHourly = uvRes.value?.hourly?.uv_index ?? []
          const _uvTimes  = uvRes.value?.hourly?.time ?? []
          const _nowHr    = new Date().toISOString().slice(0,13)
          const _uvIdx    = _uvTimes.findIndex(t => t.startsWith(_nowHr))
          uvIndex = _uvIdx >= 0 ? (_uvHourly[_uvIdx] ?? null) : (_uvHourly[0] ?? null)
          const daily = uvRes.value?.daily ?? {}
          // Only override sunrise/sunset if dedicated fetch didn't already get them
          if (!sunrise)   sunrise   = daily.sunrise?.[0]    ?? null
          if (!sunset)    sunset    = daily.sunset?.[0]     ?? null
          if (!moonPhase) moonPhase = daily.moon_phase?.[0] ?? null
          // moonrise not available in /v1/forecast daily vars — leave as null
          const hCodes = uvRes.value?.hourly?.weather_code ?? []
          const hWind  = uvRes.value?.hourly?.wind_speed_10m ?? []
          const hTimes = uvRes.value?.hourly?.time ?? []
          if (baseWeather.today_forecast && hCodes.length) {
            baseWeather.today_forecast = baseWeather.today_forecast.map(slot => {
              const idx = hTimes.findIndex(t => parseInt(t.split('T')[1]) === slot.hour)
              return { ...slot, weather_code:idx>=0?hCodes[idx]:null, wind_kmh:idx>=0?Math.round(hWind[idx]??0):null }
            })
          }
        }
        if (aqiRes.status==='fulfilled') {
          aqi   = aqiRes.value?.current?.us_aqi ?? null
          pm2_5 = aqiRes.value?.current?.pm2_5  ?? null
          pm10  = aqiRes.value?.current?.pm10   ?? null
        }
      } catch { /* opțional */ }

      // ── Separate 7-day daily forecast fetch ──
      let dailyForecast = []
      try {
        const lat2 = position.coords.latitude.toFixed(4)
        const lon2 = position.coords.longitude.toFixed(4)
        const dr = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat2}&longitude=${lon2}` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
          `&forecast_days=7&timezone=auto`
        ).then(r => r.json())
        const dd = dr.daily ?? {}
        const DAYS_RO = getLang() === 'en'
          ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
          : ['Dum','Lun','Mar','Mie','Joi','Vin','Sâm']
        dailyForecast = (dd.time ?? []).slice(1).map((dateStr, i) => ({
          day:    DAYS_RO[new Date(dateStr + 'T12:00:00').getDay()],
          maxT:   dd.temperature_2m_max?.[i+1] != null ? Math.round(dd.temperature_2m_max[i+1]) : null,
          minT:   dd.temperature_2m_min?.[i+1] != null ? Math.round(dd.temperature_2m_min[i+1]) : null,
          code:   dd.weather_code?.[i+1] ?? null,
          precip: dd.precipitation_probability_max?.[i+1] ?? null,
        }))
      } catch { /* prognoza zilnică opțională */ }

      const enrichedWeather = { ...baseWeather, uv_index:uvIndex, aqi, pm2_5, pm10, sunrise, sunset, moonrise, moon_phase:moonPhase, dailyForecast }
      setWeather(enrichedWeather)
      if (onWeatherUpdate) onWeatherUpdate(enrichedWeather)
      setError(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function wmoIcon(code, hour) {
    const n = hour < 6 || hour >= 21
    if (code===0)  return n?'🌙':'☀️'
    if (code<=2)   return n?'🌙':'🌤️'
    if (code===3)  return '☁️'
    if (code<=48)  return '🌫️'
    if (code<=55)  return '🌦️'
    if (code<=65)  return '🌧️'
    if (code<=67)  return '🌨️'
    if (code<=77)  return '❄️'
    if (code<=82)  return '🌦️'
    if (code<=86)  return '🌨️'
    if (code>=95)  return '⛈️'
    return '🌡️'
  }

  function forecastSummary(forecast, currentWind, uvIdx) {
    if (!forecast?.length) return null
    const alerts = []
    const rainHours     = forecast.filter(h => h.precip_prob >= 40)
    const highWindHours = forecast.filter(h => (h.wind_kmh??0) >= 30)
    const stormHours    = forecast.filter(h => h.weather_code >= 95)
    const snowHours     = forecast.filter(h => h.weather_code >= 71 && h.weather_code <= 77)
    const EN = getLang() === 'en'
    if (stormHours.length)       alerts.push(EN ? `⛈️ Storm expected around ${stormHours[0].hour}:00 — avoid outdoor activities.` : `⛈️ Furtună așteptată în jurul orei ${stormHours[0].hour}:00 — evită activitățile în aer liber.`)
    else if (rainHours.length>=3) alerts.push(EN ? `🌧️ Rain likely across several hours — take an umbrella.` : `🌧️ Precipitații probabile în mai multe intervale orare — ia o umbrelă.`)
    else if (rainHours.length)   alerts.push(EN ? `🌦️ Chance of rain around ${rainHours[0].hour}:00 (${rainHours[0].precip_prob}%).` : `🌦️ Șanse de ploaie în jurul orei ${rainHours[0].hour}:00 (${rainHours[0].precip_prob}%).`)
    if (snowHours.length)        alerts.push(EN ? `❄️ Snow possible around ${snowHours[0].hour}:00.` : `❄️ Ninsoare posibilă spre ora ${snowHours[0].hour}:00.`)
    if (highWindHours.length)    alerts.push(EN ? `💨 Strong wind (${highWindHours[0].wind_kmh} km/h) around ${highWindHours[0].hour}:00 — mind outdoor activities.` : `💨 Vânt puternic (${highWindHours[0].wind_kmh} km/h) spre ora ${highWindHours[0].hour}:00 — atenție la activități outdoor.`)
    if (uvIdx >= 8)              alerts.push(EN ? `☀️ Extreme UV index (${uvIdx.toFixed(0)}) — apply sunscreen and avoid exposure 11:00–16:00.` : `☀️ Indice UV extrem (${uvIdx.toFixed(0)}) — aplică protecție solară și evită expunerea 11:00–16:00.`)
    else if (uvIdx >= 6)         alerts.push(EN ? `☀️ High UV (${uvIdx.toFixed(0)}) — sunscreen recommended.` : `☀️ UV ridicat (${uvIdx.toFixed(0)}) — recomandată protecție solară.`)
    if (!alerts.length)          alerts.push(EN ? '✅ Favorable conditions for outdoor activities in the coming hours.' : '✅ Condiții favorabile pentru activități în aer liber în orele viitoare.')
    return alerts
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:c.text4, padding:'6px 12px' }}>
      <span>🌍</span> ...
    </div>
  )
  if (error || !weather) return null

  const pressureDelta       = weather.pressure_delta_24h
  const hasSignificantChange = pressureDelta != null && Math.abs(pressureDelta) >= 6
  const aqi     = weather.aqi     ?? null
  const pm2_5   = weather.pm2_5   ?? null
  const pm10    = weather.pm10    ?? null
  const uvIndex = weather.uv_index ?? null

  const aqiColor = !aqi ? c.text4 : aqi<=50 ? '#4EC94E' : aqi<=100 ? '#D4B800' : aqi<=150 ? '#F08030' : '#E04040'
  const aqiLabel = !aqi ? '—'     : aqi<=50 ? tr('Bun')     : aqi<=100 ? tr('Moderat')  : aqi<=150 ? tr('Nesănătos*') : tr('Nesănătos')
  const uvColor  = !uvIndex ? c.text4 : uvIndex<=2 ? '#4EC94E' : uvIndex<=5 ? '#D4B800' : uvIndex<=7 ? '#F08030' : uvIndex<=10 ? '#E04040' : '#9B30FF'
  const uvLabel  = !uvIndex ? '—'     : uvIndex<=2 ? tr('Scăzut')  : uvIndex<=5 ? tr('Moderat')  : uvIndex<=7 ? tr('Ridicat')  : uvIndex<=10 ? tr('Foarte ridicat') : tr('Extrem')

  const currentHour = new Date().getHours()
  const currentSlot = weather.today_forecast?.find(h => h.hour === currentHour)
  const currentCode = currentSlot?.weather_code ?? weather.today_forecast?.find(h => h.weather_code != null)?.weather_code ?? null

  // Detect dark palette (for unified card background)
  const isDark = (() => {
    try {
      const hex = (c.card||'').replace('#','')
      if (hex.length < 6) return false
      const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16)
      return (r*299+g*587+b*114)/1000 < 100
    } catch { return false }
  })()
  const CARD_DARK = '#0D1E32'  // unified dark nav bg for all sections

  return (
    <div style={{ position:'relative' }}>
      {/* ── Compact trigger ── */}
      <div onClick={() => setShowDetail(s => !s)}
        style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color: transparent ? 'rgba(255,255,255,0.75)' : c.text3,
          background: transparent ? 'transparent' : c.card,
          padding: transparent ? '4px 6px' : '6px 12px',
          borderRadius:c.radiusSm,
          boxShadow: transparent ? 'none' : c.shadowCard,
          cursor:'pointer', userSelect:'none' }}>
        <span style={{ fontSize:16 }}>{weather.weather_icon}</span>
        <strong style={{ color: transparent ? '#ffffff' : c.text, fontSize:13 }}>{Math.round(weather.temperature_c)}°</strong>
        {hasSignificantChange && <span style={{ fontSize:10, color:c.orange }}>⚡</span>}
      </div>

      {/* ── Expanded modal ── */}
      {showDetail && (
        <div onClick={() => setShowDetail(false)}
          style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:isDark?CARD_DARK:c.card, borderRadius:20, width:'100%', maxWidth:400,
              maxHeight:'90vh', overflow:'hidden', border:`1px solid ${c.border2}`, boxShadow:c.shadowHero,
              display:'flex', flexDirection:'column' }}>

            {/* Header — fix, nu defilează */}
            <div style={{ background:'linear-gradient(135deg,#1A2E44 0%,#0D1E32 100%)', padding:'16px 16px 12px', flexShrink:0 }}>
              {/* Inline keyframes — garantat sincron cu DOM */}
              <style>{FW_CSS}</style>

              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:42, fontWeight:800, color:'#fff', lineHeight:1 }}>{Math.round(weather.temperature_c)}°C</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.75)', marginTop:4 }}>{wmoLabelText(currentCode, weather.weather_label)}</div>
                </div>
                <WeatherAnimIcon code={currentCode} hour={currentHour} weatherIcon={weather.weather_icon} />
              </div>

              {/* Quick stats */}
              <div style={{ display:'flex', gap:14, marginTop:12, flexWrap:'wrap' }}>
                {[
                  { icon:'💧', label:'Umiditate', val:`${weather.humidity_pct}%` },
                  { icon:'💨', label:'Vânt',      val:`${weather.wind_speed_kmh} km/h` },
                  uvIndex != null && { icon:'☀️', label:'UV', val:uvIndex.toFixed(1), col:uvColor },
                  { icon:'🌡️', label:'Presiune',  val:`${weather.pressure_hpa} hPa` },
                ].filter(Boolean).map((item,i) => (
                  <div key={i} style={{ textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginBottom:2 }}>{item.icon} {tr(item.label)}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:item.col||'rgba(255,255,255,0.9)' }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll container */}
            <div style={{ overflowY:'auto', flex:1, WebkitOverflowScrolling:'touch' }}>

            {/* AQI */}
            {aqi != null && (
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${c.border2}` }}>
                <div style={{ fontSize:10, color:c.text4, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{tr('Calitatea aerului')}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontSize:22, fontWeight:800, color:aqiColor }}>{aqi}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:aqiColor, background:`${aqiColor}22`, padding:'3px 10px', borderRadius:20 }}>{aqiLabel}</div>
                </div>
                <div style={{ position:'relative', height:8, borderRadius:4, marginBottom:6, overflow:'hidden',
                  background:'linear-gradient(90deg,#4EC94E 0%,#D4B800 25%,#F08030 50%,#E04040 75%,#8B0000 100%)' }}>
                  <div style={{ position:'absolute', top:-2, width:12, height:12, borderRadius:'50%',
                    background:'#fff', boxShadow:'0 0 0 2px rgba(0,0,0,0.3)',
                    left:`${Math.min(99,(aqi/300)*100)}%`, transform:'translateX(-50%)' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:c.text4 }}>
                  <span>0 {tr('Bun')}</span><span>100</span><span>200</span><span>300 {tr('Hazard')}</span>
                </div>
                {(pm2_5!=null||pm10!=null) && (
                  <div style={{ display:'flex', gap:16, marginTop:10 }}>
                    {pm2_5!=null && <div><div style={{ fontSize:10, color:c.text4 }}>PM2.5</div><div style={{ fontSize:13, fontWeight:700, color:c.text }}>{pm2_5.toFixed(1)} <span style={{ fontSize:10, fontWeight:400 }}>µg/m³</span></div></div>}
                    {pm10!=null  && <div><div style={{ fontSize:10, color:c.text4 }}>PM10</div><div style={{ fontSize:13, fontWeight:700, color:c.text }}>{pm10.toFixed(1)} <span style={{ fontSize:10, fontWeight:400 }}>µg/m³</span></div></div>}

                  </div>
                )}
              </div>
            )}

            {/* UV Index bar — only when data available */}
            {uvIndex != null && <div style={{ padding:'12px 16px', borderBottom:`1px solid ${c.border2}` }}>
              <div style={{ fontSize:10, color:c.text4, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{tr('Indice UV')}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontSize:22, fontWeight:800, color:uvColor }}>{uvIndex.toFixed(1)}</div>
                <div style={{ fontSize:12, fontWeight:600, color:uvColor, background:`${uvColor}22`, padding:'3px 10px', borderRadius:20 }}>{uvLabel}</div>
              </div>
              <div style={{ position:'relative', height:8, borderRadius:4, marginBottom:6, overflow:'hidden',
                background:'linear-gradient(90deg,#4EC94E 0%,#DDCC00 22%,#F08030 45%,#E04040 65%,#9B30FF 100%)' }}>
                <div style={{ position:'absolute', top:-2, width:12, height:12, borderRadius:'50%',
                  background:'#fff', boxShadow:'0 0 0 2px rgba(0,0,0,0.3)',
                  left:`${Math.min(99,(uvIndex/13)*100)}%`, transform:'translateX(-50%)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:c.text4 }}>
                <span>0 {tr('Scăzut')}</span><span>3</span><span>6</span><span>8</span><span>11+ {tr('Extrem')}</span>
              </div>
            </div>}

            {/* Pressure alert */}
            {hasSignificantChange && (
              <div style={{ padding:'10px 16px', background:isDark?'rgba(255,160,30,0.08)':'#2A1E0A', borderBottom:`1px solid ${c.border2}` }}>
                <div style={{ fontSize:11, color:c.orange, lineHeight:1.5 }}>
                  ⚡ Variație presiune {pressureDelta>0?'+':''}{pressureDelta} hPa/24h — poate afecta readiness-ul și energia.
                </div>
              </div>
            )}

            {/* Hourly forecast */}
            {weather.today_forecast?.length > 0 && (() => {
              const alerts = forecastSummary(weather.today_forecast, weather.wind_speed_kmh, weather.uv_index)
              return (
                <div style={{ padding:'12px 16px' }}>
                  <div style={{ fontSize:10, color:c.text4, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>{tr('Prognoză orară')}</div>
                  <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8 }}>
                    {weather.today_forecast.map((h,i) => (
                      <div key={i} style={{ textAlign:'center', flexShrink:0, minWidth:44 }}>
                        <div style={{ fontSize:10, color:c.text4, marginBottom:3 }}>{h.hour}:00</div>
                        <div style={{ display:'flex', justifyContent:'center', marginBottom:3 }}>
                          <WeatherIconSm code={h.weather_code} hour={h.hour} />
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, color:c.text }}>{h.temp}°</div>
                        {h.precip_prob>=20 && <div style={{ fontSize:9, color:'#4A9EE8', marginTop:2 }}>💧{h.precip_prob}%</div>}
                      </div>
                    ))}
                  </div>
                  {alerts?.length > 0 && (
                    <div style={{ marginTop:8, borderTop:`1px solid ${c.border2}`, paddingTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                      {alerts.map((txt,i) => (
                        <div key={i} style={{ fontSize:12, color:c.text, lineHeight:1.5, background:c.card2, borderRadius:10, padding:'8px 12px' }}>{txt}</div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 7-day daily forecast */}
            {weather.dailyForecast?.length > 0 && (
              <div style={{ padding:'12px 16px', borderTop:`1px solid ${c.border2}` }}>
                <div style={{ fontSize:10, color:c.text4, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>{tr('Prognoză zilnică')}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {weather.dailyForecast.map((d, i) => {
                    const icon = wmoIcon(d.code, 12)
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0',
                        borderBottom: i < weather.dailyForecast.length-1 ? `1px solid ${c.border2}` : 'none' }}>
                        <div style={{ width:32, fontSize:11, fontWeight:600, color:c.text4 }}>{d.day}</div>
                        <div style={{ fontSize:18, lineHeight:1 }}>{icon}</div>
                        {d.precip > 20
                          ? <div style={{ fontSize:9, color:'#4A9EE8', minWidth:28 }}>💧{d.precip}%</div>
                          : <div style={{ minWidth:28 }}/>}
                        <div style={{ flex:1 }}/>
                        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                          <div style={{ fontSize:13, fontWeight:700, color:c.text }}>{d.maxT != null ? d.maxT+'°' : '—'}</div>
                          <div style={{ fontSize:11, color:c.text4 }}>{d.minT != null ? d.minT+'°' : '—'}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sun / Moon arc — bottom of card */}
            <div style={{ background:'linear-gradient(180deg,#0A1620 0%,#0D1E32 100%)', borderTop:`1px solid ${c.border2}` }}>
              <SunMoonArc
                sunrise={weather.sunrise}
                sunset={weather.sunset}
                moonrise={weather.moonrise}
                moonPhase={weather.moon_phase}
                wmoCode={currentCode}
              />
            </div>

            </div>{/* end scroll container */}
          </div>
        </div>
      )}
    </div>
  )
}
