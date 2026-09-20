// hooks/useIntervalsData.js
import { useState, useCallback } from 'react'
import { fetchIntervalsData } from '../lib/intervals'

export function useIntervalsData() {
  const [intervalsData, setIntervalsData] = useState(null)
  const [intervalsLoading, setIntervalsLoading] = useState(false)

  const load = useCallback(async (userId, days = 60) => {
    if (!userId) return
    setIntervalsLoading(true)
    try {
      const data = await fetchIntervalsData(userId, days)
      setIntervalsData(data)
    } catch (err) {
      console.warn('Intervals.icu:', err.message)
    } finally {
      setIntervalsLoading(false)
    }
  }, [])

  return { intervalsData, intervalsLoading, loadIntervalsData: load }
}
