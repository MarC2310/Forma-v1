// src/components/ActivityTab.jsx
import React, { useState } from 'react'

function toStr(val) {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number') return String(val)
  if (React.isValidElement(val)) return val
  if (typeof val === 'object') {
    try { return JSON.stringify(val) } catch { return '[object]' }
  }
  return String(val)
}

function MiniProgressRing({ pct, color, c }) {
  const size = 32, stroke = 3, r = (size - stroke) / 2, circ = 2 * Math.PI * r
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} stroke={c?.border || 'rgba(255,255,255,0.1)'} strokeWidth={stroke} fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function MetricCard({ label, value, unit, delta, deltaPos, c, ringPct, ringColor, onClick, icon }) {
  const safeC = c || {}
  const [hover, setHover] = useState(false)
  const valStr = String(value ?? '')
  const valueFontSize = valStr.length > 7 ? 14 : valStr.length > 5 ? 16 : 20

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: safeC.card || 'rgba(0,0,0,0.22)', borderRadius: safeC.radiusSm || 12, padding: '0.65rem',
        boxShadow: hover ? safeC.shadowHero : safeC.shadowCard,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        transform: hover ? 'translateY(-2px)' : 'none',
        position: 'relative', overflow: 'hidden', minWidth: 0,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 9, color: safeC.text3 || 'rgba(255,255,255,0.5)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
            {icon && <span style={{ fontSize: 11 }}>{toStr(icon)}</span>}
            {toStr(label)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: valueFontSize, fontWeight: 800, color: safeC.text || '#fff', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toStr(value)}</span>
            {unit && <span style={{ fontSize: 10, color: safeC.text4 || 'rgba(255,255,255,0.38)', flexShrink: 0 }}>{toStr(unit)}</span>}
          </div>
          {delta && <div style={{ fontSize: 9, marginTop: 2, color: deltaPos === true ? (safeC.green || '#86efac') : deltaPos === false ? (safeC.red || '#ef4444') : (safeC.text4 || 'rgba(255,255,255,0.38)'), fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toStr(delta)}</div>}
        </div>
        {ringPct != null && <MiniProgressRing pct={ringPct} color={ringColor || safeC.green || '#86efac'} c={safeC}/>}
      </div>
      {onClick && (
        <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, color: safeC.text4 || 'rgba(255,255,255,0.38)', opacity: hover ? 1 : 0, transition: 'opacity 0.15s ease' }}>→</div>
      )}
    </div>
  )
}

