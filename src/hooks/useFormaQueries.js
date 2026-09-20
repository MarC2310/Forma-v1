// src/hooks/useFormaQueries.js
// Toate query-urile React Query pentru FORMA — înlocuiesc hook-urile manuale din S1
// Fiecare useQuery are cache automat, background refetch și deduplicare

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchRecentWorkouts, calcMuscleRecovery, calcWeeklyStats } from '../lib/hevy'
import { fetchWithingsAll } from '../lib/withings'
import { fetchGoogleFitData } from '../lib/googlefit'
import { fetchIntervalsData } from '../lib/intervals'
import { QUERY_KEYS, STALE_TIMES } from '../lib/queryClient'

const today = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// ── 1. Hevy Workouts ──────────────────────────────────────────────────────────
// fetchRecentWorkouts() fără argument = fetch TOT istoricul (pages=9999, se oprește
// natural când Hevy nu mai returnează date).
export function useHevyQuery(userId) {
  return useQuery({
    queryKey: QUERY_KEYS.hevy(userId),
    queryFn: async () => {
      const data = await fetchRecentWorkouts()
      return {
        workouts: data || [],
        recovery: calcMuscleRecovery(data || []),
        weeklyStats: calcWeeklyStats(data || []),
      }
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.hevy,
  })
}

// ── 2. Withings ──────────────────────────────────────────────────────────────
export function useWithingsQuery(userId) {
  return useQuery({
    queryKey: QUERY_KEYS.withings(userId),
    queryFn: () => fetchWithingsAll(userId),
    enabled: !!userId,
    staleTime: STALE_TIMES.withings,
    retry: 1,
  })
}

// ── 3. Google Fit ─────────────────────────────────────────────────────────────
export function useGoogleFitQuery(userId) {
  return useQuery({
    queryKey: QUERY_KEYS.googleFit(userId),
    queryFn: async () => {
      const result = await fetchGoogleFitData(userId)
      // Dacă tokenul e expirat, returnăm obiectul special (nu aruncăm eroare)
      // — componenta verifică _needsReconnect și afișează butonul de reconectare
      return result
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.googleFit,
    retry: 0, // nu reîncercăm — 400 înseamnă token invalid, nu eroare tranzitorie
  })
}

// ── 4. Intervals.icu ─────────────────────────────────────────────────────────
export function useIntervalsQuery(userId, days = 60) {
  return useQuery({
    queryKey: QUERY_KEYS.intervals(userId, days),
    queryFn: () => fetchIntervalsData(userId, days),
    enabled: !!userId,
    staleTime: STALE_TIMES.intervals,
    retry: 0, // Intervals.icu opțional — nu reîncercăm
  })
}

// ── 5. Profil utilizator ──────────────────────────────────────────────────────
export function useProfileQuery(userId) {
  return useQuery({
    queryKey: QUERY_KEYS.profile(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')           // select * evită erori 400 din coloane lipsă
        .eq('id', userId)
        .maybeSingle()         // maybeSingle returnează null în loc de 400 când nu există
      if (error) throw error
      return data
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.profile,
    retry: 1,
  })
}

// ── 6. Injuries ───────────────────────────────────────────────────────────────
export function useInjuriesQuery(userId) {
  return useQuery({
    queryKey: QUERY_KEYS.injuries(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injuries')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.profile,
  })
}

// ── 7. Nutriție (nutrition_logs + meal_entries combinate) ────────────────────
export function useNutritionQuery(userId) {
  const todayStr = today()
  return useQuery({
    queryKey: QUERY_KEYS.nutrition(userId, todayStr),
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const [logsRes, mealsRes] = await Promise.all([
        supabase.from('nutrition_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
        supabase.from('meal_entries').select('id,date,name,image_url,calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,saturated_fat_g,sodium_mg,potassium_mg,calcium_mg,iron_mg,vitamin_a_mcg,vitamin_c_mg,vitamin_d_mcg,vitamin_b12_mcg,magnesium_mg,zinc_mg,vitamin_b6_mg,folate_mcg,vitamin_e_mg,omega3_mg,selenium_mcg,time,created_at').eq('user_id', userId).gte('date', cutoff),
      ])
      const logs  = logsRes.data  || []
      const meals = mealsRes.data || []

      // Agregare meal_entries pe zi
      const mealsByDate = {}
      meals.forEach(m => {
        if (!mealsByDate[m.date]) mealsByDate[m.date] = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, saturated_fat_g: 0, sodium_mg: 0, potassium_mg: 0, calcium_mg: 0, iron_mg: 0, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0, vitamin_b12_mcg: 0, magnesium_mg: 0, zinc_mg: 0, vitamin_b6_mg: 0, folate_mcg: 0, vitamin_e_mg: 0, omega3_mg: 0, selenium_mcg: 0 }
        mealsByDate[m.date].calories  += m.calories  || 0
        mealsByDate[m.date].protein_g += m.protein_g || 0
        mealsByDate[m.date].carbs_g   += m.carbs_g   || 0
        mealsByDate[m.date].fat_g     += m.fat_g     || 0
        mealsByDate[m.date].fiber_g         += m.fiber_g         || 0
        mealsByDate[m.date].sugar_g          += m.sugar_g          || 0
        mealsByDate[m.date].saturated_fat_g  += m.saturated_fat_g  || 0
        mealsByDate[m.date].sodium_mg        += m.sodium_mg        || 0
        mealsByDate[m.date].potassium_mg     += m.potassium_mg     || 0
        mealsByDate[m.date].calcium_mg       += m.calcium_mg       || 0
        mealsByDate[m.date].iron_mg          += m.iron_mg          || 0
        mealsByDate[m.date].vitamin_a_mcg    += m.vitamin_a_mcg    || 0
        mealsByDate[m.date].vitamin_c_mg     += m.vitamin_c_mg     || 0
        mealsByDate[m.date].vitamin_d_mcg    += m.vitamin_d_mcg    || 0
        mealsByDate[m.date].vitamin_b12_mcg  += m.vitamin_b12_mcg  || 0
        mealsByDate[m.date].magnesium_mg     += m.magnesium_mg     || 0
        mealsByDate[m.date].zinc_mg           += m.zinc_mg          || 0
        mealsByDate[m.date].vitamin_b6_mg     += m.vitamin_b6_mg    || 0
        mealsByDate[m.date].folate_mcg        += m.folate_mcg       || 0
        mealsByDate[m.date].vitamin_e_mg      += m.vitamin_e_mg     || 0
        mealsByDate[m.date].omega3_mg         += m.omega3_mg        || 0
        mealsByDate[m.date].selenium_mcg      += m.selenium_mcg     || 0
      })

      // Combină pe zi
      const allDates = new Set([...logs.map(d => d.date), ...Object.keys(mealsByDate)])
      const history = Array.from(allDates).map(date => {
        const manual = logs.find(d => d.date === date) || {}
        const meal   = mealsByDate[date] || {}
        return {
          date,
          calories:  Math.round((manual.calories  || 0) + (meal.calories  || 0)),
          protein_g: Math.round(((manual.protein_g || 0) + (meal.protein_g || 0)) * 10) / 10,
          carbs_g:   Math.round(((manual.carbs_g   || 0) + (meal.carbs_g   || 0)) * 10) / 10,
          fat_g:     Math.round(((manual.fat_g     || 0) + (meal.fat_g     || 0)) * 10) / 10,
          fiber_g:   Math.round(((manual.fiber_g   || 0) + (meal.fiber_g   || 0)) * 10) / 10,
        }
      }).sort((a, b) => b.date.localeCompare(a.date))

      // ── Calcul fasting din timestamp-urile meselor ──────────────────────────────
      // Pentru fiecare zi: primul aliment (firstTs) și ultimul aliment (lastTs)
      const mealTimestamps = {}  // date → { firstTs, lastTs }
      meals.forEach(m => {
        let ts = 0
        if (m.time && m.date) {
          const timeStr = m.time.length === 5 ? m.time + ':00' : m.time
          ts = new Date(`${m.date}T${timeStr}`).getTime()
        }
        if (!ts && m.created_at) ts = new Date(m.created_at).getTime()
        if (!ts) return
        if (!mealTimestamps[m.date]) mealTimestamps[m.date] = { firstTs: ts, lastTs: ts }
        else {
          if (ts < mealTimestamps[m.date].firstTs) mealTimestamps[m.date].firstTs = ts
          if (ts > mealTimestamps[m.date].lastTs)  mealTimestamps[m.date].lastTs  = ts
        }
      })

      // Calculează ore de fasting = firstTs[ziN] - lastTs[ziN-1]
      const sortedDates = Object.keys(mealTimestamps).sort()
      const fastingData = []  // [{ date, hours, startedAt, endedAt }]
      for (let i = 1; i < sortedDates.length; i++) {
        const d     = sortedDates[i]
        const dPrev = sortedDates[i - 1]
        const prevLast  = mealTimestamps[dPrev].lastTs
        const currFirst = mealTimestamps[d].firstTs
        if (currFirst > prevLast) {
          const hours = (currFirst - prevLast) / (1000 * 60 * 60)
          if (hours >= 6 && hours <= 30) {  // filtrăm valorile aberante
            fastingData.push({
              date:      d,
              hours:     Math.round(hours * 10) / 10,
              startedAt: new Date(prevLast).toISOString(),
              endedAt:   new Date(currFirst).toISOString(),
            })
          }
        }
      }

      return {
        history,
        today: history.find(d => d.date === todayStr) || null,
        meals,  // raw entries with name, for macro source breakdown
        fastingData,  // [{ date, hours, startedAt, endedAt }]
      }
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.nutrition,
  })
}

// ── 8. Suplimente ─────────────────────────────────────────────────────────────
export function useSupplementsQuery(userId) {
  const todayStr = today()
  return useQuery({
    queryKey: QUERY_KEYS.supplements(userId),
    queryFn: async () => {
      const [suppsRes, logsRes] = await Promise.all([
        supabase.from('supplements').select('*').eq('user_id', userId).eq('active', true),
        supabase.from('supplement_logs').select('supplement_id').eq('user_id', userId).eq('date', todayStr),
      ])
      const supps = suppsRes.data || []
      const taken = new Set((logsRes.data || []).map(l => l.supplement_id))
      return { supplements: supps, suppTaken: Object.fromEntries(supps.map(s => [s.id, taken.has(s.id)])) }
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.supplements,
  })
}

// ── 9. Water — Realtime ───────────────────────────────────────────────────────
// useQuery pentru fetch inițial + Supabase Realtime pentru updates live
export function useWaterQuery(userId) {
  const qc = useQueryClient()
  const todayStr = today()
  const queryKey = QUERY_KEYS.waterToday(userId, todayStr)

  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .in('date', [todayStr, yesterdayStr])
      const logs = data || []
      const todayLogs = logs.filter(l => l.date === todayStr)
      const yestLogs  = logs.filter(l => l.date === yesterdayStr)
      return {
        logs: todayLogs,
        total_ml: todayLogs.reduce((s, l) => s + (l.amount_ml || 0), 0),
        yesterday_ml: yestLogs.reduce((s, l) => s + (l.amount_ml || 0), 0),
      }
    },
    enabled: !!userId,
    staleTime: 0, // mereu fresh — Realtime ține cache-ul la zi
  })

  // Realtime subscription — invalidează query la orice INSERT/DELETE în water_logs
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`water-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'water_logs',
        filter: `user_id=eq.${userId}`,
      }, () => {
        // Invalidare = React Query re-fetch automat în background
        qc.invalidateQueries({ queryKey })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return query
}

// ── 10. Supplement Logs — Realtime ────────────────────────────────────────────
export function useSuppLogsRealtime(userId) {
  const qc = useQueryClient()
  const todayStr = today()

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`supp-logs-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'supplement_logs',
        filter: `user_id=eq.${userId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.supplements(userId) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])
}

// ── 11. Meal Entries — Realtime ───────────────────────────────────────────────
export function useMealEntriesRealtime(userId) {
  const qc = useQueryClient()
  const todayStr = today()

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`meals-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meal_entries',
        filter: `user_id=eq.${userId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.nutrition(userId, todayStr) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])
}

// ── Mutation: Add Water ───────────────────────────────────────────────────────
export function useAddWater(userId) {
  const qc = useQueryClient()
  const todayStr = today()

  return useMutation({
    mutationFn: async (amount_ml) => {
      const { error } = await supabase
        .from('water_logs')
        .insert({ user_id: userId, date: todayStr, amount_ml })
      if (error) throw error
    },
    onMutate: async (amount_ml) => {
      // Optimistic update — UI se actualizează instant, fără să aștepte serverul
      const queryKey = QUERY_KEYS.waterToday(userId, todayStr)
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData(queryKey)
      qc.setQueryData(queryKey, old => ({
        ...old,
        logs: [...(old?.logs || []), { id: 'temp', amount_ml, date: todayStr }],
        total_ml: (old?.total_ml || 0) + amount_ml,
      }))
      return { prev }
    },
    onError: (_, __, ctx) => {
      // Rollback la eroare
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.waterToday(userId, todayStr), ctx.prev)
    },
  })
}

// ── Mutation: Toggle Supplement ───────────────────────────────────────────────
export function useToggleSupplement(userId) {
  const qc = useQueryClient()
  const todayStr = today()

  return useMutation({
    mutationFn: async ({ suppId, isTaken }) => {
      if (isTaken) {
        await supabase.from('supplement_logs')
          .delete().eq('user_id', userId).eq('supplement_id', suppId).eq('date', todayStr)
      } else {
        await supabase.from('supplement_logs')
          .insert({ user_id: userId, supplement_id: suppId, date: todayStr, taken_at: new Date().toISOString() })
      }
    },
    onMutate: async ({ suppId, isTaken }) => {
      // Optimistic update
      const key = QUERY_KEYS.supplements(userId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, old => ({
        ...old,
        suppTaken: { ...old?.suppTaken, [suppId]: !isTaken }
      }))
      return { prev }
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.supplements(userId), ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.supplements(userId) })
    },
  })
}

// ── Body Measurements — persistență istorică compoziție corporală ─────────────
export function useBodyMeasurementsQuery(userId, days = 180) {
  return useQuery({
    queryKey: QUERY_KEYS.bodyMeasurements(userId),
    queryFn: async () => {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('body_measurements')
        .select('date,weight_kg,fat_pct,muscle_kg,lean_kg,pwv,bp_sys,bp_dia,hr_rest,source')
        .eq('user_id', userId)
        .gte('date', cutoff)
        .order('date', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}

export function useUpsertBodyMeasurement(userId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      // body = { date, weight_kg, fat_pct, muscle_kg, lean_kg, pwv, bp_sys, bp_dia, hr_rest, source }
      const payload = { user_id: userId, ...body }
      const { error } = await supabase
        .from('body_measurements')
        .upsert(payload, { onConflict: 'user_id,date' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.bodyMeasurements(userId) })
    },
  })
}

// ── Supplement Log (cross-device sync) ───────────────────────────────────────
export function useSupplementLogQuery(userId, date) {
  return useQuery({
    queryKey: QUERY_KEYS.suppLogs(userId, date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplement_log')
        .select('id,name,description,taken_at')
        .eq('user_id', userId)
        .eq('date', date)
      if (error) throw error
      return data || []
    },
    enabled: !!userId && !!date,
    staleTime: 30 * 1000,
    retry: 1,
  })
}

export function useAddSupplementLog(userId, date) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, description }) => {
      const { error } = await supabase
        .from('supplement_log')
        .upsert(
          { user_id: userId, date, name, description: description || null },
          { onConflict: 'user_id,date,name' }
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.suppLogs(userId, date) }),
  })
}

export function useRemoveSupplementLog(userId, date) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name) => {
      const { error } = await supabase
        .from('supplement_log')
        .delete()
        .eq('user_id', userId)
        .eq('date', date)
        .eq('name', name)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.suppLogs(userId, date) }),
  })
}
