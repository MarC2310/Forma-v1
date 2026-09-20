/**
 * src/components/MuscleRecoveryMap.jsx — FORMA v66
 * Siluetă anatomică SVG colorată în funcție de recuperare.
 * Dependency: body-muscles (Apache 2.0) — npm install body-muscles
 */
import { useState, useMemo } from 'react'
import { MUSCLE_MAP } from 'body-muscles'

const getColor  = (p) => p >= 80 ? '#16a34a' : p >= 55 ? '#d97706' : '#dc2626'
const getBg     = (p) => p >= 80 ? 'rgba(22,163,74,0.1)' : p >= 55 ? 'rgba(217,119,6,0.12)' : 'rgba(220,38,38,0.12)'
const getBorder = (p) => p >= 80 ? 'rgba(22,163,74,0.28)' : p >= 55 ? 'rgba(217,119,6,0.28)' : 'rgba(220,38,38,0.28)'

const LABELS = {
  quads:'Cvadriceps', hamstrings:'Ischiogambieri', calves:'Gambe',
  glutes:'Fesieri', lower_back:'Lombari', chest:'Piept',
  shoulders:'Umeri', biceps:'Biceps', triceps:'Triceps',
  abs:'Abdomen', forearms:'Antebrațe', lats:'Dorsali',
  traps:'Trapez', obliques:'Oblici',
}

// ORDER MATTERS: hamstrings înainte de biceps
const FRAGS = {
  quads:      ['quadricep','vastus','rectus femoris','rectus-femoris'],
  hamstrings: ['hamstring','biceps femoris','biceps-femoris','semitendin','semimembran'],
  calves:     ['gastrocnem','soleus','tibialis posterior','calf'],
  glutes:     ['gluteus','gluteal','glute','piriform'],
  lower_back: ['erector','lumbar','multifidus','quadratus lumb','lower back','lower-back'],
  chest:      ['pectoral','serratus','chest'],
  shoulders:  ['deltoid','shoulder','rotator cuff','infraspinatus','supraspinatus','teres minor'],
  biceps:     ['bicep','brachialis','coracobrachialis'],
  triceps:    ['tricep','anconeus'],
  abs:        ['abdominis','transversus','abdom','abs'],
  forearms:   ['brachioradial','forearm','flexor carpi','pronator teres','supinator','extensor carpi'],
  lats:       ['latissimus','teres major','lats'],
  traps:      ['trapezius'],
  obliques:   ['oblique'],
}

function matchMuscle(id, name) {
  const strs = [id, name].filter(Boolean).map((s) => s.toLowerCase().replace(/-/g, ' '))
  for (const [key, frags] of Object.entries(FRAGS))
    for (const s of strs) for (const f of frags) if (s.includes(f)) return key
  return null
}

