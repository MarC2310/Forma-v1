// src/hooks/useSwipe.js
// Swipe între tab-uri pe mobile — detectează gesturi orizontale și navighează

import { useRef, useCallback } from 'react'

const SWIPE_THRESHOLD   = 50   // px minim pentru a considera un swipe
const SWIPE_MAX_VERTICAL = 80  // px maxim vertical — evităm să interferăm cu scroll
const SWIPE_VELOCITY    = 0.3  // px/ms minim pentru swipe rapid

export function useSwipeTabs(tabs, currentTab, setTab, enabled = true) {
  const touchStart  = useRef(null)
  const touchTime   = useRef(null)

  const onTouchStart = useCallback((e) => {
    if (!enabled) return
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
    touchTime.current  = Date.now()
  }, [enabled])

  const onTouchEnd = useCallback((e) => {
    if (!enabled || !touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = Math.abs(t.clientY - touchStart.current.y)
    const dt = Date.now() - touchTime.current
    const velocity = Math.abs(dx) / dt

    // Ignorăm scroll-ul vertical și swipe-urile prea scurte/lente
    if (dy > SWIPE_MAX_VERTICAL) return
    if (Math.abs(dx) < SWIPE_THRESHOLD && velocity < SWIPE_VELOCITY) return

    const currentIdx = tabs.indexOf(currentTab)
    if (dx < 0 && currentIdx < tabs.length - 1) {
      // Swipe stânga → tab următor
      setTab(tabs[currentIdx + 1])
    } else if (dx > 0 && currentIdx > 0) {
      // Swipe dreapta → tab anterior
      setTab(tabs[currentIdx - 1])
    }

    touchStart.current = null
  }, [enabled, tabs, currentTab, setTab])

  return { onTouchStart, onTouchEnd }
}
