// src/hooks/useSwipeNavigation.js
// Hook generic pentru swipe cu callback custom
// Folosit pentru navigare la nivel de pagină sau alte gesturi

import { useRef, useCallback } from 'react'

export function useSwipeNavigation(onSwipe, options = {}) {
  const { enabled = true, threshold = 50, maxVertical = 80 } = options
  const startRef = useRef(null)

  const onTouchStart = useCallback((e) => {
    if (!enabled) return
    const t = e.touches[0]
    startRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
  }, [enabled])

  const onTouchEnd = useCallback((e) => {
    if (!enabled || !startRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - startRef.current.x
    const dy = Math.abs(t.clientY - startRef.current.y)

    if (dy > maxVertical || Math.abs(dx) < threshold) return

    onSwipe(dx > 0 ? 'right' : 'left', Math.abs(dx))
    startRef.current = null
  }, [enabled, onSwipe, threshold, maxVertical])

  return { onTouchStart, onTouchEnd }
}
