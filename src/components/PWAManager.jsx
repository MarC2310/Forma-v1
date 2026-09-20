// src/components/PWAManager.jsx — PWA Install + Push Notifications
import { useState, useEffect } from 'react'
import { useTheme, getColors } from '../lib/theme.jsx'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = 'BBWox1zJUJpeezZH6Pn6BRkZgFxql7C4CXkU3KfCCnHecCfuK0hZFrQLHSlf-gDF9fZxhN18cOFyX-cgYjLiUDA'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function PWAManager() {
  const { theme } = useTheme()
  const c = getColors(theme)

  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
        .catch(err => console.error('[PWA] SW registration failed:', err))

      // Navigare din notificări (handled și de NotificationBell, dus pentru robustețe)
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'NAVIGATE' && event.data?.url) {
          const url = event.data.url
          const safe = ['/dashboard', '/auth/'].some(u => url.startsWith(u))
          window.location.href = safe ? url : '/dashboard'
        }
      })
    }

    const handler = e => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function installApp() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setIsInstalled(true); setShowBanner(false) }
    setInstallPrompt(null)
  }

  if (showBanner && !isInstalled) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: c.card, borderTop: `0.5px solid ${c.border}`,
        padding: '1rem', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: c.green3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📲</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>Instalează FORMA</div>
          <div style={{ fontSize: 12, color: c.text3 }}>Acces rapid de pe ecranul principal Android</div>
        </div>
        <button onClick={installApp}
          style={{ padding: '8px 16px', background: c.green2, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Instalează
        </button>
        <button onClick={() => setShowBanner(false)}
          style={{ padding: '8px', background: 'transparent', border: 'none', color: c.text4, cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>✕</button>
      </div>
    )
  }
  return null
}

// Hook pentru funcții PWA din alte componente
export function usePWA() {
  const [notifStatus, setNotifStatus] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  )

  async function requestNotifications() {
    if (!('Notification' in window)) { alert('Browserul tău nu suportă notificări.'); return }
    const permission = await Notification.requestPermission()
    setNotifStatus(permission)
    if (permission === 'granted') {
      new Notification('🎉 FORMA — Notificări activate!', {
        body: 'Vei primi briefingul matinal și raportul de seară.',
        icon: '/icon-192.png',
      })
      try {
        console.log('[PWA] Starting push subscription...')
        const reg = await navigator.serviceWorker.ready
        console.log('[PWA] SW ready:', reg.scope)
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        })
        console.log('[PWA] Subscription created:', sub.endpoint)
        // Salvează subscription în Supabase pentru cron notifications
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        console.log('[PWA] User:', authData?.user?.id, 'authErr:', authErr?.message)
        if (authData?.user) {
          const { error: dbErr } = await supabase.from('push_subscriptions').upsert({
            user_id: authData.user.id,
            subscription: sub.toJSON(),
          }, { onConflict: 'user_id' })
          console.log('[PWA] DB save result:', dbErr ? 'ERROR: ' + dbErr.message : 'OK ✓')
        } else {
          console.warn('[PWA] No user found — cannot save subscription')
        }
      } catch (err) { console.warn('[PWA] Push subscription failed:', err.message, err) }
    }
    return permission
  }

  async function disableNotifications() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      // Sterge subscription din Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      }
      setNotifStatus('default')
      localStorage.setItem('forma-notif-disabled', 'true')
    } catch (e) {
      console.warn('Disable notifications:', e.message)
    }
  }

  async function toggleNotifications() {
    console.log('[PWA] toggleNotifications called, status:', notifStatus, 'Notification.permission:', Notification.permission)
    if (notifStatus === 'granted') {
      console.log('[PWA] Disabling notifications...')
      await disableNotifications()
    } else {
      console.log('[PWA] Enabling notifications...')
      localStorage.removeItem('forma-notif-disabled')
      await requestNotifications()
    }
  }

  return { notifStatus, requestNotifications, disableNotifications, toggleNotifications }
}
