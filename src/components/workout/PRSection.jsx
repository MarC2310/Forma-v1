// src/components/workout/PRSection.jsx
import { calc1RMPercent } from '../../lib/workoutCalculations'

export function PRCard({ exercise, c, onSelect, selected }) {
  const latest = exercise.history[exercise.history.length - 1]
  const trend = exercise.trend
  return (
    <div onClick={() => onSelect(exercise)}
      style={{ background: selected ? c.green3 : c.card, border: `0.5px solid ${selected ? c.green4 : c.border}`, borderRadius: 12, padding: '0.875rem', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: c.text, flex: 1, paddingRight: 8 }}>{exercise.name}</div>
        <div style={{ fontSize: 11, color: trend > 0 ? c.green : trend < 0 ? c.red : c.text4, flexShrink: 0 }}>
          {trend > 0 ? `+${trend}kg` : trend < 0 ? `${trend}kg` : '—'} 1RM
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: c.green }}>{exercise.current1RM}</div>
          <div style={{ fontSize: 10, color: c.text4 }}>kg est. 1RM</div>
        </div>
        <div style={{ fontSize: 12, color: c.text3 }}>
          {latest?.weight}kg × {latest?.reps} reps
        </div>
        <div style={{ fontSize: 11, color: c.text4, marginLeft: 'auto' }}>
          {exercise.history.length} sesiuni
        </div>
      </div>
    </div>
  )
}

export function PRChart({ exercise, c }) {
  if (!exercise || exercise.history.length < 2) return null
  const data = exercise.history.slice(-12)
  const max = Math.max(...data.map(d => d.est1RM))
  const min = Math.min(...data.map(d => d.est1RM))
  const range = max - min || 1
  const oneRM = exercise.current1RM
  const percents = [
    { pct: 95, label: '1-2 reps', color: c.red },
    { pct: 85, label: '3-5 reps', color: c.orange },
    { pct: 75, label: '8-10 reps', color: c.green },
    { pct: 65, label: '12-15 reps', color: c.blue },
  ]

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ fontSize: 11, color: c.text4, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Progresie 1RM estimat — {exercise.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 8 }}>
        {data.map((d, i) => {
          const h = Math.max(4, ((d.est1RM - min) / range) * 68 + 8)
          const isLast = i === data.length - 1
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: 9, color: c.text4 }}>{d.est1RM}</div>
              <div style={{ width: '100%', height: `${h}px`, background: isLast ? c.green : c.green + '55', borderRadius: 3 }}/>
              <div style={{ fontSize: 8, color: c.text4, transform: 'rotate(-45deg)', transformOrigin: 'right', whiteSpace: 'nowrap' }}>{d.date?.slice(5)}</div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: c.text4, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Zone de antrenament (1RM = {oneRM}kg)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {percents.map(p => (
          <div key={p.pct} style={{ background: c.card2, borderRadius: 8, padding: '8px 10px', borderLeft: `3px solid ${p.color}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{calc1RMPercent(oneRM, p.pct)}kg</div>
            <div style={{ fontSize: 11, color: c.text4 }}>{p.pct}% · {p.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