export default function ActivityTab(props) {
  const {
    intervalsData,
    userProfile,
    c = {},
    t,
    lang,
    activitateDayOffset = 0,
    setActivitateDayOffset,
    filterMFP = (x => x),
    loadIntervalsData,
    Acc = (({children}) => <div>{children}</div>),
    PMCChart,
    HROrarChart,
    trainingLoadHistory,
    trainingLoad,
    pmcAiText,
    setPmcAiText,
    generatePmcAi,
    pmcAiLoading,
    activityEditMode,
    setActivityEditMode,
    ACTIVITY_WIDGET_REGISTRY = [],
    isActivityVisible = (() => true),
    toggleActivityWidget,
    stepsChartPeriod = 7,
    loadStepsChartPeriod,
    stepsChartLoading,
    stepsChartData,
    combinedSleep,
    getBLEHRData = (() => []),
    activityWorkoutOpen,
    setActivityWorkoutOpen,
    hevyFetching,
    loadHevyData,
    weeklyStats = { count: 0, totalVolume: 0, prs: 0 },
    weeklyView,
    setWeeklyView,
    weeklyWorkouts = [],
    weeklyPRs = [],
    estimateWorkoutDuration = (() => ({ value: 0, isEstimated: false })),
    formatCalories = (() => ({ value: 0, isReal: false })),
    calc1RM = (() => 0),
    s = {},
    bmrSoFar = 0,
    vo2max,
    activitiesExpanded = true,
    setActivitiesExpanded = (() => {})
  } = props

  const safeC = {
    card: 'rgba(0,0,0,0.22)',
    card2: 'rgba(0,0,0,0.15)',
    card3: 'rgba(0,0,0,0.3)',
    text: '#ffffff',
    text3: 'rgba(255,255,255,0.5)',
    text4: 'rgba(255,255,255,0.38)',
    border: 'rgba(255,255,255,0.1)',
    border2: 'rgba(255,255,255,0.08)',
    green: '#86efac',
    green2: '#22c55e',
    green3: 'rgba(134,239,172,0.2)',
    orange: '#fb923c',
    blue: '#60a5fa',
    radiusSm: 12,
    radiusMd: 14,
    ...c
  }

  const safeS = {
    card: { background: safeC.card, borderRadius: 14, padding: '1rem', marginBottom: '0.75rem' },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: safeC.text3, textTransform: 'uppercase', letterSpacing: '0.08em' },
    ...s
  }

  const safeT = (key) => {
    try {
      const res = typeof t === 'function' ? t(key) : key
      return toStr(res || key)
    } catch {
      return toStr(key)
    }
  }

  const grid4 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: '0.75rem' }

  return (
    <div style={{ position: 'relative', zIndex: 0 }}>
      <img src="/om.png" alt="" aria-hidden="true" style={{ position: 'absolute', top: 4, right: -6, width: 130, height: 'auto', zIndex: -1, pointerEvents: 'none', opacity: 0.12 }}/>
      
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '1.8px', textTransform: 'uppercase', marginBottom: 10 }}>
        {safeT('Activitate')}
      </div>

      {/* ── Navigare pe zile și Inel Activitate ── */}
      {(() => {
        const maxActOffset = Math.max(0, (intervalsData?.days?.length || 1) - 1)
        const clampedActOffset = Math.min(activitateDayOffset, maxActOffset)
        const actDate = new Date()
        actDate.setDate(actDate.getDate() - clampedActOffset)
        const actDateStr = actDate.toISOString().slice(0, 10)
        const actDayLabel = actDate.toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })

        const allActivities = intervalsData?.activities || intervalsData?.todayActivities || []
        const dayActs = filterMFP(clampedActOffset === 0
          ? (intervalsData?.todayActivities || [])
          : allActivities.filter(a => (a.date || (a.start_date_local||'').slice(0,10)) === actDateStr))

        const dayData = clampedActOffset === 0
          ? intervalsData?.today
          : (intervalsData?.days || []).find(d => d.date === actDateStr)
        const stepsDay = dayData?.steps || 0
        const targetSteps = userProfile?.target_steps || 10000

        const actColor = (type) => {
          if (!type) return '#94a3b8'
          const tName = type.toLowerCase()
          if (tName.includes('walk') || tName.includes('mers')) return '#fbbf24'
          if (tName.includes('run') || tName.includes('aler')) return '#f97316'
          if (tName.includes('ride') || tName.includes('cycl')) return '#60a5fa'
          if (tName.includes('swim')) return '#22d3ee'
          if (tName.includes('weight') || tName.includes('strength') || tName.includes('gym')) return '#f43f5e'
          return '#94a3b8'
        }

        const totalCalsD = dayActs.reduce((sum, a) => sum + (a.calories || 0), 0)
        const totalMinsD = Math.round(dayActs.reduce((sum, a) => sum + (a.duration_min || (a.moving_time || a.elapsed_time || 0) / 60), 0))
        const targetCals = userProfile?.target_calories_burned || 600
        const targetMins = 60
        const actScore = Math.min(100, Math.round(
          (Math.min(1, totalCalsD / targetCals) * 50) +
          (Math.min(1, totalMinsD / targetMins) * 40) +
          (Math.min(dayActs.length, 3) / 3 * 10)
        ))
        const scoreLabel = actScore >= 90 ? 'Excelent' : actScore >= 75 ? 'Foarte bun' : actScore >= 55 ? 'Bun' : actScore > 0 ? 'În progres' : 'Nicio activitate'
        const scoreColor = actScore >= 75 ? safeC.green : actScore >= 55 ? safeC.orange : '#94a3b8'

        const ringActs = dayActs
        const svgSize = 120
        const cx = 60, cy = 60, oR = 52, iR = 36
        const gap = 5
        const ringTotalCals = ringActs.reduce((sum, a) => sum + (a.calories || 0), 0)
        const totalCalsForArc = Math.max(ringTotalCals, targetCals)
        let arcAngle = 0
        const arcPaths = ringActs.map(act => {
          const span = (act.calories || 0) / totalCalsForArc * (360 - gap * ringActs.length)
          const startA = arcAngle + gap / 2
          const endA = arcAngle + span - gap / 2
          arcAngle += span + gap
          const ptO = (a) => { const rad = (a - 90) * Math.PI / 180; return [cx + oR * Math.cos(rad), cy + oR * Math.sin(rad)] }
          const ptI = (a) => { const rad = (a - 90) * Math.PI / 180; return [cx + iR * Math.cos(rad), cy + iR * Math.sin(rad)] }
          const lg = endA - startA > 180 ? 1 : 0
          const p1 = ptO(startA), p2 = ptO(endA), p3 = ptI(endA), p4 = ptI(startA)
          const f = n => n.toFixed(2)
          const d = `M${f(p1[0])},${f(p1[1])} A${oR},${oR} 0 ${lg} 1 ${f(p2[0])},${f(p2[1])} L${f(p3[0])},${f(p3[1])} A${iR},${iR} 0 ${lg} 0 ${f(p4[0])},${f(p4[1])}Z`
          return { d, color: actColor(act.type), act }
        })
        const remainAngle = arcAngle
        const emptyArc = (() => {
          if (remainAngle >= 358) return null
          const startA = remainAngle + gap / 2
          const endA = 360 - gap / 2
          const ptO = (a) => { const r=(a-90)*Math.PI/180; return [cx+oR*Math.cos(r), cy+oR*Math.sin(r)] }
          const ptI = (a) => { const r=(a-90)*Math.PI/180; return [cx+iR*Math.cos(r), cy+iR*Math.sin(r)] }
          const lg = endA - startA > 180 ? 1 : 0
          const p1=ptO(startA),p2=ptO(endA),p3=ptI(endA),p4=ptI(startA)
          const f=n=>n.toFixed(2)
          return `M${f(p1[0])},${f(p1[1])} A${oR},${oR} 0 ${lg} 1 ${f(p2[0])},${f(p2[1])} L${f(p3[0])},${f(p3[1])} A${iR},${iR} 0 ${lg} 0 ${f(p4[0])},${f(p4[1])}Z`
        })()

        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button
                onClick={() => setActivitateDayOffset && setActivitateDayOffset(o => Math.min(o + 1, maxActOffset))}
                style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: clampedActOffset >= maxActOffset ? 0.3 : 1 }}
                disabled={clampedActOffset >= maxActOffset}
              >‹</button>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{toStr(actDayLabel)}</span>
              <button
                onClick={() => setActivitateDayOffset && setActivitateDayOffset(o => Math.max(o - 1, 0))}
                style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: clampedActOffset <= 0 ? 0.3 : 1 }}
                disabled={clampedActOffset <= 0}
              >›</button>
            </div>

            <div style={{ margin: '0 0 1rem', padding: '14px 16px', background: 'transparent', borderRadius: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                    <circle cx={cx} cy={cy} r={oR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={oR - iR}/>
                    {arcPaths.map((ap, i) => (<path key={i} d={ap.d} fill={ap.color}/>))}
                    {emptyArc && <path d={emptyArc} fill="rgba(255,255,255,0.05)"/>}
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 26, fontWeight: 500, color: '#fff', lineHeight: 1 }}>{actScore}</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{safeT('scor zi')}</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: scoreColor, marginBottom: 8 }}>{safeT(scoreLabel)}</div>
                  {ringActs.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{safeT('Nicio activitate înregistrată')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {ringActs.map((act, i) => {
                        const startTime = (act.start_time || act.start_date_local || '').slice(11, 16)
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: actColor(act.type), flexShrink: 0 }}/>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toStr(act.name || act.type)}</span>
                            {startTime && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{startTime}</span>}
                            {act.calories > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{Math.round(act.calories)}cal</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hero card activitate */}
            {(() => {
              const totalCalsH = Math.round(dayActs.reduce((sum, a) => sum + (a.calories || 0), 0))
              const activeMinsH = Math.round(dayActs.reduce((sum, a) => sum + (a.duration_min || (a.moving_time || a.elapsed_time || 0) / 60), 0))
              const workoutsH = dayActs.length
              const stepsPctH = Math.min(100, Math.round((stepsDay / targetSteps) * 100))
              const heroStats = [
                { val: stepsDay.toLocaleString(), lbl: safeT('Pași') },
                { val: totalCalsH ? totalCalsH.toLocaleString() : '—', lbl: safeT('kcal arse') },
                { val: activeMinsH ? `${activeMinsH}m` : '—', lbl: safeT('Activ') },
                { val: workoutsH || '—', lbl: safeT('Antren.') },
              ]
              return (
                <div style={{ margin: '0 0 1rem', padding: '14px 16px', background: 'rgba(0,0,0,0.18)', borderRadius: 18 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                    {heroStats.map((item, i) => (
                      <React.Fragment key={i}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 600, color: '#fff', lineHeight: 1.1 }}>{toStr(item.val)}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{toStr(item.lbl)}</div>
                        </div>
                        {i < heroStats.length - 1 && <div style={{ width: 1, background: 'rgba(255,255,255,0.18)', margin: '4px 0' }}/>}
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, height: 5, overflow: 'hidden' }}>
                    <div style={{ background: safeC.green, height: '100%', width: `${stepsPctH}%`, borderRadius: 6 }}/>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{stepsDay.toLocaleString()} / {targetSteps.toLocaleString()} {safeT('pași')}</span>
                    <span style={{ fontSize: 10, color: safeC.green }}>{stepsPctH}%</span>
                  </div>
                </div>
              )
            })()}
          </>
        )
      })()}

      {/* ── 2. Metric cards principale ── */}
      {(() => {
        const cAct = { ...safeC,
          card: 'rgba(0,0,0,0.22)', card2: 'rgba(0,0,0,0.15)',
          text: '#ffffff', text3: 'rgba(255,255,255,0.5)', text4: 'rgba(255,255,255,0.38)',
          shadowCard: 'none', shadowHero: '0 4px 16px rgba(0,0,0,0.3)',
        }
        return (
          <>
            <div style={grid4}>
              <MetricCard label={'Pași azi'} value={(intervalsData?.today?.steps || 0).toLocaleString()||'—'} delta={userProfile?.target_steps ? `${lang === 'en' ? 'target' : 'țintă'} ${userProfile.target_steps.toLocaleString()}` : (intervalsData?.today?.steps||0) >= 10000 ? '✓ 10k' : ''} deltaPos={(intervalsData?.today?.steps||0) >= (userProfile?.target_steps || 10000)} c={cAct}
                ringPct={intervalsData?.today?.steps && userProfile?.target_steps ? Math.round((intervalsData.today.steps / userProfile.target_steps) * 100) : null} ringColor={safeC.green}
                onClick={loadIntervalsData}/>
              {(() => {
                const todayStrA = new Date().toISOString().slice(0, 10)
                const todayActsA = filterMFP(intervalsData?.activities).filter(a => a.date === todayStrA)
                const intervalsCalsA = todayActsA.length > 0 && todayActsA.some(a => a.calories != null)
                  ? todayActsA.reduce((sum, a) => sum + (a.calories || 0), 0) : null
                const nowH2 = new Date().getHours() + new Date().getMinutes()/60
                const rawC2 = intervalsData?.todayActivities?.reduce((s,a)=>s+(a.calories||0),0) || null
                const maxR2 = nowH2 < 10 ? Math.round(((userProfile?.bmrDaily||1800)/24)*nowH2 + 400) : null
                const stale2 = !intervalsCalsA && rawC2 && maxR2 && rawC2 > maxR2
                const fitActC2 = !stale2 && rawC2 ? Math.round(Math.max(0, rawC2 - bmrSoFar)) : null
                const actC2 = intervalsCalsA ?? fitActC2
                const isRealA = intervalsCalsA != null
                const tgt2 = userProfile?.target_calories_burned
                return <MetricCard label={'Calorii arse'} value={actC2 ?? '—'} unit={actC2 ? 'kcal' : ''}
                  delta={stale2 ? 'sincronizare în curs' : isRealA ? `✓ Intervals.icu` : tgt2 ? `${lang === 'en' ? 'target' : 'țintă'} ${tgt2} kcal` : `+ ${bmrSoFar} ${lang === 'en' ? 'basal' : 'bazal'}`}
                  deltaPos={stale2 ? false : isRealA ? true : tgt2 && actC2 ? actC2 >= tgt2 : null}
                  ringPct={actC2 && tgt2 ? Math.round((actC2/tgt2)*100) : null}
                  ringColor={safeC.orange} c={cAct} onClick={loadIntervalsData}/>
              })()}
              <MetricCard label={'Puls mediu'} value={intervalsData?.today?.hr_rest ? `${intervalsData.today.hr_rest}` : '—'} unit="bpm" delta={intervalsData?.todayActivities?.[0]?.hr_max ? `max ${intervalsData.todayActivities[0].hr_max}bpm` : ''} deltaPos={intervalsData?.today?.hr_rest < 70} c={cAct}
                onClick={loadIntervalsData}/>
              <MetricCard label={'Pași medie/zi'} value={(() => { const d7=intervalsData?.days?.slice(-7)||[]; return d7.length ? Math.round(d7.reduce((s,d)=>s+(d.steps||0),0)/d7.length).toLocaleString() : '—' })()} delta="7 zile" deltaPos={(intervalsData?.days?.slice(-7)||[]).reduce((s,d)=>s+(d.steps||0),0)/7 >= 8000} c={cAct}
                onClick={loadIntervalsData}/>
            </div>
            <div style={grid4}>
              {(() => {
                const ictd = intervalsData?.latest || intervalsData?.today
                const hasIntervals = ictd?.ctl != null
                const ctl = hasIntervals ? ictd.ctl : trainingLoad?.ctl
                const tsb = hasIntervals ? ictd.tsb : trainingLoad?.tsb
                const src = hasIntervals ? 'Intervals.icu' : (lang === 'en' ? 'estimated' : 'estimat')
                return (
                  <MetricCard label={'Fitness (CTL)'} value={ctl != null ? Math.round(ctl) : '—'} delta={tsb != null ? (tsb > 5 ? `✓ ${lang === 'en' ? 'fresh' : 'proaspăt'} TSB +${Math.round(tsb)}` : tsb < -10 ? `⚠ ${lang === 'en' ? 'fatigue' : 'oboseală'} TSB ${Math.round(tsb)}` : `${lang === 'en' ? 'balanced' : 'echilibrat'} TSB ${Math.round(tsb)}`) + ` · ${src}` : src} deltaPos={tsb != null ? tsb >= -10 : null} c={cAct}
                    onClick={() => window.location.href='/progress'}/>
                )
              })()}
              {(() => {
                const latestWithVo2 = [...(intervalsData?.days || [])].reverse().find(d => d.vo2max != null)
                const intervalsVo2 = latestWithVo2?.vo2max ?? null
                const displayVo2 = intervalsVo2 ?? vo2max?.value ?? null
                const vo2Src = intervalsVo2 != null
                  ? `Intervals.icu · ${latestWithVo2.date}`
                  : vo2max ? `${lang === 'en' ? 'estimated' : 'estimat'} · HRmax ${vo2max.hrMax} / HRrest ${vo2max.hrRest}` : (lang === 'en' ? 'insufficient data' : 'date insuficiente')
                return (
                  <MetricCard label={'VO2max'} value={displayVo2 ?? '—'} unit={displayVo2 ? 'ml/kg/min' : ''} delta={vo2Src} deltaPos={displayVo2 ? displayVo2 >= 40 : null} c={cAct}/>
                )
              })()}
              <MetricCard label={'Total săpt.'} value={(intervalsData?.days?.slice(-7)||[]).reduce((s,d)=>s+(d.steps||0),0).toLocaleString()||'—'} delta="pași" c={cAct}
                onClick={loadIntervalsData}/>
              {(() => {
                const ym = new Date().toISOString().slice(0,7)
                const mDays = (intervalsData?.days||[]).filter(d => d.date?.startsWith(ym) && d.steps > 0)
                const mTotal = mDays.reduce((s,d)=>s+(d.steps||0),0)
                const mTarget = (userProfile?.target_steps||10000) * new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()
                const pct = mTarget>0 ? Math.min(100,Math.round(mTotal/mTarget*100)) : 0
                return (
                  <MetricCard label={'Pași lunar'} icon="📅"
                    value={mTotal.toLocaleString()||'—'}
                    delta={`${pct}% ${lang === 'en' ? 'of target' : 'din țintă'}`}
                    deltaPos={pct>=100} c={cAct}
                    ringPct={pct} ringColor={pct>=100?safeC.green:safeC.blue}/>
                )
              })()}
            </div>
          </>
        )
      })()}

      {/* ── ACTIVITĂȚILE ZILEI — Intervals.icu ── */}
      {(() => {
        const selDate = new Date()
        selDate.setDate(selDate.getDate() - activitateDayOffset)
        const selDateStr = selDate.toISOString().slice(0, 10)
        const todayActs = filterMFP(intervalsData?.activities).filter(a => a.date === selDateStr)
        const recentActs = filterMFP(intervalsData?.activities).filter(a => a.date !== selDateStr).slice(0, 5)
        const activityIcon = (type) => {
          if (!type) return '🏃'
          const tName = type.toLowerCase()
          if (tName.includes('walk')) return '🚶'
          if (tName.includes('run')) return '🏃'
          if (tName.includes('ride') || tName.includes('cycl')) return '🚴'
          if (tName.includes('swim')) return '🏊'
          if (tName.includes('weight') || tName.includes('strength') || tName.includes('gym')) return '🏋️'
          if (tName.includes('hike')) return '🥾'
          if (tName.includes('yoga')) return '🧘'
          if (tName.includes('row')) return '🚣'
          return '⚡'
        }
        const formatDist = (m) => {
          if (!m) return null
          return m >= 1000 ? `${(m/1000).toFixed(1)}km` : `${Math.round(m)}m`
        }

        if (todayActs.length === 0 && !intervalsData) return null

        return (
          <div style={safeS.card}>
            <div onClick={() => setActivitiesExpanded(o => !o)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: activitiesExpanded ? 14 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: safeC.text4, display: 'inline-block', transform: activitiesExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>›</span>
                <div style={safeS.sectionLabel}>{safeT('Activitățile zilei')} {todayActs.length > 0 && <span style={{ color: safeC.green, fontWeight: 700 }}>({todayActs.length})</span>}</div>
              </div>
              <span style={{ fontSize: 10, color: safeC.text4 }}>Intervals.icu · {selDateStr}</span>
            </div>

            {activitiesExpanded && (todayActs.length === 0 ? (
              <div style={{ fontSize: 13, color: safeC.text4, textAlign: 'center', padding: '0.75rem 0' }}>
                Nicio activitate înregistrată {activitateDayOffset === 0 ? 'azi' : 'în această zi'}.<br/>
                <span style={{ fontSize: 11 }}>{safeT('Activitățile din Garmin apar după sincronizare.')}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {todayActs.map((act, i) => {
                  const actTypeLower = (act.type || '').toLowerCase()
                  const isOutdoor = /walk|run|ride|cycl|swim|hike|outdoor/i.test(actTypeLower)
                  const durationMin = act.duration_min != null ? act.duration_min : Math.round((act.elapsed_time || act.moving_time || 0) / 60)
                  
                  const startTimeStr = act.start_time?.slice(11, 16) || act.start_date_local?.slice(11, 16) || '12:00'
                  const startHourNum = parseInt(startTimeStr.split(':')[0], 10) || 12
                  const startMinuteNum = parseInt(startTimeStr.split(':')[1], 10) || 0
                  const totalHourDecimal = startHourNum + startMinuteNum / 60
                  const isDaytime = totalHourDecimal >= 8 && totalHourDecimal < 19

                  const skinMultiplier = userProfile?.skin_type === 1 ? 1.2 : userProfile?.skin_type === 2 ? 1.0 : 0.8
                  const solarVitD = isOutdoor && isDaytime && durationMin > 0 ? Math.max(2, Math.round(durationMin * 2 * skinMultiplier)) : 0
                  
                  const tempAtHour = startHourNum >= 12 && startHourNum <= 18 ? 34 : startHourNum > 18 ? 28 : 24
                  const weatherDesc = startHourNum >= 10 && startHourNum <= 18 ? '☀️ Însorit' : '⛅ Parțial noros'

                  return (
                    <div key={act.id || i} style={{ background: safeC.card2, borderRadius: safeC.radiusSm, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{activityIcon(act.type)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: safeC.text }}>{act.name || act.type}</div>
                          <div style={{ fontSize: 11, color: safeC.text4, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{act.type} · {startTimeStr}</span>
                            {solarVitD > 0 && (
                              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                ☀️ +{solarVitD} UI Vit. D
                              </span>
                            )}
                            {isOutdoor && (
                              <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '1px 6px', borderRadius: 4 }}>
                                {weatherDesc} · {tempAtHour}°C
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                        <div style={{ background: safeC.card, borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: safeC.text4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{safeT('Durată')}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: safeC.text, marginTop: 2 }}>{durationMin > 0 ? `${durationMin}min` : '—'}</div>
                        </div>
                        <div style={{ background: safeC.card, borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: safeC.text4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{safeT('Calorii')}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: safeC.orange, marginTop: 2 }}>{act.calories != null ? `${act.calories}` : '—'}</div>
                          {act.calories && <div style={{ fontSize: 9, color: safeC.green }}>✓ real</div>}
                        </div>
                        <div style={{ background: safeC.card, borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: safeC.text4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{safeT('Puls mediu')}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: safeC.text, marginTop: 2 }}>{act.hr_avg ? `${Math.round(act.hr_avg)}` : '—'}<span style={{ fontSize: 11, fontWeight: 400, color: safeC.text4 }}>{act.hr_avg ? ' bpm' : ''}</span></div>
                          {act.hr_max && <div style={{ fontSize: 9, color: safeC.text4 }}>max {Math.round(act.hr_max)}</div>}
                        </div>
                        <div style={{ background: safeC.card, borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: safeC.text4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{safeT('Distanță')}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: safeC.text, marginTop: 2 }}>{formatDist(act.distance_m) || '—'}</div>
                          {act.training_load && <div style={{ fontSize: 9, color: safeC.text4 }}>TSS {Math.round(act.training_load)}</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {activitiesExpanded && recentActs.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `0.5px solid ${safeC.border2}` }}>
                <div style={{ fontSize: 11, color: safeC.text4, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{safeT('Ultimele activități')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentActs.map((act, i) => (
                    <div key={act.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < recentActs.length - 1 ? `0.5px solid ${safeC.border2}` : 'none' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{activityIcon(act.type)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: safeC.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.name || act.type}</div>
                        <div style={{ fontSize: 11, color: safeC.text4 }}>{act.date} · {act.duration_min != null ? `${act.duration_min}min` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                          {act.calories && <div style={{ fontSize: 13, fontWeight: 600, color: safeC.orange }}>{act.calories} kcal</div>}
                          {act.hr_avg && <div style={{ fontSize: 11, color: safeC.text4 }}>{Math.round(act.hr_avg)} bpm</div>}
                          {!act.calories && !act.hr_avg && formatDist(act.distance_m) && <div style={{ fontSize: 13, color: safeC.text3 }}>{formatDist(act.distance_m)}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── PMC Chart ── */}
      {(() => {
        const pmcFromIntervals = intervalsData?.pmcHistory?.length > 5
        const pmcHistory = pmcFromIntervals ? intervalsData.pmcHistory : trainingLoadHistory
        const pmcLatest = pmcFromIntervals ? (intervalsData.latest || intervalsData.today) : trainingLoad
        const pmcSrc = pmcFromIntervals ? 'Intervals.icu' : (lang === 'en' ? 'estimated from Hevy+GFit' : 'estimat din Hevy+GFit')

        if (!pmcLatest || !pmcHistory || pmcHistory.length <= 5 || !PMCChart) return null
        return (
          <Acc title={safeT('📈 Fitness-Oboseală (PMC)')} c={safeC}>
            <div style={safeS.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={safeS.sectionLabel}>{safeT('Fitness-Oboseală (Banister)')}</div>
                  <div style={{ fontSize: 10, color: pmcFromIntervals ? safeC.green : safeC.text4, marginTop: 2 }}>
                    {pmcFromIntervals ? (lang === 'en' ? '✓ real data · Intervals.icu' : '✓ date reale · Intervals.icu') : (lang === 'en' ? '⚠ estimated data · connect Intervals.icu for better accuracy' : '⚠ date estimate · conectează Intervals.icu pentru precizie mai bună')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                  <span style={{ color: safeC.text3 }}>CTL <strong style={{ color: safeC.green }}>{Math.round(pmcLatest.ctl)}</strong></span>
                  <span style={{ color: safeC.text3 }}>ATL <strong style={{ color: safeC.orange }}>{Math.round(pmcLatest.atl)}</strong></span>
                  <span style={{ color: safeC.text3 }}>TSB <strong style={{ color: (pmcLatest.tsb ?? pmcLatest.ctl - pmcLatest.atl) >= 0 ? safeC.green : '#ef4444' }}>{((pmcLatest.tsb ?? pmcLatest.ctl - pmcLatest.atl) > 0 ? '+' : '')}{Math.round(pmcLatest.tsb ?? pmcLatest.ctl - pmcLatest.atl)}</strong></span>
                </div>
              </div>
              <PMCChart history={pmcHistory} c={safeC} height={140}/>
              <div style={{ fontSize: 11, color: safeC.text4, marginTop: 10, lineHeight: 1.5 }}>
                <strong style={{ color: safeC.text3 }}>CTL</strong> ({lang === 'en' ? 'long-term fitness, 42-day avg' : 'fitness pe termen lung, medie 42 zile'}) · <strong style={{ color: safeC.text3 }}>ATL</strong> ({lang === 'en' ? 'acute fatigue, 7-day avg' : 'oboseală acută, medie 7 zile'}) · <strong style={{ color: safeC.text3 }}>TSB</strong> = CTL−ATL. {lang === 'en' ? 'Source' : 'Sursă'}: {pmcSrc}.
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${safeC.border2}` }}>
                {pmcAiText ? (
                  <div>
                    <div style={{ fontSize: 11, color: safeC.text4, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🤖 {lang === 'en' ? 'AI interpretation' : 'Interpretare AI'}</span>
                      <button onClick={() => { setPmcAiText && setPmcAiText(null); generatePmcAi && generatePmcAi(pmcLatest?.ctl, pmcLatest?.atl, pmcLatest?.tsb, pmcLatest?.ramp_rate) }}
                        style={{ fontSize: 10, padding: '3px 8px', background: safeC.card2, border: 'none', borderRadius: 6, color: safeC.text4, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ↻ {lang === 'en' ? 'Regenerate' : 'Regenerează'}
                      </button>
                    </div>
                    <div style={{ fontSize: 13, color: safeC.text3, lineHeight: 1.7 }}>{pmcAiText}</div>
                  </div>
                ) : (
                  <button onClick={() => generatePmcAi && generatePmcAi(pmcLatest?.ctl, pmcLatest?.atl, pmcLatest?.tsb, pmcLatest?.ramp_rate)}
                    disabled={pmcAiLoading}
                    style={{ width: '100%', padding: '10px', background: pmcAiLoading ? safeC.card2 : safeC.card3, border: `0.5px solid ${safeC.border}`, borderRadius: safeC.radiusSm, color: pmcAiLoading ? safeC.text4 : safeC.text3, fontSize: 13, cursor: pmcAiLoading ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {pmcAiLoading ? (lang === 'en' ? '⏳ Analyzing...' : '⏳ Se analizează...') : (lang === 'en' ? '🤖 Explain the chart with AI' : '🤖 Explică-mi graficul cu AI')}
                  </button>
                )}
              </div>
            </div>
          </Acc>
        )
      })()}

      {/* ── Training Load Ratio ── */}
      {(() => {
        const ictd = intervalsData?.latest || intervalsData?.today || {}
        const pmcFromIntervals = ictd?.ctl != null
        const pmcLatest = pmcFromIntervals ? ictd : trainingLoad
        const ctl = pmcLatest?.ctl ?? null
        const atl = pmcLatest?.atl ?? null
        if (!ctl || !atl || ctl === 0) return (
          <div style={{ background: safeC.card, border: `0.5px solid ${safeC.border}`, borderRadius: 14, padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: safeC.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{safeT('Training Load Ratio')}</div>
            <div style={{ fontSize: 11, color: safeC.text4 }}>
              {!ctl && !atl ? (lang === 'en' ? 'CTL/ATL data unavailable · sync Intervals.icu' : 'Date CTL/ATL indisponibile · sync Intervals.icu') : `CTL: ${ctl ?? '—'} · ATL: ${atl ?? '—'}`}
            </div>
          </div>
        )
        const ratio = atl / ctl
        const rRound = Math.round(ratio * 100) / 100

        let zone, zoneColor, zoneLabel
        if (ratio < 0.8)      { zone = 'low';     zoneColor = '#4FC3F7'; zoneLabel = 'Low' }
        else if (ratio < 1.3) { zone = 'optimal'; zoneColor = '#66BB6A'; zoneLabel = 'Optimal' }
        else if (ratio < 1.5) { zone = 'high';    zoneColor = '#FFA726'; zoneLabel = 'High' }
        else                  { zone = 'risk';    zoneColor = '#EF5350'; zoneLabel = 'Risk' }

        const ratioToPos = r => {
          if (r <= 0.8) return r / 0.8 * 20
          if (r <= 1.3) return 20 + (r - 0.8) / 0.5 * 45
          if (r <= 1.5) return 65 + (r - 1.3) / 0.2 * 20
          return Math.min(100, 85 + (r - 1.5) / 0.5 * 15)
        }
        const pos = ratioToPos(ratio)

        return (
          <Acc title={safeT('⚖️ Training Load Ratio')} c={safeC}>
            <div style={{ background: safeC.card, border: `0.5px solid ${safeC.border}`, borderRadius: 14, padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: safeC.text4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{safeT('Training Load Ratio')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: safeC.text4 }}>CTL {Math.round(ctl)} · ATL {Math.round(atl)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: zoneColor, background: zoneColor + '22', padding: '2px 8px', borderRadius: 12 }}>{zoneLabel}</span>
                </div>
              </div>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <div style={{ height: 14, borderRadius: 7, background: 'linear-gradient(to right, #4FC3F7 0%, #4FC3F7 20%, #66BB6A 20%, #66BB6A 65%, #FFA726 65%, #FFA726 85%, #EF5350 85%, #EF5350 100%)', overflow: 'visible', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: `${pos}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 24, height: 24, borderRadius: '50%', background: zoneColor, border: '3px solid #fff', boxShadow: `0 2px 8px ${zoneColor}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#fff' }}>{rRound}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', marginTop: 8 }}>
                  <div style={{ width: '20%', fontSize: 10, color: '#4FC3F7', textAlign: 'center' }}>Low</div>
                  <div style={{ width: '45%', fontSize: 10, color: '#66BB6A', textAlign: 'center' }}>Optimal</div>
                  <div style={{ width: '20%', fontSize: 10, color: '#FFA726', textAlign: 'center' }}>High</div>
                  <div style={{ width: '15%', fontSize: 10, color: '#EF5350', textAlign: 'center' }}>Risk</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: safeC.text3, marginTop: 8, lineHeight: 1.5, padding: '8px 10px', background: zoneColor + '11', borderRadius: 8, borderLeft: `3px solid ${zoneColor}` }}>
                {zone === 'low'     && (lang === 'en' ? 'Training load is low relative to your fitness. You can increase intensity or volume.' : 'Sarcina de antrenament e scăzută față de fitness-ul tău. Poți crește intensitatea sau volumul.')}
                {zone === 'optimal' && (lang === 'en' ? 'Optimal balance between fatigue and fitness. Ideal zone for progress with low injury risk.' : 'Raport optim între oboseală și fitness. Zona ideală pentru progres cu risc scăzut de accidentare.')}
                {zone === 'high'    && (lang === 'en' ? 'High fatigue relative to fitness. Monitor recovery and avoid further increases.' : 'Oboseală ridicată față de fitness. Monitorizează recuperarea și evită creșteri suplimentare.')}
                {zone === 'risk'    && (lang === 'en' ? 'High overtraining risk. Prioritize rest and active recovery.' : 'Risc ridicat de supraantrenament. Prioritizează odihna și recuperarea activă.')}
              </div>
            </div>
          </Acc>
        )
      })()}

      {/* Buton editare activitate */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => setActivityEditMode && setActivityEditMode(m => !m)}
          style={{ fontSize: 11, padding: '5px 12px', background: activityEditMode ? safeC.green3 : safeC.card2, border: 'none', borderRadius: safeC.radiusSm, color: activityEditMode ? safeC.green : safeC.text3, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
          {activityEditMode ? safeT('✓ Gata') : safeT('⚙️ Editează pagina')}
        </button>
      </div>

      {/* Panou editare widget-uri */}
      {activityEditMode && ACTIVITY_WIDGET_REGISTRY && (
        <div style={{ background: safeC.card2, borderRadius: safeC.radiusMd, padding: '0.75rem', marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Array.isArray(ACTIVITY_WIDGET_REGISTRY) && ACTIVITY_WIDGET_REGISTRY.map(w => {
            const isOn = isActivityVisible ? isActivityVisible(w.id) : true
            return (
              <button key={w.id} onClick={() => toggleActivityWidget && toggleActivityWidget(w.id)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${isOn ? safeC.green : safeC.border}`, background: isOn ? safeC.green3 : 'transparent', color: isOn ? safeC.green : safeC.text4, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                {isOn ? '✓ ' : '+ '}{safeT(w.label)}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Pași zilnici (Grafic) ── */}
      {isActivityVisible && isActivityVisible('act_steps') && (
        <Acc title={safeT('👣 Pași zilnici')} defaultOpen c={safeC}>
        <div style={safeS.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <div style={safeS.sectionLabel}>Pași zilnici{stepsChartLoading ? ' — se încarcă...' : ''}</div>
            <div style={{ display: 'flex', gap: 4, background: safeC.card2, padding: 3, borderRadius: 10 }}>
              {[[7,'7z'],[14,'14z'],[30,'1L'],[90,'3L'],[9999,'Tot']].map(([val, label]) => (
                <button key={val} onClick={() => loadStepsChartPeriod && loadStepsChartPeriod(val)}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: stepsChartPeriod===val ? safeC.card3 : 'transparent', color: stepsChartPeriod===val ? safeC.text : safeC.text4, fontWeight: stepsChartPeriod===val ? 700 : 500 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const stepsTarget2 = userProfile?.target_steps || 10000
            const MAX_Y2 = 40000
            const SEG2 = [
              { key:'morning',   label:safeT('Dimineață 06–12'), color:'#818cf8' },
              { key:'noon',      label:safeT('Prânz 12–16'),     color:'#f59e0b' },
              { key:'afternoon', label:safeT('Dupămasă 16–18'),  color:'#f97316' },
              { key:'evening',   label:safeT('Seară 18–22'),     color:'#ec4899' },
            ]
            const allDays2 = (intervalsData?.days || stepsChartData || [])
              .filter(d => (d.steps||0) > 0)
              .sort((a,b) => a.date.localeCompare(b.date))
            const stepsSource2 = stepsChartPeriod === 9999 ? allDays2 : allDays2.slice(-stepsChartPeriod)

            if (!stepsSource2.length) return (
              <div style={{ color:safeC.text4, fontSize:12, textAlign:'center', padding:'20px 0' }}>
                {stepsChartLoading ? 'Se încarcă…' : 'Fără date pași'}
              </div>
            )

            const actsByDate2 = {}
            const STEP_EXCL2 = /weight|strength|gym|crossfit|yoga|pilates|stretching|lift|workout/i
            ;(intervalsData?.activities || []).filter(a => !STEP_EXCL2.test(a.type||'')).forEach(a => {
              const aDate2 = a.date || a.start_date_local?.slice(0,10) || a.start_time?.slice(0,10)
              if (!aDate2) return
              ;(actsByDate2[aDate2] = actsByDate2[aDate2] || []).push(a)
            })

            const chartDays2 = stepsSource2.map(day => {
              const total = day.steps || 0
              const dayKey2 = day.date || day.start_date_local?.slice(0,10)
              const acts  = actsByDate2[dayKey2] || []
              const segs  = { morning:0, noon:0, afternoon:0, evening:0 }
              if (acts.length > 0) {
                const segW2 = { morning:0, noon:0, afternoon:0, evening:0 }
                acts.forEach(a => {
                  try {
                    const startDT = a.start_time || a.start_date_local
                    if (!startDT) return
                    const h = new Date(startDT).getHours()
                    const w = Math.max(a.elapsed_time || a.moving_time || 0, 1)
                    if      (h >= 18) segW2.evening   += w
                    else if (h >= 16) segW2.afternoon += w
                    else if (h >= 12) segW2.noon      += w
                    else              segW2.morning   += w
                  } catch {}
                })
                const totalW2 = Object.values(segW2).reduce((s,v)=>s+v, 0)
                if (totalW2 > 0) {
                  const actFrac2  = Math.min(0.85, 0.30 + acts.length * 0.15)
                  const actSteps2 = Math.round(total * actFrac2)
                  Object.keys(segs).forEach(k => {
                    segs[k] = segW2[k] > 0 ? Math.round(actSteps2 * segW2[k] / totalW2) : 0
                  })
                }
              }
              segs.morning += Math.max(0, total - segs.morning - segs.noon - segs.afternoon - segs.evening)
              return { date: day.date, total, segs }
            })

            const avg2  = Math.round(chartDays2.reduce((s,d)=>s+d.total,0)/chartDays2.length)
            const best2  = chartDays2.reduce((b,d)=>d.total>b.total?d:b, chartDays2[0])
            const goal2  = chartDays2.filter(d=>d.total>=stepsTarget2).length
            const goalPctAct = Math.min(stepsTarget2/MAX_Y2*100, 98)
            const fmtDt2 = ds => { const d=new Date(ds+'T12:00:00'); return ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'][d.getDay()]+' '+d.getDate() }
            const gapAct = chartDays2.length > 20 ? 1 : 2
            const showTipA = (e, html) => {
              e.preventDefault()
              let t = window._fTip
              if (!t) { t = document.createElement('div'); t.style.cssText='position:fixed;z-index:99999;background:rgba(15,15,25,0.93);color:#fff;padding:9px 12px;border-radius:10px;font-size:11px;pointer-events:none;max-width:190px;text-align:left;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,0.4)'; document.body.appendChild(t); window._fTip=t }
              const r=e.currentTarget.getBoundingClientRect(); t.innerHTML=html; t.style.display='block'
              const l=Math.min(Math.max(r.left+r.width/2-95,6),window.innerWidth-196)
              t.style.left=l+'px'; t.style.top=(r.top>80?r.top-t.offsetHeight-8:r.bottom+8)+'px'
              clearTimeout(window._fTipT); window._fTipT=setTimeout(()=>{t.style.display='none'},2500)
            }

            return (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
                  {[{label:safeT('Medie'),val:avg2.toLocaleString()+' p'},{label:safeT('Record'),val:best2.total.toLocaleString()+' p'},{label:safeT('Zile obiectiv'),val:`${goal2}/${chartDays2.length}`}].map(({label,val})=>(
                    <div key={label} style={{ background:safeC.card2, borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:safeC.text }}>{val}</div>
                      <div style={{ fontSize:10, color:safeC.text4, marginTop:2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:0 }}>
                  <div style={{ width:34, flexShrink:0, position:'relative', height:170, marginBottom:18 }}>
                    {[0,10000,20000,30000,40000].map(v=>(
                      <div key={v} style={{ position:'absolute', bottom:`${v/MAX_Y2*100}%`, right:5, transform:'translateY(50%)', fontSize:9, color:safeC.text4, whiteSpace:'nowrap' }}>
                        {v===0?'0':(v/1000)+'k'}
                      </div>
                    ))}
                  </div>
                  <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                    <div style={{ position:'relative', height:170 }}>
                      {[0,10000,20000,30000,40000].map(v=>(
                        <div key={v} style={{ position:'absolute', left:0, right:0, bottom:`${v/MAX_Y2*100}%`, borderTop:`1px solid ${v===0?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.05)'}`, pointerEvents:'none' }} />
                      ))}
                      <div style={{ position:'absolute', left:0, right:0, bottom:`${goalPctAct}%`, borderTop:'1px dashed rgba(129,140,248,0.35)', zIndex:1, pointerEvents:'none' }}>
                        <span style={{ position:'absolute', right:2, fontSize:8, color:'#818cf8', transform:'translateY(-100%)', whiteSpace:'nowrap' }}>{(stepsTarget2/1000).toFixed(0)}k</span>
                      </div>
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', gap:gapAct, padding:'0 2px', zIndex:2 }}>
                        {chartDays2.map((day,i)=>{
                          const pct=Math.min(day.total/MAX_Y2*100,100)
                          const tipHtmlA = `<b>${fmtDt2(day.date)}</b> — ${day.total.toLocaleString()} pași<br/>${SEG2.filter(s=>day.segs[s.key]>0).map(s=>`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${s.color};margin-right:4px;vertical-align:middle"></span>${s.label.split(' ')[0]}: ${day.segs[s.key].toLocaleString()}`).join('<br/>')}`
                          return (
                            <div key={i} title={`${fmtDt2(day.date)}: ${day.total.toLocaleString()} pași`} onTouchStart={e=>showTipA(e,tipHtmlA)} style={{ flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                              <div style={{ width:'100%', height:`${Math.max(pct,0.5)}%`, display:'flex', flexDirection:'column-reverse', borderRadius:'3px 3px 0 0', overflow:'hidden' }}>
                                {SEG2.map(seg=>{
                                  const v=day.segs[seg.key]||0
                                  if(!v) return null
                                  return <div key={seg.key} style={{ flex:v, background:seg.color }} />
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {chartDays2.length <= 14 && (
                      <div style={{ display:'flex', gap:gapAct, marginTop:3, padding:'0 2px' }}>
                        {chartDays2.map((day,i)=>(
                          <div key={i} style={{ flex:1, textAlign:'center', fontSize:8, color:safeC.text4, overflow:'hidden' }}>{fmtDt2(day.date)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', marginTop:8 }}>
                  {SEG2.map(seg=>(
                    <div key={seg.key} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:safeC.text4 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:seg.color, flexShrink:0 }} />
                      {seg.label}
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
      </Acc>
      )}

      {/* ── Puls Orar ── */}
      {(() => {
        const currentHour = new Date().getHours()
        const todayStr = new Date().toISOString().slice(0, 10)
        const hrRest = intervalsData?.today?.hr_rest || intervalsData?.latest?.hr_rest || null
        const todayActs = filterMFP(intervalsData?.activities).filter(a => a.date === todayStr)

        const hrPoints = []
        const hrSleep = combinedSleep?.hr || (hrRest ? hrRest - 8 : null)
        const hrBase  = hrRest || 62
        const localBle  = getBLEHRData ? getBLEHRData() : []
        const remoteBle = []
        const bleMerged = new Map()
        ;[...remoteBle, ...localBle].forEach(pt => { if (pt?.ts) bleMerged.set(pt.ts, pt) })
        const bleData   = [...bleMerged.values()].sort((a, b) => a.ts - b.ts)
        const sortedBle = [...bleData].sort((a, b) => a.hour - b.hour)

        if (sortedBle.length >= 3) {
          sortedBle.forEach(pt => {
            if (!isNaN(pt.hr) && pt.hr > 0) {
              hrPoints.push({ hour: pt.hour, hr: Math.round(pt.hr), real: true, ble: true })
            }
          })
        } else {
          for (let h = 0; h <= currentHour; h++) {
            const act = todayActs.find(a => {
              try {
                const startDT = a.start_time || a.start_date_local
                if (!startDT) return false
                const d = new Date(startDT)
                if (isNaN(d.getTime())) return false
                const startHour = d.getHours() + d.getMinutes()/60
                const durationH = Math.max(0.25, (a.elapsed_time || a.moving_time || 1800) / 3600)
                return h >= Math.floor(startHour) && h < startHour + durationH
              } catch { return false }
            })
            const blePt = sortedBle.length > 0
              ? sortedBle.reduce((best, p) => Math.abs(p.hour - h) < Math.abs(best.hour - h) ? p : best, sortedBle[0])
              : null
            const bleMatch = blePt && Math.abs(blePt.hour - h) < 0.3
            let hr, isReal = false, isBLE = false
            if (bleMatch) {
              hr = blePt.hr; isReal = true; isBLE = true
            } else if (act && act.average_heartrate && !isNaN(act.average_heartrate)) {
              hr = act.average_heartrate; isReal = true
            } else if (h >= 0 && h < 6 && hrSleep) {
              hr = hrSleep + Math.sin(h * 0.8) * 3; isReal = true
            } else if (h >= 6 && h < 8) {
              hr = hrBase * (0.85 + (h - 6) * 0.075)
            } else {
              hr = hrBase + Math.sin(h * 0.5) * 4
            }
            const hrRounded = Math.round(hr)
            if (!isNaN(hrRounded) && hrRounded > 0) {
              hrPoints.push({ hour: h, hr: hrRounded, real: isReal, ble: isBLE })
            }
          }
        }

        const hasRealData = sortedBle.length >= 3 || hrRest || todayActs.length > 0 || combinedSleep?.hr
        if (!hasRealData || hrPoints.length < 3 || !HROrarChart) return null

        const validHrs = hrPoints.map(d => d.hr)
        const minHr = Math.min(...validHrs)
        const maxHr = Math.max(...validHrs)
        const avgHr = Math.round(validHrs.reduce((a,b)=>a+b,0)/validHrs.length)

        return (
          <Acc title={safeT('❤️ Puls zilnic')} c={safeC}>
            <div style={safeS.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={safeS.sectionLabel}>❤️ {safeT('Puls zilnic')}</div>
                <div style={{ fontSize: 10, color: safeC.text4 }}>
                  {sortedBle.length >= 3
                    ? <span style={{ color: '#81C784' }}>📡 {sortedBle.length} {lang === 'en' ? 'BLE readings' : 'citiri BLE'}</span>
                    : todayActs.length > 0 ? `${todayActs.length} ${lang === 'en' ? 'activities ✓real' : 'activități ✓real'}` : (lang === 'en' ? 'interpolated' : 'interpolat')}
                </div>
              </div>
              <HROrarChart hrData={hrPoints} currentHour={currentHour} minHr={minHr} maxHr={maxHr} avgHr={avgHr} c={safeC} sleepData={combinedSleep} activities={(() => {
                const todayStr2 = new Date().toISOString().slice(0,10)
                const acts = filterMFP(intervalsData?.activities || [])
                  .filter(a => {
                    const actDate = a.date || a.start_time?.slice(0,10) || a.start_date_local?.slice(0,10)
                    if (actDate !== todayStr2) return false
                    const durMin = (a.elapsed_time || a.moving_time || 0) / 60
                    return durMin >= 5
                  })
                  .sort((a,b) => new Date(a.start_time) - new Date(b.start_time))
                return acts.filter((a, i) => {
                  if (i === 0) return true
                  const prev = acts[i-1]
                  const diff = Math.abs(new Date(a.start_time) - new Date(prev.start_time)) / 60000
                  return !(a.type === prev.type && diff < 5)
                })
              })()}/>
            </div>
          </Acc>
        )
      })()}

      {/* ── Antrenament (Hevy) ── */}
      <div style={safeS.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activityWorkoutOpen ? 14 : 0 }}>
          <div onClick={() => setActivityWorkoutOpen && setActivityWorkoutOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
            <span style={{ fontSize: 12, color: safeC.text4, transform: activityWorkoutOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>›</span>
            <div style={safeS.sectionLabel}>🏋️ {safeT('Antrenament')}</div>
            <div style={{ fontSize: 11, color: safeC.text4 }}>
              {weeklyStats.count} {lang === 'en' ? 'sessions wk.' : 'sesiuni săpt.'} · {weeklyStats.totalVolume > 0 ? `${Math.round(weeklyStats.totalVolume/1000)}t` : '—'}
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); loadHevyData && loadHevyData() }}
            disabled={hevyFetching}
            title={safeT('Sincronizează cu Hevy')}
            style={{ fontSize: 12, padding: '4px 10px', background: 'transparent', border: `1px solid ${safeC.border}`, borderRadius: 8, color: hevyFetching ? safeC.text4 : safeC.green, cursor: hevyFetching ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ display: 'inline-block', animation: hevyFetching ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {hevyFetching ? 'Sync...' : 'Sync'}
          </button>
        </div>
        {activityWorkoutOpen && (
          <>
            <button onClick={() => window.location.href='/workout'}
              style={{ width: '100%', padding: '11px', background: safeC.green2, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1rem' }}>
              💪 {lang === 'en' ? 'Weekly program + PRs + 1RM →' : 'Program săpt. + PR-uri + 1RM →'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              <MetricCard label="Sesiuni săpt." value={weeklyStats.count} delta="această săptămână" c={safeC}
                onClick={() => setWeeklyView && setWeeklyView(weeklyWorkouts.length === 1 ? { type: 'single', workout: weeklyWorkouts[0] } : 'sessions')}/>
              <MetricCard label="Volum săpt." value={weeklyStats.totalVolume > 0 ? `${Math.round(weeklyStats.totalVolume/1000)}t` : '0'} delta="tone ridicate" deltaPos={true} c={safeC}
                onClick={() => setWeeklyView && setWeeklyView('sessions')}/>
              <MetricCard label="Durată medie" value={`${estimateWorkoutDuration ? estimateWorkoutDuration(weeklyWorkouts[0]||{}).value : 0}min`} delta={estimateWorkoutDuration ? 'estimat (seturi+tranziții)' : 'per sesiune'} c={safeC}
                onClick={() => setWeeklyView && setWeeklyView('sessions')}/>
              <MetricCard label="PR-uri săpt." value={weeklyStats.prs} delta={weeklyStats.prs > 0 ? '🏆' : 'niciun record'} deltaPos={weeklyStats.prs > 0} c={safeC}
                onClick={() => weeklyStats.prs > 0 && setWeeklyView && setWeeklyView('prs')}/>
            </div>

            {weeklyView && (
              <div style={{ background: safeC.card2, borderRadius: safeC.radiusSm, padding: '1rem', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: safeC.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {weeklyView === 'sessions' ? (lang === 'en' ? `This week's sessions (${weeklyWorkouts.length})` : `Sesiuni săptămâna asta (${weeklyWorkouts.length})`) : weeklyView === 'prs' ? (lang === 'en' ? `This week's PRs (${weeklyPRs.length})` : `PR-uri săptămâna asta (${weeklyPRs.length})`) : weeklyView.workout?.title}
                  </div>
                  <button onClick={() => setWeeklyView && setWeeklyView(null)} style={{ background: 'transparent', border: 'none', color: safeC.text4, fontSize: 16, cursor: 'pointer' }}>✕</button>
                </div>

                {weeklyView === 'sessions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {weeklyWorkouts.map((w, i) => {
                      const { value: wDuration, isEstimated: wDurEstimated } = estimateWorkoutDuration ? estimateWorkoutDuration(w) : { value: 0, isEstimated: false }
                      const wCal = formatCalories ? formatCalories(w) : { value: 0, isReal: false }
                      return (
                        <div key={w.id || i} onClick={() => setWeeklyView && setWeeklyView({ type: 'single', workout: w })}
                          style={{ background: safeC.card, borderRadius: 10, padding: '10px 12px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: safeC.text }}>{w.title}</div>
                              <div style={{ fontSize: 11, color: safeC.text4, marginTop: 2 }}>{w.date} · {wDuration}min{wDurEstimated ? ` (${lang === 'en' ? 'estimated' : 'estimat'})` : ''} · {w.volume_kg?.toLocaleString()}kg · <span style={{ color: safeC.orange }}>🔥 {wCal.isReal ? '' : '~'}{wCal.value} kcal{wCal.isReal ? ' ✓' : ''}</span></div>
                            </div>
                            <span style={{ fontSize: 12, color: safeC.text4 }}>→</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {weeklyView === 'prs' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {weeklyPRs.map((pr, i) => (
                      <div key={i} style={{ background: safeC.card, borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: safeC.text }}>🏆 {pr.exerciseName}</div>
                          <div style={{ fontSize: 11, color: safeC.text4, marginTop: 2 }}>{pr.workoutTitle} · {pr.workoutDate}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: safeC.green }}>{pr.weight_kg}kg × {pr.reps}</div>
                      </div>
                    ))}
                  </div>
                )}

                {weeklyView?.type === 'single' && weeklyView.workout && (
                  <div>
                    {(() => {
                      const w = weeklyView.workout
                      const { value: wDuration, isEstimated: wDurEstimated } = estimateWorkoutDuration ? estimateWorkoutDuration(w) : { value: 0, isEstimated: false }
                      const wCal = formatCalories ? formatCalories(w) : { value: 0, isReal: false }
                      return (
                        <div>
                          <div style={{ fontSize: 11, color: safeC.text4, marginBottom: 10 }}>{w.date} · {wDuration}min{wDurEstimated ? ` (${lang === 'en' ? 'estimated' : 'estimat'})` : ''} · {w.volume_kg?.toLocaleString()}kg {lang === 'en' ? 'volume' : 'volum'}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {w.muscle_groups?.map(g => <span key={g} style={{ fontSize: 11, background: safeC.green3, color: safeC.green, padding: '2px 8px', borderRadius: 5 }}>{g}</span>)}
                            {w.rpe_avg && <span style={{ fontSize: 11, background: safeC.card, color: safeC.text3, padding: '2px 8px', borderRadius: 5 }}>RPE {w.rpe_avg}</span>}
                            <span style={{ fontSize: 11, background: '#2A1A0A', color: safeC.orange, padding: '2px 8px', borderRadius: 5 }}>🔥 {wCal.isReal ? '' : '~'}{wCal.value} kcal{wCal.isReal ? ' · Intervals.icu' : ' (estimat)'}</span>
                          </div>
                          {w.exercises?.map((ex, j) => {
                            const best = ex.sets?.reduce((b, s) => {
                              const est = calc1RM ? calc1RM(s.weight_kg, s.reps) : 0
                              return est > (b.est || 0) ? { weight: s.weight_kg, reps: s.reps, est } : b
                            }, {})
                            return (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: safeC.text3, padding: '5px 0', borderTop: j === 0 ? 'none' : `0.5px solid ${safeC.border2}` }}>
                                <span>{ex.name} <span style={{ color: safeC.text4 }}>({ex.sets?.length || 0} {lang === 'en' ? 'sets' : 'seturi'})</span></span>
                                <span style={{ color: safeC.text }}>{best?.weight}kg × {best?.reps} <span style={{ color: safeC.green2 }}>({best?.est}kg 1RM)</span></span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Card unicat cu derulare orizontală pentru cele 4 secțiuni ── */}
      <div style={{ background: safeC.card, borderRadius: safeC.radiusMd, padding: '1rem', marginBottom: '1rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: '4px', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
          {[
            {
              title: '1. Săptămâna 37: V-shape și postură',
              desc: 'Reducerea țesutului adipos abdominal și lățirea simetrică a spatelui prin tracțiuni controlate, ramat din aplecat și exerciții dedicate pe multi-gym constituie piatra de temelie pentru sculptarea unui fizic atletic în V. Această abordare riguroasă susține aliniamentul biomecanic corect, îmbunătățește considerabil postura generală în activitatea cotidiană de la birou sau șantier și asigură decompresia lombară necesară în menținerea unui echilibru fizic optim pe termen lung, protejând coloana vertebrală de uzura mecanică cotidiană și maximizând eficiența fiecărei contracții musculare în parte în cadrul sesiunilor de hipertrofie.',
              img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=400&q=80'
            },
            {
              title: '2. Săptămâna 37: Recuperare & HRV',
              desc: 'Monitorizarea continuă și atentă a variabilității ritmului cardiac (HRV), a scorurilor de odihnă furnizate de inele și brățări inteligente, alături de analiza parametrilor biometrici complecși, previne eficient supraantrenamentul. Optimizarea ferestrelor de odihnă nocturnă și gestionarea corectă a efortului fizic mențin imunitatea la cote ridicate, asigurând resursele energetice necesare pentru provocările profesionale și personale de zi cu zi, permițând sistemului nervos central să se regenereze complet după antrenamente grele.',
              img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=400&q=80'
            },
            {
              title: '3. Săptămâna 37: Sinteza Proteică',
              desc: 'Alimentarea constantă și precisă cu aminoacizi esențiali, proteine de înaltă calitate precum izolatul din zer și un aport calculat cu atenție de micronutrienți reprezintă motorul creșterii musculare curate. O nutriție bine planificată declanșează refacerea rapidă a microleziunilor fibrilare după antrenamentele intense, sprijină nivelul ridicat de energie și stabilizează metabolismul pe parcursul întregii săptămâni, asigurând mediul anabolic ideal pentru dezvoltarea armonioasă a fibrelor musculare.',
              img: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=400&q=80'
            },
            {
              title: '4. Săptămâna 37: Mobilitate & Longevitate',
              desc: 'Consolidarea masei musculare funcționale, menținerea densității osoase prin antrenamente de rezistență structurate cu atenție și dezvoltarea continuă a mobilității articulare reprezintă pilonii fundamentali pentru o sănătate de fier și o formă fizică de invidiat. Investiția zilnică în mișcare corectă și flexibilitate garantează o independență fizică extinsă, vitalitate pe termen lung și o rezistență crescută la stres, reducând considerabil riscul accidentărilor și asigurând o tinerețe biologică prelungită.',
              img: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80'
            }
          ].map((card, idx) => (
            <div key={idx} style={{ minWidth: '280px', maxWidth: '320px', flex: '0 0 auto', scrollSnapAlign: 'start', background: safeC.card2, borderRadius: safeC.radiusSm, padding: '16px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: `1px solid ${safeC.border2}` }}>
              <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', height: 110, background: 'rgba(0,0,0,0.3)', position: 'relative' }}>
                <img src={card.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}/>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: safeC.text, marginBottom: 8 }}>
                  {toStr(card.title)}
                </div>
                <div style={{ fontSize: 11, color: safeC.text3, lineHeight: 1.6 }}>
                  {toStr(card.desc)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
