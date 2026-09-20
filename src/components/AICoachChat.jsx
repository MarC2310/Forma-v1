// src/components/AICoachChat.jsx
// AI Coach Chat inline — conversație persistentă cu context complet din toate sursele FORMA
// Construiește pe edge function-ul ai-coach existent, salvează în Supabase

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildUserContext(data) {
  if (!data) return 'Date indisponibile.'
  const { sleep, body, workouts, nutrition, fitData, profile, readiness, injuries, waterToday, weather, intervalsData } = data

  const lines = []

  // Profil
  if (profile) lines.push(`Utilizator: obiectiv ${profile.goal}, nivel ${profile.level}, ${profile.days_per_week} zile/săpt, ${profile.age || '—'} ani, ${profile.weight_kg || '—'}kg`)

  // Readiness
  if (readiness?.score) lines.push(`Readiness azi: ${readiness.score}/100 · Somn:${readiness.scores?.sleep||'—'} HRV:${readiness.scores?.hrv||'—'} Recuperare:${readiness.scores?.recovery||'—'} Sănătate:${readiness.scores?.health||'—'}`)

  // Somn
  if (sleep?.total_h) lines.push(`Somn: ${sleep.total_h.toFixed(1)}h · HRV ${sleep.hrv||'—'}ms · HR ${sleep.hr ? Math.round(sleep.hr) : '—'}bpm · SpO2 ${sleep.spo2||'—'}% · scor ${sleep.score||'—'}/100`)

  // Intervals.icu
  const iData = intervalsData?.today || intervalsData?.latest
  if (iData) {
    if (iData.hrv) lines.push(`HRV (Intervals.icu): ${Math.round(iData.hrv)}ms · HR repaus: ${iData.hr_rest||'—'}bpm`)
    if (iData.ctl) lines.push(`Fitness (CTL): ${Math.round(iData.ctl)} · Oboseală (ATL): ${iData.atl ? Math.round(iData.atl) : '—'} · Formă (TSB): ${iData.tsb != null ? (iData.tsb > 0 ? '+' : '') + Math.round(iData.tsb) : '—'}`)
    if (iData.vo2max) lines.push(`VO2max: ${iData.vo2max} ml/kg/min`)
  }

  // Corp
  if (body) lines.push(`Corp: ${body.weight_kg||'—'}kg · grăsime ${body.fat_pct||'—'}% · mușchi ${body.muscle_kg||'—'}kg · PWV ${body.pwv||'—'}m/s · TA ${body.bp_sys ? `${body.bp_sys}/${body.bp_dia}` : '—'}mmHg`)

  // Activitate
  if (fitData?.today?.steps) lines.push(`Activitate azi: ${fitData.today.steps.toLocaleString()} pași · ${Math.round(fitData.today.calories_burned||0)} kcal arse`)

  // Antrenamente
  const lastW = workouts?.[0]
  if (lastW) lines.push(`Ultimul antrenament: ${lastW.title} acum ${lastW.hours_ago}h · ${lastW.volume_kg?.toLocaleString()}kg volum · RPE ${lastW.rpe_avg||'—'}`)
  const week = workouts?.filter(w => w.date && new Date(w.date) >= new Date(Date.now()-7*86400000)) || []
  if (week.length) lines.push(`Săptămâna aceasta: ${week.length} antrenamente · ${week.reduce((s,w)=>s+(w.volume_kg||0),0).toLocaleString()}kg total`)

  // Nutriție
  if (nutrition?.calories) lines.push(`Nutriție azi: ${nutrition.calories}kcal · ${nutrition.protein_g}g proteină · ${nutrition.carbs_g}g carbo · ${nutrition.fat_g}g grăsimi`)

  // Hidratare
  if (waterToday?.target_ml) lines.push(`Hidratare: ${waterToday.total_ml}ml / ${waterToday.target_ml}ml (${Math.round((waterToday.total_ml/waterToday.target_ml)*100)}%)`)

  // Accidentări
  if (injuries?.length) lines.push(`⚠️ ACCIDENTĂRI ACTIVE: ${injuries.map(i=>`${i.description}${i.zone?' ('+i.zone+')':''}`).join('; ')}`)

  // Vreme
  if (weather) lines.push(`Vreme: ${weather.temperature_c}°C · ${weather.weather_label} · presiune ${weather.pressure_hpa}hPa${weather.pressure_delta_24h && Math.abs(weather.pressure_delta_24h)>=6 ? ` ⚠️ variație ${weather.pressure_delta_24h>0?'+':''}${weather.pressure_delta_24h}hPa` : ''}`)

  return lines.join('\n')
}

