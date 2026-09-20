 {tab === 'history' && (() => {
        const periodOptions = [[1, lang === 'en' ? '1 day' : '1 zi'],[7, lang === 'en' ? '7 days' : '7 zile'],[14, lang === 'en' ? '14 days' : '14 zile'],[30, lang === 'en' ? '30 days' : '30 zile'],[90, lang === 'en' ? '90 days' : '90 zile'],[0, lang === 'en' ? 'All' : 'Tot']]
        const cutoffDate = statsPeriod === 0
          ? (() => {
              const _allD = [
                ...(intervalsData?.days||[]).map(d=>d.date),
                ...(workouts||[]).map(w=>w.date),
                ...(nutritionHistory||[]).map(n=>n.date),
              ].filter(Boolean).sort()
              return _allD.length ? _allD[0] : '2020-01-01'
            })()
          : new Date(Date.now() - statsPeriod * 86400000).toISOString().slice(0,10)

        // ── Antrenamente: separă forță (Hevy) vs cardio (pași/activitate) ──────
        const periodWorkouts = workouts.filter(w => w.date && w.date >= cutoffDate)
        const strengthSessions = periodWorkouts.length
        const strengthVolume = periodWorkouts.reduce((s,w) => s + (w.volume_kg||0), 0)
        const avgDuration = strengthSessions > 0 ? Math.round(periodWorkouts.reduce((s,w)=>s+(w.duration_min||0),0)/strengthSessions) : 0
        const allMuscleGroups = {}
        periodWorkouts.forEach(w => (w.muscle_groups||[]).forEach(g => { allMuscleGroups[g] = (allMuscleGroups[g]||0)+1 }))
        const topMuscleGroups = Object.entries(allMuscleGroups).sort((a,b)=>b[1]-a[1]).slice(0,5)

        const periodFitDays = (intervalsData?.days || []).filter(d => d.date >= cutoffDate)
        const totalSteps = periodFitDays.reduce((s,d)=>s+(d.steps||0),0)
        const avgStepsP = periodFitDays.length>0 ? Math.round(totalSteps/periodFitDays.length) : 0
        const activeDays = periodFitDays.filter(d => d.steps >= 8000).length
        const totalCalBurned = periodFitDays.reduce((s,d)=>s+(d.calories_burned||0),0)

        // ── Nutriție ──────────────────────────────────────────────────────────
        const periodNutrition = nutritionHistory.filter(n => n.date >= cutoffDate)
        const avgCalories = periodNutrition.length>0 ? Math.round(periodNutrition.reduce((s,n)=>s+(n.calories||0),0)/periodNutrition.length) : 0
        const avgProtein = periodNutrition.length>0 ? Math.round(periodNutrition.reduce((s,n)=>s+(n.protein_g||0),0)/periodNutrition.length*10)/10 : 0
        const loggedDays = periodNutrition.length

        // ── Somn ──────────────────────────────────────────────────────────────
        const sleepHrsAvg = combinedSleep?.total_h ? combinedSleep.total_h.toFixed(1) : '—'

        // ── Sănătate ──────────────────────────────────────────────────────────
        const cardioScoreNow = readiness.scores.health
        const hrvScoreNow = readiness.scores.hrv

        // ── Corp: MiniBodyChart multi-series (defined here to avoid TDZ in bundle) ─
        const MiniBodyChart = ({ series = [], low, high, target: tgt }) => {
          const W2 = 310, H2 = 120, pl2 = 38, pr2 = 20, pt2 = 12, pb2 = 24
          const [tip, setTip] = useState(null) // { cx, cy, text, color }
          // Build per-series point arrays
          const seriesData = series.map(s => ({
            ...s,
            pts: (s.days || []).filter(d => d[s.fieldKey] != null).map(d => ({
              date: d.date, v: d[s.fieldKey], label: d.date?.slice(5)
            }))
          })).filter(s => s.pts.length >= 1)
          if (!seriesData.length) {
            return <div style={{ textAlign:'center', color:'#888', fontSize:12, padding:'1.5rem 0' }}>{t('Date insuficiente')}</div>
          }
          // Single point: show as card with value, not chart
          if (!seriesData.some(s => s.pts.length >= 2)) {
            return (
              <div style={{ padding:'0.75rem 0' }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:6 }}>
                  {seriesData.map(s => s.pts.length > 0 && (
                    <div key={s.key} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.pts[0].v}{s.unit}</div>
                      <div style={{ fontSize:10, color:'#888' }}>{t(s.label)} · {s.pts[0].date}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'#666', fontStyle:'italic' }}>
                  📊 Graficul necesită date istorice · activează istoricul Withings în edge function
                </div>
              </div>
            )
          }
          const isSingle = seriesData.length === 1
          // Shared X axis: all dates
          const allDates = [...new Set(seriesData.flatMap(s => s.pts.map(p => p.date)))].sort()
          const innerW2 = W2 - pl2 - pr2, innerH2 = H2 - pt2 - pb2
          const xByDate = {}
          allDates.forEach((d, i) => { xByDate[d] = pl2 + (i / Math.max(allDates.length - 1, 1)) * innerW2 })
          // Y scale per series (each normalizes independently in multi mode)
          const getY = (s) => {
            const vals = s.pts.map(p => p.v)
            const extra = isSingle ? [...(tgt != null ? [tgt] : []), low, high] : []
            const allV2 = [...vals, ...extra]
            const mn = Math.min(...allV2), mx = Math.max(...allV2)
            const pad2 = (mx - mn) * 0.15 || 1
            const lo2 = mn - pad2, hi2 = mx + pad2
            return { y: v => pt2 + innerH2 - ((v - lo2) / (hi2 - lo2)) * innerH2, lo2, hi2 }
          }
          const primary = seriesData[0]
          const { y: yP, lo2, hi2 } = getY(primary)
          const avgP = primary.pts.reduce((s2, p) => s2 + p.v, 0) / primary.pts.length
          const tickDates = allDates.length <= 5 ? allDates
            : [allDates[0], allDates[Math.floor(allDates.length/3)], allDates[Math.floor(2*allDates.length/3)], allDates[allDates.length-1]]
          // Tooltip bubble dimensions
          const TW = 68, TH = 28, TR = 5
          const clampTX = (cx) => Math.min(Math.max(cx - TW/2, 2), W2 - TW - 2)
          return (
            <svg width="100%" viewBox={`0 0 ${W2} ${H2}`} style={{ display:'block' }}
              onMouseLeave={() => setTip(null)}>
              {/* Normal range band — solo greutate only */}
              {isSingle && primary.fieldKey === 'weight_kg' && (
                <>
                  <rect x={pl2} y={yP(high)} width={innerW2} height={yP(low)-yP(high)} fill="rgba(74,222,128,0.08)"/>
                  <line x1={pl2} y1={yP(low)} x2={pl2+innerW2} y2={yP(low)} stroke="#4ade80" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4}/>
                  <line x1={pl2} y1={yP(high)} x2={pl2+innerW2} y2={yP(high)} stroke="#4ade80" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.4}/>
                </>
              )}
              {/* Target line */}
              {isSingle && tgt != null && (
                <line x1={pl2} y1={yP(tgt)} x2={pl2+innerW2} y2={yP(tgt)} stroke="#e879f9" strokeWidth={1} strokeDasharray="5,3"/>
              )}
              {/* Avg line — primary series, thinner, behind data */}
              <line x1={pl2} y1={yP(avgP)} x2={pl2+innerW2} y2={yP(avgP)}
                stroke={primary.color} strokeWidth={0.8} strokeDasharray="4,3" opacity={0.55}/>
              {/* Each series */}
              {seriesData.map((s, si) => {
                const { y: ySeries } = getY(s)
                const validPts = s.pts.filter(p => xByDate[p.date] !== undefined)
                if (validPts.length < 2) return null
                const pathD = validPts.map((p, i) => `${i===0?'M':'L'}${xByDate[p.date].toFixed(1)},${ySeries(p.v).toFixed(1)}`).join(' ')
                return (
                  <g key={s.key}>
                    <path d={pathD} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
                    {validPts.map((p, i) => {
                      const cx = xByDate[p.date], cy = ySeries(p.v)
                      return (
                        <circle key={i} cx={cx} cy={cy} r={5} fill="transparent" stroke="none"
                          style={{ cursor:'pointer' }}
                          onMouseEnter={() => setTip({ cx, cy, color: s.color, label: s.label, value: p.v, unit: s.unit, date: p.date })}>
                          <circle cx={cx} cy={cy} r={2.5} fill={s.color} style={{ pointerEvents:'none' }}/>
                        </circle>
                      )
                    })}
                    {/* Last point value label */}
                    {(() => { const lp = validPts[validPts.length-1]; return lp ? (
                      <text x={xByDate[lp.date]} y={ySeries(lp.v)-6} fontSize={8} fill={s.color} textAnchor="middle" fontWeight="600">
                        {lp.v}{s.unit}
                      </text>
                    ) : null })()}
                  </g>
                )
              })}
              {/* Visible dots layer (on top of hit areas) */}
              {seriesData.map(s => {
                const { y: ySeries } = getY(s)
                return s.pts.filter(p => xByDate[p.date] !== undefined).map((p, i) => (
                  <circle key={s.key+i} cx={xByDate[p.date]} cy={ySeries(p.v)} r={2.5} fill={s.color} style={{ pointerEvents:'none' }}/>
                ))
              })}
              {/* X ticks */}
              {tickDates.map(d => xByDate[d] !== undefined ? (
                <text key={d} x={xByDate[d]} y={H2-4} fontSize={8} fill="#888" textAnchor="middle">{d.slice(5)}</text>
              ) : null)}
              {/* Y ticks — primary series only */}
              {isSingle && [lo2, (lo2+hi2)/2, hi2].map((v, i) => (
                <text key={i} x={pl2-3} y={yP(v)+3} fontSize={8} fill="#888" textAnchor="end">{v.toFixed(1)}</text>
              ))}
              {/* Hover tooltip */}
              {tip && (() => {
                const tx = clampTX(tip.cx)
                const ty = tip.cy - TH - 6 < pt2 ? tip.cy + 8 : tip.cy - TH - 6
                return (
                  <g style={{ pointerEvents:'none' }}>
                    <rect x={tx} y={ty} width={TW} height={TH} rx={TR} ry={TR}
                      fill="rgba(20,20,30,0.88)" stroke={tip.color} strokeWidth={1}/>
                    <text x={tx + TW/2} y={ty + 10} fontSize={7.5} fill="#aaa" textAnchor="middle">
                      {tip.date}
                    </text>
                    <text x={tx + TW/2} y={ty + 21} fontSize={10} fontWeight="700" fill={tip.color} textAnchor="middle">
                      {tip.value}{tip.unit}
                    </text>
                  </g>
                )
              })()}
            </svg>
          )
        }

        const statsTabs = [
          ['calendar', t('📅 Calendar')],
          ['strength', '🏋️ ' + t('Forță')],
          ['cardio', t('🏃 Cardio')],
          ['nutrition', t('🥗 Nutriție')],
          ['sleep', t('😴 Somn')],
          ['corp', '⚖️ ' + t('Corp')],
          ['health', t('❤️ Sănătate')],
        ]

        return (
          <div style={{ position: 'relative', zIndex: 0 }}>
            {/* ── Grafic auriu — se desenează animat în fundal, în dreptul scorului general ── */}
            <style>{`
              @keyframes statGrpFade{0%{opacity:1}84%{opacity:1}99%{opacity:0}100%{opacity:0}}
              @keyframes statRingDraw{0%{stroke-dashoffset:100}55%,100%{stroke-dashoffset:0}}
              @keyframes statLineDraw{0%,32%{stroke-dashoffset:100}72%,100%{stroke-dashoffset:0}}
              @keyframes statBg1{0%,8%{transform:scaleY(0)}22%,100%{transform:scaleY(1)}}
              @keyframes statBg2{0%,18%{transform:scaleY(0)}32%,100%{transform:scaleY(1)}}
              @keyframes statBg3{0%,28%{transform:scaleY(0)}42%,100%{transform:scaleY(1)}}
              @keyframes statArrShow{0%,66%{opacity:0}76%,100%{opacity:1}}
            `}</style>
            <div aria-hidden="true" style={{ position: 'absolute', top: 8, right: -6, width: 120, height: 120, zIndex: -1, pointerEvents: 'none', opacity: 0.10 }}>
              <svg width="120" height="120" viewBox="0 0 100 100" fill="none" style={{ overflow: 'visible', animation: 'statGrpFade 8s linear infinite' }}>
                <defs><linearGradient id="statChartGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c8940f"/><stop offset="50%" stopColor="#ffd54a"/><stop offset="100%" stopColor="#fff2b0"/>
                </linearGradient></defs>
                <circle cx="50" cy="52" r="42" pathLength="100" stroke="url(#statChartGrad)" strokeWidth="3" strokeLinecap="round" transform="rotate(-95 50 52)" strokeDasharray="100" style={{ animation: 'statRingDraw 8s ease-out infinite' }}/>
                <rect x="34" y="64" width="9" height="22" rx="1" stroke="url(#statChartGrad)" strokeWidth="2.6" style={{ transformOrigin: '38px 86px', animation: 'statBg1 8s ease-out infinite' }}/>
                <rect x="46" y="54" width="9" height="32" rx="1" stroke="url(#statChartGrad)" strokeWidth="2.6" style={{ transformOrigin: '50px 86px', animation: 'statBg2 8s ease-out infinite' }}/>
                <rect x="58" y="44" width="9" height="42" rx="1" stroke="url(#statChartGrad)" strokeWidth="2.6" style={{ transformOrigin: '62px 86px', animation: 'statBg3 8s ease-out infinite' }}/>
                <path d="M26 68 L40 55 L48 62 L72 33" pathLength="100" stroke="url(#statChartGrad)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" style={{ animation: 'statLineDraw 8s ease-out infinite' }}/>
                <path d="M72 33 L60 35 M72 33 L70 45" stroke="url(#statChartGrad)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'statArrShow 8s ease-out infinite' }}/>
              </svg>
            </div>

            {/* ── Hero card Statistici ── */}
            {(() => {
              const _trainScore = Math.min(100, Math.round((strengthSessions / Math.max(statsPeriod || 30, 1)) * 7 * 100))
              const _nutritionScore = Math.min(100, loggedDays > 0 ? Math.round((loggedDays / Math.max(statsPeriod || 30, 1)) * 100) : 0)
              const _sleepScore = combinedSleep?.score || 0
              const _overallScore = Math.round((_trainScore + _nutritionScore + _sleepScore) / 3)
              const R = 38, CX = 50, CY = 50, CIRC = 2 * Math.PI * R
              const arc = (pct) => CIRC * (1 - pct / 100)
              return (
                <div style={{ background: 'transparent', border: 'none', borderRadius: c.radius, padding: '0.5rem 0.25rem 1rem', marginBottom: '1.25rem', boxShadow: 'none' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.9rem' }}>{t('Progres general')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Ring SVG */}
                    <div style={{ flexShrink: 0 }}>
                      <svg width="100" height="100" viewBox="0 0 100 100">
                        {/* Track */}
                        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8"/>
                        {/* Arc */}
                        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth="8"
                          strokeDasharray={CIRC} strokeDashoffset={arc(_overallScore)}
                          strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`}
                          style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
                        <text x={CX} y={CY - 4} textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="inherit">{_overallScore}</text>
                        <text x={CX} y={CY + 13} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="inherit">{t('scor general')}</text>
                      </svg>
                    </div>
                    {/* Bars */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Antrenament', pct: _trainScore, color: '#a78bfa', icon: '🏋️' },
                        { label: 'Nutriție', pct: _nutritionScore, color: '#f59e0b', icon: '🥗' },
                        { label: 'Somn', pct: _sleepScore, color: '#60a5fa', icon: '😴' },
                      ].map(({ label, pct, color, icon }) => (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{icon} {t(label)}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{pct}%</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.5s ease' }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {statsPeriod > 0 ? (lang === 'en' ? `Last ${statsPeriod} days` : `Ultimele ${statsPeriod} zile`) : (lang === 'en' ? 'All data' : 'Toate datele')}
                  </div>
                </div>
              )
            })()}

            {/* Selector perioadă — 6 taburi separate pe un rând */}
            <div style={{ display: 'flex', gap: 5, marginBottom: '1rem' }}>
              {periodOptions.map(([val, label]) => {
                const active = statsPeriod === val
                return (
                  <button key={val} onClick={() => setStatsPeriod(val)}
                    style={{
                      flex: 1, padding: '8px 2px', fontSize: 11.5, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                      whiteSpace: 'nowrap', textAlign: 'center',
                      background: active ? 'rgba(124,58,237,0.9)' : 'rgba(124,58,237,0.12)',
                      color: active ? '#ffffff' : '#c4b5fd',
                      border: active ? '1px solid rgba(124,58,237,0.9)' : '0.5px solid rgba(167,139,250,0.3)',
                      fontWeight: active ? 700 : 500,
                      transition: 'all 0.15s',
                    }}>
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Sub-tabs categorii */}
            <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', overflowX: 'auto' }}>
              {statsTabs.map(([id, label]) => (
                <button key={id} onClick={() => setStatsSubTab(id)}
                  style={{ padding: '7px 14px', fontSize: 12, borderRadius: c.radiusSm, border: 'none', background: statsSubTab===id ? c.green3 : c.card, color: statsSubTab===id ? c.green : c.text3, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600, boxShadow: statsSubTab===id ? 'none' : c.shadowCard }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── SUMAR — toate categoriile pe scurt ── */}
            {/* ── FORȚĂ — antrenamente Hevy ── */}
            {statsSubTab === 'strength' && (
              <>
                <div style={grid4}>
                  <MetricCard label="Sesiuni" value={strengthSessions} delta={statsPeriod>0?(lang==='en'?`in ${statsPeriod} days`:`în ${statsPeriod} zile`):(lang==='en'?'total':'total')} c={c}/>
                  <MetricCard label="Volum total" value={strengthVolume>0?`${Math.round(strengthVolume/1000)}t`:'—'} c={c}/>
                  <MetricCard label="Durată medie" value={avgDuration} unit="min" c={c}/>
                  <MetricCard label="PR-uri" value={weeklyStats.prs||0} c={c}/>
                </div>
                {/* ── Recuperare musculară ── */}
                {(() => {
                  const RECOVERY = {
                    chest:48, back:48, shoulders:48, biceps:36, triceps:36,
                    quads:72, hamstrings:72, calves:24, core:24, traps:36, glutes:48,
                  }
                  const CARDIO_MUSCLES = {
                    Walk:['calves','quads','core'], Run:['calves','quads','hamstrings','core'],
                    Ride:['quads','hamstrings','calves'], Hike:['quads','hamstrings','calves','core'],
                    VirtualRide:['quads','hamstrings','calves'],
                  }
                  const lastTrained = {}
                  for (const w of workouts) {
                    if (!w.hours_ago) continue
                    for (const g of (w.muscle_groups || [])) {
                      if (!lastTrained[g] || w.hours_ago < lastTrained[g]) lastTrained[g] = w.hours_ago
                    }
                  }
                  for (const act of filterMFP(intervalsData?.activities)) {
                    const hoursAgo = (Date.now() - new Date(act.start_time || act.date)) / 3600000
                    for (const g of (CARDIO_MUSCLES[act.type] || [])) {
                      if (!lastTrained[g] || hoursAgo < lastTrained[g]) lastTrained[g] = hoursAgo
                    }
                  }
                  const LABELS = { chest:t('Piept'), back:t('Spate / lats'), shoulders:t('Umeri'), biceps:t('Biceps'), triceps:t('Triceps'), quads:t('Cvadriceps'), hamstrings:t('Ischiogambieri'), calves:t('Gambe'), core:t('Core / oblici'), traps:t('Trapez'), glutes:t('Fesier') }
                  const groups = Object.entries(RECOVERY).map(([g, needed]) => {
                    const since = lastTrained[g] ?? 999
                    const pct = Math.min(100, Math.round((since / needed) * 100))
                    return { g, label: LABELS[g], pct, hoursLeft: Math.max(0, Math.round(needed - since)) }
                  }).sort((a, b) => a.pct - b.pct)
                  const overall = Math.round(groups.reduce((s, g) => s + g.pct, 0) / groups.length)
                  const clr = p => p >= 80 ? c.green : p >= 50 ? c.orange : c.red

                  return (
                    <Acc title="💪 Recuperare musculară" defaultOpen c={c}>
                    <div style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={s.sectionLabel}>{t('Recuperare musculară')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20, fontWeight: 700, color: clr(overall) }}>{overall}%</span>
                          <span style={{ fontSize: 11, color: c.text4 }}>{t('global')}</span>
                          <button
                            onClick={() => {
                              const KEY_MAP = { chest:'chest', back:'lats', shoulders:'shoulders', biceps:'biceps', triceps:'triceps', quads:'quads', hamstrings:'hamstrings', calves:'calves', core:'abs', traps:'traps', glutes:'glutes' }
                              const data = {}
                              groups.forEach(({ g, pct }) => { const k = KEY_MAP[g]; if (k) data[k] = pct })
                              setMuscleModalData(data)
                              setShowMuscleModal(true)
                            }}
                            style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8, cursor:'pointer', color:'#60a5fa', padding:'4px 10px', fontSize:11, fontWeight:500, whiteSpace:'nowrap' }}
                          >{t('🫀 Siluetă')}</button>
                        </div>
                      </div>

                      {/* Etichete zone */}
                      <div style={{ display: 'flex', marginLeft: 146, marginRight: 44, marginBottom: 4 }}>
                        <div style={{ width: '50%', textAlign: 'center', fontSize: 9, color: c.red, fontWeight: 600 }}>{lang === 'en' ? '<50% tired' : '<50% obosit'}</div>
                        <div style={{ width: '30%', textAlign: 'center', fontSize: 9, color: c.orange, fontWeight: 600 }}>{lang === 'en' ? '50–79%' : '50–79%'}</div>
                        <div style={{ width: '20%', textAlign: 'center', fontSize: 9, color: c.green, fontWeight: 600 }}>≥80%</div>
                      </div>

                      {/* Zona cu fundal colorat + bare */}
                      <div style={{ position: 'relative' }}>
                        {/* Fundal 3 zone */}
                        <div style={{ position: 'absolute', top: 0, left: 146, right: 44, bottom: 0, borderRadius: 8, overflow: 'hidden', opacity: 0.1, pointerEvents: 'none' }}>
                          <div style={{ position: 'absolute', left: 0, width: '50%', top: 0, bottom: 0, background: c.red }}/>
                          <div style={{ position: 'absolute', left: '50%', width: '30%', top: 0, bottom: 0, background: c.orange }}/>
                          <div style={{ position: 'absolute', left: '80%', width: '20%', top: 0, bottom: 0, background: c.green }}/>
                        </div>
                        {/* Linii separatoare */}
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(146px + (100% - 190px) * 0.5)`, width: 1, background: c.orange, opacity: 0.3, pointerEvents: 'none' }}/>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(146px + (100% - 190px) * 0.8)`, width: 1, background: c.green, opacity: 0.3, pointerEvents: 'none' }}/>

                        {/* Bare muschi */}
                        {groups.map(({ g, label, pct, hoursLeft }) => (
                          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, position: 'relative', zIndex: 1 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: clr(pct), flexShrink: 0 }}/>
                            <div style={{ width: 130, fontSize: 13, color: c.text3, flexShrink: 0 }}>{label}</div>
                            <div style={{ flex: 1, height: 7, background: 'rgba(128,128,128,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: clr(pct), borderRadius: 4 }}/>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: clr(pct), width: 36, textAlign: 'right', flexShrink: 0 }}>{pct}%</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 12, fontSize: 11, color: c.text4 }}>{t('Forță (Hevy) + cardio (walking, bike, hiking)')}</div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                        {[[c.green,t('≥80% recuperat')],[c.orange,t('50–79% parțial')],[c.red,t('<50% obosit')]].map(([col,lbl])=>(
                          <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: c.text4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, display: 'inline-block' }}/>
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                    </Acc>
                  )
                })()}

                {/* ── Radar grupe musculare ── */}
                {(() => {
                  const _rCounts = {}
                  periodWorkouts.forEach(w => (w.muscle_groups||[]).forEach(g => { _rCounts[g] = (_rCounts[g]||0)+1 }))
                  if (Object.keys(_rCounts).length === 0) return null
                  return <RadarChart counts={_rCounts} sessions={strengthSessions} cardStyle={s.card} c={c} />
                })()}
                                {topMuscleGroups.length > 0 && (
                  <Acc title="📊 Distribuție grupe musculare" c={c}>
                    <div style={s.card}>
                      <div style={s.sectionLabel}>{t('Distribuție grupe musculare')}</div>
                      {topMuscleGroups.map(([group, count]) => (
                        <MiniBar key={group} label={group} value={count} max={Math.max(...topMuscleGroups.map(g=>g[1]))} color={c.green} c={c}/>
                      ))}
                    </div>
                  </Acc>
                )}
                {/* Trend volum săptămânal */}
                {(() => {
                  // Grupează antrenamentele pe săptămâni
                  const weekMap = {}
                  periodWorkouts.forEach(w => {
                    if (!w.date) return
                    const d = new Date(w.date)
                    const day = d.getDay() // 0=Sun
                    const monday = new Date(d)
                    monday.setDate(d.getDate() - ((day+6)%7))
                    const wk = monday.toISOString().slice(0,10)
                    if (!weekMap[wk]) weekMap[wk] = { vol:0, sessions:0, date:wk }
                    weekMap[wk].vol += w.volume_kg || 0
                    weekMap[wk].sessions += 1
                  })
                  const weeks = Object.values(weekMap).sort((a,b)=>a.date.localeCompare(b.date))
                  if (weeks.length < 2) return null
                  return (
                    <Acc title="📦 Volum săptămânal (kg)" c={c}>
                    <div style={s.card}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <div style={s.sectionLabel}>{t('Volum săptămânal (kg)')}</div>
                        <div style={{ fontSize:11, color:c.text4 }}>{weeks.length} săptămâni</div>
                      </div>
                      <SplineChart
                        data={weeks.map(w=>Math.round(w.vol))}
                        dates={weeks.map(w=>w.date)}
                        color={c.green}
                        height={70}
                        c={c}
                        showDots={weeks.length<=8}
                        formatValue={v=>`${Math.round(v).toLocaleString()} kg`}
                      />
                      <div style={{ display:'flex', gap:16, marginTop:8, fontSize:10, color:c.text4 }}>
                        <span>Sesiuni: {weeks.map(w=>w.sessions).join(' · ')}</span>
                      </div>
                    </div>
                    </Acc>
                  )
                })()}
                {/* Top exerciții după volum */}
                {(() => {
                  const exMap = {}
                  periodWorkouts.forEach(w => {
                    (w.exercises||[]).forEach(ex => {
                      if (!exMap[ex.name]) exMap[ex.name] = { vol:0, sets:0, maxW:0 }
                      const exVol = (ex.sets||[]).reduce((s,st)=>s+(st.weight_kg||0)*(st.reps||0),0)
                      exMap[ex.name].vol += exVol
                      exMap[ex.name].sets += (ex.sets||[]).length
                      const mx = Math.max(...(ex.sets||[]).map(st=>st.weight_kg||0))
                      if (mx > exMap[ex.name].maxW) exMap[ex.name].maxW = mx
                    })
                  })
                  const topEx = Object.entries(exMap).sort((a,b)=>b[1].vol-a[1].vol).slice(0,5)
                  if (!topEx.length) return null
                  const maxVol = topEx[0][1].vol
                  return (
                    <Acc title="🏆 Top exerciții (volum)" c={c}>
                    <div style={s.card}>
                      <div style={s.sectionLabel}>{t('Top exerciții (volum)')}</div>
                      <div style={{ marginTop:8 }}>
                        {topEx.map(([name, ex]) => (
                          <div key={name} style={{ marginBottom:8 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                              <span style={{ fontSize:12, color:c.text }}>{name}</span>
                              <span style={{ fontSize:11, color:c.text4 }}>{Math.round(ex.vol).toLocaleString()} kg · max {ex.maxW}kg</span>
                            </div>
                            <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:3 }}>
                              <div style={{ height:5, background:c.green, borderRadius:3, width:`${(ex.vol/maxVol)*100}%` }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    </Acc>
                  )
                })()}
                {/* Calendar antrenamente forță — heatmap săptămânal */}
                {(() => {
                  const wByDate = {}
                  periodWorkouts.forEach(w => {
                    if (!w.date) return
                    if (!wByDate[w.date]) wByDate[w.date] = { volume: 0, sessions: 0 }
                    wByDate[w.date].volume += w.volume_kg || 0
                    wByDate[w.date].sessions += 1
                  })
                  const maxVol = Math.max(1, ...Object.values(wByDate).map(d => d.volume))
                  const todaySt = new Date().toISOString().slice(0,10)
                  const DAYS_RO = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']
                  const sd = new Date(cutoffDate + 'T12:00:00')
                  const d0 = sd.getDay(); sd.setDate(sd.getDate() - (d0===0?6:d0-1))
                  const ed = new Date(todaySt + 'T12:00:00')
                  const d1 = ed.getDay(); ed.setDate(ed.getDate() + (d1===0?0:7-d1))
                  const heatWeeks = []
                  const hCur = new Date(sd)
                  while (hCur <= ed) {
                    const wk = []
                    for (let i=0;i<7;i++) { wk.push(new Date(hCur).toISOString().slice(0,10)); hCur.setDate(hCur.getDate()+1) }
                    heatWeeks.push(wk)
                  }
                  const CELL=15, HGAP=3
                  return (
                    <Acc title="📅 Calendar antrenamente forță" c={c}>
                    <div style={s.card}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={s.sectionLabel}>{t('Calendar antrenamente forță')}</div>
                        <div style={{ fontSize:11, color:c.text4 }}>{strengthSessions} sesiuni{statsPeriod>0?' · '+statsPeriod+' zile':''}</div>
                      </div>
                      <div style={{ overflowX:'auto' }}>
                        <div style={{ display:'flex', gap:HGAP }}>
                          <div style={{ display:'flex', flexDirection:'column', gap:HGAP, paddingTop:CELL+HGAP }}>
                            {DAYS_RO.map((d,i)=>(
                              <div key={i} style={{ width:16, height:CELL, fontSize:8.5, color:c.text4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:4 }}>{d}</div>
                            ))}
                          </div>
                          {heatWeeks.map((wk,wi)=>{
                            const prev=wi>0?heatWeeks[wi-1]:null
                            const showM=!prev||prev[0].slice(0,7)!==wk[0].slice(0,7)
                            const mLbl=showM?new Date(wk[0]+'T12:00:00').toLocaleDateString('ro-RO',{month:'short'}):''
                            return (
                              <div key={wi} style={{ display:'flex', flexDirection:'column', gap:HGAP }}>
                                <div style={{ height:CELL, fontSize:8.5, color:c.text4, whiteSpace:'nowrap' }}>{mLbl}</div>
                                {wk.map(ds=>{
                                  const wd=wByDate[ds]
                                  const isFut=ds>todaySt
                                  const isToday=ds===todaySt
                                  let bg
                                  if(isFut) bg='transparent'
                                  else if(wd){
                                    const intensity=Math.max(0.35,wd.volume/maxVol)
                                    bg=`rgba(74,222,128,${intensity.toFixed(2)})`
                                  } else bg='rgba(128,128,128,0.12)'
                                  return (
                                    <div key={ds}
                                      title={wd?`${ds}: ${wd.sessions} sesiune · ${Math.round(wd.volume).toLocaleString()} kg volum`:ds}
                                      style={{ width:CELL,height:CELL,borderRadius:3,background:bg,
                                        border:isToday?`1.5px solid ${c.text3}`:'1px solid rgba(128,128,128,0.08)',
                                        boxSizing:'border-box', opacity:isFut?0:1 }}
                                    />
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:14, marginTop:6, fontSize:10, color:c.text4, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:10,height:10,borderRadius:2,background:'rgba(74,222,128,0.9)'}}/> {t('Sesiune forță')}</span>
                        <span style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{width:10,height:10,borderRadius:2,background:'rgba(128,128,128,0.12)',border:'1px solid rgba(128,128,128,0.25)'}}/> Repaus</span>
                        <span style={{ color:c.text4 }}>— intensitate = volum antrenament</span>
                      </div>
                    </div>
                    </Acc>
                  )
                })()}
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <button onClick={() => window.location.href='/workout'} style={{ fontSize: 12, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Vezi PR-uri detaliate & program AI →
                  </button>
                </div>
              </>
            )}

            {/* ── CARDIO — pași, calorii arse, activitate ── */}
            {statsSubTab === 'cardio' && (() => {
              const distDays = periodFitDays.filter(d => d.distance_m != null && d.distance_m > 0)
              const totalDistKm = distDays.reduce((s,d)=>s+(d.distance_m||0),0)/1000
              const avgDistKm = distDays.length>0 ? (totalDistKm/distDays.length).toFixed(1) : null
              const calDays = periodFitDays.filter(d => d.calories_burned != null && d.calories_burned > 0)
              const avgCal = calDays.length>0 ? Math.round(calDays.reduce((s,d)=>s+d.calories_burned,0)/calDays.length) : null
              const stepsTarget = userProfile?.steps_target || 8000
              const stepsAboveTarget = periodFitDays.filter(d=>(d.steps||0)>=stepsTarget).length
              return (
                <>
                  <div style={grid4}>
                    <MetricCard label="Pași total" value={totalSteps.toLocaleString()} delta={statsPeriod>0?`${statsPeriod} zile`:'total'} c={c}/>
                    <MetricCard label="Medie zilnică" value={avgStepsP.toLocaleString()} deltaPos={avgStepsP>=stepsTarget} delta={`țintă ${stepsTarget.toLocaleString()}`} c={c}/>
                    <MetricCard label="Zile active (≥8k)" value={activeDays} delta={`din ${periodFitDays.length}`} deltaPos={activeDays>periodFitDays.length/2} c={c}/>
                    <MetricCard label={'Calorii arse'} value={totalCalBurned>0?Math.round(totalCalBurned).toLocaleString():'—'} unit={totalCalBurned>0?"kcal":''} delta={avgCal?`~${avgCal} kcal/zi`:null} c={c}/>
                  </div>
                  {/* Pași pe zi */}
                  {periodFitDays.length > 1 && (
                    <Acc title="👣 Pași pe zi" defaultOpen c={c}>
                      <div style={s.card}>
                        {(() => {
                          const MAX_Y = 40000
                          const SEG_STEPS = [
                            { key:'morning',   label:'Dimineață 06–12', color:'#818cf8' },
                            { key:'noon',      label:'Prânz 12–16',     color:'#f59e0b' },
                            { key:'afternoon', label:'Dupămasă 16–18',  color:'#f97316' },
                            { key:'evening',   label:'Seară 18–22',     color:'#ec4899' },
                          ]
                          const sourceDays = (statsPeriod > 0 ? periodFitDays.slice(-statsPeriod) : periodFitDays).filter(d => (d.steps||0) > 0)
                          if (!sourceDays.length) return <div style={{ color:c.text4, fontSize:12, textAlign:'center', padding:'16px 0' }}>{t('Fără date pași')}</div>

                          // Index activities by date (exclude strength; use all step-gen activity sources)
                          const STEP_EXCL = /weight|strength|gym|crossfit|yoga|pilates|stretching|lift|workout/i
                          const actsByDateS = {}
                          ;(intervalsData?.activities || []).filter(a => !STEP_EXCL.test(a.type||'')).forEach(a => {
                            const aDate = a.date || a.start_date_local?.slice(0,10) || a.start_time?.slice(0,10)
                            if (!aDate) return
                            ;(actsByDateS[aDate] = actsByDateS[aDate] || []).push(a)
                          })

                          // Build segments per day — works even when elapsed_time=0
                          const chartDaysS = sourceDays.map(day => {
                            const total = day.steps || 0
                            const dayKeyS = day.date || day.start_date_local?.slice(0,10)
                            const acts  = actsByDateS[dayKeyS] || []
                            const segs  = { morning:0, noon:0, afternoon:0, evening:0 }
                            if (acts.length > 0) {
                              const segW = { morning:0, noon:0, afternoon:0, evening:0 }
                              acts.forEach(a => {
                                try {
                                  const startDT = a.start_time || a.start_date_local
                                  if (!startDT) return
                                  const h = new Date(startDT).getHours()
                                  const w = Math.max(a.elapsed_time || a.moving_time || 0, 1)
                                  if      (h >= 18) segW.evening   += w
                                  else if (h >= 16) segW.afternoon += w
                                  else if (h >= 12) segW.noon      += w
                                  else              segW.morning   += w
                                } catch {}
                              })
                              const totalW = Object.values(segW).reduce((s,v)=>s+v, 0)
                              if (totalW > 0) {
                                const actFrac  = Math.min(0.85, 0.30 + acts.length * 0.15)
                                const actSteps = Math.round(total * actFrac)
                                Object.keys(segs).forEach(k => {
                                  segs[k] = segW[k] > 0 ? Math.round(actSteps * segW[k] / totalW) : 0
                                })
                              }
                            }
                            segs.morning += Math.max(0, total - segs.morning - segs.noon - segs.afternoon - segs.evening)
                            return { date: day.date, total, segs }
                          })

                          const avgSt    = Math.round(chartDaysS.reduce((s,d)=>s+d.total,0)/chartDaysS.length)
                          const bestSt   = chartDaysS.reduce((b,d)=>d.total>b.total?d:b, chartDaysS[0])
                          const goalDays = chartDaysS.filter(d=>d.total>=stepsTarget).length
                          const goalPct2 = Math.min(stepsTarget/MAX_Y*100, 98)
                          const fmtDt    = dateStr => { const d=new Date(dateStr+'T12:00:00'); return ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'][d.getDay()]+' '+d.getDate() }
                          const showTipS = (e, html) => {
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
                                {[{label:'Medie',val:avgSt.toLocaleString()+' p'},{label:'Record',val:bestSt.total.toLocaleString()+' p'},{label:'Zile obiectiv',val:`${goalDays}/${chartDaysS.length}`}].map(({label,val})=>(
                                  <div key={label} style={{ background:c.card2, borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
                                    <div style={{ fontSize:13, fontWeight:700, color:c.text }}>{val}</div>
                                    <div style={{ fontSize:10, color:c.text4, marginTop:2 }}>{label}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display:'flex', gap:0 }}>
                                <div style={{ width:34, flexShrink:0, position:'relative', height:180, marginBottom:18 }}>
                                  {[0,10000,20000,30000,40000].map(v=>(
                                    <div key={v} style={{ position:'absolute', bottom:`${v/MAX_Y*100}%`, right:5, transform:'translateY(50%)', fontSize:9, color:c.text4, whiteSpace:'nowrap' }}>
                                      {v===0?'0':(v/1000)+'k'}
                                    </div>
                                  ))}
                                </div>
                                <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                                  <div style={{ position:'relative', height:180 }}>
                                    {[0,10000,20000,30000,40000].map(v=>(
                                      <div key={v} style={{ position:'absolute', left:0, right:0, bottom:`${v/MAX_Y*100}%`, borderTop:`1px solid ${v===0?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.05)'}`, pointerEvents:'none' }} />
                                    ))}
                                    <div style={{ position:'absolute', left:0, right:0, bottom:`${goalPct2}%`, borderTop:'1px dashed rgba(129,140,248,0.35)', zIndex:1, pointerEvents:'none' }}>
                                      <span style={{ position:'absolute', right:2, fontSize:8, color:'#818cf8', transform:'translateY(-100%)', whiteSpace:'nowrap' }}>{(stepsTarget/1000).toFixed(0)}k</span>
                                    </div>
                                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'flex-end', gap:chartDaysS.length>20?1:2, padding:'0 2px', zIndex:2 }}>
                                      {chartDaysS.map((day,i)=>{
                                        const pct = Math.min(day.total/MAX_Y*100, 100)
                                        const tipHtmlS = `<b>${fmtDt(day.date)}</b> — ${day.total.toLocaleString()} pași<br/>${SEG_STEPS.filter(s=>day.segs[s.key]>0).map(s=>`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${s.color};margin-right:4px;vertical-align:middle"></span>${s.label.split(' ')[0]}: ${day.segs[s.key].toLocaleString()}`).join('<br/>')}`
                                        return (
                                          <div key={i} title={`${fmtDt(day.date)}: ${day.total.toLocaleString()} ${lang==='en'?'steps':'pași'}`} onTouchStart={e=>showTipS(e,tipHtmlS)} style={{ flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                                            <div style={{ width:'100%', height:`${Math.max(pct,0.5)}%`, display:'flex', flexDirection:'column-reverse', borderRadius:'3px 3px 0 0', overflow:'hidden' }}>
                                              {SEG_STEPS.map(seg=>{
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
                                  {chartDaysS.length <= 14 && (
                                    <div style={{ display:'flex', gap:chartDaysS.length>20?1:2, marginTop:3, padding:'0 2px' }}>
                                      {chartDaysS.map((day,i)=>(
                                        <div key={i} style={{ flex:1, textAlign:'center', fontSize:8, color:c.text4, overflow:'hidden' }}>{fmtDt(day.date)}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', marginTop:8 }}>
                                {SEG_STEPS.map(seg=>(
                                  <div key={seg.key} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:c.text4 }}>
                                    <div style={{ width:8, height:8, borderRadius:2, background:seg.color, flexShrink:0 }} />
                                    {t(seg.label)}
                                  </div>
                                ))}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </Acc>
                  )}
                  {/* ── Activități cardio — timeline 24h ── */}
                  <Acc title="🏃 Activități cardio" defaultOpen c={c}>
                    <div style={s.card}>
                      {(() => {
                        const CARDIO_MAP = {
                          Run:         { color:'#22c55e', label:t('Alergare')   },
                          Walk:        { color:'#64748b', label:t('Plimbare')   },
                          Ride:        { color:'#3b82f6', label:t('Ciclism')    },
                          VirtualRide: { color:'#3b82f6', label:t('Ciclism V.') },
                          Swim:        { color:'#06b6d4', label:t('Înot')       },
                          Row:         { color:'#f59e0b', label:t('Rowing')     },
                          Hike:        { color:'#22c55e', label:t('Drumeție')   },
                          Kayaking:    { color:'#06b6d4', label:t('Caiac')      },
                        }
                        const STRENGTH_RE = /weight|strength|gym|crossfit|yoga|pilates|stretching|lift|workout/i
                        const H_START = 5, H_END = 23, H_RANGE = H_END - H_START
                        const CHART_H = 200

                        // Filter activities to period, exclude strength
                        const allCardioActs = filterMFP(intervalsData?.activities || []).filter(a => {
                          const aDate = a.date || a.start_date_local?.slice(0,10) || a.start_time?.slice(0,10)
                          if (!aDate || (!a.start_time && !a.start_date_local)) return false
                          if (STRENGTH_RE.test(a.type || '')) return false
                          if (cutoffDate && aDate < cutoffDate) return false
                          return true
                        })

                        // Group by date
                        const actsByDateC = {}
                        allCardioActs.forEach(a => {
                          const aDate = a.date || a.start_date_local?.slice(0,10) || a.start_time?.slice(0,10)
                          ;(actsByDateC[aDate] = actsByDateC[aDate] || []).push(a)
                        })
                        const datesC = Object.keys(actsByDateC).sort()

                        if (!datesC.length) return (
                          <div style={{ color:c.text4, fontSize:12, textAlign:'center', padding:'18px 0' }}>
                            Nicio activitate cardio în perioada selectată
                          </div>
                        )

                        const hourToY  = h => { const cl=Math.min(Math.max(h,H_START),H_END); return (cl-H_START)/H_RANGE*CHART_H }
                        const getCol   = t => CARDIO_MAP[t]?.color || '#8b5cf6'
                        const getLbl   = t => CARDIO_MAP[t]?.label || (t || 'Altele')
                        const fmtDtC   = d => { const dt=new Date(d+'T12:00:00'); return ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'][dt.getDay()]+' '+dt.getDate() }

                        const bandTintsC = [
                          {from:5, to:12, col:'rgba(129,140,248,0.06)'},
                          {from:12,to:16, col:'rgba(245,158,11,0.06)' },
                          {from:16,to:18, col:'rgba(249,115,22,0.06)' },
                          {from:18,to:23, col:'rgba(236,72,153,0.06)' },
                        ]
                        const usedTypes = [...new Set(allCardioActs.map(a => a.type || 'other'))]
                        const gapPx = datesC.length > 25 ? 1 : datesC.length > 14 ? 2 : 3
                        const showTipC = (e, html) => {
                          e.preventDefault()
                          let t = window._fTip
                          if (!t) { t = document.createElement('div'); t.style.cssText='position:fixed;z-index:99999;background:rgba(15,15,25,0.93);color:#fff;padding:9px 12px;border-radius:10px;font-size:11px;pointer-events:none;max-width:190px;text-align:left;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,0.4)'; document.body.appendChild(t); window._fTip=t }
                          const r=e.currentTarget.getBoundingClientRect(); t.innerHTML=html; t.style.display='block'
                          const l=Math.min(Math.max(r.left+r.width/2-95,6),window.innerWidth-196)
                          t.style.left=l+'px'; t.style.top=(r.top>80?r.top-t.offsetHeight-8:r.bottom+8)+'px'
                          clearTimeout(window._fTipT); window._fTipT=setTimeout(()=>{t.style.display='none'},2500)
                        }

                        return (
                          <div>
                            <div style={{ display:'flex', gap:0 }}>
                              {/* Y axis — hours */}
                              <div style={{ width:36, flexShrink:0, position:'relative', height:CHART_H }}>
                                {[6,10,14,18,22].map(h=>(
                                  <div key={h} style={{ position:'absolute', top:hourToY(h), right:5, transform:'translateY(-50%)', fontSize:9, color:c.text4, whiteSpace:'nowrap' }}>{h}:00</div>
                                ))}
                              </div>
                              <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
                                <div style={{ position:'relative', height:CHART_H }}>
                                  {bandTintsC.map((b,i)=>(
                                    <div key={i} style={{ position:'absolute', left:0, right:0, top:hourToY(b.from), height:hourToY(b.to)-hourToY(b.from), background:b.col, pointerEvents:'none' }} />
                                  ))}
                                  {[6,10,14,18,22].map(h=>(
                                    <div key={h} style={{ position:'absolute', left:0, right:0, top:hourToY(h), borderTop:'1px solid rgba(255,255,255,0.07)', pointerEvents:'none', zIndex:1 }} />
                                  ))}
                                  <div style={{ position:'absolute', inset:0, display:'flex', gap:gapPx, padding:'0 2px', zIndex:2 }}>
                                    {datesC.map((dateStr,i)=>{
                                      const acts = actsByDateC[dateStr] || []
                                      return (
                                        <div key={i} style={{ flex:1, position:'relative', height:'100%' }}>
                                          {acts.map((a,j)=>{
                                            try {
                                              const startDT = a.start_time || a.start_date_local
                                              if (!startDT) return null
                                              const d = new Date(startDT)
                                              const startH = d.getHours() + d.getMinutes()/60
                                              // Duration: elapsed_time (seconds) → if 0, estimate from distance
                                              const rawDur = a.elapsed_time || a.moving_time || 0
                                              const SPD = {Run:10,Ride:25,VirtualRide:30,Walk:4.5,Swim:2,Row:5,Hike:4}
                                              const distH = (a.distance_m||a.distance||0)/1000/(SPD[a.type]||5)
                                              const durH  = rawDur > 0 ? rawDur/3600 : (distH > 0 ? distH : 0.75)
                                              const topPx  = hourToY(startH)
                                              const endH   = startH + durH
                                              const htPx   = Math.max(hourToY(endH) - topPx, 8)
                                              const tip    = `${getLbl(a.type)}\n${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} · ${Math.round(durH*60)} min`
                                              const tipHtmlC = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${getCol(a.type)};margin-right:5px;vertical-align:middle"></span><b>${getLbl(a.type)}</b><br/>${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} · ${Math.round(durH*60)} min`
                                              return (
                                                <div key={j} title={tip} onTouchStart={e=>showTipC(e,tipHtmlC)} style={{ position:'absolute', left:1, right:1, top:topPx, height:htPx, background:getCol(a.type), borderRadius:3, opacity:0.88 }} />
                                              )
                                            } catch { return null }
                                          })}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                                {datesC.length <= 14 && (
                                  <div style={{ display:'flex', gap:gapPx, marginTop:4, padding:'0 2px' }}>
                                    {datesC.map((d,i)=>(
                                      <div key={i} style={{ flex:1, textAlign:'center', fontSize:8, color:c.text4, overflow:'hidden' }}>{fmtDtC(d)}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', marginTop:8 }}>
                              {usedTypes.map(t=>(
                                <div key={t} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:c.text4 }}>
                                  <div style={{ width:8, height:8, borderRadius:2, background:getCol(t), flexShrink:0 }} />
                                  {getLbl(t)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </Acc>

                  {/* Calorii arse */}
                  {calDays.length > 1 && (
                    <Acc title="🔥 Calorii arse pe zi" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <div style={s.sectionLabel}>{t('Calorii arse pe zi')}</div>
                          <div style={{ fontSize:11, color:c.text4 }}>kcal</div>
                        </div>
                        <SplineChart
                          data={calDays.map(d => d.calories_burned)}
                          dates={calDays.map(d => d.date)}
                          color="#f97316"
                          height={70}
                          c={c}
                          showDots={false}
                          formatValue={v => `${Math.round(v)} kcal`}
                        />
                      </div>
                    </Acc>
                  )}
                  {/* Distanță (dacă disponibilă) */}
                  {distDays.length > 1 && (
                    <Acc title="📍 Distanță pe zi" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <div style={s.sectionLabel}>{t('Distanță pe zi')}</div>
                          <div style={{ fontSize:11, color:c.text4 }}>Total: {totalDistKm.toFixed(1)} km</div>
                        </div>
                        <SplineChart
                          data={distDays.map(d => d.distance_m/1000)}
                          dates={distDays.map(d => d.date)}
                          color="#22d3ee"
                          height={70}
                          c={c}
                          showDots={false}
                          formatValue={v => `${v.toFixed(1)} km`}
                        />
                      </div>
                    </Acc>
                  )}
                  {/* Calendar activitate cardio — heatmap săptămânal */}
                  {(() => {
                    const todaySc = new Date().toISOString().slice(0,10)
                    const DAYS_ROc = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']
                    const cByDate = {}
                    periodFitDays.forEach(d => { if(d.date) cByDate[d.date]=d })
                    const sdc = new Date(cutoffDate+'T12:00:00')
                    const dc0=sdc.getDay(); sdc.setDate(sdc.getDate()-(dc0===0?6:dc0-1))
                    const edc = new Date(todaySc+'T12:00:00')
                    const dc1=edc.getDay(); edc.setDate(edc.getDate()+(dc1===0?0:7-dc1))
                    const cHeatWeeks=[]
                    const cCur=new Date(sdc)
                    while(cCur<=edc){
                      const wkc=[]
                      for(let i=0;i<7;i++){wkc.push(new Date(cCur).toISOString().slice(0,10));cCur.setDate(cCur.getDate()+1)}
                      cHeatWeeks.push(wkc)
                    }
                    const CCELL=15, CGAP=3
                    const stT=stepsTarget
                    return (
                      <Acc title="🗓 Calendar activitate cardio" c={c}>
                      <div style={s.card}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <div style={s.sectionLabel}>{t('Calendar activitate cardio')}</div>
                          <div style={{ fontSize:11, color:c.text4 }}>{stepsAboveTarget} {lang==='en'?'days':'zile'} ≥ {stT.toLocaleString()} {lang==='en'?'steps':'pași'}</div>
                        </div>
                        <div style={{ overflowX:'auto' }}>
                          <div style={{ display:'flex', gap:CGAP }}>
                            <div style={{ display:'flex', flexDirection:'column', gap:CGAP, paddingTop:CCELL+CGAP }}>
                              {DAYS_ROc.map((d,i)=>(
                                <div key={i} style={{ width:16,height:CCELL,fontSize:8.5,color:c.text4,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:4 }}>{d}</div>
                              ))}
                            </div>
                            {cHeatWeeks.map((wkc,wi)=>{
                              const prevc=wi>0?cHeatWeeks[wi-1]:null
                              const showMc=!prevc||prevc[0].slice(0,7)!==wkc[0].slice(0,7)
                              const mLblc=showMc?new Date(wkc[0]+'T12:00:00').toLocaleDateString('ro-RO',{month:'short'}):''
                              return (
                                <div key={wi} style={{ display:'flex', flexDirection:'column', gap:CGAP }}>
                                  <div style={{ height:CCELL, fontSize:8.5, color:c.text4, whiteSpace:'nowrap' }}>{mLblc}</div>
                                  {wkc.map(ds=>{
                                    const dd=cByDate[ds]
                                    const isFutc=ds>todaySc
                                    const isTodayc=ds===todaySc
                                    const steps=dd?.steps||0
                                    const pct=stT>0?steps/stT:0
                                    let bgc
                                    if(isFutc) bgc='transparent'
                                    else if(!dd||steps===0) bgc='rgba(128,128,128,0.12)'
                                    else if(pct>=1) bgc=`rgba(74,222,128,${Math.min(0.9,0.4+pct*0.35).toFixed(2)})`
                                    else if(pct>=0.5) bgc=`rgba(251,146,60,${(0.3+pct*0.5).toFixed(2)})`
                                    else bgc='rgba(251,146,60,0.2)'
                                    const lbl=dd?`${ds}: ${steps.toLocaleString()} pași (${Math.round(pct*100)}%)`:ds
                                    return (
                                      <div key={ds}
                                        title={lbl}
                                        style={{ width:CCELL,height:CCELL,borderRadius:3,background:bgc,
                                          border:isTodayc?`1.5px solid ${c.text3}`:'1px solid rgba(128,128,128,0.08)',
                                          boxSizing:'border-box', opacity:isFutc?0:1 }}
                                      />
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:12, marginTop:6, fontSize:10, color:c.text4, flexWrap:'wrap' }}>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(74,222,128,0.85)'}}/> ≥{stT.toLocaleString()} {lang==='en'?'steps':'pași'}</span>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(251,146,60,0.6)'}}/> 50–99%</span>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(251,146,60,0.2)'}}/> &lt;50%</span>
                          <span style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{width:9,height:9,borderRadius:2,background:'rgba(128,128,128,0.12)',border:'1px solid rgba(128,128,128,0.2)'}}/> {t('nicio dată')}</span>
                        </div>
                      </div>
                      </Acc>
                    )
                  })()}

                </>
              )
            })()}
