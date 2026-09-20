// forma-app-main/src/hooks/useBLEHeartRate.js
import { useState, useRef, useCallback, useEffect } from 'react'

const HR_SERVICE    = 'heart_rate'
const HR_CHAR       = 'heart_rate_measurement'
const BAT_SERVICE   = 'battery_service'
const BAT_CHAR      = 'battery_level'
const STORAGE_KEY   = 'ble_hr_history'
const SAVE_INTERVAL = 5 * 60 * 1000   
const LIVE_INTERVAL = 5 * 1000        
const LIVE_MAX_PTS  = 720             

function parseHRM(dataView) {
  const flags   = dataView.getUint8(0)
  const is16bit = (flags & 0x01) !== 0
  return is16bit ? dataView.getUint16(1, true) : dataView.getUint8(1)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return data[todayKey()] || []
  } catch { return [] }
}

function saveHistoryPoint(hr) {
  try {
    const raw  = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const key  = todayKey()
    if (!data[key]) data[key] = []
    const hour = new Date().getHours() + new Date().getMinutes() / 60
    data[key].push({ hr, hour, ts: Date.now() })
    const clean = {}
    Object.keys(data).sort().reverse().slice(0, 7).forEach(k => { clean[k] = data[k] })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch {}
}

export function getBLEHRData() {
  return loadHistory()
}

export function useBLEHeartRate() {
  const [status, setStatus]             = useState('disconnected')
  const [hr, setHr]                     = useState(null)
  const [battery, setBattery]           = useState(null)
  const [deviceName, setDeviceName]     = useState(null)
  const [hrHistory, setHrHistory]       = useState(loadHistory)
  const [hrLive, setHrLive]             = useState([])   
  const [lastSync, setLastSync]         = useState(null)
  const [error, setError]               = useState(null)
  const [autoConnecting, setAutoConnecting] = useState(false)

  const deviceRef       = useRef(null)
  const hrCharRef       = useRef(null)
  const saveTimerRef    = useRef(null)
  const reconnTimerRef  = useRef(null)
  const mountedRef      = useRef(true)
  const liveBufferRef   = useRef([])        
  const lastLiveTsRef   = useRef(0)         

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(reconnTimerRef.current)
      clearInterval(saveTimerRef.current)
    }
  }, [])

  function clearLiveBuffer() {
    liveBufferRef.current = []
    lastLiveTsRef.current = 0
    setHrLive([])
  }

  function startSaveTimer() {
    clearInterval(saveTimerRef.current)
    saveTimerRef.current = setInterval(() => {
      setHr(current => {
        if (current) {
          saveHistoryPoint(current)
          setHrHistory(loadHistory())
          const now = new Date()
          setLastSync(
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0')
          )
        }
        return current
      })
    }, SAVE_INTERVAL)
  }

  const handleHRChange = useCallback((event) => {
    if (!mountedRef.current) return
    const bpm = parseHRM(event.target.value)
    setHr(bpm)
    setError(null)

    const now = Date.now()
    if (now - lastLiveTsRef.current >= LIVE_INTERVAL) {
      lastLiveTsRef.current = now
      const newPt = { hr: bpm, ts: now }
      liveBufferRef.current = [
        ...liveBufferRef.current.slice(-(LIVE_MAX_PTS - 1)),
        newPt
      ]
      setHrLive([...liveBufferRef.current])
    }
  }, [])

  const reconnect = useCallback(async (device) => {
    if (!mountedRef.current) return
    setAutoConnecting(true)
    try {
      const server  = await device.gatt.connect()
      if (!mountedRef.current) return
      const service = await server.getPrimaryService(HR_SERVICE)
      const hrChar  = await service.getCharacteristic(HR_CHAR)
      hrCharRef.current = hrChar
      await hrChar.startNotifications()
      hrChar.addEventListener('characteristicvaluechanged', handleHRChange)
      try {
        const batSvc  = await server.getPrimaryService(BAT_SERVICE)
        const batChar = await batSvc.getCharacteristic(BAT_CHAR)
        const val     = await batChar.readValue()
        if (mountedRef.current) setBattery(val.getUint8(0))
      } catch {}
      if (mountedRef.current) {
        setStatus('connected')
        setAutoConnecting(false)
        startSaveTimer()
      }
    } catch {
      if (!mountedRef.current) return
      setAutoConnecting(false)
      reconnTimerRef.current = setTimeout(() => {
        if (mountedRef.current && deviceRef.current) reconnect(deviceRef.current)
      }, 5000)
    }
  }, [handleHRChange])

  const handleDisconnect = useCallback(() => {
    if (!mountedRef.current) return
    setStatus('disconnected')
    setHr(null)
    clearLiveBuffer()
    clearInterval(saveTimerRef.current)
    if (hrCharRef.current) {
      hrCharRef.current.removeEventListener('characteristicvaluechanged', handleHRChange)
      hrCharRef.current = null
    }
    if (deviceRef.current) {
      reconnTimerRef.current = setTimeout(() => {
        if (mountedRef.current && deviceRef.current) reconnect(deviceRef.current)
      }, 2000)
    }
  }, [handleHRChange, reconnect])

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth nu este suportat. Folositi Chrome sau Edge pe HTTPS.')
      return
    }
    setError(null)
    setStatus('connecting')
    clearLiveBuffer()
    try {
      let device;
      // Încercăm mai întâi să preluăm dispozitivele deja asociate anterior de browser (fără ferestre inutile)
      const knownDevices = await navigator.bluetooth.getDevices?.() || [];
      if (knownDevices.length > 0) {
        device = knownDevices.find(d => d.name?.toLowerCase().includes('helio') || d.name?.toLowerCase().includes('polar') || d.name);
      }
      
      if (!device) {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ services: [HR_SERVICE] }],
          optionalServices: [BAT_SERVICE],
        })
      }

      deviceRef.current = device
      setDeviceName(device.name || 'Dispozitiv BLE')
      device.addEventListener('gattserverdisconnected', handleDisconnect)

      const server  = await device.gatt.connect()
      const service = await server.getPrimaryService(HR_SERVICE)
      const hrChar  = await service.getCharacteristic(HR_CHAR)
      hrCharRef.current = hrChar
      await hrChar.startNotifications()
      hrChar.addEventListener('characteristicvaluechanged', handleHRChange)

      try {
        const batSvc  = await server.getPrimaryService(BAT_SERVICE)
        const batChar = await batSvc.getCharacteristic(BAT_CHAR)
        const val     = await batChar.readValue()
        setBattery(val.getUint8(0))
      } catch {}

      setStatus('connected')
      startSaveTimer()
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setStatus('disconnected')
      } else {
        setError(err.message || 'Eroare la conectare BLE.')
        setStatus('error')
      }
    }
  }, [handleHRChange, handleDisconnect])

  const disconnect = useCallback(async () => {
    clearTimeout(reconnTimerRef.current)
    clearInterval(saveTimerRef.current)
    if (hrCharRef.current) {
      hrCharRef.current.removeEventListener('characteristicvaluechanged', handleHRChange)
      try { await hrCharRef.current.stopNotifications() } catch {}
      hrCharRef.current = null
    }
    if (deviceRef.current) {
      deviceRef.current.removeEventListener('gattserverdisconnected', handleDisconnect)
      if (deviceRef.current.gatt?.connected) deviceRef.current.gatt.disconnect()
      deviceRef.current = null
    }
    setStatus('disconnected')
    setHr(null)
    setBattery(null)
    setAutoConnecting(false)
    clearLiveBuffer()
  }, [handleHRChange, handleDisconnect])

  return { status, deviceName, hr, battery, hrHistory, hrLive, lastSync, error, autoConnecting, connect, disconnect }
}
