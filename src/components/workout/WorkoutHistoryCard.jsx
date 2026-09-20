// src/components/workout/WorkoutHistoryCard.jsx
import { useState } from 'react'
import { fetchGoogleFitData } from '../../lib/googlefit'
import { MiniMuscleMap } from '../MuscleRecoveryMap'
import { calc1RM, estimateWorkoutDuration, estimateWorkoutCalories } from '../../lib/workoutCalculations'

export function WorkoutHistoryCard({ w, c, userWeight, userId, intervalsActivity }) {
  const [expanded, setExpanded] = useState(false)
  const [hrLoading, setHrLoading] = useState(false)
  const [estimatedHr, setEstimatedHr] = useState(null)
  const [hrFetched, setHrFetched] = useState(false)

  const { value: durationMin, isEstimated: durationEstimated } = estimateWorkoutDuration(w)

  const realCalories = intervalsActivity?.calories ?? null
  const realHrAvg = intervalsActivity?.hr_avg ?? null
  const realHrMax = intervalsActivity?.hr_max ?? null
  const realDuration = intervalsActivity?.duration_min ?? null
  const caloriesDisplay = realCalories ?? estimateWorkoutCalories(durationMin, w.rpe_avg, userWeight)
  const caloriesIsReal = realCalories != null
  const displayDuration = realDuration ?? durationMin
  const displayDurationEstimated = realDuration ? false : durationEstimated

  async function loadEstimatedHr() {
    if (realHrAvg) return 
    if (!userId || !w.start_time || hrFetched) return
    setHrLoading(true)
    try {
      const data = await fetchGoogleFitData(userId, undefined, w.date)
      const hrHourly = data?.hrHourly || []
      if (hrHourly.length === 0) { setHrFetched(true); return }
      const startHour = new Date(w.start_time).getHours()
      const endHour = Math.min(23, startHour + Math.ceil(displayDuration / 60))
      const relevantHrs = hrHourly.filter(h => h.hour >= startHour && h.hour <= endHour).map(h => h.hr).filter(Boolean)
      if (relevantHrs.length > 0) {
        setEstimatedHr({ avg: Math.round(relevantHrs.reduce((a, b) => a + b, 0) / relevantHrs.length), max: Math.max(...relevantHrs), source: 'googlefit' })
      }
      setHrFetched(true)
    } catch (err) { console.warn('HR:', err.message); setHrFetched(true) }
    finally { setHrLoading(false) }
  }

  function handleToggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !hrFetched && !realHrAvg) loadEstimatedHr()
  }

  const hrDisplay = realHrAvg ? { avg: Math.round(realHrAvg), max: realHrMax ? Math.round(realHrMax) : null, source: 'intervals' } : estimatedHr

  return (
    <div style={{ background: c.card, borderRadius: c.radius || 16, padding: '1rem', boxShadow: c.shadowCard, border: `0.5px solid ${c.border}` }}>
      <div onClick={handleToggle} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: c.text4, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>›</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{w.title}</div>
              <div style={{ fontSize: 12, color: c.text4, marginTop: 2 }}>{w.date} · {displayDuration}min{displayDurationEstimated ? ' (estimat)' : ''}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MiniMuscleMap exercises={w.exercises || []} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.green }}>{w.volume_kg?.toLocaleString()}kg</div>
              <div style={{ fontSize: 10, color: c.text4 }}>volum total</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          {w.muscle_groups?.map(g => (
            <span key={g} style={{ fontSize: 11, background: c.green3, color: c.green, padding: '2px 8px', borderRadius: 5 }}>{g}</span>
          ))}
          {w.rpe_avg && <span style={{ fontSize: 11, background: c.card2, color: c.text3, padding: '2px 8px', borderRadius: 5 }}>RPE {w.rpe_avg}</span>}
          <span style={{ fontSize: 11, background: '#2A1A0A', color: c.orange, padding: '2px 8px', borderRadius: 5 }}>
            🔥 {caloriesIsReal ? '' : '~'}{caloriesDisplay} kcal{caloriesIsReal ? ' · Intervals.icu' : ''}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: `0.5px solid ${c.border2}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            <div style={{ background: c.card2, borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: c.text4 }}>Durată</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{displayDuration}min</div>
              {displayDurationEstimated && <div style={{ fontSize: 9, color: c.text4 }}>estimat</div>}
            </div>
            <div style={{ background: c.card2, borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: c.text4 }}>Calorii</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.orange }}>{caloriesIsReal ? '' : '~'}{caloriesDisplay}</div>
              <div style={{ fontSize: 9, color: caloriesIsReal ? c.green : c.text4 }}>{caloriesIsReal ? '✓ Intervals.icu' : 'estimat'}</div>
            </div>
            <div style={{ background: c.card2, borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: c.text4 }}>Puls mediu</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>
                {hrLoading ? '...' : hrDisplay ? `${hrDisplay.avg}` : '—'}
                {hrDisplay && <span style={{ fontSize: 11, fontWeight: 400, color: c.text4 }}> bpm</span>}
              </div>
              <div style={{ fontSize: 9, color: hrDisplay?.source === 'intervals' ? c.green : c.text4 }}>
                {hrDisplay ? (hrDisplay.source === 'intervals' ? `✓ Intervals.icu${hrDisplay.max ? ` · max ${hrDisplay.max}` : ''}` : `max ${hrDisplay.max} · GFit`) : hrLoading ? 'se încarcă' : 'indisponibil'}
              </div>
            </div>
          </div>

          {w.exercises?.map((ex, j) => {
            const best = ex.sets?.reduce((b, s) => {
              const est = calc1RM(s.weight_kg, s.reps)
              return est > (b.est || 0) ? { weight: s.weight_kg, reps: s.reps, est } : b
            }, {})
            return (
              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: c.text3, padding: '5px 0', borderTop: j === 0 ? 'none' : `0.5px solid ${c.border2}` }}>
                <span>{ex.name} <span style={{ color: c.text4 }}>({ex.sets?.length || 0} seturi)</span></span>
                <span style={{ color: c.text }}>{best?.weight}kg × {best?.reps} <span style={{ color: c.green2 }}>({best?.est}kg 1RM)</span></span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
