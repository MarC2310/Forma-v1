// hooks/useGoogleFitData.js
import { useState, useCallback } from 'react'
import { fetchGoogleFitData } from '../lib/googlefit'

export function useGoogleFitData() {
  const [fitData, setFitData] = useState(null)
  const [fitLoading, setFitLoading] = useState(false)

  const load = useCallback(async (userId) => {
    if (!userId) return
    setFitLoading(true)
    try {
      const data = await fetchGoogleFitData(userId)
      if (data) setFitData(data)
    } catch (err) {
      console.warn('Google Fit:', err.message)
    } finally {
      setFitLoading(false)
    }
  }, [])

  return { fitData, fitLoading, loadGoogleFitData: load }
}
