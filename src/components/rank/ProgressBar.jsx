import { useState, useEffect } from 'react'

export function ProgressBar({ value, max, color, height = 8, animated = true }) {
  const [width, setWidth] = useState(0)
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  
  useEffect(() => { 
    const timer = setTimeout(() => setWidth(pct), 100)
    return () => clearTimeout(timer)
  }, [pct])

  return (
    <div style={{ height, background: 'rgba(128,128,128,0.15)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ 
        height: '100%', 
        width: `${animated ? width : pct}%`, 
        background: color, 
        borderRadius: height, 
        transition: animated ? 'width 1s cubic-bezier(.4,0,.2,1)' : 'none' 
      }}/>
    </div>
  )
}
