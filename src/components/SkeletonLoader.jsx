// src/components/SkeletonLoader.jsx
// Skeleton screens pentru toate cardurile din Dashboard
// Zero dependențe externe — CSS animations pure

import { useEffect } from 'react'

// Injectăm keyframe-ul o singură dată
function injectSkeleton() {
  if (document.getElementById('forma-skeleton-css')) return
  const s = document.createElement('style')
  s.id = 'forma-skeleton-css'
  s.textContent = `
    @keyframes forma-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .forma-skeleton-pulse {
      animation: forma-shimmer 1.4s ease-in-out infinite;
      background: linear-gradient(
        90deg,
        var(--sk-base, rgba(255,255,255,0.04)) 0%,
        var(--sk-highlight, rgba(255,255,255,0.10)) 50%,
        var(--sk-base, rgba(255,255,255,0.04)) 100%
      );
      background-size: 800px 100%;
      border-radius: 6px;
    }
    @media (prefers-reduced-motion: reduce) {
      .forma-skeleton-pulse { animation: none; opacity: 0.4; }
    }
  `
  document.head.appendChild(s)
}

// ── Block generic ─────────────────────────────────────────────────────────────
export function SkeletonBlock({ w = '100%', h = 16, r = 6, style = {} }) {
  useEffect(() => { injectSkeleton() }, [])
  return (
    <div className="forma-skeleton-pulse" style={{ width: w, height: h, borderRadius: r, ...style }}/>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function SkCard({ c, children, style = {} }) {
  return (
    <div style={{
      background: c.card, borderRadius: c.radius,
      padding: '1.25rem', marginBottom: '1.1rem',
      boxShadow: c.shadowCard, ...style
    }}>
      {children}
    </div>
  )
}

// ── Hero card skeleton ────────────────────────────────────────────────────────
export function SkeletonHero({ c }) {
  useEffect(() => { injectSkeleton() }, [])
  return (
    <SkCard c={c} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Ring */}
      <div className="forma-skeleton-pulse" style={{ width: 90, height: 90, borderRadius: '50%', flexShrink: 0 }}/>
      <div style={{ flex: 1 }}>
        <SkeletonBlock w="80px" h={22} r={6} style={{ marginBottom: 10 }}/>
        <SkeletonBlock w="60%" h={18} style={{ marginBottom: 8 }}/>
        <SkeletonBlock w="90%" h={14} style={{ marginBottom: 6 }}/>
        <SkeletonBlock w="75%" h={14} style={{ marginBottom: 14 }}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[1,2,3,4,5,6].map(i => <SkeletonBlock key={i} h={14} r={4}/>)}
        </div>
      </div>
    </SkCard>
  )
}

// ── MetricCard skeleton (per card mic) ────────────────────────────────────────
export function SkeletonMetricCard({ c }) {
  useEffect(() => { injectSkeleton() }, [])
  return (
    <div style={{ background: c.card, borderRadius: c.radiusSm, padding: '0.75rem', boxShadow: c.shadowCard }}>
      <SkeletonBlock w="55%" h={10} r={4} style={{ marginBottom: 10 }}/>
      <SkeletonBlock w="70%" h={26} r={5} style={{ marginBottom: 8 }}/>
      <SkeletonBlock w="80%" h={10} r={4}/>
    </div>
  )
}

// ── Grid de 4 MetricCards skeleton ───────────────────────────────────────────
export function SkeletonMetricGrid({ c, cols = 4, isMobile }) {
  const n = Math.min(cols, isMobile ? 2 : 4)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 8, marginBottom: '1rem' }}>
      {Array.from({ length: cols }).map((_, i) => <SkeletonMetricCard key={i} c={c}/>)}
    </div>
  )
}

// ── Card generic cu linii de text ─────────────────────────────────────────────
export function SkeletonCard({ c, lines = 3, hasTitle = true }) {
  useEffect(() => { injectSkeleton() }, [])
  const widths = ['45%', '90%', '75%', '60%', '85%', '70%']
  return (
    <SkCard c={c}>
      {hasTitle && <SkeletonBlock w="40%" h={12} r={4} style={{ marginBottom: 16 }}/>}
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} w={widths[i % widths.length]} h={14} style={{ marginBottom: 10 }}/>
      ))}
    </SkCard>
  )
}

// ── Tab bar skeleton ──────────────────────────────────────────────────────────
export function SkeletonTabBar({ c }) {
  useEffect(() => { injectSkeleton() }, [])
  return (
    <div style={{ display: 'flex', gap: 4, background: c.card, padding: 5, borderRadius: c.radiusSm, marginBottom: '1rem', boxShadow: c.shadowCard }}>
      {[80, 70, 100, 90, 110].map((w, i) => (
        <SkeletonBlock key={i} w={`${w}px`} h={30} r={7}/>
      ))}
    </div>
  )
}

// ── Pachet complet pentru loading inițial Dashboard ───────────────────────────
export function SkeletonDashboard({ c, isMobile }) {
  return (
    <>
      <SkeletonTabBar c={c}/>
      <SkeletonHero c={c}/>
      <SkeletonMetricGrid c={c} cols={4} isMobile={isMobile}/>
      <SkeletonCard c={c} lines={4}/>
      <SkeletonMetricGrid c={c} cols={4} isMobile={isMobile}/>
      <SkeletonCard c={c} lines={3}/>
    </>
  )
}
