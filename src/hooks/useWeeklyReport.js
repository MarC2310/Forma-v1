// src/hooks/useWeeklyReport.js
// Generează automat un raport săptămânal AI o dată pe săptămână
// Salvează în Supabase weekly_reports, auto-trigger la prima deschidere a săptămânii

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─── Helpers dată ─────────────────────────────────────────────────────────────

function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// ─── Constructor prompt ────────────────────────────────────────────────────────

function buildPrompt({ weekStart, weekEnd, nutrition, steps, workouts, targets, profile }) {
  const fmt = (d) => d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)} ${weekEnd.getFullYear()}`

  const loggedNutrition = nutrition.filter(d => (d.calories || 0) > 0)
  const avgCal   = loggedNutrition.length ? Math.round(loggedNutrition.reduce((s,d) => s+(d.calories||0), 0) / loggedNutrition.length) : 0
  const avgProt  = loggedNutrition.length ? Math.round(loggedNutrition.reduce((s,d) => s+(d.protein_g||0), 0) / loggedNutrition.length) : 0
  const avgCarbs = loggedNutrition.length ? Math.round(loggedNutrition.reduce((s,d) => s+(d.carbs_g||0), 0) / loggedNutrition.length) : 0
  const avgFat   = loggedNutrition.length ? Math.round(loggedNutrition.reduce((s,d) => s+(d.fat_g||0), 0) / loggedNutrition.length) : 0

  const stepDays  = steps.filter(d => (d.steps||0) > 0)
  const avgSteps  = stepDays.length ? Math.round(stepDays.reduce((s,d) => s+(d.steps||0), 0) / stepDays.length) : 0
  const activeDays = stepDays.filter(d => d.steps >= 5000).length

  const sleepDays = steps.filter(d => (d.sleep_hours||d.sleep_h||0) > 3)
  const avgSleep  = sleepDays.length
    ? (sleepDays.reduce((s,d) => s+(d.sleep_hours||d.sleep_h||0), 0) / sleepDays.length).toFixed(1)
    : null

  const hrvVals = steps.filter(d => (d.hrv||0) > 0).map(d => d.hrv)
  const avgHrv  = hrvVals.length ? Math.round(hrvVals.reduce((a,b) => a+b, 0) / hrvVals.length) : null

  const workoutCount  = workouts.length
  const totalVolume   = Math.round(workouts.reduce((s,w) => s+(w.volume_kg||0), 0))

  const tCal  = targets?.calories  || 2000
  const tProt = targets?.protein_g || 160
  const goal  = profile?.goal || 'sanatate'
  const goalLabels = {
    hipertrofie:'hipertrofie musculară', forta:'creștere forță', slabit:'slăbire',
    rezistenta:'rezistență cardiovasculară', recompozitie:'recompoziție corporală', sanatate:'sănătate generală'
  }

  return `Ești FORMA AI Coach. Generează un raport săptămânal complet și personalizat.

SĂPTĂMÂNA: ${weekLabel}

📊 ACTIVITATE:
- Pași medii/zi: ${avgSteps > 0 ? avgSteps.toLocaleString() : 'indisponibil'} | zile active (≥5k pași): ${activeDays}/7
- Antrenamente: ${workoutCount} sesiuni${totalVolume > 0 ? ` · volum ${totalVolume.toLocaleString()} kg` : ''}
${avgHrv ? `- HRV mediu: ${avgHrv} ms` : ''}

😴 SOMN:
- Durată medie: ${avgSleep ? avgSleep + 'h/noapte' : 'indisponibil'} (target: ≥7.5h)

🍽️ NUTRIȚIE (${loggedNutrition.length}/7 zile logate):
${loggedNutrition.length > 0
  ? `- Calorii: ${avgCal} kcal/zi (target: ${tCal}, ${Math.round(avgCal/tCal*100)}%)
- Proteine: ${avgProt}g/zi (target: ${tProt}g)
- Carbohidrați: ${avgCarbs}g/zi | Grăsimi: ${avgFat}g/zi`
  : '- Fără date de nutriție această săptămână'}

🎯 OBIECTIV: ${goalLabels[goal] || goal}

Generează raportul în română, max 250 cuvinte, cu EXACT aceste secțiuni (scrie titlurile exact):

REZUMAT
[2-3 propoziții despre săptămână, cu date concrete]

PUNCTE FORTE
[2-3 realizări cu cifre]

