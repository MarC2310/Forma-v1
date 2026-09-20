import { useState, useEffect } from 'react'
import useBLEHeartRate from '../hooks/useBLEHeartRate'
import useSoundLevelAnalyzer from '../hooks/useSoundLevelAnalyzer'

export default function SleepChartsComponent({ c, isDark }) {
  const { isConnected, heartRate, heartRateData, connectDevice, disconnect } = useBLEHeartRate()
  const { soundLevel, soundLevelData, isMonitoring, startMonitoring, stopMonitoring } = useSoundLevelAnalyzer()
  const [showHeartRate, setShowHeartRate] = useState(true)
  const [showSoundLevel, setShowSoundLevel] = useState(true)

  const colors = c || {
    card: isDark ? '#1a1a1a' : '#ffffff',
    card2: isDark ? '#2a2a2a' : '#f5f5f5',
    text: isDark ? '#ffffff' : '#000000',
    text3: isDark ? '#aaaaaa' : '#666666',
    border: isDark ? '#333333' : '#cccccc',
  }

  // Simple line chart renderer
  const renderChart = (data, label, color, max = 100) => {
    if (data.length < 2) return <div style={{ color: colors.text3, fontSize: 12 }}>Așteptând date...</div>

    const width = 400
    const height = 150
    const padding = 30

    // Calculate points
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (width - 2 * padding) + padding
      const y = height - padding - (d.level || d.bpm) / max * (height - 2 * padding)
      return `${x},${y}`
    })

    const pathData = `M ${points.join(' L ')}`

    return (
      <svg width="100%" height={height} style={{ border: `1px solid ${colors.border}`, borderRadius: 8 }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => (
          <line
            key={val}
            x1={padding}
            y1={height - padding - (val / 100) * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - (val / 100) * (height - 2 * padding)}
            stroke={colors.border}
            strokeDasharray="4"
            strokeWidth="0.5"
          />
        ))}

        {/* Chart line */}
        <path d={pathData} stroke={color} strokeWidth="2" fill="none" />

        {/* Y-axis labels */}
        {[0, 50, 100].map((val) => (
          <text
            key={`y-${val}`}
            x={padding - 10}
            y={height - padding - (val / 100) * (height - 2 * padding) + 4}
            fontSize="10"
            fill={colors.text3}
            textAnchor="end"
          >
            {val}
          </text>
        ))}
      </svg>
    )
  }

  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 'bold', color: colors.text }}>
        📊 Sleep Analytics
      </h3>

      {/* Heart Rate Section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h4 style={{ margin: 0, color: colors.text, fontSize: 14 }}>❤️ Heart Rate</h4>
            <div style={{ fontSize: 12, color: colors.text3, marginTop: 4 }}>
              {isConnected ? (
                <>
                  Current: <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{heartRate} BPM</span>
                </>
              ) : (
                'Disconnected'
              )}
            </div>
          </div>
          <button
            onClick={isConnected ? disconnect : connectDevice}
            style={{
              background: isConnected ? '#ef4444' : '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 'bold',
            }}
          >
            {isConnected ? '🔌 Disconnect' : '🔗 Connect BLE'}
          </button>
        </div>

        {heartRateData.length > 0 && (
          <div style={{ background: colors.card2, borderRadius: 8, padding: 12 }}>
            {renderChart(heartRateData, 'BPM', '#ef4444', 180)}
            <div style={{ fontSize: 10, color: colors.text3, marginTop: 8, textAlign: 'center' }}>
              {heartRateData.length > 0 &&
                `Last 2 minutes | Min: ${Math.min(...heartRateData.map((d) => d.bpm))} | Max: ${Math.max(...heartRateData.map((d) => d.bpm))}`}
            </div>
          </div>
        )}
      </div>

      {/* Sound Level Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h4 style={{ margin: 0, color: colors.text, fontSize: 14 }}>🔊 Noise Level</h4>
            <div style={{ fontSize: 12, color: colors.text3, marginTop: 4 }}>
              Current: <span style={{ fontWeight: 'bold', color: '#f59e0b' }}>{soundLevel}%</span>
            </div>
          </div>
          <button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            style={{
              background: isMonitoring ? '#ef4444' : '#22c55e',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 'bold',
            }}
          >
            {isMonitoring ? '⏹️ Stop' : '🎙️ Start Monitor'}
          </button>
        </div>

        {soundLevelData.length > 0 && (
          <div style={{ background: colors.card2, borderRadius: 8, padding: 12 }}>
            {renderChart(soundLevelData, 'Level', '#f59e0b', 100)}
            <div style={{ fontSize: 10, color: colors.text3, marginTop: 8, textAlign: 'center' }}>
              {soundLevelData.length > 0 &&
                `Last 2 minutes | Min: ${Math.min(...soundLevelData.map((d) => d.level))}% | Max: ${Math.max(...soundLevelData.map((d) => d.level))}%`}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
