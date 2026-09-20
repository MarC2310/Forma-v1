// hooks/useWithingsData.js
import { useState, useCallback } from 'react'
import { fetchWithingsAll } from '../lib/withings'

export function useWithingsData() {
  const [withingsData, setWithingsData]       = useState({ sleep: null, body: null })
  const [withingsLoading, setWithingsLoading] = useState(false)
  const [withingsConnected, setWithingsConnected] = useState(true)

  const load = useCallback(async (userId, { onSleepScore, onHrvScore }) => {
    if (!userId) return
    setWithingsLoading(true)
    try {
      const data = await fetchWithingsAll(userId)
      setWithingsConnected(true)
      setWithingsData({ sleep: data.sleep || null, body: data.body || null })
      // Notifică Dashboard cu scorurile derivate — Dashboard decide ce face cu ele
      if (data.sleep?.total_h > 0) {
        onSleepScore?.(data.sleep)
      }
    } catch (err) {
      if (err.message?.includes('neconectat')) setWithingsConnected(false)
    } finally {
      setWithingsLoading(false)
    }
  }, [])

  return { withingsData, withingsLoading, withingsConnected, loadWithingsData: load }
}
