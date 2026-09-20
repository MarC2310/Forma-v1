import React, { useState } from 'react';

// ── Componenta auxiliară MetricCard ──────────────────────────────────────────
function MetricCard({ label, value, unit, delta, deltaPos, c }) {
  return (
    <div style={{ background: c?.cardBg || '#111827', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, color: c?.text4 || '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: c?.text4 || '#9ca3af' }}>{unit}</span>}
      </div>
      {delta && (
        <div style={{ fontSize: 10, marginTop: 4, color: deltaPos ? '#22c55e' : '#f87171' }}>
          {delta}
        </div>
      )}
    </div>
  )
}

// ── Componenta auxiliară Acc (Accordion) ────────────────────────────────────
function Acc({ title, defaultOpen = true, children, c }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div style={{ background: c?.cardBg || '#111827', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.75rem', overflow: 'hidden' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{title}</span>
        <span style={{ fontSize: 12, color: c?.text4 || '#9ca3af' }}>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && <div style={{ padding: '0 14px 14px 14px' }}>{children}</div>}
    </div>
  )
}

export default function SleepStatsView({ periodFitDays, userProfile, lang, c, s, grid4, t, setTab }) {
  const sleepDays = periodFitDays.filter(d => d.sleep_hours != null && d.sleep_hours > 0)
  const avgSleepH = sleepDays.length > 0 ? (sleepDays.reduce((s,d)=>s+d.sleep_hours,0)/sleepDays.length).toFixed(1) : null
  const avgSleepScore = sleepDays.length > 0 ? Math.round(sleepDays.filter(d=>d.sleep_score>0).reduce((s,d)=>s+(d.sleep_score||0),0)/Math.max(1,sleepDays.filter(d=>d.sleep_score>0).length)) : null
  const hrvDays = periodFitDays.filter(d => d.hrv != null && d.hrv > 0)
  const avgHrv = hrvDays.length > 0 ? Math.round(hrvDays.reduce((s,d)=>s+d.hrv,0)/hrvDays.length) : null
  const hrDays = periodFitDays.filter(d => d.hr_rest != null && d.hr_rest > 0)
  const avgHrRest = hrDays.length > 0 ? Math.round(hrDays.reduce((s,d)=>s+d.hr_rest,0)/hrDays.length) : null
  const sleepTarget = userProfile?.target_sleep_hours || 7
  const below7 = sleepDays.filter(d => d.sleep_hours < sleepTarget).length

  const sleepColor = h => h >= sleepTarget ? '#818cf8' : h >= sleepTarget - 1 ? '#f59e0b' : '#f87171'
  const hrvColor   = v => v >= 50 ? '#818cf8' : v >= 40 ? '#6366f1' : v >= 30 ? '#f59e0b' : '#f87171'
  const hrColor    = v => v <= 55 ? '#22c55e' : v <= 62 ? '#34d399' : v <= 70 ? '#f59e0b' : '#f87171'

  const renderBars = (vals, dates, colorFn, refLines, maxVal, fmtTip, height = 90) => {
    const max = Math.max(...vals.filter(v => v > 0), maxVal || 1)
    return (
      <div style={{ position: 'relative', height, marginBottom: 4 }}>
        {(refLines || []).map(({ v, label }) => {
          const pct = Math.min(v / max * 100, 100)
          return (
            <div key={v} style={{ position: 'absolute', left: 0, right: 24, bottom: `${pct}%`, borderTop: '1px dashed rgba(255,255,255,0.12)', zIndex: 1, pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', right: -22, fontSize: 8, color: c.text4, transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
          )
        })}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: vals.length > 25 ? 1 : 2, height: '100%', paddingRight: 24, position: 'relative', zIndex: 2 }}>
          {vals.map((v, i) => {
            const pct = v > 0 ? Math.min(v / max * 100, 100) : 2
            const col = v > 0 ? colorFn(v) : 'rgba(255,255,255,0.06)'
            const dateShort = dates[i] ? new Date(dates[i] + 'T12:00:00').toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) : ''
            return (
              <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
                title={v > 0 ? `${dateShort}: ${fmtTip(v)}` : `${dateShort}: fără date`}>
                <div style={{ width: '100%', minWidth: vals.length > 30 ? 2 : 4, background: col, borderRadius: '3px 3px 0 0', height: `${pct}%`, transition: 'height 0.3s ease' }} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const aboveTarget  = sleepDays.filter(d => d.sleep_hours >= sleepTarget).length
  const pctTarget    = sleepDays.length > 0 ? Math.round(aboveTarget / sleepDays.length * 100) : 0
  const sortedDesc   = [...sleepDays].sort((a, b) => b.date.localeCompare(a.date))
  let currentStreak  = 0
  for (const d of sortedDesc) { if (d.sleep_hours >= sleepTarget) currentStreak++; else break }

  const dowLabels = lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']
  const dowStats  = Array.from({ length: 7 }, (_, i) => ({ total: 0, count: 0 }))
  sleepDays.forEach(d => {
    const dow = new Date(d.date + 'T12:00:00').getDay()
    const idx = dow === 0 ? 6 : dow - 1
    dowStats[idx].total += d.sleep_hours
    dowStats[idx].count++
  })

  let trendDiff = null
  if (sleepDays.length >= 6) {
    const sortedAsc = [...sleepDays].sort((a, b) => a.date.localeCompare(b.date))
    const half = Math.floor(sortedAsc.length / 2)
    const fA = sortedAsc.slice(0, half).reduce((s, d) => s + d.sleep_hours, 0) / half
    const lA = sortedAsc.slice(-half).reduce((s, d) => s + d.sleep_hours, 0) / half
    trendDiff = lA - fA
  }

  const scoreDays = periodFitDays.filter(d => d.sleep_score != null && d.sleep_score > 0)

  return (
    <>
      <div style={grid4}>
        <MetricCard label="Medie somn" value={avgSleepH||'—'} unit={avgSleepH?'h':''} deltaPos={parseFloat(avgSleepH)>=sleepTarget} delta={sleepDays.length + (lang === 'en' ? ' nights' : ' nopți')} c={c}/>
        <MetricCard label="Scor mediu" value={avgSleepScore||'—'} unit={avgSleepScore?'/100':''} deltaPos={avgSleepScore>=70} c={c}/>
        <MetricCard label="HRV mediu" value={avgHrv||'—'} unit={avgHrv?'ms':''} deltaPos={avgHrv!=null && avgHrv>=40} c={c}/>
        <MetricCard label="HR odihnă med." value={avgHrRest||'—'} unit={avgHrRest?'bpm':''} deltaPos={avgHrRest!=null && avgHrRest<=60} c={c}/>
      </div>

      {below7 > 0 && (
        <div style={{ background:'rgba(251,146,60,0.1)', border:'1px solid rgba(251,146,60,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:'0.75rem', fontSize:12, color:'#fb923c' }}>
          ⚠️ {lang === 'en' ? `${below7} of ${sleepDays.length} nights under ${sleepTarget}h sleep in this period` : `${below7} din ${sleepDays.length} nopți sub ${sleepTarget}h somn în această perioadă`}
        </div>
      )}

      {sleepDays.length > 1 && (
        <Acc title="🌙 Ore somn pe zi" defaultOpen c={c}>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Medie',        value: (avgSleepH||'—') + (avgSleepH?'h':''), color: avgSleepH ? sleepColor(parseFloat(avgSleepH)) : c.text4 },
              { label: `≥${sleepTarget}h`,  value: `${aboveTarget}x`, sub: `${pctTarget}%`, color: aboveTarget > 0 ? '#818cf8' : c.text4 },
              { label: 'Max',            value: Math.max(...sleepDays.map(d=>d.sleep_hours)).toFixed(1)+'h', color: '#818cf8' },
              { label: 'Streak',         value: `${currentStreak}`, sub: lang === 'en' ? 'nights' : 'nopți', color: currentStreak >= 3 ? '#818cf8' : c.text4 },
            ].map((m, i) => (
              <div key={i} style={{ background: c.bg, borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 9, color: c.text4, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{t(m.label)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 9, color: c.text4 }}>{m.sub}</div>}
              </div>
            ))}
          </div>
          {renderBars(sleepDays.map(d=>d.sleep_hours), sleepDays.map(d=>d.date), sleepColor,
            [{ v: sleepTarget, label: `${sleepTarget}h` }, { v: 8, label: '8h' }], 10,
            v => v.toFixed(1)+'h somn')}
          {sleepDays.length <= 10 && (
            <div style={{ display: 'flex', gap: 2, paddingRight: 24, marginBottom: 6 }}>
              {sleepDays.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: c.text4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {new Date(d.date+'T12:00:00').toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            {[
              { label: `≥${sleepTarget}h — ${lang === 'en' ? 'goal' : 'obiectiv'}`, color: '#818cf8' },
              { label: `${sleepTarget-1}–${sleepTarget}h — ${lang === 'en' ? 'close' : 'aproape'}`, color: '#f59e0b' },
              { label: `<${sleepTarget-1}h — ${lang === 'en' ? 'insufficient' : 'insuficient'}`, color: '#f87171' },
            ].map(item => (
              <div key={t(item.label)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 9, height: 9, background: item.color, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: c.text4 }}>{t(item.label)}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c.text4, marginTop:8 }}>
            <span>Min: {Math.min(...sleepDays.map(d=>d.sleep_hours)).toFixed(1)}h</span>
            <span>{lang === 'en' ? 'Avg' : 'Medie'}: {avgSleepH}h</span>
            <span>Max: {Math.max(...sleepDays.map(d=>d.sleep_hours)).toFixed(1)}h</span>
          </div>
        </div>
        </Acc>
      )}

      {hrvDays.length > 1 && (
        <Acc title="💓 HRV (Intervals.icu)" c={c}>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Medie', value: (avgHrv||'—')+(avgHrv?'ms':''), color: avgHrv ? hrvColor(avgHrv) : c.text4 },
              { label: 'Max',    value: Math.max(...hrvDays.map(d=>d.hrv))+'ms', color: '#818cf8' },
              { label: 'Min',    value: Math.min(...hrvDays.map(d=>d.hrv))+'ms', color: c.text4 },
              { label: '≥50ms', value: `${hrvDays.filter(d=>d.hrv>=50).length}x`, color: '#818cf8' },
            ].map((m, i) => (
              <div key={i} style={{ background: c.bg, borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 9, color: c.text4, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{t(m.label)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
              </div>
            ))}
          </div>
          {renderBars(hrvDays.map(d=>d.hrv), hrvDays.map(d=>d.date), hrvColor,
            [{ v: 40, label: '40' }, { v: 50, label: '50' }], 70,
            v => Math.round(v)+' ms')}
          {hrvDays.length <= 10 && (
            <div style={{ display: 'flex', gap: 2, paddingRight: 24, marginBottom: 6 }}>
              {hrvDays.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: c.text4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {new Date(d.date+'T12:00:00').toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            {[
              { label: `≥50ms — ${lang==='en'?'excellent':'excelent'}`, color: '#818cf8' },
              { label: `40–50ms — ${lang==='en'?'good':'bun'}`,    color: '#6366f1' },
              { label: `30–40ms — ${lang==='en'?'medium':'mediu'}`,  color: '#f59e0b' },
              { label: `<30ms — ${lang==='en'?'poor':'slab'}`,     color: '#f87171' },
            ].map(item => (
              <div key={t(item.label)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 9, height: 9, background: item.color, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: c.text4 }}>{t(item.label)}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c.text4, marginTop:8 }}>
            <span>Min: {Math.min(...hrvDays.map(d=>d.hrv))} ms</span>
            <span>{lang === 'en' ? 'Avg' : 'Medie'}: {avgHrv} ms</span>
            <span>Max: {Math.max(...hrvDays.map(d=>d.hrv))} ms</span>
          </div>
        </div>
        </Acc>
      )}

      {hrDays.length > 1 && (
        <Acc title="❤️ Puls odihnă" c={c}>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
            {[
              { label: 'Medie',  value: (avgHrRest||'—')+(avgHrRest?'bpm':''), color: avgHrRest ? hrColor(avgHrRest) : c.text4 },
              { label: 'Min',    value: Math.min(...hrDays.map(d=>d.hr_rest))+'bpm', color: '#22c55e' },
              { label: 'Max',    value: Math.max(...hrDays.map(d=>d.hr_rest))+'bpm', color: c.text4 },
              { label: '≤60bpm', value: `${hrDays.filter(d=>d.hr_rest<=60).length}x`, color: '#22c55e' },
            ].map((m, i) => (
              <div key={i} style={{ background: c.bg, borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 9, color: c.text4, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{t(m.label)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
              </div>
            ))}
          </div>
          {renderBars(hrDays.map(d=>d.hr_rest), hrDays.map(d=>d.date), hrColor,
            [{ v: 55, label: '55' }, { v: 65, label: '65' }], 80,
            v => Math.round(v)+' bpm')}
          {hrDays.length <= 10 && (
            <div style={{ display: 'flex', gap: 2, paddingRight: 24, marginBottom: 6 }}>
              {hrDays.map((d, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: c.text4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {new Date(d.date+'T12:00:00').toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            {[
              { label: `≤55 bpm — ${lang==='en'?'excellent':'excelent'}`,  color: '#22c55e' },
              { label: `56–62 bpm — ${lang==='en'?'good':'bun'}`,      color: '#34d399' },
              { label: `63–70 bpm — ${lang==='en'?'medium':'mediu'}`,    color: '#f59e0b' },
              { label: `>70 bpm — ${lang==='en'?'high':'ridicat'}`,    color: '#f87171' },
            ].map(item => (
              <div key={t(item.label)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 9, height: 9, background: item.color, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: c.text4 }}>{t(item.label)}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c.text4, marginTop:8 }}>
            <span>Min: {Math.min(...hrDays.map(d=>d.hr_rest))} bpm</span>
            <span>{lang === 'en' ? 'Avg' : 'Medie'}: {avgHrRest} bpm</span>
            <span>Max: {Math.max(...hrDays.map(d=>d.hr_rest))} bpm</span>
          </div>
        </div>
        </Acc>
      )}

      {sleepDays.length > 1 && (
        <Acc title="📊 Trends somn" defaultOpen={false} c={c}>
        <div style={s.card}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
            {[
              { label: 'Obiectiv atins', value: `${aboveTarget}x`, sub: `${pctTarget}%`, color: aboveTarget > 0 ? '#818cf8' : c.text4 },
              { label: 'Streak curent', value: `${currentStreak}`, sub: lang === 'en' ? 'nights' : 'nopți', color: currentStreak >= 3 ? '#818cf8' : currentStreak >= 1 ? '#f59e0b' : c.text4 },
              { label: 'Medie somn', value: (avgSleepH||'—')+(avgSleepH?'h':''), color: avgSleepH ? sleepColor(parseFloat(avgSleepH)) : c.text4 },
              { label: 'Trend', value: trendDiff !== null ? (trendDiff > 0 ? `+${trendDiff.toFixed(1)}h` : `${trendDiff.toFixed(1)}h`) : '—', color: trendDiff === null ? c.text4 : trendDiff > 0.2 ? '#22c55e' : trendDiff < -0.2 ? '#f87171' : '#f59e0b' },
            ].map((m, i) => (
              <div key={i} style={{ background: c.bg, borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 9, color: c.text4, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{t(m.label)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 9, color: c.text4 }}>{m.sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: c.text3, fontWeight: 600, marginBottom: 8 }}>{t('Medie per zi a săptămânii')}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 72, marginBottom: 4 }}>
            {dowStats.map((ds, i) => {
              const avg = ds.count > 0 ? ds.total / ds.count : 0
              const pct = avg > 0 ? Math.min(avg / 10 * 100, 100) : 3
              const col = avg > 0 ? sleepColor(avg) : 'rgba(255,255,255,0.06)'
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}
                  title={avg > 0 ? `${dowLabels[i]}: ${avg.toFixed(1)}h ${lang === 'en' ? 'avg' : 'medie'} (${ds.count} ${lang === 'en' ? 'nights' : 'nopți'})` : `${dowLabels[i]}: ${lang === 'en' ? 'no data' : 'fără date'}`}>
                  {avg > 0 && <div style={{ fontSize: 7, color: col, fontWeight: 600 }}>{avg.toFixed(1)}</div>}
                  <div style={{ width: '100%', background: col, borderRadius: '3px 3px 0 0', height: `${pct}%` }} />
                  <div style={{ fontSize: 9, color: c.text4 }}>{dowLabels[i]}</div>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: c.text4, marginBottom: 14, paddingLeft: 2 }}>
            {(() => {
              const best = dowStats.reduce((b, ds, i) => ds.count > 0 && (!b || ds.total/ds.count > b.avg) ? { idx: i, avg: ds.total/ds.count } : b, null)
              const worst = dowStats.reduce((b, ds, i) => ds.count > 0 && (!b || ds.total/ds.count < b.avg) ? { idx: i, avg: ds.total/ds.count } : b, null)
              if (!best || !worst || best.idx === worst.idx) return null
              return lang === 'en' ? `Best: ${dowLabels[best.idx]} (${best.avg.toFixed(1)}h) · Worst: ${dowLabels[worst.idx]} (${worst.avg.toFixed(1)}h)` : `Cel mai bun: ${dowLabels[best.idx]} (${best.avg.toFixed(1)}h) · Cel mai slab: ${dowLabels[worst.idx]} (${worst.avg.toFixed(1)}h)`
            })()}
          </div>

          {scoreDays.length > 1 && (() => {
            const avgScore = Math.round(scoreDays.reduce((s,d)=>s+d.sleep_score,0)/scoreDays.length)
            const scoreColor = v => v >= 80 ? '#22c55e' : v >= 65 ? '#f59e0b' : '#f87171'
            const scoreMax = Math.max(...scoreDays.map(d=>d.sleep_score), 100)
            return (
              <>
                <div style={{ fontSize: 11, color: c.text3, fontWeight: 600, marginBottom: 8 }}>{t('Scor somn / noapte')}</div>
                {renderBars(scoreDays.map(d=>d.sleep_score), scoreDays.map(d=>d.date), scoreColor,
                  [{ v: 65, label: '65' }, { v: 80, label: '80' }], scoreMax,
                  v => Math.round(v)+'/100', 70)}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:c.text4, marginTop:4, marginBottom:10 }}>
                  <span>Min: {Math.min(...scoreDays.map(d=>d.sleep_score))}/100</span>
                  <span style={{ color: scoreColor(avgScore) }}>{lang === 'en' ? 'Avg' : 'Medie'}: {avgScore}/100</span>
                  <span>Max: {Math.max(...scoreDays.map(d=>d.sleep_score))}/100</span>
                </div>
              </>
            )
          })()}

          {trendDiff !== null && (
            <div style={{ background: trendDiff > 0.2 ? 'rgba(129,140,248,0.08)' : trendDiff < -0.2 ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${trendDiff > 0.2 ? 'rgba(129,140,248,0.25)' : trendDiff < -0.2 ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: c.text3, fontWeight: 600, marginBottom: 4 }}>
                {trendDiff > 0.2 ? t('📈 Somn în îmbunătățire') : trendDiff < -0.2 ? t('📉 Somn în scădere') : t('→ Somn stabil')}
              </div>
              <div style={{ fontSize: 11, color: c.text4 }}>
                {lang === 'en' ? 'Second half of the period:' : 'A doua jumătate a perioadei:'}{' '}
                <span style={{ color: trendDiff > 0.2 ? '#818cf8' : trendDiff < -0.2 ? '#f87171' : c.text3, fontWeight: 600 }}>
                  {trendDiff > 0 ? '+' : ''}{trendDiff.toFixed(1)}h/noapte
                </span>{' '}
                {lang === 'en' ? 'vs first half' : 'față de prima jumătate'}
              </div>
            </div>
          )}
        </div>
        </Acc>
      )}

      <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
        <button onClick={() => setTab('sleep')} style={{ fontSize: 12, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          {lang === 'en' ? 'See full sleep stages →' : 'Vezi fazele de somn complete →'}
        </button>
      </div>
    </>
  )
}
