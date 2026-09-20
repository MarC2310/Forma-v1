// src/lib/theme.jsx — Theme management (dark/light/auto)
import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('forma-theme') || 'dark'
    // 'dark' | 'light' | 'auto'
  })
  const [resolvedTheme, setResolvedTheme] = useState('dark')

  // Rezolvă tema efectivă bazată pe mod
  function resolveTheme(mode) {
    if (mode === 'dark') return 'dark'
    if (mode === 'light') return 'light'
    // auto: preferinta sistem (prefers-color-scheme) sau ora
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    // Fallback: ora (6:00-20:00 = light, restul = dark)
    const hour = new Date().getHours()
    return (hour >= 6 && hour < 20) ? 'light' : 'dark'
  }

  useEffect(() => {
    setResolvedTheme(resolveTheme(themeMode))

    if (themeMode !== 'auto') return

    // Ascultă schimbări sistem (dark/light mode)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setResolvedTheme(resolveTheme('auto'))
    mq.addEventListener('change', handler)

    // Ascultă senzor luminozitate (dacă disponibil)
    let lightSensor = null
    if ('AmbientLightSensor' in window) {
      try {
        lightSensor = new window.AmbientLightSensor()
        lightSensor.addEventListener('reading', () => {
          // < 50 lux = întuneric → dark theme
          // > 200 lux = luminos → light theme
          const lux = lightSensor.illuminance
          if (lux < 50) setResolvedTheme('dark')
          else if (lux > 200) setResolvedTheme('light')
        })
        lightSensor.start()
      } catch (e) {
        // Senzor indisponibil — ignorăm silențios
      }
    }

    // Timer pentru schimbare bazată pe oră (verifică la fiecare minut)
    const timer = setInterval(() => {
      setResolvedTheme(resolveTheme('auto'))
    }, 60000)

    return () => {
      mq.removeEventListener('change', handler)
      if (lightSensor) try { lightSensor.stop() } catch(e) {}
      clearInterval(timer)
    }
  }, [themeMode])

  function setMode(mode) {
    setThemeMode(mode)
    localStorage.setItem('forma-theme', mode)
    setResolvedTheme(resolveTheme(mode))
  }

  function toggleTheme() {
    // Ciclează: dark → light → auto → dark
    const next = themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'auto' : 'dark'
    setMode(next)
  }

  return (
    <ThemeContext.Provider value={{
      theme: resolvedTheme,
      themeMode,
      toggleTheme,
      setMode,
      isDark: resolvedTheme === 'dark',
      isAuto: themeMode === 'auto',
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}

export function getColors(theme) {
  const dark = {
    bg:       '#1A1D23',
    card:     '#252932',
    card2:    '#2A2F38',
    card3:    '#323843',
    border:   '#343A45',
    border2:  '#2A2F38',
    text:     '#F2F3F5',
    text2:    '#B8BCC4',
    text3:    '#888D98',
    text4:    '#5C6270',
    green:    '#9FD66B',
    green2:   '#6FAE3A',
    green3:   '#22321A',
    orange:   '#E8A840',
    orange2:  '#3A2A0A',
    red:      '#E06560',
    red2:     '#2A1A1A',
    blue:     '#4A9EE8',
    purple:   '#9B8FE8',
    radiusSm: 10,
    radiusMd: 14,
    radiusLg: 18,
    shadowCard:  '0 1px 3px rgba(0,0,0,0.3)',
    shadowGlow:  (color) => `0 0 12px ${color}44`,
    gradGreen:   'linear-gradient(135deg, #9FD66B 0%, #6FAE3A 100%)',
    gradOrange:  'linear-gradient(135deg, #E8A840 0%, #C07A10 100%)',
    gradRed:     'linear-gradient(135deg, #E06560 0%, #C02A2A 100%)',
    fontFamily:  "'Inter', system-ui, -apple-system, sans-serif",
  }
  const light = {
    bg:       '#F4F6F9',
    card:     '#FFFFFF',
    card2:    '#F0F2F5',
    card3:    '#E8EBF0',
    border:   '#DDE1E8',
    border2:  '#E8EBF0',
    text:     '#1A1D23',
    text2:    '#3D4350',
    text3:    '#6B7280',
    text4:    '#9CA3AF',
    green:    '#4A8C1C',
    green2:   '#3A7010',
    green3:   '#E8F5E0',
    orange:   '#C07A10',
    orange2:  '#FFF3D8',
    red:      '#C02A2A',
    red2:     '#FDE8E8',
    blue:     '#2563EB',
    purple:   '#7C3AED',
    radiusSm: 10,
    radiusMd: 14,
    radiusLg: 18,
    shadowCard:  '0 1px 4px rgba(0,0,0,0.08)',
    shadowGlow:  (color) => `0 0 12px ${color}33`,
    gradGreen:   'linear-gradient(135deg, #6FAE3A 0%, #4A8C1C 100%)',
    gradOrange:  'linear-gradient(135deg, #E8A840 0%, #C07A10 100%)',
    gradRed:     'linear-gradient(135deg, #E06560 0%, #C02A2A 100%)',
    fontFamily:  "'Inter', system-ui, -apple-system, sans-serif",
  }
  return theme === 'dark' ? dark : light
}
