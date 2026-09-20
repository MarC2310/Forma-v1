// src/pages/HealthDashboard.jsx — FORMA Health (Curat și Modular)
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import { supabase } from '../lib/supabase'
import { fetchWithingsAll } from '../lib/withings'
import { fetchGoogleFitData } from '../lib/googlefit'
import { fetchIntervalsData } from '../lib/intervals'
import SleepSoundRecorder from '../components/SleepSoundRecorder'
import { ScoreRing, MetricRow, TrendChart, scoreColor, scoreLabel } from '../components/HealthCharts'

// ── Calcul scor sănătate din Withings + Intervals.icu ────────────────────────
function calcHealthScore({ hr_rest, bp_sys, bp_dia, pwv, spo2, hrv_rmssd, respiration }) {
  let score = 0, factors = 0

  if (hr_rest) {
    factors++
    score += hr_rest < 50 ? 20 : hr_rest < 60 ? 17 : hr_rest < 70 ? 13 : hr_rest < 80 ? 8 : 3
  }

  if (bp_sys && bp_dia) {
    factors++
    score += bp_sys < 120 && bp_dia < 80 ? 20 : bp_sys < 130 && bp_dia < 85 ? 15 : bp_sys < 140 && bp_dia < 90 ? 9 : 3
  }

  if (pwv) {
    factors++
    score += pwv < 7 ? 20 : pwv < 9 ? 14 : pwv < 11 ? 8 : 2
  }

  if (spo2) {
    factors++
    score += spo2 >= 98 ? 15 : spo2 >= 96 ? 12 : spo2 >= 94 ? 7 : 2
  }

  if (hrv_rmssd) {
    factors++
    score += hrv_rmssd >= 60 ? 20 : hrv_rmssd >= 45 ? 16 : hrv_rmssd >= 35 ? 12 : hrv_rmssd >= 25 ? 7 : 3
  }

  if (respiration) {
    factors++
    score += respiration >= 12 && respiration <= 18 ? 5 : respiration >= 10 && respiration <= 20 ? 3 : 1
  }

  if (factors === 0) return null
  const maxPossible =
    (hr_rest     ? 20 : 0) +
    (bp_sys      ? 20 : 0) +
    (pwv         ? 20 : 0) +
    (spo2        ? 15 : 0) +
    (hrv_rmssd   ? 20 : 0) +
    (respiration ?  5 : 0)
  if (maxPossible === 0) return null
  return Math.min(100, Math.round((score / maxPossible) * 100))
}

