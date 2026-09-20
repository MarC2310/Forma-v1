// src/components/NotificationBell.jsx — Centru de notificări cu badge
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import { supabase } from '../lib/supabase'

export default function NotificationBell({ transparent }) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const c = getColors(theme)

  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)
  const bellRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (user?.id) loadNotifications()
  }, [user])

  // Realtime: preia notificări noi instant când sunt inserate în DB
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('notifications-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => {
          // evităm duplicate
          if (prev.find(n => n.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  // Ascultă mesaje de la service worker (notificări noi push)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function handleMessage(event) {
      if (event.data?.type === 'NEW_NOTIFICATION') {
        saveNotification(event.data.title, event.data.body, event.data.url)
      }
      if (event.data?.type === 'NAVIGATE') {
        const url = event.data.url || '/dashboard'
        const safe = ['/dashboard', '/auth/'].some(u => url.startsWith(u))
        window.location.href = safe ? url : '/dashboard'
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [user])

  // Click în afara panoului îl închide
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target) && bellRef.current && !bellRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Actualizează badge-ul nativ Android la fiecare schimbare
  useEffect(() => {
    updateAppBadge(unreadCount)
  }, [unreadCount])

  function updateAppBadge(count) {
    if ('setAppBadge' in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {})
      else navigator.clearAppBadge().catch(() => {})
    }
  }

  async function loadNotifications() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (data) setNotifications(data)
    } catch (err) { console.warn('Load notifications:', err.message) }
    finally { setLoading(false) }
  }

  async function saveNotification(title, body, url) {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('notifications')
        .insert({ user_id: user.id, title, body, url: url || '/dashboard' })
        .select()
        .single()
      if (data) setNotifications(prev => [data, ...prev])
    } catch (err) { console.warn('Save notification:', err.message) }
  }

  async function markAsRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    } catch (err) { console.warn(err) }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    } catch (err) { console.warn(err) }
    // Șterge și badge-ul nativ
    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {})
  }

  async function deleteNotification(id, e) {
    e.stopPropagation()
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await supabase.from('notifications').delete().eq('id', id)
    } catch (err) { console.warn(err) }
  }

  function handleBellClick() {
    setIsOpen(prev => !prev)
    if (!isOpen) {
      // La deschidere, marchează toate ca citite și șterge badge-ul
      markAllAsRead()
    }
  }

  function handleNotificationClick(notif) {
    if (!notif.read) markAsRead(notif.id)
    setIsOpen(false)
    if (notif.url) window.location.href = notif.url
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'acum'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}z`
  }

  return (
    <div style={{ position: 'relative' }}>
      <button ref={bellRef} onClick={handleBellClick}
        style={{ position: 'relative', width: 36, height: 36, borderRadius: c.radiusSm, background: transparent ? 'transparent' : c.card, border: 'none', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: transparent ? 'none' : c.shadowCard }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: c.red, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: `1.5px solid ${c.bg}` }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div ref={panelRef} style={{
          position: 'absolute', left: 0, top: 40, width: 320, maxWidth: '90vw',
          background: c.card3, border: 'none', borderRadius: c.radius, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 150, overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: `0.5px solid ${c.border2}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Notificări</div>
            {notifications.length > 0 && (
              <button onClick={async () => {
                setNotifications([])
                try { await supabase.from('notifications').delete().eq('user_id', user.id) } catch {}
              }} style={{ fontSize: 11, color: c.text4, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Șterge tot
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontSize: 12, color: c.text4 }}>Se încarcă...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 12, color: c.text4 }}>Nicio notificare încă</div>
              </div>
            ) : (
              notifications.map(notif => (
                <div key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{ display: 'flex', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: `0.5px solid ${c.border2}`, background: notif.read ? 'transparent' : c.green3 + '33' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: notif.read ? 'transparent' : c.green, marginTop: 5, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: notif.read ? 400 : 600, color: c.text }}>{notif.title}</div>
                    {notif.body && <div style={{ fontSize: 12, color: c.text3, marginTop: 2, lineHeight: 1.4 }}>{notif.body}</div>}
                    <div style={{ fontSize: 10, color: c.text4, marginTop: 4 }}>{timeAgo(notif.created_at)}</div>
                  </div>
                  <button onClick={e => deleteNotification(notif.id, e)}
                    style={{ fontSize: 12, color: c.text4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, height: 'fit-content' }}>✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
