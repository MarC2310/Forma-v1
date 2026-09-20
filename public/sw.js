// public/sw.js — Service Worker minimal pentru FORMA (PWA)
const CACHE = 'forma-cache-v2'
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Procesăm doar cererile GET same-origin
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Navigare (pagini) → network-first, fallback pe cache sau index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(async () => {
          const cached = await caches.match(req)
          if (cached) return cached
          const fallback = await caches.match('/index.html')
          if (fallback) return fallback
          // Ultimul refugiu pentru a preveni eroarea de tip Response
          return new Response('Network error happened', { status: 408, headers: { 'Content-Type': 'text/plain' } })
        })
    )
    return
  }

  // Restul resurselor statice → cache-first, cu fallback pe rețea
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Opțional: facem un fetch în fundal pentru actualizare (stale-while-revalidate simplificat)
        fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {})
          }
        }).catch(() => {})
        return cached
      }

      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => {
          // Returnăm un Response gol sau eroare controlată în loc să lăsăm promisiunea să eșueze
          return new Response('Resource not available offline', { status: 404, headers: { 'Content-Type': 'text/plain' } })
        })
    })
  )
})