ZONE DE ÎMBUNĂTĂȚIT
[2-3 aspecte specifice cu sugestii practice]

RECOMANDĂRI SĂPTĂMÂNA VIITOARE
[3 acțiuni concrete și măsurabile]

MESAJ
[1 propoziție motivațională scurtă și energică]`
}

// ─── Hook principal ────────────────────────────────────────────────────────────

export function useWeeklyReport({ userId, nutritionHistory, nutritionTargets, intervalsData, workouts, userProfile }) {
  const [report,       setReport]       = useState(null)   // { text, week_start, created_at, snapshot }
  const [isLoading,    setIsLoading]    = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error,        setError]        = useState(null)
  const generatingRef = useRef(false)

  // Săptămâna trecută (completă)
  const today      = new Date()
  const thisMonday = getMondayOf(today)
  const lastMonday = addDays(thisMonday, -7)
  const lastSunday = addDays(lastMonday,  6)
  const wStart     = toDateStr(lastMonday)
  const wEnd       = toDateStr(lastSunday)

  const doGenerate = async () => {
    if (generatingRef.current || !userId) return
    generatingRef.current = true
    setIsGenerating(true)
    setError(null)

    try {
      // Date pentru săptămâna trecută
      const nutrition = (nutritionHistory || []).filter(d => d.date >= wStart && d.date <= wEnd)
      const steps     = (intervalsData?.days || []).filter(d => d.date >= wStart && d.date <= wEnd)
      const wks       = (workouts || []).filter(w => (w.date || '') >= wStart && (w.date || '') <= wEnd)

      // Nu generăm fără niciun fel de date
      const hasData = nutrition.length > 0 || steps.filter(d => d.steps > 0).length > 0 || wks.length > 0
      if (!hasData) { setIsLoading(false); setIsGenerating(false); generatingRef.current = false; return }

      const prompt = buildPrompt({
        weekStart:  lastMonday,
        weekEnd:    lastSunday,
        nutrition,
        steps,
        workouts:   wks,
        targets:    nutritionTargets,
        profile:    userProfile,
      })

      const { data: fn, error: fnErr } = await supabase.functions.invoke('ai-coach', {
        body: { prompt, max_tokens: 900 },
      })

      if (fnErr || !fn?.ok) throw new Error(fn?.error || fnErr?.message || 'Eroare generare raport')

      const text = fn.text
      const snapshot = {
        nutritionDays:  nutrition.length,
        avgSteps:       steps.filter(d=>d.steps>0).length
          ? Math.round(steps.reduce((s,d)=>s+(d.steps||0),0) / steps.filter(d=>d.steps>0).length)
          : 0,
        workouts:       wks.length,
      }

      // Upsert în Supabase
      const { data: saved } = await supabase
        .from('weekly_reports')
        .upsert({ user_id: userId, week_start: wStart, report_text: text, data_snapshot: snapshot },
                 { onConflict: 'user_id,week_start' })
        .select('created_at')
        .maybeSingle()

      setReport({ text, week_start: wStart, created_at: saved?.created_at || new Date().toISOString(), snapshot })
    } catch (err) {
      console.error('[useWeeklyReport] generate error:', err)
      setError(err.message)
    } finally {
      setIsGenerating(false)
      setIsLoading(false)
      generatingRef.current = false
    }
  }

  // Fetch la mount — dacă nu există, generează automat
  useEffect(() => {
    if (!userId) { setIsLoading(false); return }
    let cancelled = false

    ;(async () => {
      setIsLoading(true)
      try {
        const { data } = await supabase
          .from('weekly_reports')
          .select('*')
          .eq('user_id', userId)
          .eq('week_start', wStart)
          .maybeSingle()

        if (cancelled) return

        if (data) {
          setReport({ text: data.report_text, week_start: data.week_start, created_at: data.created_at, snapshot: data.data_snapshot })
          setIsLoading(false)
        } else {
          // Nu există → generează automat (dacă avem date)
          await doGenerate()
        }
      } catch (err) {
        if (!cancelled) { console.error('[useWeeklyReport] fetch error:', err); setIsLoading(false) }
      }
    })()

    return () => { cancelled = true }
  }, [userId, wStart]) // eslint-disable-line

  return {
    report,
    weekStart: wStart,
    weekEnd:   wEnd,
    isLoading,
    isGenerating,
    error,
    regenerate: doGenerate,
  }
}
