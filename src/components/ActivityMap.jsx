// src/components/ActivityMap.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function ActivityMap({ activityId, userId, activityName, c, onClose }) {
  if (!c) return null // guard: c poate fi undefined la primul render
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [points, setPoints] = useState([])
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => { loadGPS() }, [activityId])

  useEffect(() => {
    if (points.length > 0 && mapRef.current && !leafletRef.current) {
      // Mic delay pentru ca div-ul să fie rendered
      setTimeout(initMap, 100)
    }
  }, [points])

  async function loadGPS() {
    setLoading(true)
    setError(null)
    setDebugInfo(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('intervals-activity-gps', {
        body: { userId, activityId }
      })
      if (fnErr) throw new Error(fnErr.message)
      if (!data?.ok) throw new Error(data?.error || 'Eroare GPS')

      // Salvează debug info dacă există
      if (data.debug) setDebugInfo(data.debug)

      if (!data.data?.points?.length) {
        setError(`Nu s-au găsit coordonate GPS pentru această activitate.${data.debug ? '\n\nDebug: ' + data.debug : ''}`)
        return
      }
      setPoints(data.data.points)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function initMap() {
    if (!window.L || !mapRef.current || leafletRef.current) return
    const L = window.L
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(map)

    const polyline = L.polyline(points, { color: '#97C459', weight: 4, opacity: 0.9 }).addTo(map)

    const startIcon = L.divIcon({
      html: '<div style="width:12px;height:12px;background:#97C459;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
      iconSize: [12,12], iconAnchor: [6,6], className: ''
    })
    const endIcon = L.divIcon({
      html: '<div style="width:12px;height:12px;background:#E24B4A;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
      iconSize: [12,12], iconAnchor: [6,6], className: ''
    })
    L.marker(points[0], { icon: startIcon }).addTo(map).bindPopup('Start')
    L.marker(points[points.length - 1], { icon: endIcon }).addTo(map).bindPopup('Finish')
    map.fitBounds(polyline.getBounds(), { padding: [24, 24] })
    leafletRef.current = map
  }

  useEffect(() => {
    if (window.L) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => { if (points.length > 0 && mapRef.current && !leafletRef.current) initMap() }
    document.head.appendChild(script)
  }, [])

  useEffect(() => () => { if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null } }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', flexDirection: 'column', fontFamily: c.fontFamily }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: c.card, flexShrink: 0, boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>🗺️ {activityName}</div>
          <div style={{ fontSize: 11, color: c.text4, marginTop: 2 }}>
            {points.length > 0 ? `${points.length} puncte GPS · OpenStreetMap` : 'Se încarcă traseul...'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: c.card2, border: 'none', borderRadius: 8, color: c.text3, fontSize: 18, cursor: 'pointer', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      {/* Conținut */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, zIndex: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div style={{ fontSize: 14, color: c.text4 }}>Se încarcă traseul GPS...</div>
            </div>
          </div>
        )}
        {!loading && error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, zIndex: 10, padding: '2rem' }}>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
              <div style={{ fontSize: 14, color: c.text, marginBottom: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{error}</div>
              <button onClick={loadGPS} style={{ padding: '8px 20px', background: c.green2, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Reîncearcă</button>
            </div>
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%', display: loading || error ? 'none' : 'block' }}/>
      </div>
    </div>
  )
}