export default function HealthDashboard({ onBack }) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const c = getColors(theme)
  const isDark = theme === 'dark'

  const today = new Date().toISOString().slice(0, 10)
  const nowHour = new Date().getHours()

  const [withingsBody, setWithingsBody] = useState(null)
  const [measHist, setMeasHist] = useState([])   
  const [withingsSleep, setWithingsSleep] = useState(null)
  const [fitData, setFitData] = useState(null)
  const [intervalsData, setIntervalsData] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [trendPeriod, setTrendPeriod] = useState(30)

  useEffect(() => {
    if (user?.id) loadAll()
  }, [user])

  async function loadAll() {
    setDataLoading(true)
    await Promise.allSettled([
      fetchWithingsAll(user.id).then(w => {
        if (w?.body) {
          const body = {
            ...w.body,
            bp_sys:      w.body.systolic  ?? w.body.bp_sys  ?? null,
            bp_dia:      w.body.diastolic ?? w.body.bp_dia  ?? null,
            bp_sys_date: w.body.bp_date   ?? w.body.bp_sys_date ?? null,
          }
          setWithingsBody(body)
        }
        if (w?.sleep) setWithingsSleep(w.sleep)
      }),
      fetchGoogleFitData(user.id).then(g => { if (g) setFitData(g) }),
      fetchIntervalsData(user.id, 60).then(d => { if (d) setIntervalsData(d) }),
      supabase.from('body_measurements')
        .select('date,weight_kg,fat_pct,muscle_kg,lean_kg,pwv,bp_sys,bp_dia,hr_rest')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(180)
        .then(({ data }) => { if (data) setMeasHist(data) }),
    ])
    setDataLoading(false)
  }

  const body = (() => {
    const snap = withingsBody
    if (!snap && (!measHist || measHist.length === 0)) return null
    const lastOf = (f) => {
      if (snap?.[f] != null && snap[f] !== 0) return snap[f]
      const r = (measHist || []).find(d => d[f] != null && d[f] !== 0)
      return r ? r[f] : null
    }
    const merged = {
      ...(snap || {}),
      bp_sys: lastOf('bp_sys'), bp_dia: lastOf('bp_dia'), pwv: lastOf('pwv'),
      weight_kg: lastOf('weight_kg'), fat_pct: lastOf('fat_pct'),
      muscle_kg: lastOf('muscle_kg'), hr_rest: lastOf('hr_rest'),
    }
    const fbDate = (snap?.date === today) ? today : (snap?.date || (measHist && measHist[0]?.date) || null)
    if (fbDate === today) return merged
    return { ...merged, _isFallback: true, _fallbackDate: fbDate }
  })()
  const bodyIsFallback = body?._isFallback === true
  const bodySrc = body ? (bodyIsFallback ? `Withings · ${body._fallbackDate}` : 'Withings · azi') : null

  const todayFit = fitData?.today || null

  const rawHrv = intervalsData?.today?.hrv ?? null
  const recentHrvs = (intervalsData?.days || []).slice(-30).map(d => d.hrv).filter(v => v != null && v > 0)
  const sorted = [...recentHrvs].sort((a, b) => a - b)
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null
  const hrvRmssd = rawHrv != null && median != null && rawHrv > median * 2.5 ? null : rawHrv ? Math.round(rawHrv) : null
  const hrvBaseline = recentHrvs.length >= 3 ? Math.round(recentHrvs.reduce((a, b) => a + b, 0) / recentHrvs.length) : null

  const hrRest = intervalsData?.today?.hr_rest ?? body?.hr_rest ?? intervalsData?.latest?.hr_rest ?? null
  const hrRestSrc = intervalsData?.today?.hr_rest ? 'Intervals.icu · azi' : body?.hr_rest ? bodySrc : 'Intervals.icu'

  const spo2 = body?.spo2 ?? todayFit?.spo2 ?? intervalsData?.today?.spo2 ?? null

  const todayWeightI = intervalsData?.today?.weight_kg
  const daysI = intervalsData?.days || []
  const idxI = daysI.findIndex(x => x.date === today)
  const yestWeightI = idxI > 0 ? daysI[idxI - 1]?.weight_kg : null
  const weightKg = body?.weight_kg ?? (todayWeightI ?? (nowHour < 11 ? yestWeightI : null))
  const weightSrc = body?.weight_kg ? bodySrc : todayWeightI ? 'Intervals.icu · azi' : (nowHour < 11 && yestWeightI) ? 'Intervals.icu · ieri' : null

  const healthScore = calcHealthScore({
    hr_rest: hrRest,
    bp_sys: body?.bp_sys,
    bp_dia: body?.bp_dia,
    pwv: body?.pwv,
    spo2,
    hrv_rmssd: hrvRmssd,
    respiration: withingsSleep?.respiration,
  })

  const bpStatus = (s, d) => !s ? null : s < 120 && d < 80 ? 'good' : s < 130 ? 'warn' : 'bad'
  const hrStatus = h => !h ? null : h < 55 ? 'good' : h < 70 ? 'warn' : 'bad'
  const pwvStatus = p => !p ? null : p < 7 ? 'good' : p < 9 ? 'warn' : 'bad'
  const spo2Status = s => !s ? null : s >= 97 ? 'good' : s >= 94 ? 'warn' : 'bad'
  const hrvStatus = h => !h ? null : h >= 45 ? 'good' : h >= 28 ? 'warn' : 'bad'

  const apneaStatus = (val) => {
    if (val == null) return null;
    if (val < 20) return 'good';  
    if (val < 40) return 'warn';  
    return 'bad';                   
  };

  const s = {
    page: { minHeight: '100vh', background: c.bg, padding: '0.75rem 1rem', fontFamily: c.fontFamily, maxWidth: 900, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' },
    card: { background: c.card, borderRadius: c.radius, padding: '1.2rem', marginBottom: '1.1rem', boxShadow: c.shadowCard },
    sectionLabel: { fontSize: 11, fontWeight: 600, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.85rem' },
    tab: { padding: '7px 14px', fontSize: 12, borderRadius: c.radiusSm, cursor: 'pointer', color: c.text3, border: 'none', background: 'transparent', fontFamily: 'inherit', whiteSpace: 'nowrap', fontWeight: 500 },
    tabActive: { background: c.card3, color: c.text, fontWeight: 700 },
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button onClick={onBack} style={{ fontSize: 13, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Dashboard</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: c.text, letterSpacing: '0.1em' }}>❤️ SĂNĂTATE</div>
        <div style={{ width: 60 }}/>
      </div>

      <div style={{ display: 'flex', gap: 4, background: c.card, padding: 5, borderRadius: c.radiusSm, marginBottom: '1.1rem', overflowX: 'auto', boxShadow: c.shadowCard }}>
        {[['overview','Sumar'],['somn','😴 Somn'],['cardio','Cardiovascular'],['body','Corp'],['trends','Tendințe']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ ...s.tab, ...(activeTab===id ? s.tabActive : {}), flexShrink: 0 }}>{label}</button>
        ))}
      </div>

      {dataLoading && <div style={{ fontSize: 12, color: c.text4, textAlign: 'center', padding: '0.5rem', marginBottom: '0.5rem' }}>⏳ Se încarcă datele...</div>}

      {/* ── SUMAR ── */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ ...s.card, display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <ScoreRing score={healthScore} size={130} label="Stare generală" c={c}/>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(healthScore, c), marginBottom: 6 }}>
                {healthScore ? scoreLabel(healthScore) : 'Date insuficiente'}
              </div>
              <div style={{ fontSize: 12, color: c.text4, lineHeight: 1.7 }}>
                {hrRest && <div>❤️ HR repaus: {hrRest} bpm · {body?.hr_rest ? 'Withings' : 'Intervals.icu'}</div>}
                {hrvRmssd && <div>📊 HRV: {hrvRmssd}ms {hrvBaseline ? `(baseline ${hrvBaseline}ms)` : ''} · Intervals.icu</div>}
                {body?.pwv && <div>🌊 PWV: {body.pwv} m/s · Withings</div>}
                {body?.bp_sys && <div>🩺 TA: {body.bp_sys}/{body.bp_dia} mmHg · Withings</div>}
                {spo2 && <div>🫁 SpO2: {spo2}% · {todayFit?.spo2 ? 'Google Fit' : 'Intervals.icu'}</div>}
              </div>
            </div>
          </div>

          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.sectionLabel}>HRV & Recuperare — Intervals.icu</div>
              <span style={{ fontSize: 10, color: c.text4 }}>{intervalsData?.today?.date || '—'}</span>
            </div>
            <MetricRow icon="📊" label="HRV (RMSSD)" value={hrvRmssd} unit="ms"
              status={hrvStatus(hrvRmssd)}
              note={hrvBaseline ? `Baseline personal: ${hrvBaseline}ms · ${hrvRmssd != null && hrvRmssd >= hrvBaseline ? '✓ peste medie' : '⬇ sub medie'}` : 'Medie ultimele 30 zile indisponibilă'}
              src="Intervals.icu" c={c}/>
            <MetricRow icon="❤️" label="Puls repaus" value={hrRest} unit="bpm"
              status={hrStatus(hrRest)}
              note="Minim zilnic înregistrat de Garmin"
              src={body?.hr_rest ? 'Withings' : 'Intervals.icu'} c={c}/>
            <MetricRow icon="😴" label="Somn" value={intervalsData?.today?.sleep_hours != null ? intervalsData.today.sleep_hours.toFixed(1) : null} unit="h"
              status={intervalsData?.today?.sleep_hours >= 7 ? 'good' : intervalsData?.today?.sleep_hours >= 6 ? 'warn' : intervalsData?.today?.sleep_hours ? 'bad' : null}
              note={intervalsData?.today?.sleep_score != null ? `Scor Garmin: ${intervalsData.today.sleep_score}/100` : 'Din Garmin via Intervals.icu'}
              src="Intervals.icu" c={c}/>
            <MetricRow icon="💨" label="Respirație nocturnă" value={withingsSleep?.respiration ? Math.round(withingsSleep.respiration) : null} unit="rpm"
              status={withingsSleep?.respiration ? (withingsSleep.respiration >= 12 && withingsSleep.respiration <= 18 ? 'good' : 'warn') : null}
              note="Normal: 12–18 rpm" src="Withings Sleep Mat" c={c}/>
              
            {withingsSleep?.breathing_disturbances_intensity != null && (
              <MetricRow 
                icon="⚠️" 
                label="Indice Apnee / Respirație" 
                value={withingsSleep.breathing_disturbances_intensity} 
                unit="indice"
                status={apneaStatus(withingsSleep.breathing_disturbances_intensity)}
                note={withingsSleep.breathing_disturbances_intensity < 20 ? "Tulburări reduse (Optim)" : withingsSleep.breathing_disturbances_intensity < 40 ? "Tulburări moderate" : "Tulburări ridicate (Atenție)"}
                src="Withings Sleep Mat" 
                c={c}
              />
            )}

            {!hrvRmssd && !intervalsData && (
              <div style={{ fontSize: 12, color: c.text4, marginTop: 8, lineHeight: 1.5 }}>
                Conectează Intervals.icu din{' '}
                <span style={{ color: c.green, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.location.href='/profile'}>
                  Profil → Intervals.icu
                </span>{' '}pentru a vedea HRV și recuperarea zilnică.
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.sectionLabel}>Semne vitale — Withings</div>
            <MetricRow icon="🩺" label="Tensiune arterială" value={body?.bp_sys ? `${body.bp_sys}/${body.bp_dia}` : null} unit="mmHg"
              status={bpStatus(body?.bp_sys, body?.bp_dia)}
              note={body?.bp_sys ? (body.bp_sys < 120 ? 'Optimă' : body.bp_sys < 130 ? 'Normală' : body.bp_sys < 140 ? 'Crescută' : 'HTA') : 'Withings Body Cardio'}
              src="Withings" c={c}/>
            <MetricRow icon="🌊" label="PWV — rigiditate arterială" value={body?.pwv} unit="m/s"
              status={pwvStatus(body?.pwv)}
              note={body?.pwv ? (body.pwv < 7 ? 'Artere elastice ✓' : body.pwv < 9 ? 'Ușor crescut' : 'Ridicat — consultați medicul') : 'Withings Body Cardio'}
              src="Withings" c={c}/>
            <MetricRow icon="🫁" label="SpO2" value={spo2} unit="%"
              status={spo2Status(spo2)}
              note="Saturație oxigen"
              src={todayFit?.spo2 ? 'Google Fit' : spo2 ? 'Intervals.icu' : 'lipsă'} c={c}/>
            <MetricRow icon="⚖️" label="Greutate" value={weightKg} unit="kg"
              src={weightSrc} c={c}/>
            <MetricRow icon="💪" label="Masă musculară" value={body?.muscle_kg} unit="kg" src="Withings" c={c}/>
            <MetricRow icon="🔥" label="Grăsime corporală" value={body?.fat_pct} unit="%"
              status={body?.fat_pct ? (body.fat_pct < 15 ? 'good' : body.fat_pct < 22 ? 'warn' : 'bad') : null}
              src="Withings" c={c}/>
            {body?.body_temp && <MetricRow icon="🌡️" label="Temperatură corporală" value={body.body_temp} unit="°C"
              status={body.body_temp >= 36.1 && body.body_temp <= 37.2 ? 'good' : 'warn'} src="Withings" c={c}/>}
          </div>
        </div>
      )}

      {/* ── CARDIOVASCULAR ── */}
      {activeTab === 'cardio' && (
        <div>
          <div style={{ ...s.card, textAlign: 'center' }}>
            <ScoreRing score={healthScore} size={140} c={c}/>
            <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(healthScore, c), marginTop: 12 }}>{scoreLabel(healthScore)}</div>
            <div style={{ fontSize: 12, color: c.text4, marginTop: 4 }}>Scor sănătate compozit</div>
          </div>

          <div style={s.card}>
            <div style={s.sectionLabel}>Componente scor</div>
            {[
              { label: 'HR odihnă', value: hrRest, pts: hrRest ? (hrRest < 50 ? 20 : hrRest < 60 ? 17 : hrRest < 70 ? 13 : 8) : null, max: 20, unit: 'bpm', src: body?.hr_rest ? 'Withings' : 'Intervals.icu' },
              { label: 'Tensiune', value: body?.bp_sys ? `${body.bp_sys}/${body.bp_dia}` : null, pts: body?.bp_sys ? (body.bp_sys < 120 ? 20 : body.bp_sys < 130 ? 15 : 9) : null, max: 20, src: 'Withings' },
              { label: 'PWV', value: body?.pwv, pts: body?.pwv ? (body.pwv < 7 ? 20 : body.pwv < 9 ? 14 : 8) : null, max: 20, unit: 'm/s', src: 'Withings' },
              { label: 'SpO2', value: spo2, pts: spo2 ? (spo2 >= 98 ? 15 : spo2 >= 96 ? 12 : 7) : null, max: 15, unit: '%', src: 'Intervals.icu / GFit' },
              { label: 'HRV RMSSD', value: hrvRmssd, pts: hrvRmssd ? (hrvRmssd >= 60 ? 20 : hrvRmssd >= 45 ? 16 : hrvRmssd >= 35 ? 12 : 7) : null, max: 20, unit: 'ms', src: 'Intervals.icu' },
              { label: 'Respirație', value: withingsSleep?.respiration ? Math.round(withingsSleep.respiration) : null, pts: withingsSleep?.respiration ? (withingsSleep.respiration >= 12 && withingsSleep.respiration <= 18 ? 5 : 3) : null, max: 5, unit: 'rpm', src: 'Withings' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 100, fontSize: 12, color: c.text3, flexShrink: 0 }}>{item.label}</div>
                <div style={{ flex: 1, height: 8, background: c.card2, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: item.pts ? `${(item.pts / item.max) * 100}%` : '0%', height: '100%', borderRadius: 4,
                    background: item.pts ? (item.pts >= item.max * 0.7 ? c.green : item.pts >= item.max * 0.4 ? c.orange : c.red) : c.border }}/>
                </div>
                <div style={{ width: 90, fontSize: 12, color: c.text, textAlign: 'right', flexShrink: 0 }}>
                  {item.value != null ? `${item.value}${item.unit ? ' ' + item.unit : ''}` : <span style={{ color: c.text4 }}>lipsă</span>}
                </div>
                <div style={{ width: 36, fontSize: 10, color: c.text4, textAlign: 'right', flexShrink: 0 }}>
                  {item.pts != null ? `${item.pts}/${item.max}` : `0/${item.max}`}
                </div>
              </div>
            ))}
          </div>

          {body?.pwv && (
            <div style={{ ...s.card, background: body.pwv < 7 ? c.green3 : body.pwv < 9 ? '#2E2410' : '#2E1416' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: body.pwv < 7 ? c.green : body.pwv < 9 ? c.orange : c.red, marginBottom: 6 }}>
                PWV {body.pwv} m/s — {body.pwv < 7 ? 'Artere tinere și elastice ✓' : body.pwv < 9 ? 'Rigiditate ușoară' : 'Rigiditate arterială semnificativă'}
              </div>
              <div style={{ fontSize: 12, color: c.text3, lineHeight: 1.6 }}>
                {body.pwv < 7 ? 'Excelent! PWV sub 7 m/s indică artere sănătoase. Risc cardiovascular scăzut.' :
                 body.pwv < 9 ? 'PWV moderat crescut. Recomandări: cardio regulat, dietă mediteraneană, reducere sodiu.' :
                 'PWV ridicat. Consultați cardiologul. Evitați sare, alcool, stres.'}
              </div>
            </div>
          )}

          {hrvRmssd && (
            <div style={{ ...s.card, background: hrvRmssd >= 45 ? c.green3 : hrvRmssd >= 28 ? '#2E2410' : '#2E1416' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: hrvRmssd >= 45 ? c.green : hrvRmssd >= 28 ? c.orange : c.red, marginBottom: 6 }}>
                HRV RMSSD {hrvRmssd}ms {hrvBaseline ? `(vs. baseline ${hrvBaseline}ms)` : ''} — Intervals.icu
              </div>
              <div style={{ fontSize: 12, color: c.text3, lineHeight: 1.6 }}>
                {hrvRmssd >= 60 ? 'Recuperare excelentă. Sistem parasimpatic dominant. Antrenament intens OK.' :
                 hrvRmssd >= 45 ? 'Recuperare bună. Antrenament moderat—intens posibil.' :
                 hrvRmssd >= 28 ? 'Recuperare moderată. Antrenament ușor sau mobilitate recomandată.' :
                 'Recuperare slabă. Zi de odihnă recomandată.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CORP ── */}
      {activeTab === 'body' && (
        <div>
          {bodyIsFallback && body && (
            <div style={{ ...s.card, background: '#2A200A', border: `0.5px solid ${c.orange}44`, marginBottom: '0.875rem' }}>
              <div style={{ fontSize: 13, color: c.orange, fontWeight: 600, marginBottom: 4 }}>
                ⏰ Date din {body._fallbackDate} (ultimele disponibile)
              </div>
              <div style={{ fontSize: 12, color: c.text4, lineHeight: 1.5 }}>
                Nu s-au găsit date Withings pentru azi. Afișăm ultima cântărire disponibilă.
              </div>
            </div>
          )}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={s.sectionLabel}>Compoziție corporală</div>
              <span style={{ fontSize: 10, color: bodyIsFallback ? c.orange : c.green }}>{bodySrc || 'lipsă'}</span>
            </div>
            {!body && !weightKg ? (
              <div style={{ fontSize: 13, color: c.text4, textAlign: 'center', padding: '1.5rem', lineHeight: 1.7 }}>
                ⚠ Date Withings indisponibile.<br/>
                <span style={{ fontSize: 12 }}>Conectează Withings din Profil sau sincronizează cântarul.</span>
              </div>
            ) : (
              <>
                <MetricRow icon="⚖️" label="Greutate" value={weightKg} unit="kg" src={weightSrc} c={c}/>
                {body?.fat_pct && <MetricRow icon="💧" label="Masă grasă" value={body.fat_pct} unit="%"
                  status={body.fat_pct < 15 ? 'good' : body.fat_pct < 22 ? 'warn' : 'bad'}
                  note={body.fat_pct < 15 ? 'Atletică' : body.fat_pct < 22 ? 'Fitness' : 'Crescut'}
                  src={body.fat_pct_date && body.fat_pct_date !== body.date ? `Withings · ${body.fat_pct_date}` : bodySrc} c={c}/>}
                {body?.muscle_kg && <MetricRow icon="💪" label="Masă musculară" value={body.muscle_kg} unit="kg"
                  src={body.muscle_kg_date && body.muscle_kg_date !== body.date ? `Withings · ${body.muscle_kg_date}` : bodySrc} c={c}/>}
                {body?.bone_kg && <MetricRow icon="🦴" label="Masă osoasă" value={body.bone_kg} unit="kg"
                  src={body.bone_kg_date && body.bone_kg_date !== body.date ? `Withings · ${body.bone_kg_date}` : bodySrc} c={c}/>}
                {body?.hydration_kg && <MetricRow icon="💧" label="Hidratare" value={body.hydration_kg} unit="kg"
                  status={null} src={bodySrc} c={c}/>}
                {body?.pwv && <MetricRow icon="🌊" label="PWV" value={body.pwv} unit="m/s"
                  status={pwvStatus(body.pwv)} note="Rigiditate arterială"
                  src={body.pwv_date && body.pwv_date !== body.date ? `Withings · ${body.pwv_date}` : bodySrc} c={c}/>}
                {body?.bp_sys && <MetricRow icon="🩺" label="Tensiune" value={`${body.bp_sys}/${body.bp_dia}`} unit="mmHg"
                  status={bpStatus(body.bp_sys, body.bp_dia)}
                  src={body.bp_sys_date && body.bp_sys_date !== body.date ? `Withings · ${body.bp_sys_date}` : bodySrc} c={c}/>}
                <MetricRow icon="❤️" label="HR repaus" value={hrRest} unit="bpm"
                  status={hrStatus(hrRest)} src={hrRestSrc} c={c}/>
                {body?.body_temp && <MetricRow icon="🌡️" label="Temperatură" value={body.body_temp} unit="°C"
                  status={body.body_temp >= 36.1 && body.body_temp <= 37.2 ? 'good' : 'warn'} src={bodySrc} c={c}/>}
                {!body?.weight_kg && weightKg && (
                  <div style={{ fontSize: 11, color: c.text4, marginTop: 10, fontStyle: 'italic' }}>
                    Greutatea afișată provine din Intervals.icu (Garmin sync) — nu din Withings.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SOMN — SLEEP SOUND RECORDER ── */}
      {activeTab === 'somn' && (
        <div>
          <SleepSoundRecorder c={c} isDark={isDark} />
          
          {withingsSleep && (
            <div style={{ ...s.card, marginTop: '1rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metrici Somn — Withings</div>
              <MetricRow icon="😴" label="Durată somn" value={withingsSleep.sleep_duration_minutes ? Math.round(withingsSleep.sleep_duration_minutes / 60 * 10) / 10 : null} unit="h" src="Withings Sleep Mat" c={c}/>
              
              {withingsSleep.breathing_disturbances_intensity != null && (
                <MetricRow 
                  icon="⚠️" 
                  label="Tulburări respirație (Apnee)" 
                  value={withingsSleep.breathing_disturbances_intensity} 
                  unit="indice" 
                  status={apneaStatus(withingsSleep.breathing_disturbances_intensity)}
                  note={withingsSleep.breathing_disturbances_intensity < 20 ? "Optim" : withingsSleep.breathing_disturbances_intensity < 40 ? "Moderat" : "Ridicat"}
                  src="Withings Sleep Mat" 
                  c={c}
                />
              )}
              
              {withingsSleep.heart_rate && <MetricRow icon="❤️" label="HR mediu somn" value={Math.round(withingsSleep.heart_rate)} unit="bpm" src="Withings" c={c}/>}
              {withingsSleep.heart_rate_variability && <MetricRow icon="📊" label="HRV somn" value={Math.round(withingsSleep.heart_rate_variability)} unit="ms" src="Withings" c={c}/>}
              {withingsSleep.respiration && <MetricRow icon="🫁" label="Respirație" value={Math.round(withingsSleep.respiration)} unit="rpm" src="Withings" c={c}/>}
              {withingsSleep.spo2_average && <MetricRow icon="🫁" label="SpO2 mediu" value={Math.round(withingsSleep.spo2_average)} unit="%" src="Withings" c={c}/>}
            </div>
          )}
        </div>
      )}

      {/* ── TENDINȚE CU BARE VERTICALE ȘI TOOLTIP ── */}
      {activeTab === 'trends' && (() => {
        const cutoff = trendPeriod >= 9999 ? null : new Date(Date.now() - trendPeriod * 86400000).toISOString().slice(0, 10)
        const days = (intervalsData?.days || []).filter(d => !cutoff || d.date >= cutoff)
        const chartData = [...days].sort((a, b) => a.date.localeCompare(b.date))
        return (
          <div>
            <div style={{ display: 'flex', gap: 4, background: c.card, padding: 4, borderRadius: 10, marginBottom: '1rem' }}>
              {[[7,'7z'],[14,'14z'],[30,'1L'],[9999,'Tot']].map(([val, label]) => (
                <button key={val} onClick={() => setTrendPeriod(val)}
                  style={{ flex: 1, padding: '6px', fontSize: 12, borderRadius: 7, border: trendPeriod===val ? `0.5px solid ${c.border}` : '0.5px solid transparent', cursor: 'pointer', fontFamily: 'inherit', background: trendPeriod===val ? c.bg : 'transparent', color: trendPeriod===val ? c.text : c.text3, fontWeight: trendPeriod===val ? 600 : 400 }}>
                  {label}
                </button>
              ))}
            </div>
            {chartData.length < 2 ? (
              <div style={{ ...s.card, textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: 13, color: c.text4 }}>Date insuficiente din Intervals.icu pentru această perioadă.</div>
              </div>
            ) : (
              <div style={s.card}>
                <div style={s.sectionLabel}>Evoluție — {chartData.length} zile · Intervals.icu</div>
                <TrendChart data={chartData} keyName="hrv" color="#97C459" label="HRV RMSSD (ms)" unit="ms" c={c}/>
                <TrendChart data={chartData} keyName="hr_rest" color="#E24B4A" label="Puls repaus (bpm)" unit=" bpm" c={c}/>
                <TrendChart data={chartData} keyName="sleep_hours" color="#4A9EE8" label="Somn (h)" unit="h" c={c}/>
                <TrendChart data={chartData} keyName="weight_kg" color="#F0A830" label="Greutate (kg)" unit=" kg" c={c}/>
                <TrendChart data={chartData} keyName="spo2" color="#534AB7" label="SpO2 (%)" unit="%" c={c}/>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
