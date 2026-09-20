// src/components/DynamicFavicon.jsx — Favicon + badge dinamic bazat pe scorul readiness
import { useEffect, useRef } from 'react'

function scoreToColor(score) {
  if (score >= 80) return { ring: '#97C459', bg: '#1A3A0A' }
  if (score >= 65) return { ring: '#97C459', bg: '#1A3A0A' }
  if (score >= 48) return { ring: '#F0A830', bg: '#3A2A0A' }
  return { ring: '#E24B4A', bg: '#3A0A0A' }
}

function drawFaviconCanvas(score) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const { ring, bg } = scoreToColor(score)

  // Fundal rotunjit
  ctx.fillStyle = '#0F1117'
  ctx.beginPath()
  ctx.roundRect(0, 0, 64, 64, 14)
  ctx.fill()

  // Cerc de fundal (track)
  ctx.strokeStyle = bg
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(32, 32, 22, 0, Math.PI * 2)
  ctx.stroke()

  // Cerc progres (scorul curent)
  const pct = Math.max(0, Math.min(100, score)) / 100
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + pct * Math.PI * 2
  ctx.strokeStyle = ring
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(32, 32, 22, startAngle, endAngle)
  ctx.stroke()

  // Scor numeric în centru
  ctx.fillStyle = '#E8E8E4'
  ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(Math.round(score).toString(), 32, 33)

  return canvas.toDataURL('image/png')
}

export default function DynamicFavicon({ score }) {
  const lastScore = useRef(null)

  useEffect(() => {
    if (score == null || score === lastScore.current) return
    lastScore.current = score

    try {
      // Actualizează favicon-ul
      const dataUrl = drawFaviconCanvas(score)
      let link = document.querySelector("link[rel~='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.type = 'image/png'
      link.href = dataUrl

      // Actualizează și apple-touch-icon dacă există (pentru iOS Safari pinned tabs)
      let appleLink = document.querySelector("link[rel='apple-touch-icon']")
      if (appleLink) appleLink.href = dataUrl

      // Actualizează titlul tab-ului cu scorul, pentru vizibilitate rapidă
      const baseTitle = 'FORMA — Daily Readiness Intelligence'
      document.title = `(${Math.round(score)}) ${baseTitle}`
    } catch (err) {
      console.warn('[DynamicFavicon] update failed:', err.message)
    }
  }, [score])

  return null
}
