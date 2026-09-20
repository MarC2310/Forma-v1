// src/components/AchievementSystem.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const MEDAL_DEFS = [
  { id:'somn_atins',   name:'Somn Atins',   sub:'≥7.5h/noapte',   key:'noapte',  type:'circle',  cx:111,cy:113,r:77, rot:0, rnd:0,gap:0,  color:'#5B7EC9',bg1:'#1A2A5A',bg2:'#0D1E4A',ring:'#5B7EC9',series:1 },
  { id:'pasi_atins',   name:'Pași Atinși',  sub:'10.000 pași/zi', key:'pasi',    type:'circle',  cx:111,cy:110,r:81, rot:0, rnd:0,gap:0,  color:'#5DB85D',bg1:'#3B6D11',bg2:'#0F2A04',ring:'#5DB85D',series:2 },
  { id:'pasi_2x',      name:'Pași 2×',      sub:'20.000 pași/zi', key:'pasi2x',  type:'circle',  cx:108,cy:112,r:79, rot:0, rnd:0,gap:64, color:'#5DB85D',bg1:'#3B6D11',bg2:'#0F2A04',ring:'#5DB85D',series:3 },
  { id:'pasi_3x',      name:'Pași 3×',      sub:'30.000 pași/zi', key:'pasi3x',  type:'hexagon', cx:111,cy:110,r:102,rot:30,rnd:5,gap:0,  color:'#5DB85D',bg1:'#3B6D11',bg2:'#0F2A04',ring:'#5DB85D',series:4 },
  { id:'calorii_arse', name:'Calorii Arse', sub:'≥target zilnic',  key:'calorii', type:'circle',  cx:107,cy:111,r:77, rot:0, rnd:0,gap:0,  color:'#22A822',bg1:'#2A1A0A',bg2:'#1A0A00',ring:'#BA7517',series:5 },
  { id:'luna_1',       name:'Luna 1',        sub:'≥90% obiective', key:'luna1',   type:'partial', cx:110,cy:109,r:72, rot:0, rnd:0,gap:0,  color:'#22A822',bg1:'#4A3A00',bg2:'#1A1200',ring:'#BA9517',series:6 },
]

const BASE = 'https://yiqmkcbdywtkjuvztwkg.supabase.co/storage/v1/object/public/medals'
const MEDAL_IMG = {
  noapte:  BASE + '/noapte.png',
  pasi:    BASE + '/pasi.png',
  pasi2x:  BASE + '/pasi2x.png',
  pasi3x:  BASE + '/pasi3x.png',
  calorii: BASE + '/calorii.png',
  luna1:   BASE + '/luna1.png',
}

async function loadEarned(userId) {
  const { data } = await supabase.from('user_achievements').select('*')
    .eq('user_id', userId).order('obtained_at', { ascending: false })
  return data || []
}

function hexPath(cx, cy, r, rot, rnd, gap) {
  const v = []
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 + rot) * Math.PI / 180
    v.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  const dist = (a, b) => Math.hypot(b[0]-a[0], b[1]-a[1])
  const s = v.map((p, i) => {
    const pp = v[(i+5)%6], pn = v[(i+1)%6]
    const dp = [pp[0]-p[0], pp[1]-p[1]], dn = [pn[0]-p[0], pn[1]-p[1]]
    const lp = dist(p,pp), ln = dist(p,pn), rr = Math.min(rnd, lp/2, ln/2)
    return { c:p, f:[p[0]+dp[0]/lp*rr,p[1]+dp[1]/lp*rr], t:[p[0]+dn[0]/ln*rr,p[1]+dn[1]/ln*rr] }
  })
  let maxY=-999, gs=0
  for (let i=0; i<6; i++) { const my=(v[i][1]+v[(i+1)%6][1])/2; if(my>maxY){maxY=my;gs=i} }
  let d = `M${s[0].t[0].toFixed(1)},${s[0].t[1].toFixed(1)}`
  for (let i=0; i<6; i++) {
    const si=s[i], ns=s[(i+1)%6]
    d+=` Q${si.c[0].toFixed(1)},${si.c[1].toFixed(1)} ${ns.f[0].toFixed(1)},${ns.f[1].toFixed(1)}`
    if (i===gs && gap>0) {
      const gp=gap/120, f=ns.f, t=ns.t
      d+=` L${(f[0]+(t[0]-f[0])*(0.5-gp)).toFixed(1)},${(f[1]+(t[1]-f[1])*(0.5-gp)).toFixed(1)}`
      d+=` M${(f[0]+(t[0]-f[0])*(0.5+gp)).toFixed(1)},${(f[1]+(t[1]-f[1])*(0.5+gp)).toFixed(1)}`
    } else {
      d+=` L${ns.f[0].toFixed(1)},${ns.f[1].toFixed(1)}`
    }
  }
  return d
}

