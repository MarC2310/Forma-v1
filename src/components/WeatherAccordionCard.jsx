import { useState, useEffect } from 'react'

export default function WeatherAccordionCard({ weather, c, isDark }) {
  const [open, setOpen] = useState(false)
  if (!weather) return null

  const wAqi   = weather.aqi      ?? null
  const wPm25  = weather.pm2_5    ?? null
  const wPm10  = weather.pm10     ?? null
  const wUv    = weather.uv_index ?? null
  const wDelta = weather.pressure_delta_24h
  const wAlert = wDelta != null && Math.abs(wDelta) >= 6

  const aqiColor = !wAqi ? c.text4 : wAqi<=50 ? '#4EC94E' : wAqi<=100 ? '#D4B800' : wAqi<=150 ? '#F08030' : '#E04040'
  const aqiLabel = !wAqi ? '—'     : wAqi<=50 ? 'Bun'     : wAqi<=100 ? 'Moderat' : wAqi<=150 ? 'Nesănătos*' : 'Nesănătos'
  const uvColor  = !wUv  ? c.text4 : wUv<=2   ? '#4EC94E' : wUv<=5    ? '#D4B800' : wUv<=7    ? '#F08030'   : '#E04040'
  const uvLabel  = !wUv  ? ''      : wUv<=2   ? 'Scăzut'  : wUv<=5    ? 'Moderat' : wUv<=7    ? 'Ridicat'   : 'Extrem'

  /* tema */
  const hdrBg    = isDark ? 'linear-gradient(135deg,#1A2E44 0%,#0D1E32 100%)' : 'linear-gradient(135deg,#E2F0FB 0%,#C5DFF5 100%)'
  const hdrText  = isDark ? '#fff'                   : '#0D2A48'
  const hdrMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,42,72,0.55)'
  const divider  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(13,42,72,0.12)'
  const bodyBg   = isDark ? '#0F1E2E'                : '#EAF4FC'
  const pmCardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,42,72,0.06)'
  const alertBg  = isDark ? '#2A1E0A'                : '#FFF3DC'
  const overlayBg= isDark ? 'rgba(0,0,0,0.72)'      : 'rgba(0,0,0,0.45)'

  /* lock body scroll when modal open */
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* ── CARD HEADER — mereu vizibil ── */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${c.border2}` }}>
        <div style={{ background: hdrBg, padding: '18px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 52, fontWeight: 800, color: hdrText, lineHeight: 1 }}>
                {Math.round(weather.temperature_c)}°C
              </div>
              <div style={{ fontSize: 13, color: hdrMuted, marginTop: 6 }}>{weather.weather_label}</div>
            </div>
            <span style={{ fontSize: 52, lineHeight: 1 }}>{weather.weather_icon}</span>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'flex', borderTop: `1px solid ${divider}`, marginTop: 14, paddingTop: 12 }}>
            {[
              { label: 'Umiditate', val: `${weather.humidity_pct}%`,       col: hdrText },
              { label: 'Vânt',      val: `${weather.wind_speed_kmh} km/h`, col: hdrText },
              wUv != null && { label: 'UV Index', val: wUv.toFixed(1),     col: uvColor },
              { label: 'Presiune',  val: `${weather.pressure_hpa}`,        col: hdrText },
            ].filter(Boolean).map((item, i, arr) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length-1 ? `1px solid ${divider}` : 'none', padding: '0 4px', paddingBottom: 14 }}>
                <div style={{ fontSize: 9, color: hdrMuted, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: item.col }}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* Toggle strip */}
          <div onClick={() => setOpen(true)}
            style={{ borderTop: `1px solid ${divider}`, padding: '9px 0', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: 11, color: hdrMuted, letterSpacing: '0.04em' }}>
              {`AQI${wAqi != null ? ` ${wAqi}` : ''} · PM · Prognoză orară ▼`}
            </span>
          </div>
        </div>
      </div>

      {/* ── MODAL OVERLAY ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: overlayBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto', borderRadius: 20, overflow: 'hidden', border: `1px solid ${c.border2}` }}>

            {/* Modal header compact */}
            <div style={{ background: hdrBg, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: hdrText }}>{Math.round(weather.temperature_c)}°C</span>
                <span style={{ fontSize: 13, color: hdrMuted }}>{weather.weather_label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>{weather.weather_icon}</span>
                <button onClick={() => setOpen(false)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer', color: hdrText, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            <div style={{ background: bodyBg, overflowY: 'auto', maxHeight: 'calc(85vh - 60px)' }}>

              {/* AQI */}
              {wAqi != null && (
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${c.border2}` }}>
                  <div style={{ fontSize: 10, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Calitatea aerului</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: aqiColor }}>
                      {wAqi} <span style={{ fontSize: 12, fontWeight: 400, color: c.text4 }}>AQI</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: aqiColor, background: aqiColor+'22', padding: '4px 12px', borderRadius: 20 }}>{aqiLabel}</div>
                  </div>
                  <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#4EC94E 0%,#D4B800 33%,#F08030 55%,#E04040 78%,#8B0000 100%)', marginBottom: 6 }}>
                    <div style={{ position: 'absolute', top: -2, width: 12, height: 12, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 2px rgba(0,0,0,0.25)', left: `${Math.min(98,(wAqi/300)*100)}%`, transform: 'translateX(-50%)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: c.text4, marginBottom: 12 }}>
                    <span>0 Bun</span><span>100</span><span>200</span><span>300 Hazard</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {wPm25 != null && (
                      <div style={{ flex: 1, background: pmCardBg, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: c.text4, marginBottom: 4 }}>PM2.5</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{wPm25.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: c.text4 }}>µg/m³</div>
                      </div>
                    )}
                    {wPm10 != null && (
                      <div style={{ flex: 1, background: pmCardBg, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: c.text4, marginBottom: 4 }}>PM10</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{wPm10.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: c.text4 }}>µg/m³</div>
                      </div>
                    )}
                    {wUv != null && (
                      <div style={{ flex: 1, background: pmCardBg, borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: c.text4, marginBottom: 4 }}>UV Index</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: uvColor }}>{wUv.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: uvColor, opacity: .8 }}>{uvLabel}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pressure alert */}
              {wAlert && (
                <div style={{ padding: '10px 16px', background: alertBg, borderBottom: `1px solid ${c.border2}` }}>
                  <div style={{ fontSize: 11, color: c.orange, lineHeight: 1.5 }}>
                    ⚡ Variație presiune {wDelta > 0 ? '+' : ''}{wDelta} hPa în 24h — poate afecta readiness-ul și energia.
                  </div>
                </div>
              )}

              {/* Hourly forecast */}
              {weather.today_forecast?.length > 0 && (
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Prognoză orară</div>
                  <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
                    {weather.today_forecast.map((h, i) => (
                      <div key={i} style={{ textAlign: 'center', flexShrink: 0, minWidth: 36 }}>
                        <div style={{ fontSize: 10, color: c.text4, marginBottom: 4 }}>{h.hour}:00</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{h.temp}°</div>
                        {h.precip_prob >= 20 && <div style={{ fontSize: 9, color: '#4A9EE8', marginTop: 3 }}>💧{h.precip_prob}%</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  )
}
