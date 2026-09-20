// src/components/HRVMeasurement.jsx — FORMA v68
// Măsurătoare HRV cu Polar H10 via Web Bluetooth BLE
// v68: istoric complet (toate metricile), interpretare rapidă după măsurătoare

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { translate as tr, getLang, useI18n } from '../lib/i18n'
import {
  filterArtifacts, calcTimeDomain, calcStressIndex,
  calcFrequencyDomain, assessQuality, calcReadinessScore, parseHRPacket,
} from '../lib/hrvAnalysis'

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb'
const HR_CHAR    = '00002a37-0000-1000-8000-00805f9b34fb'
const DURATIONS  = [{value:1,label:'1 min',desc:tr('Rapid')},{value:2,label:'2 min',desc:tr('Standard')},{value:3,label:'3 min',desc:tr('Precis')},{value:5,label:'5 min',desc:tr('Complet')}]
const BREATH_CYCLE = 10, BREATH_IN = 5

function BreathingGuide({ elapsed, active, c }) {
  const phase = elapsed % BREATH_CYCLE
  const inhale = phase < BREATH_IN
  const progress = inhale ? phase/BREATH_IN : (phase-BREATH_IN)/(BREATH_CYCLE-BREATH_IN)
  const radius = inhale ? 60+progress*30 : 90-progress*30
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,margin:'12px 0'}}>
      <div style={{position:'relative',width:190,height:190,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {[130,150,170].map(r=>(
          <div key={r} style={{position:'absolute',width:r,height:r,borderRadius:'50%',border:`1px solid ${c.border||'#374151'}`,opacity:0.3}}/>
        ))}
        <div style={{
          width:radius*2,height:radius*2,borderRadius:'50%',
          background:active?`radial-gradient(circle, ${inhale?'rgba(52,211,153,0.35)':'rgba(96,165,250,0.25)'} 0%, transparent 70%)`:'rgba(75,85,99,0.2)',
          border:`2px solid ${active?(inhale?'#34d399':'#60a5fa'):'#4b5563'}`,
          transition:'all 0.1s ease',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',
        }}>
          <div style={{fontSize:13,fontWeight:700,color:active?(inhale?'#34d399':'#60a5fa'):'#6b7280'}}>
            {active?(inhale?tr('INSPIRA'):tr('EXPIRA')):tr('PREGATIT')}
          </div>
          {active&&<div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{inhale?`${Math.ceil(BREATH_IN-phase)}s`:`${Math.ceil(BREATH_CYCLE-phase)}s`}</div>}
        </div>
      </div>
      <div style={{fontSize:11,color:'#6b7280'}}>{getLang()==='en'?'6 breaths/min · resonant breathing':'6 respiratii/min · respiratie rezonanta'}</div>
    </div>
  )
}

