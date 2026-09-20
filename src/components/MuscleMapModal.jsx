/**
 * src/components/MuscleMapModal.jsx — FORMA v66
 * Modal siluetă musculară. Deschis din cardul Recuperare Musculară.
 */
import { useEffect } from 'react'
import MuscleRecoveryMap from './MuscleRecoveryMap'

export default function MuscleMapModal({ recoveryData, c = {}, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const bg     = c.surface || c.bg    || '#1f2937'
  const border = c.border  || c.card2 || '#374151'
  const muted  = c.textSecondary || c.text4 || '#9ca3af'

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:'fixed', inset:0, zIndex:1000,
        background:'rgba(0,0,0,0.65)',
        backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:16,
      }}
    >
      <div style={{
        background:bg, border:`1px solid ${border}`,
        borderRadius:18, padding:'20px 18px',
        width:'100%', maxWidth:460,
        maxHeight:'92vh', overflowY:'auto',
        position:'relative',
        boxShadow:'0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <button onClick={onClose} style={{
          position:'absolute', top:12, right:12,
          background:'rgba(255,255,255,0.08)',
          border:`1px solid ${border}`,
          borderRadius:8, cursor:'pointer',
          color:muted, padding:'3px 9px', fontSize:15, lineHeight:1.4,
        }}>✕</button>
        <MuscleRecoveryMap recoveryData={recoveryData} c={c} />
      </div>
    </div>
  )
}
