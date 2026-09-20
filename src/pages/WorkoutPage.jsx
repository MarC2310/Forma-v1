// src/pages/WorkoutPage.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import { supabase } from '../lib/supabase'
import { fetchRecentWorkouts } from '../lib/hevy'
import { fetchIntervalsData } from '../lib/intervals'
import { extractPRs } from '../lib/workoutCalculations'
import { PRCard, PRChart } from '../components/workout/PRSection'
import { WorkoutHistoryCard } from '../components/workout/WorkoutHistoryCard'

export default function WorkoutPage({ onBack }) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const c = getColors(theme)

  const [activeTab, setActiveTab] = useState('program')
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [exercises, setExercises] = useState([])
  const [selectedEx, setSelectedEx] = useState(null)
  const [profile, setProfile] = useState(null)
  const [injuries, setInjuries] = useState([])
  const [program, setProgram] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [searchEx, setSearchEx] = useState('')
  const [doneExercises, setDoneExercises] = useState({})
  const [intervalsActivities, setIntervalsActivities] = useState([]) 

  useEffect(() => {
    if (user?.id) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      const data = await fetchRecentWorkouts(5) 
      setWorkouts(data)
      const prs = extractPRs(data)
      setExercises(prs)
      if (prs.length > 0) setSelectedEx(prs[0])

      const { data: prof } = await supabase.from('profiles')
        .select('goal,level,days_per_week,weight_kg,age').eq('id', user.id).single()
      if (prof) setProfile(prof)

      const { data: inj } = await supabase.from('injuries')
        .select('*').eq('user_id', user.id).eq('active', true)
      if (inj) setInjuries(inj)

      try {
        const iData = await fetchIntervalsData(user.id, 30)
        if (iData?.activities) setIntervalsActivities(iData.activities)
      } catch { /* opțional */ }

    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function generateWeeklyProgram() {
    setGenerating(true)
    try {
      const recentExercises = exercises.slice(0, 15).map(e =>
        `${e.name}: 1RM=${e.current1RM}kg (${e.history.length} sesiuni, trend ${e.trend > 0 ? '+' : ''}${e.trend}kg)`
      ).join('\n')

      const lastWorkouts = workouts.slice(0, 5).map(w =>
        `${w.date}: ${w.title} (${w.duration_min}min, ${w.volume_kg?.toLocaleString()}kg volum, ${w.muscle_groups?.join('/')})`
      ).join('\n')

      const injuryContext = injuries.length > 0
        ? `Accidentări active: ${injuries.map(i => `${i.description} (${i.zone})`).join(', ')}`
        : 'Fără accidentări active'

      const prompt = `Ești un coach de forță expert. Generează un program de antrenament săptămânal optimizat în română.

DATE ATHLETE:
- Obiectiv: ${profile?.goal || 'hipertrofie'}
- Nivel: ${profile?.level || 'intermediar'}
- Greutate: ${profile?.weight_kg || 85}kg
- ${injuryContext}

PERFORMANȚE ACTUALE (1RM estimat):
${recentExercises}

ULTIMELE ANTRENAMENTE:
${lastWorkouts}

Răspunde DOAR cu JSON valid, concis, fără explicații, fără markdown.
Maxim 4-5 exerciții per zi, note scurte (max 5 cuvinte):
{"split":"PPL bazat pe recuperare","zile":[{"zi":"Luni","titlu":"Push","exercitii":[{"nume":"Bench Press","seturi":4,"reps":"8-10","greutate":"75kg"}],"durata_min":55}]}`

      const { data: fnData, error } = await supabase.functions.invoke('ai-coach', {
        body: { prompt, max_tokens: 4000 }
      })

      if (error) throw new Error(error.message)
      if (!fnData?.ok) throw new Error(fnData?.error)

      let text = fnData.text || ''
      text = text.replace(/```json|```/g, '').trim()
      const firstBrace = text.indexOf('{')
      const lastBrace = text.lastIndexOf('}')
      const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1))
      setProgram(parsed)

    } catch (err) {
      setProgram({ error: err.message })
    } finally {
      setGenerating(false)
    }
  }

  const filteredEx = exercises.filter(e => e.name.toLowerCase().includes(searchEx.toLowerCase()))

  const s = {
    page: { minHeight: '100vh', background: c.bg, padding: '0.75rem 1rem', fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 900, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `0.5px solid ${c.border}` },
    card: { background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '1rem', marginBottom: '1rem' },
    sectionLabel: { fontSize: 11, fontWeight: 600, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' },
    tab: { padding: '6px 14px', fontSize: 12, borderRadius: 7, cursor: 'pointer', color: c.text3, border: 'none', background: 'transparent', fontFamily: 'inherit', whiteSpace: 'nowrap' },
    tabActive: { background: c.bg, color: c.text, fontWeight: 500, border: `0.5px solid ${c.border}` },
  }

  if (loading) return (
    <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: c.text4 }}>Se încarcă datele din Hevy...</div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button onClick={onBack} style={{ fontSize: 13, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Dashboard</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: c.text, letterSpacing: '0.1em' }}>💪 ANTRENAMENT</div>
        <div style={{ fontSize: 12, color: c.text4 }}>{exercises.length} exerciții · {workouts.length} sesiuni</div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: c.card, padding: 4, borderRadius: 10, marginBottom: '1rem', overflowX: 'auto' }}>
        {[['program','Program săpt.'],['prs','PR-uri & 1RM'],['history','Istoric']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ ...s.tab, ...(activeTab===id?s.tabActive:{}), flex: 1 }}>{label}</button>
        ))}
      </div>

      {activeTab === 'program' && (
        <div>
          {injuries.length > 0 && (
            <div style={{ ...s.card, background: '#2A0A0A', border: `0.5px solid ${c.red}44` }}>
              <div style={{ fontSize: 13, color: c.red, fontWeight: 600, marginBottom: 4 }}>⚠ Accidentări active — programul va fi adaptat</div>
              {injuries.map(inj => (
                <div key={inj.id} style={{ fontSize: 12, color: '#F09595' }}>🦵 {inj.description}</div>
              ))}
            </div>
          )}

          <div style={s.card}>
            <div style={s.sectionLabel}>Program săptămânal personalizat</div>
            <button onClick={generateWeeklyProgram} disabled={generating}
              style={{ width: '100%', padding: '12px', background: generating ? c.card2 : c.green2, border: 'none', borderRadius: 10, color: generating ? c.green : '#fff', fontSize: 14, fontWeight: 600, cursor: generating ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {generating ? '⏳ Se generează programul...' : program ? '↻ Regenerează programul' : '✨ Generează program săptămânal'}
            </button>
          </div>

          {program && !program.error && (
            <>
              <div style={s.card}>
                <div style={s.sectionLabel}>Split ales de AI</div>
                <div style={{ fontSize: 13, color: c.text, lineHeight: 1.6 }}>{program.split}</div>
              </div>
              {(program.zile || []).map((zi, idx) => (
                <div key={idx} style={s.card}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.accent, marginBottom: 8 }}>{zi.zi} - {zi.titlu}</div>
                  {(zi.exercitii || []).map((ex, j) => (
                    <div key={j} style={{ fontSize: 12, color: c.text3, padding: '4px 0' }}>{ex.nume} ({ex.seturi}x{ex.reps} @ {ex.greutate})</div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === 'prs' && (
        <div>
          <div style={s.card}>
            <input value={searchEx} onChange={e => setSearchEx(e.target.value)} placeholder="🔍 Caută exercițiu..."
              style={{ width: '100%', padding: '8px 12px', background: c.card2, border: `0.5px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, marginBottom: '0.75rem', boxSizing: 'border-box' }}/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {filteredEx.slice(0, 20).map(ex => (
                <PRCard key={ex.name} exercise={ex} c={c} onSelect={setSelectedEx} selected={selectedEx?.name === ex.name}/>
              ))}
            </div>
          </div>
          {selectedEx && <div style={s.card}><PRChart exercise={selectedEx} c={c}/></div>}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {workouts.slice(0, 20).map((w, i) => {
            const iActs = intervalsActivities.filter(a => a.date === w.date)
            const iAct = iActs.find(a => /weight|strength|gym/i.test(a.type || '')) || iActs[0] || null
            return <WorkoutHistoryCard key={w.id || i} w={w} c={c} userWeight={profile?.weight_kg} userId={user?.id} intervalsActivity={iAct}/>
          })}
        </div>
      )}
    </div>
  )
}