function buildSystemPrompt(data, user) {
  const ctx = buildUserContext(data)
  const name = data?.profile?.first_name
    || user?.user_metadata?.full_name?.split(' ')[0]
    || user?.user_metadata?.name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || null

  return `Ești AI Coach-ul personal integrat în aplicația FORMA — Daily Readiness Intelligence.
${name ? `Numele utilizatorului este ${name}. Adresează-te lui pe nume când e natural.` : ''}

DATELE UTILIZATORULUI (actualizate în timp real):
${ctx}

ROLUL TĂU:
- Răspunzi concis, direct și personalizat folosind EXCLUSIV datele de mai sus
- Nu inventa date — dacă ceva lipsește, spune explicit
- Fii un coach real: direct, motivant, fără clișee
- Răspunde MEREU în română
- Dacă întrebarea e despre antrenament și există accidentări active, adaptează OBLIGATORIU recomandarea
- Menține contextul conversației — faci referire la mesajele anterioare când e relevant
- Răspunsuri scurte și acționabile (3-6 propoziții max pentru întrebări simple, mai lung doar pentru planuri)`
}

// ─── Formatare mesaj ──────────────────────────────────────────────────────────
function MessageBubble({ msg, c }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: 8, background: c.green3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginBottom: 2 }}>🤖</div>
      )}
      <div style={{
        maxWidth: '82%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? c.green2 : c.card2,
        color: isUser ? '#fff' : c.text,
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }}>
        {msg.content}
        {msg.pending && (
          <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: c.text4, display: 'inline-block', animation: `chatDot 1.2s ${i*0.2}s infinite ease-in-out` }}/>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Sugestii rapide ──────────────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  'Cum arată forma mea azi?',
  'Ce antrenament fac azi?',
  'Sunt suficient recuperat?',
  'Când e picul meu de energie?',
  'Câte calorii să mănânc azi?',
  'Explică-mi HRV-ul meu',
  'Fă-mi un plan pentru săptămâna asta',
  'De ce scorul meu e mic azi?',
]

