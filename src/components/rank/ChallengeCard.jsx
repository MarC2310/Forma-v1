import { loadPoints } from '../../lib/rankSystem'
import { useI18n } from '../../lib/i18n'
import { ProgressBar } from './ProgressBar'

const BD_CSS_RANK = `
  @property --bd-ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
  @keyframes bd-spin { to { --bd-ang: 360deg; } }
  .bd-anim { --bd-ang: 0deg; animation: bd-spin 3s linear infinite; padding: 1.5px; }
`

export function ChallengeCard({ challenge, progress, c }) {
  const { t } = useI18n()
  const pts = loadPoints()

  let currentTier = null
  for (let i = challenge.tiers.length - 1; i >= 0; i--) {
    if (progress >= challenge.tiers[i].target) { currentTier = challenge.tiers[i]; break }
  }

  let nextTier = null
  for (let i = 0; i < challenge.tiers.length; i++) {
    if (progress < challenge.tiers[i].target) { nextTier = challenge.tiers[i]; break }
  }

  const displayTier = nextTier || challenge.tiers[challenge.tiers.length - 1]
  const pct = Math.min(100, Math.round((progress / displayTier.target) * 100))

  return (
    <div style={{ background: c.card, border: `0.5px solid ${c.border}`, borderRadius: 14, padding: '1rem', marginBottom: '0.75rem' }}>
      <style dangerouslySetInnerHTML={{ __html: BD_CSS_RANK }}/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{t(challenge.title)}</div>
          <div style={{ fontSize: 11, color: c.text4, marginTop: 2 }}>{t(challenge.subtitle)} · {t(challenge.description)}</div>
        </div>
        {currentTier && (
          <div style={{ fontSize: 11, fontWeight: 700, color: currentTier.color, background: currentTier.color + '22', padding: '3px 8px', borderRadius: 20, flexShrink: 0, marginLeft: 8 }}>
            {t(currentTier.label)} ✓
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {challenge.tiers.map(tier => {
          const done = progress >= tier.target
          const key = `${challenge.id}_${tier.label}`
          const awarded = !!pts[key]
          const _tierInner = (
            <>
              <div style={{ fontSize: 16 }}>{tier.label === 'Bronz' ? '🥉' : tier.label === 'Argint' ? '🥈' : '🥇'}</div>
              <div style={{ fontSize: 9, color: done ? tier.color : c.text4, fontWeight: done ? 700 : 400, marginTop: 2 }}>{t(tier.label)}</div>
              <div style={{ fontSize: 9, color: c.text4 }}>{tier.target.toLocaleString()}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: done ? tier.color : c.text4 }}>+{tier.points}p</div>
              {awarded && <div style={{ fontSize: 9, color: '#FFD700' }}>✓ {t('acordat')}</div>}
            </>
          )
          if (done) return (
            <div key={tier.label} className="bd-anim" style={{ flex: 1, borderRadius: 10, background: `conic-gradient(from var(--bd-ang), ${tier.color}44 0%, ${tier.color} 28%, ${tier.color}44 52%, ${tier.color} 78%, ${tier.color}44 100%)` }}>
              <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: '8.5px', background: c.card, height: '100%', boxSizing: 'border-box' }}>{_tierInner}</div>
            </div>
          )
          return (
            <div key={tier.label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: c.card2, border: `1px solid ${c.border}` }}>{_tierInner}</div>
          )
        })}
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.text4, marginBottom: 5 }}>
          <span style={{ color: c.text, fontWeight: 600 }}>{progress.toLocaleString()}</span>
          <span>{t('țintă')}: {displayTier.target.toLocaleString()} ({t(displayTier.label)})</span>
        </div>
        <ProgressBar value={progress} max={displayTier.target} color={currentTier ? '#FFD700' : displayTier.color}/>
      </div>
      <div style={{ fontSize: 11, color: c.text4, textAlign: 'right' }}>{pct}% {t('completat')}</div>
    </div>
  )
}
