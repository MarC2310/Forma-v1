// src/components/OnboardingFlow.jsx
// Flow de onboarding la prima autentificare — 5 pași, salvează în profiles
// Apare o singură dată, marcat cu onboarding_completed în DB

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { setLang as setAppLang } from '../lib/i18n'

// Vârsta (ani întregi) din data nașterii — null dacă lipsește/invalidă.
function calcAge(dateStr) {
  if (!dateStr) return null
  const b = new Date(dateStr)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

const STEPS = ['bun_venit', 'limba', 'obiectiv', 'nivel', 'date', 'tinte', 'permisiuni', 'surse']

const GOALS = [
  { id: 'hipertrofie', icon: '💪', label: 'Hipertrofie', desc: 'Creștere masă musculară' },
  { id: 'forta',       icon: '🏋️', label: 'Forță',      desc: 'Creștere 1RM pe lifturi' },
  { id: 'slabit',      icon: '🔥', label: 'Slăbit',     desc: 'Reducere masă grasă' },
  { id: 'sanatate',    icon: '❤️', label: 'Sănătate',   desc: 'Longevitate și wellbeing' },
  { id: 'rezistenta',  icon: '🏃', label: 'Rezistență', desc: 'Anduranță cardiovasculară' },
]

const LEVELS = [
  { id: 'incepator',    icon: '🌱', label: 'Începător',   desc: '< 1 an antrenament' },
  { id: 'intermediar',  icon: '⚡', label: 'Intermediar', desc: '1–3 ani antrenament' },
  { id: 'avansat',      icon: '🔥', label: 'Avansat',     desc: '3+ ani, program structurat' },
]

const SOURCES = [
  { id: 'hevy',     icon: '🏋️', label: 'Hevy',          desc: 'Antrenamente din sală' },
  { id: 'withings', icon: '⚖️',  label: 'Withings',      desc: 'Cântar, tensiune, somn' },
  { id: 'garmin',   icon: '⌚',  label: 'Garmin / GFit', desc: 'Pași, HR, activitate' },
  { id: 'intervals',icon: '📊',  label: 'Intervals.icu', desc: 'Fitness, HRV, CTL/TSB' },
]

export default function OnboardingFlow({ userId, userName, onComplete, c }) {
  if (!c) return null
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    goal: '', level: '', days_per_week: 4,
    birth_date: '', age: '', weight_kg: '', height_cm: '', gender: 'M',
    language: 'ro',
    target_steps: '10000', target_sleep_hours: '8', target_water_ml: '2500',
  })
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  const [locPerm, setLocPerm] = useState('prompt')

  async function requestNotif() {
    try {
      if (typeof Notification === 'undefined') { setNotifPerm('unsupported'); return }
      const p = await Notification.requestPermission()
      setNotifPerm(p)
    } catch (_) { /* ignore */ }
  }
  function requestLoc() {
    if (!navigator.geolocation) { setLocPerm('unsupported'); return }
    navigator.geolocation.getCurrentPosition(
      () => setLocPerm('granted'),
      () => setLocPerm('denied'),
      { timeout: 8000 }
    )
  }

  const stepKey = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100

  function set(key, val) { setData(d => ({ ...d, [key]: val })) }

  function canNext() {
    if (stepKey === 'obiectiv') return !!data.goal
    if (stepKey === 'nivel')    return !!data.level
    return true
  }

  async function finish() {
    setSaving(true)
    try {
      const payload = {
        id: userId,
        goal:          data.goal,
        level:         data.level,
        days_per_week: data.days_per_week,
        birth_date:    data.birth_date || null,
        age:           calcAge(data.birth_date) ?? (data.age ? parseInt(data.age) : null),
        weight_kg:     data.weight_kg ? parseFloat(data.weight_kg) : null,
        height_cm:     data.height_cm ? parseInt(data.height_cm) : null,
        gender:        data.gender,
        language:      data.language || 'ro',
        target_steps:        data.target_steps ? parseInt(data.target_steps) : null,
        target_sleep_hours:  data.target_sleep_hours ? parseFloat(data.target_sleep_hours) : null,
        target_water_ml:     data.target_water_ml ? parseInt(data.target_water_ml) : null,
        onboarding_completed: true,
      }
      // Upsert rezilient: dacă o coloană opțională lipsește din schemă, o scoatem și reîncercăm
      const attempt = { ...payload }
      for (let i = 0; i < 12; i++) {
        const { error } = await supabase.from('profiles').upsert(attempt)
        if (!error) break
        if (!/column|schema cache/i.test(error.message || '')) break
        const m = (error.message || '').match(/'([a-z_0-9]+)' column/i)
        const missing = m ? m[1] : null
        if (missing && missing in attempt && missing !== 'id' && missing !== 'goal') delete attempt[missing]
        else break
      }
      onComplete()
    } catch (err) {
      console.error('Onboarding save:', err)
      onComplete() // nu blocăm utilizatorul dacă eșuează
    } finally {
      setSaving(false)
    }
  }

  const name = userName?.split(' ')[0] || ''

  return (
    <div style={{
      position: 'fixed', inset: 0, background: c.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: c.fontFamily, zIndex: 9000, padding: '1.5rem',
    }}>
      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: c.card2 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: c.green2, transition: 'width 0.4s ease', borderRadius: '0 2px 2px 0' }}/>
      </div>

      {/* Container */}
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* BUN VENIT */}
        {stepKey === 'bun_venit' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⚡</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: c.text, marginBottom: 12 }}>
              Bun venit{name ? `, ${name}` : ''}!
            </h1>
            <p style={{ fontSize: 16, color: c.text3, lineHeight: 1.6, marginBottom: 32 }}>
              FORMA îți monitorizează readiness-ul zilnic din toate sursele tale de date — antrenamente, somn, HRV și nutriție.
            </p>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 32 }}>
              Durează 1 minut să te configurăm corect.
            </p>
          </div>
        )}

        {/* LIMBA */}
        {stepKey === 'limba' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>Limbă · Language</h2>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 24 }}>Alege limba aplicației. O poți schimba oricând din Profil.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[['ro', '🇷🇴', 'Română'], ['en', '🇬🇧', 'English']].map(([code, flag, lbl]) => (
                <button key={code} onClick={() => { set('language', code); setAppLang(code) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: c.radiusSm,
                    background: data.language === code ? c.green3 : c.card,
                    border: `1.5px solid ${data.language === code ? c.green : c.border}`,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  }}>
                  <span style={{ fontSize: 24 }}>{flag}</span>
                  <div style={{ fontSize: 15, fontWeight: 600, color: data.language === code ? c.green : c.text }}>{lbl}</div>
                  {data.language === code && <span style={{ marginLeft: 'auto', color: c.green, fontSize: 18 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* OBIECTIV */}
        {stepKey === 'obiectiv' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>Care e obiectivul tău?</h2>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 24 }}>AI Coach-ul și recomandările se adaptează la acesta.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => set('goal', g.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: c.radiusSm,
                    background: data.goal === g.id ? c.green3 : c.card,
                    border: `1.5px solid ${data.goal === g.id ? c.green : c.border}`,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 24 }}>{g.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: data.goal === g.id ? c.green : c.text }}>{g.label}</div>
                    <div style={{ fontSize: 12, color: c.text4, marginTop: 2 }}>{g.desc}</div>
                  </div>
                  {data.goal === g.id && <span style={{ marginLeft: 'auto', color: c.green, fontSize: 18 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NIVEL */}
        {stepKey === 'nivel' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>Nivelul tău de experiență</h2>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 24 }}>Influențează volumul și intensitatea recomandate.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LEVELS.map(l => (
                <button key={l.id} onClick={() => set('level', l.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: c.radiusSm,
                    background: data.level === l.id ? c.green3 : c.card,
                    border: `1.5px solid ${data.level === l.id ? c.green : c.border}`,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 24 }}>{l.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: data.level === l.id ? c.green : c.text }}>{l.label}</div>
                    <div style={{ fontSize: 12, color: c.text4, marginTop: 2 }}>{l.desc}</div>
                  </div>
                  {data.level === l.id && <span style={{ marginLeft: 'auto', color: c.green, fontSize: 18 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DATE PERSONALE */}
        {stepKey === 'date' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>Date personale</h2>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 24 }}>Folosite pentru calcule TDEE, BMI și vârstă biologică.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Data nașterii — vârsta se calculează din ea și se actualizează singură la aniversare */}
              <div>
                <label style={{ fontSize: 12, color: c.text3, display: 'block', marginBottom: 6 }}>Data nașterii</label>
                <input type="date" max={new Date().toISOString().slice(0, 10)}
                  value={data.birth_date} onChange={e => set('birth_date', e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', background: c.card,
                    border: `1px solid ${c.border}`, borderRadius: c.radiusSm,
                    color: c.text, fontSize: 15, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}/>
                {calcAge(data.birth_date) != null && (
                  <div style={{ fontSize: 11, color: c.green, marginTop: 6 }}>Vârstă: {calcAge(data.birth_date)} ani</div>
                )}
              </div>
              {[
                { key: 'weight_kg', label: 'Greutate (kg)', type: 'number', placeholder: 'ex: 87.5' },
                { key: 'height_cm', label: 'Înălțime (cm)', type: 'number', placeholder: 'ex: 178' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: c.text3, display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    value={data[f.key]} onChange={e => set(f.key, e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', background: c.card,
                      border: `1px solid ${c.border}`, borderRadius: c.radiusSm,
                      color: c.text, fontSize: 15, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}/>
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: c.text3, display: 'block', marginBottom: 6 }}>Gen</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[['M', 'Masculin'], ['F', 'Feminin']].map(([val, lbl]) => (
                    <button key={val} onClick={() => set('gender', val)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: c.radiusSm,
                        background: data.gender === val ? c.green3 : c.card,
                        border: `1.5px solid ${data.gender === val ? c.green : c.border}`,
                        color: data.gender === val ? c.green : c.text3,
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
                      }}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: c.text3, display: 'block', marginBottom: 6 }}>Zile de antrenament pe săptămână</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[2,3,4,5,6].map(d => (
                    <button key={d} onClick={() => set('days_per_week', d)}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: c.radiusSm,
                        background: data.days_per_week === d ? c.green3 : c.card,
                        border: `1.5px solid ${data.days_per_week === d ? c.green : c.border}`,
                        color: data.days_per_week === d ? c.green : c.text3,
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
                      }}>{d}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ȚINTE */}
        {stepKey === 'tinte' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>Țintele tale zilnice</h2>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 24 }}>La astea se raportează progresul tău. Le poți modifica oricând din Profil.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'target_steps',       label: 'Pași pe zi',   placeholder: 'ex: 10000', suffix: 'pași' },
                { key: 'target_sleep_hours', label: 'Ore de somn',  placeholder: 'ex: 8',     suffix: 'ore' },
                { key: 'target_water_ml',    label: 'Apă pe zi',    placeholder: 'ex: 2500',  suffix: 'ml' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: c.text3, display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" inputMode="numeric" placeholder={f.placeholder}
                      value={data[f.key]} onChange={e => set(f.key, e.target.value)}
                      style={{
                        width: '100%', padding: '12px 52px 12px 14px', background: c.card,
                        border: `1px solid ${c.border}`, borderRadius: c.radiusSm,
                        color: c.text, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                      }}/>
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: c.text4 }}>{f.suffix}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PERMISIUNI */}
        {stepKey === 'permisiuni' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>Permisiuni</h2>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 24 }}>Opționale — poți sări peste și le activezi mai târziu.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Notificări */}
              <div style={{ padding: '14px 16px', borderRadius: c.radiusSm, background: c.card, border: `1px solid ${c.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>🔔</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Notificări</div>
                    <div style={{ fontSize: 12, color: c.text4 }}>Reminder de readiness, somn și hidratare.</div>
                  </div>
                </div>
                <button onClick={requestNotif} disabled={notifPerm === 'granted' || notifPerm === 'unsupported'}
                  style={{
                    width: '100%', padding: '11px', borderRadius: c.radiusSm, border: 'none',
                    cursor: notifPerm === 'granted' ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    background: notifPerm === 'granted' ? c.green3 : c.green2, color: notifPerm === 'granted' ? c.green : '#fff',
                  }}>
                  {notifPerm === 'granted' ? '✓ Activate' : notifPerm === 'denied' ? 'Blocate — activează din setările telefonului' : notifPerm === 'unsupported' ? 'Indisponibil pe acest dispozitiv' : 'Activează notificările'}
                </button>
              </div>

              {/* Locație */}
              <div style={{ padding: '14px 16px', borderRadius: c.radiusSm, background: c.card, border: `1px solid ${c.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Locație</div>
                    <div style={{ fontSize: 12, color: c.text4 }}>Pentru vremea locală pe pagina principală.</div>
                  </div>
                </div>
                <button onClick={requestLoc} disabled={locPerm === 'granted' || locPerm === 'unsupported'}
                  style={{
                    width: '100%', padding: '11px', borderRadius: c.radiusSm, border: 'none',
                    cursor: locPerm === 'granted' ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    background: locPerm === 'granted' ? c.green3 : c.green2, color: locPerm === 'granted' ? c.green : '#fff',
                  }}>
                  {locPerm === 'granted' ? '✓ Permisă' : locPerm === 'denied' ? 'Refuzată — activează din setările telefonului' : locPerm === 'unsupported' ? 'Indisponibil pe acest dispozitiv' : 'Permite locația'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* SURSE DATE */}
        {stepKey === 'surse' && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: c.text, marginBottom: 8 }}>Sursele tale de date</h2>
            <p style={{ fontSize: 13, color: c.text4, marginBottom: 8 }}>Conectează-le din Profil → Surse date după setup.</p>
            <p style={{ fontSize: 12, color: c.text4, marginBottom: 24, lineHeight: 1.5 }}>FORMA funcționează și cu o singură sursă — fiecare adaugă mai multă precizie.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SOURCES.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: c.radiusSm,
                  background: c.card, border: `1px solid ${c.border}`,
                }}>
                  <span style={{ fontSize: 22 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: c.text4 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Butoane navigare */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ flex: 1, padding: '14px', background: c.card, border: `1px solid ${c.border}`, borderRadius: c.radiusSm, color: c.text3, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Înapoi
            </button>
          )}
          <button
            onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : finish()}
            disabled={!canNext() || saving}
            style={{
              flex: 2, padding: '14px',
              background: canNext() ? c.green2 : c.card2,
              border: 'none', borderRadius: c.radiusSm,
              color: canNext() ? '#fff' : c.text4,
              fontSize: 15, fontWeight: 700,
              cursor: canNext() ? 'pointer' : 'default',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
            {saving ? '⏳ Se salvează...' : step < STEPS.length - 1 ? 'Continuă →' : '🚀 Intră în FORMA'}
          </button>
        </div>

        {/* Skip */}
        {step < STEPS.length - 1 && (
          <button onClick={() => setStep(s => s + 1)}
            style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: c.text4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sari peste acest pas
          </button>
        )}

        {/* Dots indicator */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? c.green : c.border, transition: 'all 0.3s' }}/>
          ))}
        </div>
      </div>
    </div>
  )
}
