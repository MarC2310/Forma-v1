// hooks/useHevyData.js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchRecentWorkouts } from '../lib/hevy'

// Importăm calculele — rămân în Dashboard.jsx dar le referențiem explicit
export function useHevyData() {
  const [workouts, setWorkouts]       = useState([])
  const [recovery, setRecovery]       = useState({ notReady: [], suggestedDay: 'Antrenament ușor', details: [] })
  const [weeklyStats, setWeeklyStats] = useState({ count: 0, volume: 0, prs: 0 })
  const [activeInjuries, setActiveInjuries] = useState([])
  const [hevyLoading, setHevyLoading] = useState(false)
  const [hevyError, setHevyError]     = useState(null)

  const load = useCallback(async (userId, { calcMuscleRecovery, calcWeeklyStats, onRecoveryScore }) => {
    if (!userId) return
    setHevyLoading(true)
    setHevyError(null)
    try {
      const data = await fetchRecentWorkouts(2)
      setWorkouts(data)

      const rec = calcMuscleRecovery(data)
      setRecovery(rec)
      setWeeklyStats(calcWeeklyStats(data))

      // Accidentări active
      const { data: inj } = await supabase.from('injuries').select('*').eq('user_id', userId).eq('active', true)
      const injuries = inj || []
      setActiveInjuries(injuries)

      // Scor recuperare + antrenament recomandat
      const lw = data[0]
      const recoveryScore = lw
        ? lw.hours_ago >= 72 ? 95 : lw.hours_ago >= 48 ? 80
          : lw.hours_ago >= 36 ? 65 : lw.hours_ago >= 24 ? 45 : 25
        : 85

      let suggestedWorkout = rec.suggestedDay
      let recType = null
      if (injuries.length > 0) {
        const allText = injuries.map(i => i.description).join(' ').toLowerCase()
        recType = 'adapt'
        suggestedWorkout = allText.includes('genunchi') || allText.includes('menisc')
          ? 'Upper Body — evită exerciții pentru picioare'
          : allText.includes('umar') || allText.includes('umăr')
          ? 'Lower Body + Core — evită presă și tracțiuni'
          : allText.includes('spate') || allText.includes('lombar')
          ? 'Recuperare activă — fără încărcare pe coloană'
          : 'Antrenament adaptat — evită zona afectată'
      }

      onRecoveryScore?.({ recoveryScore, suggestedWorkout, recType, injuries })
    } catch (err) {
      setHevyError(err.message)
    } finally {
      setHevyLoading(false)
    }
  }, [])

  return { workouts, recovery, weeklyStats, activeInjuries, hevyLoading, hevyError, loadHevyData: load }
}