// ─── Componenta principală ────────────────────────────────────────────────────
export default function AICoachChat({ user, data, c, isMobile }) {
  if (!c) return null
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `chat_${Date.now()}`)
  const [isExpanded, setIsExpanded] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Mesaj de bun venit bazat pe oră
  useEffect(() => {
    const hour = new Date().getHours()
    const score = data?.readiness?.score
    // Extragem numele din profil, din user metadata sau din email
    const name = data?.profile?.first_name
      || user?.user_metadata?.full_name?.split(' ')[0]
      || user?.user_metadata?.name?.split(' ')[0]
      || user?.email?.split('@')[0]
      || ''
    const salut = name ? `, ${name}` : ''

    const greeting = hour < 12
      ? `Bună dimineața${salut}! 🌅 ${score ? `Readiness-ul tău azi e ${score}/100.` : ''} Cu ce te pot ajuta?`
      : hour < 18
      ? `Bună ziua${salut}! ☀️ ${score ? `Readiness ${score}/100.` : ''} Cum pot să te ajut?`
      : `Bună seara${salut}! 🌙 ${score ? `Ai încheiat ziua cu readiness ${score}/100.` : ''} Ce vrei să știi?`

    setMessages([{ role: 'assistant', content: greeting, id: 'welcome' }])
  }, [])

  // Scroll la ultimul mesaj
  useEffect(() => {
    if (isExpanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isExpanded])

  // Injectăm keyframe-ul CSS o singură dată
  useEffect(() => {
    if (document.getElementById('forma-chat-styles')) return
    const style = document.createElement('style')
    style.id = 'forma-chat-styles'
    style.textContent = `
      @keyframes chatDot { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.1)} }
      .forma-chat-input:focus { outline: none; }
      .forma-chat-input::placeholder { color: rgba(255,255,255,0.3); }
      .forma-suggestion:hover { background: rgba(255,255,255,0.08) !important; }
    `
    document.head.appendChild(style)
  }, [])

  async function sendMessage(text) {
    const userText = (text || input).trim()
    if (!userText || loading) return
    setInput('')

    const userMsg = { role: 'user', content: userText, id: Date.now() }
    const pendingMsg = { role: 'assistant', content: '', pending: true, id: 'pending' }
    setMessages(prev => [...prev, userMsg, pendingMsg])
    setLoading(true)

    try {
      // Construiește istoricul conversației (fără mesajul pending)
      const history = messages
        .filter(m => !m.pending && m.id !== 'welcome')
        .concat(userMsg)
        .slice(-12) // ultimele 12 mesaje = ~6 schimburi
        .map(m => ({ role: m.role, content: m.content }))

      const systemPrompt = buildSystemPrompt(data, user)

      const { data: fnData, error: fnErr } = await supabase.functions.invoke('ai-coach', {
        body: {
          system: systemPrompt,
          messages: history,
          max_tokens: 600,
        }
      })

      if (fnErr) throw new Error(fnErr.message)
      if (!fnData?.ok) throw new Error(fnData?.error || 'Eroare AI')

      const replyText = fnData.text || '...'
      const assistantMsg = { role: 'assistant', content: replyText, id: Date.now() + 1 }

      setMessages(prev => prev.filter(m => !m.pending).concat(assistantMsg))

      // Salvăm conversația în Supabase (async, fără a bloca UI)
      saveConversation(userText, replyText).catch(console.warn)

    } catch (err) {
      setMessages(prev => prev.filter(m => !m.pending).concat({
        role: 'assistant',
        content: `Eroare: ${err.message}. Încearcă din nou.`,
        id: Date.now() + 1,
        isError: true,
      }))
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  async function saveConversation(userText, replyText) {
    if (!user?.id) return
    await supabase.from('ai_reports').insert({
      user_id: user.id,
      date: new Date().toISOString().slice(0, 10),
      type: 'chat',
      content: JSON.stringify({ session: sessionId, q: userText, a: replyText }),
    })
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearChat() {
    const hour = new Date().getHours()
    const score = data?.readiness?.score
    const name = data?.profile?.first_name
      || user?.user_metadata?.full_name?.split(' ')[0]
      || user?.user_metadata?.name?.split(' ')[0]
      || user?.email?.split('@')[0]
      || ''
    const salut = name ? `, ${name}` : ''
    setMessages([{
      role: 'assistant',
      content: `Conversație nouă${salut}. ${score ? `Readiness azi: ${score}/100.` : ''} Cu ce te pot ajuta?`,
      id: 'welcome-new'
    }])
  }

  const hasRealMessages = messages.filter(m => m.id !== 'welcome' && m.id !== 'welcome-new').length > 0

  return (
    <div style={{
      background: c.card, borderRadius: c.radius,
      marginBottom: '1.1rem', boxShadow: c.shadowCard,
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div
        onClick={() => { setIsExpanded(o => !o); setTimeout(() => inputRef.current?.focus(), 150) }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0.9rem 1rem' : '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: c.green3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🤖</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>AI Coach — Chat</div>
            <div style={{ fontSize: 11, color: c.text4 }}>
              {hasRealMessages ? `${messages.filter(m=>m.role==='user').length} întrebări în sesiunea asta` : 'Întreabă orice despre datele tale'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasRealMessages && (
            <button onClick={e => { e.stopPropagation(); clearChat() }}
              style={{ fontSize: 11, padding: '4px 10px', background: c.card2, border: 'none', borderRadius: 8, color: c.text4, cursor: 'pointer', fontFamily: 'inherit' }}>
              ↺ Nou
            </button>
          )}
          <span style={{ fontSize: 12, color: c.text4, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>⌄</span>
        </div>
      </div>

      {/* ── Conținut expandat ── */}
      {isExpanded && (
        <div style={{ borderTop: `0.5px solid ${c.border2}` }}>
          {/* Mesaje */}
          <div style={{
            height: isMobile ? 320 : 380,
            overflowY: 'auto',
            padding: '14px 14px 8px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} c={c}/>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Sugestii rapide — afișate doar la început */}
          {!hasRealMessages && (
            <div style={{ padding: '0 14px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_SUGGESTIONS.slice(0, isMobile ? 4 : 6).map(s => (
                <button key={s} className="forma-suggestion"
                  onClick={() => sendMessage(s)}
                  style={{
                    fontSize: 11, padding: '5px 11px',
                    background: 'transparent',
                    border: `0.5px solid ${c.border}`,
                    borderRadius: 20, color: c.text3,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            display: 'flex', gap: 8, padding: '10px 14px 14px',
            borderTop: `0.5px solid ${c.border2}`,
            alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              className="forma-chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Scrie o întrebare... (Enter = trimite)"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, resize: 'none', overflow: 'hidden',
                background: c.card2, border: `0.5px solid ${c.border}`,
                borderRadius: 12, color: c.text,
                fontSize: 13, fontFamily: 'inherit',
                padding: '10px 13px', lineHeight: 1.5,
                minHeight: 40, maxHeight: 100,
                transition: 'border-color 0.15s',
              }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 40, height: 40, flexShrink: 0,
                background: loading || !input.trim() ? c.card2 : c.green2,
                border: 'none', borderRadius: 12,
                color: loading || !input.trim() ? c.text4 : '#fff',
                fontSize: 16, cursor: loading || !input.trim() ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}>
              {loading ? '⏳' : '↑'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
