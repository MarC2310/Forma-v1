import { useState, useRef, useEffect } from 'react'

export default function useSleepSession() {
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState('00:00')
  const [sessionData, setSessionData] = useState(null)
  const [error, setError] = useState(null)

  const sessionTimerRef = useRef(null)
  const sessionRef = useRef(null)

  // Load active session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sleepSession')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setSessionActive(true)
        setSessionStartTime(new Date(data.startTime))
        setSessionData(data)
      } catch (err) {
        console.error('Error loading session:', err)
      }
    }
  }, [])

  // Update elapsed time every second
  useEffect(() => {
    if (!sessionActive || !sessionStartTime) return

    const updateTimer = () => {
      const now = new Date()
      const diff = now - sessionStartTime
      const hours = Math.floor(diff / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      )
    }

    updateTimer()
    sessionTimerRef.current = setInterval(updateTimer, 1000)

    return () => clearInterval(sessionTimerRef.current)
  }, [sessionActive, sessionStartTime])

  // Start sleep session
  const startSession = async (userId) => {
    try {
      setError(null)

      const now = new Date()
      const session = {
        id: Date.now(),
        userId: userId,
        startTime: now.toISOString(),
        endTime: null,
        duration: 0,
        recordings: [],
        heartRateData: [],
        soundLevelData: [],
        notes: '',
        quality: null,
      }

      sessionRef.current = session
      setSessionActive(true)
      setSessionStartTime(now)
      setSessionData(session)

      // Save to localStorage
      localStorage.setItem('sleepSession', JSON.stringify(session))

      // Auto-save every minute
      const autoSaveInterval = setInterval(() => {
        if (sessionRef.current) {
          localStorage.setItem('sleepSession', JSON.stringify(sessionRef.current))
        }
      }, 60000) // Every minute

      // Store interval ID for cleanup
      sessionRef.current.autoSaveInterval = autoSaveInterval
    } catch (err) {
      setError(`Session start error: ${err.message}`)
    }
  }

  // End sleep session
  const endSession = async () => {
    try {
      if (!sessionRef.current) return

      // Clear auto-save
      if (sessionRef.current.autoSaveInterval) {
        clearInterval(sessionRef.current.autoSaveInterval)
      }

      const now = new Date()
      const startTime = new Date(sessionRef.current.startTime)
      const duration = now - startTime

      sessionRef.current.endTime = now.toISOString()
      sessionRef.current.duration = duration

      // Save final data
      localStorage.setItem('sleepSession', JSON.stringify(sessionRef.current))

      // Save to IndexedDB for permanent storage
      await saveSleepSessionToDB(sessionRef.current)

      setSessionActive(false)
      setSessionStartTime(null)

      return sessionRef.current
    } catch (err) {
      setError(`Session end error: ${err.message}`)
      return null
    }
  }

  // Save session to IndexedDB
  const saveSleepSessionToDB = async (session) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FormaSleepSessions', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['sessions'], 'readwrite')
        const store = transaction.objectStore('sessions')

        store.add(session)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      }

      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
      }
    })
  }

  // Add HR data to session
  const addHeartRateData = (hrData) => {
    if (sessionRef.current && sessionActive) {
      sessionRef.current.heartRateData.push({
        hr: hrData,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Add sound level to session
  const addSoundLevelData = (level) => {
    if (sessionRef.current && sessionActive) {
      sessionRef.current.soundLevelData.push({
        level: level,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Add recording to session
  const addRecording = (recordingId, duration) => {
    if (sessionRef.current && sessionActive) {
      sessionRef.current.recordings.push({
        id: recordingId,
        duration: duration,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Get session summary
  const getSessionSummary = () => {
    if (!sessionRef.current) return null

    const hrData = sessionRef.current.heartRateData
    const soundData = sessionRef.current.soundLevelData

    const avgHR = hrData.length > 0 ? Math.round(hrData.reduce((sum, d) => sum + d.hr, 0) / hrData.length) : 0
    const minHR = hrData.length > 0 ? Math.min(...hrData.map((d) => d.hr)) : 0
    const maxHR = hrData.length > 0 ? Math.max(...hrData.map((d) => d.hr)) : 0

    const avgSound = soundData.length > 0 ? Math.round(soundData.reduce((sum, d) => sum + d.level, 0) / soundData.length) : 0
    const maxSound = soundData.length > 0 ? Math.max(...soundData.map((d) => d.level)) : 0

    return {
      startTime: sessionRef.current.startTime,
      endTime: sessionRef.current.endTime,
      duration: sessionRef.current.duration,
      recordings: sessionRef.current.recordings.length,
      heartRate: { avg: avgHR, min: minHR, max: maxHR },
      soundLevel: { avg: avgSound, max: maxSound },
    }
  }

  return {
    sessionActive,
    elapsedTime,
    sessionData,
    error,
    startSession,
    endSession,
    addHeartRateData,
    addSoundLevelData,
    addRecording,
    getSessionSummary,
    setError,
  }
}
