// src/pages/RankPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useTheme, getColors } from '../lib/theme.jsx'
import { useI18n } from '../lib/i18n'
import { getRank, getNextRank, getChallenges, calcProgress, loadPoints, getTotalPoints, checkAndAwardPoints } from '../lib/rankSystem'
import { ChallengeCard } from '../components/rank/ChallengeCard'
import { ProgressBar } from '../components/rank/ProgressBar'

const CH_NAMES = {
  luna_pasilor: '🦶 Luna Pașilor',
  luna_activa: '⚡ Luna Activă',
  luna_somnului: '😴 Luna Somnului',
  sapt_pasilor: '👟 Săptămâna Pașilor',
  sapt_antrenamente: '🏋️ Săptămâna Forței',
}

function prettyPointLabel(key, t) {
  const tier = ['Bronz', 'Argint', 'Aur'].find(x => key.endsWith('_' + x))
  let base = tier ? key.slice(0, key.length - tier.length - 1) : key
  base = base.replace(/_w\d+$/, '').replace(/_\d{4}-\d{2}$/, '')
  const name = CH_NAMES[base] ? t(CH_NAMES[base]) : base.replace(/_/g, ' ')
  return tier ? `${name} · ${t(tier)}` : name
}

export default function RankPage({ intervalsData, workouts, userName }) {
  const { theme } = useTheme()
  const c = getColors(theme)
  const { t, lang } = useI18n()
  
  const [pts, setPts] = useState({})
  const [newAward, setNewAward] = useState(null)

  // Încărcăm punctele asincron din Supabase/LocalStorage la montarea paginii
  useEffect(() => {
    async function fetchPts() {
      const data = await loadPoints()
      setPts(data || {})
    }
    fetchPts()
  }, [])

  const totalPoints = getTotalPoints(pts)
  const rank = getRank(totalPoints)
  const nextRank = getNextRank(totalPoints)
  const challenges = useMemo(() => getChallenges(), [lang])

  const progressMap = useMemo(() => {
    const map = {}
    const all = [...challenges.monthly, ...challenges.weekly]
    for (const ch of all) {
      map[ch.id] = calcProgress(ch, intervalsData, workouts)
    }
    return map
  }, [intervalsData, workouts, challenges])

  useEffect(() => {
    const all = [...challenges.monthly, ...challenges.weekly]
    for (const ch of all) {
      const progress = progressMap[ch.id] || 0
      // Verificăm și actualizăm asincron punctele dacă e cazul
      checkAndAwardPoints(ch, progress).then(awarded => {
        if (awarded) {
          setNewAward({ challenge: ch, tier: awarded })
          // Reîncărcăm punctele actualizate
          loadPoints().then(updated => setPts(updated || {}))
        }
      })
    }
  }, [progressMap, challenges])

  const s = {
    section: { fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, marginTop: 20 },
  }

  const pctToNext = nextRank ? Math.round(((totalPoints - rank.minPoints) / (nextRank.minPoints - rank.minPoints)) * 100) : 100

  return (
    <div style={{ padding: '0.75rem 1rem', maxWidth: 860, margin: '0 auto', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Card rank curent */}
      <div style={{ background: `linear-gradient(135deg, ${rank.color}22, ${rank.color}08)`, border: `1px solid ${rank.color}44`, borderRadius: 18, padding: '1.25rem', marginBottom: '1rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 120, opacity: 0.06, lineHeight: 1 }}>{rank.icon}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 52, lineHeight: 1 }}>{rank.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: c.text4, marginBottom: 2 }}>{t('Rank curent')} · {userName || 'Marcel'}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: rank.color, letterSpacing: '-0.5px' }}>{t(rank.name)}</div>
            <div style={{ fontSize: 13, color: c.text3, marginTop: 2 }}>{totalPoints} {t('puncte totale')}</div>
          </div>
          {nextRank && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: c.text4, marginBottom: 3 }}>{t('următor')}</div>
              <div style={{ fontSize: 28 }}>{nextRank.icon}</div>
              <div style={{ fontSize: 10, color: nextRank.color, fontWeight: 700 }}>{t(nextRank.name)}</div>
              <div style={{ fontSize: 9, color: c.text4 }}>{nextRank.minPoints - totalPoints}p</div>
            </div>
          )}
        </div>
        {nextRank && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: c.text4, marginBottom: 5 }}>
              <span>{t(rank.name)} · {rank.minPoints}p</span>
              <span>{t(nextRank.name)} · {nextRank.minPoints}p</span>
            </div>
            <ProgressBar value={totalPoints - rank.minPoints} max={nextRank.minPoints - rank.minPoints} color={rank.color} height={10}/>
            <div style={{ fontSize: 10, color: c.text4, textAlign: 'right', marginTop: 4 }}>{pctToNext}% {t('spre')} {t(nextRank.name)}</div>
          </div>
        )}
      </div>

      {/* Puncte detaliate */}
      {(() => {
        const earnedEntries = Object.entries(pts).filter(([k, v]) => !k.startsWith('penalizare_') && !k.startsWith('decay_') && v > 0)
        const penalizariEntries = Object.entries(pts).filter(([k, v]) => (k.startsWith('penalizare_') || k.startsWith('decay_')) && v < 0)
        if (earnedEntries.length === 0) return null
        return (
          <div style={{ background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '0.875rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.text4, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{t('Puncte câștigate')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {earnedEntries.map(([key, val]) => (
                <div key={key} style={{ fontSize: 10, color: c.text3, background: c.card2, padding: '3px 8px', borderRadius: 12, border: `0.5px solid ${c.border}` }}>
                  {prettyPointLabel(key, t)} · <strong style={{ color: '#FFD700' }}>+{val}p</strong>
                </div>
              ))}
            </div>
            {penalizariEntries.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `0.5px solid ${c.border}` }}>
                {penalizariEntries.map(([key]) => {
                  const ym = key.replace(/^(penalizare_|decay_)/, '')
                  return (
                    <div key={key} style={{ fontSize: 10, color: '#FF6B6B', display: 'inline-block', background: '#FF6B6B18', padding: '3px 8px', borderRadius: 12, border: '0.5px solid #FF6B6B44' }}>
                      {t('Penalizare')} {ym}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Provocări lunare */}
      <div style={s.section}>{t('📅 Provocări lunare')}</div>
      {challenges.monthly.map(ch => (
        <ChallengeCard key={ch.id} challenge={ch} progress={progressMap[ch.id] || 0} c={c}/>
      ))}

      {/* Provocări săptămânale */}
      <div style={s.section}>{t('⚡ Provocări săptămânale')}</div>
      {challenges.weekly.map(ch => (
        <ChallengeCard key={ch.id} challenge={ch} progress={progressMap[ch.id] || 0} c={c}/>
      ))}

      {/* Popup premiu nou */}
      {newAward && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setNewAward(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: c.card, borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 300, margin: '0 1rem' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>
              {newAward.tier.label === 'Bronz' ? '🥉' : newAward.tier.label === 'Argint' ? '🥈' : '🥇'}
            </div>
            <div style={{ fontSize: 13, color: c.text4, marginBottom: 4 }}>{t('Provocare completată!')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: newAward.tier.color, marginBottom: 6 }}>
              {t(newAward.challenge.title)} — {t(newAward.tier.label)}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#FFD700', marginBottom: 16 }}>+{newAward.tier.points}p</div>
            <button onClick={() => setNewAward(null)}
              style={{ padding: '10px 28px', background: newAward.tier.color, color: '#fff', border: 'none', borderRadius: 24, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('Super! ✓')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