function Ring({ m, on, score }) {
  const circ = 2 * Math.PI * m.r
  const pct = m.type === 'partial' ? Math.min(score || 90, 100) / 100 : 1
  const gapLen = m.gap > 0 ? (m.gap/360)*circ : 0
  const arc = (circ - gapLen) * pct
  const rot = m.gap > 0 ? 90+m.gap/2 : -90
  const da = `${arc.toFixed(1)} ${circ.toFixed(1)}`
  const tr = { transform:`rotate(${rot}deg)`, transformOrigin:'50% 50%' }
  const isHex = m.type === 'hexagon'
  const El = isHex ? 'path' : 'circle'
  const sp = isHex ? { d: hexPath(m.cx,m.cy,m.r,m.rot,m.rnd,m.gap) } : { cx:m.cx, cy:m.cy, r:m.r }
  const trackDa = m.gap > 0 ? `${(circ-gapLen).toFixed(1)} ${gapLen.toFixed(1)}` : undefined
  return (
    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:5}} viewBox="0 0 220 220">
      <El fill="none" stroke={m.color+'33'} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
        style={trackDa ? {...tr, strokeDasharray:trackDa} : {}} {...sp}/>
      {on && (
        <El fill="none" stroke={m.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
          style={{...tr, strokeDasharray:da, transition:'stroke-dasharray 2s cubic-bezier(.35,0,.75,1)',
            filter:`drop-shadow(0 0 4px ${m.color}88)`}} {...sp}/>
      )}
    </svg>
  )
}

function Back({ m, obtainedAt, score, userName }) {
  const now = obtainedAt ? new Date(obtainedAt) : new Date()
  const time = now.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})
  const date = now.toLocaleDateString('ro-RO',{weekday:'short',day:'numeric',month:'long',year:'numeric'})
  return (
    <svg viewBox="0 0 220 220" style={{width:'100%',height:'100%'}} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`rg${m.id}`} cx="60%" cy="30%" r="70%">
          <stop offset="0%" stopColor={m.bg1} stopOpacity=".85"/>
          <stop offset="100%" stopColor={m.bg2}/>
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="108" fill={`url(#rg${m.id})`}/>
      <circle cx="110" cy="110" r="108" fill="none" stroke={m.ring} strokeWidth="4" opacity=".5"/>
      <circle cx="110" cy="110" r="100" fill="none" stroke={m.ring} strokeWidth="1.5" opacity=".2"/>
      <text x="110" y="44" textAnchor="middle" fontSize="13" fontWeight="900" fill="rgba(255,255,255,.9)" fontFamily="system-ui" letterSpacing="3">FORMA</text>
      <line x1="28" y1="54" x2="192" y2="54" stroke={m.ring} strokeWidth="1" opacity=".5"/>
      {m.type === 'partial' && score
        ? <text x="110" y="96" textAnchor="middle" fontSize="34" fontWeight="900" fill="#FFD700" fontFamily="system-ui">{Math.round(score)}%</text>
        : <text x="110" y="96" textAnchor="middle" fontSize="28">⭐</text>
      }
      <line x1="28" y1="106" x2="192" y2="106" stroke={m.ring} strokeWidth="1" opacity=".5"/>
      <text x="110" y="126" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,.55)" fontFamily="system-ui">Obținut la</text>
      <text x="110" y="148" textAnchor="middle" fontSize="21" fontWeight="700" fill="#fff" fontFamily="system-ui">{time}</text>
      <text x="110" y="164" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.65)" fontFamily="system-ui">{date}</text>
      <line x1="28" y1="174" x2="192" y2="174" stroke={m.ring} strokeWidth="1" opacity=".35"/>
      <text x="110" y="186" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.28)" fontFamily="system-ui">#{String(m.series).padStart(5,'0')} · {userName || 'Marcel'}</text>
    </svg>
  )
}