// ── Mapare nume exercițiu → cheie grupă musculară (pentru MiniMuscleMap) ─────
function exerciseToMuscleKey(exerciseName) {
  const n = (exerciseName || '').toLowerCase().replace(/-/g, ' ')
  const has = (s) => n.includes(s)
  // Posterior chain
  if (has('leg curl') || has('nordic') || has('rdl') || has('romanian') || has('stiff leg') || has('glute ham')) return 'hamstrings'
  // Anterior chain
  if (has('leg press') || has('leg extension') || has('hack squat') || has('split squat') || has('bulgarian') || has('sissy squat') || has('wall sit')) return 'quads'
  if (has('squat') || has('lunge')) return 'quads'
  // Calves
  if (has('calf') || has('calves') || has('gastrocnem') || has('soleus')) return 'calves'
  // Glutes
  if (has('hip thrust') || has('glute bridge') || has('glute kickback') || has('donkey kick') || has('hip abduction') || has('abductor')) return 'glutes'
  // Chest
  if (has('bench press') || has('chest press') || has('incline press') || has('decline press') || has('push up') || has('pushup') || has('chest fly') || has('cable fly') || has('dumbbell fly') || has('machine fly') || has('pec deck') || has('pectoral')) return 'chest'
  if (has('dip') && !has('tricep') && !has('bench dip') && !has('chair dip')) return 'chest'
  // Lats / Back width
  if (has('pulldown') || has('pull up') || has('pullup') || has('chin up') || has('chinup')) return 'lats'
  if (has('deadlift') || has('row') || has('teres major') || has('pendlay')) return 'lats'
  // Lower back
  if (has('back extension') || has('hyperextension') || has('good morning') || has('lower back') || has('back raise')) return 'lower_back'
  // Traps
  if (has('shrug') || has('trapezius')) return 'traps'
  // Shoulders
  if (has('face pull') || has('lateral raise') || has('front raise') || has('arnold') || has('overhead press') || has('military press') || has('shoulder press') || has('rear delt') || has('reverse fly') || has('deltoid')) return 'shoulders'
  if (has('overhead') && has('press') && !has('leg')) return 'shoulders'
  // Triceps
  if (has('tricep') || has('skull') || has('pushdown') || has('push down') || has('close grip') || has('lying extension') || has('bench dip') || has('chair dip') || has('overhead ext')) return 'triceps'
  // Biceps
  if ((has('curl') || has('bicep') || has('brachialis') || has('hammer curl')) && !has('leg curl')) return 'biceps'
  // Abs / Core
  if (has('plank') || has('crunch') || has('sit up') || has('situp') || has('dead bug') || has('dragon flag') || has('hollow') || has('ab roller') || has('hanging') || has('russian twist') || has('cable crunch') || has('wood chop') || has('leg raise') || has('knee raise') || has('mountain climber')) return 'abs'
  // Obliques
  if (has('oblique') || has('side plank') || has('side bend') || has('windshield') || has('pallof')) return 'obliques'
  // Forearms
  if (has('wrist curl') || has('forearm') || has('reverse curl') || has('pronator')) return 'forearms'
  return null
}

const ALL_MUSCLES = Array.isArray(MUSCLE_MAP) ? MUSCLE_MAP : Object.values(MUSCLE_MAP)

function BodySVG({ view, muscleColors }) {
  const muscles = useMemo(() => ALL_MUSCLES.filter((m) => m.view === view), [view])
  return (
    <svg viewBox={view === 'FRONT' ? '0 0 38 118' : '35 -1 38 120'} width={190} height={590} xmlns="http://www.w3.org/2000/svg">
      {muscles.map((m) => {
        const fill = muscleColors[m.id] || '#374151'
        const colored = !!muscleColors[m.id]
        return (
          <path key={m.id} d={m.path} fill={fill}
            stroke={colored ? fill : '#4b5563'} strokeWidth={0.25}
            opacity={colored ? 0.9 : 0.55} />
        )
      })}
    </svg>
  )
}