function HRVMetric({ label, value, unit, info, color, c }) {
  return (
    <div style={{background:c.card2||'#1f2937',borderRadius:10,padding:'10px 12px'}}>
      <div style={{fontSize:10,color:'#6b7280',marginBottom:3,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
      <div style={{display:'flex',alignItems:'baseline',gap:3}}>
        <span style={{fontSize:22,fontWeight:700,color:color||(c.text||'#f9fafb')}}>{value??'—'}</span>
        {unit&&<span style={{fontSize:11,color:'#9ca3af'}}>{unit}</span>}
      </div>
      {info&&<div style={{fontSize:10,color:'#4b5563',marginTop:2}}>{info}</div>}
    </div>
  )
}

export default function HRVMeasurement({ userId, c={}, onHrvUpdate }) {
  useI18n() // reactiv la schimbarea limbii
  const [open,        setOpen]        = useState(false)
  const [phase,       setPhase]       = useState('idle')
  const [duration,    setDuration]    = useState(2)
  const [elapsed,     setElapsed]     = useState(0)
  const [liveHR,      setLiveHR]      = useState(null)
  const [rrBuffer,    setRrBuffer]    = useState([])
  const [results,     setResults]     = useState(null)
  const [error,       setError]       = useState(null)
  const [saved,       setSaved]       = useState(false)
  const [history,     setHistory]     = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const deviceRef = useRef(null), charRef = useRef(null), timerRef = useRef(null), rrRef = useRef([])

  const handleNotification = useCallback((event) => {
    const {hr, rr} = parseHRPacket(event.target.value.buffer)
    setLiveHR(hr)
    if (rr.length>0) { rrRef.current=[...rrRef.current,...rr]; setRrBuffer([...rrRef.current]) }
  }, [])

  const computeResults = useCallback((rawRR) => {
    const {filtered, artifactPct} = filterArtifacts(rawRR)
    const td   = calcTimeDomain(filtered)
    const si   = calcStressIndex(filtered)
    const freq = calcFrequencyDomain(filtered)
    const qual = assessQuality(artifactPct, filtered.length)
    const baseline = history.length>=3 ? history.slice(0,7).reduce((s,h)=>s+(h.rmssd||0),0)/Math.min(history.length,7) : null
    const readiness = td ? calcReadinessScore(td.rmssd, baseline) : null
    return {rawCount:rawRR.length,filteredCount:filtered.length,artifactPct,quality:qual,...(td||{}),stressIndex:si,...(freq?{lf:freq.lf,hf:freq.hf,lfhf:freq.lfhf,lfPct:freq.lfPct,hfPct:freq.hfPct}:{}),readiness}
  }, [history])

  const startMeasurement = useCallback(async () => {
    setError(null); setPhase('connecting')
    if (!navigator.bluetooth) { setError(tr('Web Bluetooth nu este suportat. Foloseste Chrome sau Edge pe Android/Desktop.')); setPhase('idle'); return }
    try {
      const device = await navigator.bluetooth.requestDevice({filters:[{services:[HR_SERVICE]}],optionalServices:[HR_SERVICE]})
      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', () => {
        clearInterval(timerRef.current)
        if (rrRef.current.length>20) { setResults(computeResults(rrRef.current)); setPhase('results') }
        else { setError(tr('Conexiunea BLE a fost intrerupta prea devreme.')); setPhase('idle') }
      })
      const server  = await device.gatt.connect()
      const service = await server.getPrimaryService(HR_SERVICE)
      const char    = await service.getCharacteristic(HR_CHAR)
      charRef.current = char
      await char.startNotifications()
      char.addEventListener('characteristicvaluechanged', handleNotification)
      rrRef.current=[]; setRrBuffer([]); setElapsed(0); setPhase('measuring')
      const totalSec = duration*60
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev+1
          if (next>=totalSec) {
            clearInterval(timerRef.current)
            char.stopNotifications().catch(()=>{})
            char.removeEventListener('characteristicvaluechanged', handleNotification)
            setResults(computeResults(rrRef.current)); setPhase('results')
          }
          return next
        })
      }, 1000)
    } catch(err) {
      if (err.name!=='NotFoundError') setError(err.message||tr('Eroare la conectarea BLE.'))
      setPhase('idle')
    }
  }, [duration, handleNotification, computeResults])

  const stopMeasurement = useCallback(() => {
    clearInterval(timerRef.current)
    if (charRef.current) { charRef.current.stopNotifications().catch(()=>{}); charRef.current.removeEventListener('characteristicvaluechanged', handleNotification) }
    if (rrRef.current.length>30) { setResults(computeResults(rrRef.current)); setPhase('results') } else setPhase('idle')
  }, [handleNotification, computeResults])

  const saveResults = useCallback(async (useDashboard=false) => {
    if (!results||!userId) return
    setPhase('saving')
    const row = {
      user_id:userId, measured_at:new Date().toISOString(), duration_min:duration,
      rr_count:results.filteredCount, artifact_pct:results.artifactPct, quality:results.quality?.level,
      mean_rr:results.meanRR, sdnn:results.sdnn, rmssd:results.rmssd, pnn50:results.pnn50,
      sd1:results.sd1, sd2:results.sd2, lf_power:results.lf??null, hf_power:results.hf??null,
      lf_hf_ratio:results.lfhf??null, stress_index:results.stressIndex??null,
      readiness_score:results.readiness??null, device_name:deviceRef.current?.name??'Polar H10',
      used_in_dashboard:useDashboard,
    }
    const {error:dbErr} = await supabase.from('hrv_measurements').insert(row)
    if (dbErr) setError('Eroare la salvare: '+dbErr.message)
    else { setSaved(true); if (useDashboard&&results.rmssd&&onHrvUpdate) onHrvUpdate(results.rmssd) }
    setPhase('results')
  }, [results, userId, duration, onHrvUpdate])

  useEffect(() => {
    if (!open||!userId) return
    supabase.from('hrv_measurements')
      .select('measured_at,rmssd,sdnn,sd1,sd2,pnn50,lf_hf_ratio,stress_index,readiness_score,quality,duration_min,artifact_pct,rr_count,mean_rr,device_name')
      .eq('user_id',userId).order('measured_at',{ascending:false}).limit(20)
      .then(({data})=>{ if(data) setHistory(data) })
  }, [open, userId])

  const handleClose = useCallback(() => {
    clearInterval(timerRef.current)
    if (charRef.current) { charRef.current.stopNotifications().catch(()=>{}); charRef.current.removeEventListener('characteristicvaluechanged', handleNotification) }
    if (deviceRef.current?.gatt?.connected) deviceRef.current.gatt.disconnect()
    setOpen(false); setPhase('idle'); setResults(null); setSaved(false); setError(null); setRrBuffer([]); rrRef.current=[]
  }, [handleNotification])

  const totalSec = duration*60, pct = Math.min(100,Math.round((elapsed/totalSec)*100))
  const liveQual = rrBuffer.length>10 ? assessQuality(filterArtifacts(rrBuffer).artifactPct, rrBuffer.length) : null
  const rateRmssd = v => !v?null:v>=50?tr('Excelent'):v>=35?tr('Bun'):v>=20?tr('Acceptabil'):tr('Slab')
  const rateSI    = v => !v?null:v<=50?tr('Bun'):v<=150?tr('Normal'):v<=300?tr('Stres moderat'):tr('Stres ridicat')
  const rateLFHF  = v => !v?null:v<=1.5?tr('Echilibru'):v<=3?tr('Usor simpatic'):tr('Dominanta simpatica')
  const scoreColor = s => !s?'#9ca3af':s>=70?'#22c55e':s>=50?'#f59e0b':'#ef4444'

  return (
    <>
      <div onClick={()=>setOpen(true)} style={{background:c.card||'#1f2937',borderRadius:12,padding:'14px 16px',cursor:'pointer',border:`1px solid ${c.border||'#374151'}`,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:c.text||'#f9fafb',marginBottom:3}}>{tr('Masuratore HRV Polar H10')}</div>
          <div style={{fontSize:11,color:'#6b7280'}}>RMSSD SDNN SD1/SD2 Stress Index LF/HF {tr('Scor readiness')}</div>
        </div>
        <div style={{background:'#16a34a',color:'#fff',fontSize:12,fontWeight:600,padding:'6px 14px',borderRadius:8,flexShrink:0}}>START</div>
      </div>

      {open&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:9999,overflowY:'auto',display:'flex',flexDirection:'column'}}>
          <div style={{maxWidth:440,margin:'0 auto',padding:'16px 16px 32px',width:'100%',minHeight:'100%',boxSizing:'border-box'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:700,color:'#f9fafb'}}>HRV Polar H10</div>
              <button onClick={handleClose} style={{background:'none',border:'none',color:'#9ca3af',fontSize:22,cursor:'pointer',padding:4}}>X</button>
            </div>

            {error&&<div style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#fca5a5'}}>{error}</div>}

            {phase==='idle'&&(
              <div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,color:'#9ca3af',marginBottom:8}}>{tr('Durata masuratore')}</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                    {DURATIONS.map(d=>(
                      <button key={d.value} onClick={()=>setDuration(d.value)} style={{padding:'10px 6px',borderRadius:9,border:'none',cursor:'pointer',background:duration===d.value?'#16a34a':'#1f2937',color:duration===d.value?'#fff':'#9ca3af',fontFamily:'inherit'}}>
                        <div style={{fontSize:14,fontWeight:700}}>{d.label}</div>
                        <div style={{fontSize:10,marginTop:2}}>{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{background:'#1f2937',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#d1d5db',marginBottom:8}}>{tr('Pregatire')}</div>
                  {[tr('Pune centura Polar H10 si uda electrozii'),tr('Stai jos sau culcat — nu te misca in timpul masuratoriie'),tr('Urmeaza ghidul de respiratie (5s inspira 5s expira)'),tr('Polar H10 se conecteaza automat via Bluetooth')].map((t,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:6,fontSize:12,color:'#9ca3af'}}><span style={{color:'#4ade80',flexShrink:0}}>ok</span><span>{t}</span></div>
                  ))}
                </div>
                <BreathingGuide elapsed={0} active={false} c={c}/>
                <button onClick={startMeasurement} style={{width:'100%',padding:'14px',background:'#16a34a',color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginTop:8}}>
                  {tr('Conecteaza Polar H10 si porneste')}
                </button>
                {history.length>0&&(
                  <div style={{marginTop:16}}>
                    <button onClick={()=>setShowHistory(h=>!h)} style={{background:'none',border:'none',color:'#6b7280',fontSize:12,cursor:'pointer',fontFamily:'inherit',padding:0}}>
                      {showHistory?'^':'v'} {getLang()==='en'?'History':'Istoric'} ({history.length} {getLang()==='en'?'measurements':'masuratori'})
                    </button>
                    {showHistory&&(
                      <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
                        {history.slice(0,10).map((h,i)=>(
                          <div key={i} style={{background:'#1f2937',borderRadius:10,padding:'10px 12px',marginBottom:4}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                              <span style={{fontSize:11,color:'#6b7280'}}>
                                {new Date(h.measured_at).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                                {h.duration_min?' · '+h.duration_min+'min':''}
                                {h.device_name?' · '+h.device_name:''}
                              </span>
                              {h.readiness_score!=null&&<span style={{fontSize:13,fontWeight:700,color:scoreColor(h.readiness_score)}}>{h.readiness_score}/100</span>}
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3}}>
                              {[
                                {l:'RMSSD',v:h.rmssd,u:'ms',col:h.rmssd!=null?(h.rmssd>=50?'#22c55e':h.rmssd>=30?'#f59e0b':'#ef4444'):'#9ca3af'},
                                {l:'SDNN', v:h.sdnn, u:'ms',col:h.sdnn!=null?(h.sdnn>=50?'#22c55e':h.sdnn>=30?'#f59e0b':'#ef4444'):'#9ca3af'},
                                {l:'SD1',  v:h.sd1,  u:'ms',col:'#34d399'},
                                {l:'SD2',  v:h.sd2,  u:'ms',col:'#a78bfa'},
                                {l:'pNN50',v:h.pnn50,u:'%', col:'#f9fafb'},
                                {l:'LF/HF',v:h.lf_hf_ratio,u:'',col:h.lf_hf_ratio!=null?(h.lf_hf_ratio<=1.5?'#22c55e':h.lf_hf_ratio<=3?'#f59e0b':'#ef4444'):'#9ca3af'},
                                {l:'SI',   v:h.stress_index,u:'',col:h.stress_index!=null?(h.stress_index<=50?'#22c55e':h.stress_index<=150?'#f59e0b':'#ef4444'):'#9ca3af'},
                                {l:'Artef.',v:h.artifact_pct!=null?(Math.round(h.artifact_pct*10)/10)+'%':null,u:'',col:'#9ca3af'},
                              ].map((m,j)=>(
                                <div key={j} style={{background:'#111827',borderRadius:6,padding:'5px 6px'}}>
                                  <div style={{fontSize:9,color:'#4b5563',textTransform:'uppercase',letterSpacing:'0.04em'}}>{m.l}</div>
                                  <div style={{fontSize:11,fontWeight:600,color:m.v!=null?m.col:'#374151'}}>
                                    {m.v!=null?(typeof m.v==='string'?m.v:(Math.round(m.v*10)/10)+(m.u?' '+m.u:'')):'—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {h.quality&&<div style={{marginTop:5,fontSize:10,color:'#6b7280'}}>{getLang()==='en'?'Quality':'Calitate'}: {h.quality} · {h.rr_count??'?'} {getLang()==='en'?'RR intervals':'intervale RR'}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {phase==='connecting'&&(
              <div style={{textAlign:'center',padding:'40px 0'}}>
                <div style={{fontSize:40,marginBottom:16}}>...</div>
                <div style={{fontSize:15,color:'#f9fafb',fontWeight:600,marginBottom:8}}>{tr('Cauta Polar H10')}...</div>
                <div style={{fontSize:12,color:'#6b7280'}}>{tr('Selecteaza dispozitivul din lista Bluetooth')}</div>
              </div>
            )}

            {phase==='measuring'&&(
              <div>
                <div style={{marginBottom:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#9ca3af',marginBottom:4}}>
                    <span>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</span>
                    <span>{duration}:00</span>
                  </div>
                  <div style={{height:6,background:'#1f2937',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:pct+'%',background:'#16a34a',transition:'width 1s linear',borderRadius:3}}/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:12}}>
                  <div style={{background:'#1f2937',borderRadius:9,padding:'8px 10px',textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#f472b6'}}>{liveHR??'—'}</div><div style={{fontSize:10,color:'#6b7280'}}>BPM</div></div>
                  <div style={{background:'#1f2937',borderRadius:9,padding:'8px 10px',textAlign:'center'}}><div style={{fontSize:20,fontWeight:700,color:'#60a5fa'}}>{rrBuffer.length}</div><div style={{fontSize:10,color:'#6b7280'}}>{tr('Intervale RR')}</div></div>
                  <div style={{background:'#1f2937',borderRadius:9,padding:'8px 10px',textAlign:'center'}}><div style={{fontSize:13,fontWeight:600,color:liveQual?.color||'#9ca3af'}}>{liveQual?(filterArtifacts(rrBuffer).artifactPct)+'%':'—'}</div><div style={{fontSize:10,color:'#6b7280'}}>{tr('Artefacte')}</div></div>
                </div>
                {liveQual&&(
                  <div style={{textAlign:'center',fontSize:11,fontWeight:600,color:liveQual.color,marginBottom:8,letterSpacing:'0.08em'}}>
                    {liveQual.label}
                    {(liveQual.level==='very_low'||liveQual.level==='low')&&<div style={{fontSize:10,fontWeight:400,color:'#9ca3af',marginTop:3}}>{tr('Ramai nemisat · uda electrozii Polar')}</div>}
                  </div>
                )}
                <BreathingGuide elapsed={elapsed} active c={c}/>
                <button onClick={stopMeasurement} style={{width:'100%',padding:'11px',background:'#374151',color:'#d1d5db',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>{tr('Opreste si calculeaza')}</button>
              </div>
            )}

            {(phase==='results'||phase==='saving')&&results&&(
              <div>
                <div style={{textAlign:'center',padding:'8px 0 12px',fontSize:12,fontWeight:700,color:results.quality?.color||'#9ca3af',letterSpacing:'0.1em'}}>
                  {results.quality?.label}
                  <span style={{color:'#4b5563',fontWeight:400,marginLeft:8}}>({results.filteredCount} {getLang()==='en'?'RR intervals':'intervale RR'} · {results.artifactPct}% {getLang()==='en'?'artifacts':'artefacte'})</span>
                </div>
                {results.readiness&&(
                  <div style={{textAlign:'center',background:'#1f2937',borderRadius:14,padding:'16px',marginBottom:12}}>
                    <div style={{fontSize:11,color:'#6b7280',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>{tr('Scor Readiness')}</div>
                    <div style={{fontSize:52,fontWeight:800,color:scoreColor(results.readiness),lineHeight:1}}>{results.readiness}</div>
                    <div style={{fontSize:11,color:'#6b7280',marginTop:4}}>/100</div>
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
                  <HRVMetric label="RMSSD" value={results.rmssd} unit="ms" color={results.rmssd>=50?'#22c55e':results.rmssd>=30?'#f59e0b':'#ef4444'} info={rateRmssd(results.rmssd)} c={c}/>
                  <HRVMetric label="SDNN" value={results.sdnn} unit="ms" color={results.sdnn>=50?'#22c55e':results.sdnn>=30?'#f59e0b':'#ef4444'} c={c}/>
                  <HRVMetric label={tr('SD1 Parasimpatic')} value={results.sd1} unit="ms" color="#34d399" c={c}/>
                  <HRVMetric label={tr('SD2 Simpatic+Para')} value={results.sd2} unit="ms" color="#60a5fa" c={c}/>
                  <HRVMetric label="Mean RR" value={results.meanRR} unit="ms" info={results.hr?results.hr+' BPM':null} c={c}/>
                  <HRVMetric label="pNN50" value={results.pnn50} unit="%" c={c}/>
                </div>
                {results.stressIndex!=null&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
                    <HRVMetric label="Stress Index Baevsky" value={results.stressIndex} color={results.stressIndex<=50?'#22c55e':results.stressIndex<=150?'#f59e0b':'#ef4444'} info={rateSI(results.stressIndex)} c={c}/>
                    {results.lfhf!=null&&<HRVMetric label="LF/HF Ratio" value={results.lfhf} color={results.lfhf<=1.5?'#22c55e':results.lfhf<=3?'#f59e0b':'#ef4444'} info={rateLFHF(results.lfhf)} c={c}/>}
                  </div>
                )}
                {results.lf!=null&&(
                  <div style={{background:'#1f2937',borderRadius:10,padding:'10px 14px',marginBottom:12}}>
                    <div style={{fontSize:10,color:'#6b7280',marginBottom:6,textTransform:'uppercase'}}>{tr('Spectru frecventa')}</div>
                    <div style={{display:'flex',gap:12}}>
                      {[{label:'LF (0.04-0.15Hz)',val:results.lf,pct:results.lfPct,color:'#f59e0b'},{label:'HF (0.15-0.40Hz)',val:results.hf,pct:results.hfPct,color:'#34d399'}].map(b=>(
                        <div key={b.label} style={{flex:1}}>
                          <div style={{fontSize:10,color:b.color}}>{b.label}</div>
                          <div style={{fontSize:16,fontWeight:700,color:'#f9fafb'}}>{b.val} <span style={{fontSize:10,color:'#6b7280'}}>ms2</span></div>
                          <div style={{height:4,background:'#374151',borderRadius:2,marginTop:3}}><div style={{height:'100%',width:b.pct+'%',background:b.color,borderRadius:2}}/></div>
                          <div style={{fontSize:10,color:'#4b5563',marginTop:2}}>{b.pct}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{background:'rgba(52,211,153,0.07)',border:'1px solid rgba(52,211,153,0.18)',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#34d399',marginBottom:9,textTransform:'uppercase',letterSpacing:'0.08em'}}>{tr('Interpretare rapida')}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {results.rmssd!=null&&(
                      <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                        <span style={{fontSize:11,fontWeight:700,flexShrink:0,minWidth:88,color:results.rmssd>=50?'#22c55e':results.rmssd>=35?'#f59e0b':'#ef4444'}}>
                          RMSSD {results.rmssd}ms
                        </span>
                        <span style={{fontSize:11,color:'#9ca3af'}}>
                          {results.rmssd>=50
                            ?tr('Excelent — sistem parasimpatic activ, recuperare completa')
                            :results.rmssd>=35
                            ?tr('Bun — recuperare adecvata, antrenament normal posibil')
                            :results.rmssd>=20
                            ?tr('Acceptabil — recuperare partiala, antrenament moderat recomandat')
                            :tr('Slab — suprasolicitare sau boala, prioritizeaza odihna')}
                        </span>
                      </div>
                    )}
                    {results.stressIndex!=null&&(
                      <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                        <span style={{fontSize:11,fontWeight:700,flexShrink:0,minWidth:88,color:results.stressIndex<=50?'#22c55e':results.stressIndex<=150?'#f59e0b':'#ef4444'}}>
                          SI {results.stressIndex}
                        </span>
                        <span style={{fontSize:11,color:'#9ca3af'}}>
                          {results.stressIndex<=50
                            ?tr('Calm — activare simpatica minima, organism odihnit')
                            :results.stressIndex<=150
                            ?tr('Normal — echilibru simpato-vagal corespunzator')
                            :results.stressIndex<=300
                            ?tr('Stres moderat — considera recuperare activa si somn suficient')
                            :tr('Stres ridicat — reduce sarcina de antrenament, odihna prioritara')}
                        </span>
                      </div>
                    )}
                    {results.lfhf!=null&&(
                      <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                        <span style={{fontSize:11,fontWeight:700,flexShrink:0,minWidth:88,color:results.lfhf<=1.5?'#22c55e':results.lfhf<=3?'#f59e0b':'#ef4444'}}>
                          LF/HF {results.lfhf}
                        </span>
                        <span style={{fontSize:11,color:'#9ca3af'}}>
                          {results.lfhf<=1.5
                            ?tr('Echilibru simpato-vagal — balanta autonoma optima')
                            :results.lfhf<=3
                            ?tr('Usoara dominanta simpatica — normal dupa efort fizic')
                            :tr('Dominanta simpatica — oboseala, stres sau recuperare insuficienta')}
                        </span>
                      </div>
                    )}
                    {results.readiness!=null&&(
                      <div style={{display:'flex',gap:8,alignItems:'flex-start',marginTop:4,paddingTop:8,borderTop:'1px solid rgba(55,65,81,0.6)'}}>
                        <span style={{fontSize:12,fontWeight:700,flexShrink:0,minWidth:88,color:scoreColor(results.readiness)}}>
                          {getLang()==='en'?'Conclusion':'Concluzie'} {results.readiness}/100
                        </span>
                        <span style={{fontSize:12,color:'#d1d5db',fontWeight:600}}>
                          {results.readiness>=70
                            ?tr('Antrenament intens — zi verde')
                            :results.readiness>=50
                            ?tr('Antrenament moderat recomandat')
                            :results.readiness>=35
                            ?tr('Antrenament usor sau mobilitate')
                            :tr('Odihna activa — recuperare prioritara')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!saved?(
                  <div style={{display:'flex',gap:8,marginTop:4}}>
                    <button onClick={()=>saveResults(false)} disabled={phase==='saving'} style={{flex:1,padding:'11px',background:'#1f2937',color:'#d1d5db',border:'1px solid #374151',borderRadius:10,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{tr('Salveaza')}</button>
                    <button onClick={()=>saveResults(true)} disabled={phase==='saving'} style={{flex:2,padding:'11px',background:'#16a34a',color:'#fff',border:'none',borderRadius:10,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{tr('Salveaza si foloseste in Dashboard')}</button>
                  </div>
                ):(
                  <div style={{textAlign:'center',padding:'12px',color:'#4ade80',fontSize:13,fontWeight:600}}>{tr('Salvat cu succes!')}</div>
                )}
                <button onClick={()=>{setPhase('idle');setResults(null);setSaved(false);rrRef.current=[];setRrBuffer([])}} style={{width:'100%',padding:'10px',background:'transparent',color:'#6b7280',border:'none',borderRadius:10,fontSize:12,cursor:'pointer',fontFamily:'inherit',marginTop:6}}>{tr('Masoara din nou')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
