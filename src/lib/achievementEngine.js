// src/lib/achievementEngine.js
import { supabase } from './supabase'

export async function evaluateDailyAchievements({ userId, todayData, userProfile }) {
  const { steps = 0, sleepH = 0, caloriesBurned = 0, caloriesTarget = 500, nutritionLogged = false } = todayData
  const today = new Date().toISOString().slice(0, 10)
  const toCheck = []

  if (steps >= 10000) toCheck.push({ id: 'pasi_atins', score: Math.round(steps / 100) })
  if (steps >= 20000) toCheck.push({ id: 'pasi_2x',    score: Math.round(steps / 200) })
  if (steps >= 30000) toCheck.push({ id: 'pasi_3x',    score: Math.round(steps / 300) })
  if (sleepH >= 7.5)  toCheck.push({ id: 'somn_atins', score: Math.round(sleepH * 10) })
  if (caloriesBurned >= caloriesTarget) toCheck.push({ id: 'calorii_arse', score: Math.round(caloriesBurned / caloriesTarget * 100) })

  const newOnes = []
  for (const { id, score } of toCheck) {
    try {
      const { data: ex } = await supabase.from('user_achievements').select('id')
        .eq('user_id', userId).eq('achievement_id', id)
        .gte('obtained_at', today + 'T00:00:00').maybeSingle()
      if (!ex) {
        const { data } = await supabase.from('user_achievements')
          .insert({ user_id: userId, achievement_id: id, score, meta: { date: today } })
          .select().single()
        if (data) newOnes.push({ ...data, achievement_id: id })
      }
    } catch(e) { console.warn('Achievement insert:', e.message) }
  }
  return newOnes
}

export async function loadUserAchievements(userId) {
  const { data } = await supabase.from('user_achievements').select('*')
    .eq('user_id', userId).order('obtained_at', { ascending: false })
  return data || []
}
