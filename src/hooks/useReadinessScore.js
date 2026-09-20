// hooks/useReadinessScore.js
// Logica de calcul readiness izolată — nu mai trăiește în Dashboard.jsx
import { useState, useEffect, useCallback } from 'react'

const DEFAULT_READINESS = {
  score: null,
  label: 'Se calculează...',
  desc: '',
  recommendation_type: null,
  suggested_workout: '—',
  scores: { sleep: null, hrv: null, recovery: null, nutrition: null, subjective: null, health: null },
  recovery_hours: null,
}

export function useReadinessScore() {
  const [readiness, setReadiness] = useState(DEFAULT_READINESS)

  // Actualizare parțială sigură — merge cu starea existentă
  const updateScores = useCallback((updates) => {
    setReadiness(r => ({
      ...r,
      scores: { ...r.scores, ...updates }
    }))
  }, [])

  const updateReadiness = useCallback((updates) => {
    setReadiness(r => ({ ...r, ...updates }))
  }, [])

  const resetReadiness = useCallback(() => {
    setReadiness(DEFAULT_READINESS)
  }, [])

  return { readiness, setReadiness, updateScores, updateReadiness, resetReadiness }
}
