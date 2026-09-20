// src/lib/workoutCalculations.js

export function calc1RM(weight, reps) {
  if (!weight || !reps) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

export function calc1RMPercent(oneRM, pct) {
  return Math.round(oneRM * pct / 100)
}

export function estimateWorkoutDuration(w) {
  if (w.duration_min) return { value: w.duration_min, isEstimated: false }
  const exercises = w.exercises || []
  const totalSets = exercises.reduce((s, ex) => s + (ex.sets?.length || 0), 0)
  const setsTimeMin = (totalSets * 72.5) / 60 
  const transitionsTimeMin = (Math.max(0, exercises.length - 1) * 60) / 60 
  const warmupMin = 5
  const value = Math.max(15, Math.round(setsTimeMin + transitionsTimeMin + warmupMin))
  return { value, isEstimated: true }
}

export function estimateWorkoutCalories(durationMin, rpeAvg, userWeightKg) {
  const rpe = rpeAvg || 6.5
  const weightFactor = (userWeightKg || 80) / 80
  return Math.round(durationMin * Math.pow(rpe / 10, 1.5) * 7.5 * weightFactor)
}

export function extractPRs(workouts) {
  const exerciseMap = {}
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      const name = ex.name
      if (!exerciseMap[name]) exerciseMap[name] = { name, history: [] }
      const best = ex.sets?.reduce((best, set) => {
        const est1RM = calc1RM(set.weight_kg, set.reps)
        return est1RM > (best.est1RM || 0) ? { ...set, est1RM, date: w.date } : best
      }, {})
      if (best?.est1RM) exerciseMap[name].history.push({ date: w.date, weight: best.weight_kg, reps: best.reps, est1RM: best.est1RM })
    }
  }
  for (const ex of Object.values(exerciseMap)) {
    ex.history.sort((a, b) => new Date(a.date) - new Date(b.date))
    ex.current1RM = ex.history[ex.history.length - 1]?.est1RM || 0
    ex.best1RM = Math.max(...ex.history.map(h => h.est1RM))
    ex.trend = ex.history.length >= 2
      ? ex.history[ex.history.length-1].est1RM - ex.history[ex.history.length-2].est1RM
      : 0
  }
  return Object.values(exerciseMap).sort((a, b) => b.current1RM - a.current1RM)
}