export default function MuscleRecoveryMap({ recoveryData = {}, c = {} }) {
  const [view, setView] = useState('FRONT')

  const muscleColors = useMemo(() => {
    const map = {}
    ALL_MUSCLES.forEach((m) => {
      const key = matchMuscle(m.id, m.name)
      if (key && recoveryData[key] != null) map[m.id] = getColor(recoveryData[key])
    })
    return map
  }, [recoveryData])

  const entries = Object.entries(recoveryData).filter(([, v]) => v != null)
  const avg = entries.length
    ? Math.round(entries.reduce((s, [, v]) => s + v, 0) / entries.length) : null

  const text  = c.textPrimary   || c.text  || '#f9fafb'
  const muted = c.textSecondary || c.text4 || '#9ca3af'
  const bdr   = c.border        || c.card2 || '#374151'

  return (
    <div style={{ width: '100%', color: text }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:15 }}>Recuperare musculară</div>
          {avg != null && (
            <div style={{ fontSize:12, color:muted, marginTop:2 }}>
              Medie: <span style={{ color:getColor(avg), fontWeight:600 }}>{avg}%</span>
            </div>
          )}
        </div>
        <div style={{ display:'flex', borderRadius:8, overflow:'hidden', border:'1px solid #374151' }}>
          {['FRONT','BACK'].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'5px 16px', fontSize:11, fontWeight:500, border:'none',
              cursor:'pointer', letterSpacing:'0.04em',
              background: view===v ? '#3b82f6' : 'transparent',
              color: view===v ? '#fff' : muted,
              transition:'background 0.15s',
            }}>
              {v==='FRONT' ? 'FAȚĂ' : 'SPATE'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'center', padding:'6px 0' }}>
        <BodySVG view={view} muscleColors={muscleColors} />
      </div>

      <div style={{ display:'flex', justifyContent:'center', gap:16, margin:'10px 0', flexWrap:'wrap' }}>
        {[['#16a34a','Recuperat 80%+'],['#d97706','Parțial 55-79%'],['#dc2626','Obosit sub 55%']].map(([color, label]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:9, height:9, borderRadius:2, background:color }} />
            <span style={{ fontSize:11, color:muted }}>{label}</span>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(118px,1fr))', gap:6, marginTop:6 }}>
          {[...entries].sort((a,b)=>a[1]-b[1]).map(([key, pct]) => (
            <div key={key} style={{
              background:getBg(pct), border:'1px solid ' + getBorder(pct),
              borderRadius:8, padding:'5px 10px',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <span style={{ fontSize:11 }}>{LABELS[key]||key}</span>
              <span style={{ fontSize:13, fontWeight:600, color:getColor(pct) }}>{pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MiniMuscleMap — silueta compacta fata+spate pentru cardul zilei din calendar ──
// Props: exercises = [{name, sets:[{weight_kg, reps}]}]
// Culori: rosu = muschi intens lucrat, galben/portocaliu = mai usor
export function MiniMuscleMap({ exercises = [] }) {
  const muscleColors = useMemo(() => {
    const setCounts = {}
    exercises.forEach(ex => {
      const key = exerciseToMuscleKey(ex.name || '')
      if (key) setCounts[key] = (setCounts[key] || 0) + (ex.sets?.length || 1)
    })
    if (!Object.keys(setCounts).length) return {}
    const maxSets = Math.max(1, ...Object.values(setCounts))
    const map = {}
    ALL_MUSCLES.forEach(m => {
      const key = matchMuscle(m.id, m.name)
      if (key && setCounts[key]) {
        const intensity = setCounts[key] / maxSets
        map[m.id] = intensity >= 0.6 ? '#ef4444' : '#f59e0b'
      }
    })
    return map
  }, [exercises])

  if (!exercises.length) return null

  const W = 44

  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexShrink: 0, marginLeft: 8 }}>
      <svg viewBox="0 0 38 118" width={W} height={Math.round(W * 118 / 38)} xmlns="http://www.w3.org/2000/svg">
        {ALL_MUSCLES.filter(m => m.view === 'FRONT').map(m => (
          <path key={m.id} d={m.path}
            fill={muscleColors[m.id] || '#374151'}
            stroke={muscleColors[m.id] ? muscleColors[m.id] : '#4b5563'}
            strokeWidth={0.3}
            opacity={muscleColors[m.id] ? 0.92 : 0.45}
          />
        ))}
      </svg>
      <svg viewBox="35 -1 38 120" width={W} height={Math.round(W * 120 / 38)} xmlns="http://www.w3.org/2000/svg">
        {ALL_MUSCLES.filter(m => m.view === 'BACK').map(m => (
          <path key={m.id} d={m.path}
            fill={muscleColors[m.id] || '#374151'}
            stroke={muscleColors[m.id] ? muscleColors[m.id] : '#4b5563'}
            strokeWidth={0.3}
            opacity={muscleColors[m.id] ? 0.92 : 0.45}
          />
        ))}
      </svg>
    </div>
  )
}