export function AchievementPopup({ achievementId, obtainedAt, score, userName, onClose }) {
  const m = MEDAL_DEFS.find(d => d.id === achievementId)
  const [ringOn, setRingOn] = useState(false)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (!m) return
    const t1 = setTimeout(() => setRingOn(true), 100)
    const t2 = setTimeout(() => {
      setFlipped(true)
      const cols = [m.color, '#FFD700', '#fff']
      for (let i = 0; i < 55; i++) {
        const el = document.createElement('div')
        const s = 4 + Math.random() * 10
        el.style.cssText = `position:fixed;z-index:10001;pointer-events:none;left:${5+Math.random()*90}%;top:${Math.random()*25}%;width:${s}px;height:${s}px;background:${cols[Math.floor(Math.random()*cols.length)]};border-radius:${Math.random()>.5?'50%':'3px'};animation:ach-fall ${1.5+Math.random()*1.2}s ease-in ${Math.random()*.8}s forwards;`
        document.body.appendChild(el)
        setTimeout(() => el.remove(), 3500)
      }
    }, 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!m) return null

  return (
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(10px)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'2rem'}}>
        <div style={{position:'relative',width:240,height:240,perspective:900,marginBottom:24}}>
          <div style={{width:'100%',height:'100%',position:'relative',transformStyle:'preserve-3d',
            animation:flipped?'ach-spin .9s cubic-bezier(.4,0,.2,1) forwards,ach-idle 7s ease-in-out .9s infinite':'none'}}>
            <div style={{position:'absolute',width:'100%',height:'100%',backfaceVisibility:'hidden'}}>
              <img src={MEDAL_IMG[m.key]} style={{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 8px 24px rgba(0,0,0,.5))'}} alt={m.name}/>
              <Ring m={m} on={ringOn} score={score}/>
            </div>
            <div style={{position:'absolute',width:'100%',height:'100%',backfaceVisibility:'hidden',transform:'rotateY(180deg)',borderRadius:'50%',overflow:'hidden'}}>
              <Back m={m} obtainedAt={obtainedAt} score={score} userName={userName}/>
            </div>
          </div>
        </div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:13,color:'rgba(255,255,255,.6)',marginBottom:4}}>🏅 Medalie obținută!</div>
          <div style={{fontSize:20,fontWeight:800,color:m.color,marginBottom:6}}>{m.name}</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.5)',marginBottom:20}}>{m.sub}</div>
          <button onClick={onClose} style={{padding:'10px 32px',background:m.color,color:'#fff',border:'none',borderRadius:24,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            Super! ✓
          </button>
        </div>
      </div>
      <style>{`
        @keyframes ach-spin{0%{transform:rotateY(-540deg) scale(.1);opacity:0;}70%{transform:rotateY(12deg) scale(1.05);opacity:1;}100%{transform:rotateY(0) scale(1);}}
        @keyframes ach-idle{0%,40%{transform:rotateY(0);}50%,60%{transform:rotateY(180deg);}70%,100%{transform:rotateY(0);}}
        @keyframes ach-fall{0%{transform:translateY(0) rotate(0);opacity:1;}100%{transform:translateY(100vh) rotate(720deg);opacity:0;}}
      `}</style>
    </div>
  )
}

export function AchievementsWidget({ c, userId, userName, isMobile }) {
  const [earned, setEarned] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (userId) loadEarned(userId).then(setEarned)
  }, [userId])

  return (
    <div style={{background:c.card,border:`0.5px solid ${c.border}`,borderRadius:14,padding:'1rem',marginBottom:'1rem'}}>
      <div style={{fontSize:11,fontWeight:600,color:c.text4,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:14}}>
        🏅 Medaliile mele <span style={{fontWeight:400}}>({earned.length}/{MEDAL_DEFS.length})</span>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:isMobile?10:16,justifyContent:'center'}}>
        {MEDAL_DEFS.map(m => {
          const ua = earned.find(e => e.achievement_id === m.id)
          return (
            <div key={m.id} onClick={() => ua && setSelected(ua)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                cursor:ua?'pointer':'default',opacity:ua?1:0.3,filter:ua?'none':'grayscale(100%)',transition:'all .2s'}}>
              <div style={{position:'relative',width:isMobile?52:62,height:isMobile?52:62}}>
                <img src={MEDAL_IMG[m.key]} style={{width:'100%',height:'100%',objectFit:'contain',filter:'drop-shadow(0 2px 6px rgba(0,0,0,.3))'}} alt={m.name}/>
                {ua && <div style={{position:'absolute',bottom:-2,right:-2,width:14,height:14,background:'#FFD700',borderRadius:'50%',border:`2px solid ${c.card}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:900}}>✓</div>}
              </div>
              <div style={{fontSize:9,color:ua?c.text3:c.text4,textAlign:'center',maxWidth:64,lineHeight:1.3}}>{m.name}</div>
            </div>
          )
        })}
      </div>
      {selected && (
        <AchievementPopup
          achievementId={selected.achievement_id}
          obtainedAt={selected.obtained_at}
          score={selected.score}
          userName={userName}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
