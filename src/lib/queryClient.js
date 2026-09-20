// src/lib/queryClient.js
// Configurare globală React Query — un singur QueryClient pentru toată aplicația

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Date fresh timp de X minute — nu refetch în fereastra asta
      staleTime: 5 * 60 * 1000,        // 5 min default
      // Cache păstrat în memorie chiar dacă componenta e unmounted
      gcTime: 10 * 60 * 1000,          // 10 min
      // Retry o singură dată la eroare (nu de 3 ori ca default)
      retry: 1,
      // Nu refetch la focus window (deranjant pe mobile)
      refetchOnWindowFocus: false,
      // Refetch în background când conexiunea revine
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ── Query Keys centralizate ───────────────────────────────────────────────────
// Un singur loc pentru toate cheile — evită typo-uri și permite invalidare precisă
export const QUERY_KEYS = {
  // Date externe (cache lung)
  hevy:         (userId) => ['hevy', 'workouts', userId],
  withings:     (userId) => ['withings', 'all', userId],
  googleFit:    (userId) => ['googlefit', 'today', userId],
  intervals:    (userId, days) => ['intervals', 'data', userId, days],

  // Date Supabase (cache mediu)
  profile:      (userId) => ['profile', userId],
  nutrition:    (userId, date) => ['nutrition', userId, date],
  waterToday:   (userId, date) => ['water', userId, date],
  supplements:  (userId) => ['supplements', userId],
  suppLogs:     (userId, date) => ['supplement_logs', userId, date],
  injuries:     (userId) => ['injuries', userId],
  subjective:   (userId, date) => ['subjective', userId, date],
  healthScore:  (userId, date) => ['health_score', userId, date],
  aiReports:    (userId) => ['ai_reports', userId],
  bodyMeasurements: (userId) => ['body_measurements', userId],
}

// ── Stale times per tip de dată ───────────────────────────────────────────────
export const STALE_TIMES = {
  hevy:       30 * 60 * 1000,   // 30 min — fetch complet al istoricului, nu repetăm des
  withings:   30 * 60 * 1000,   // 30 min — sync 1x/zi
  googleFit:  5  * 60 * 1000,   // 5 min  — pași/calorii se actualizează
  intervals:  30 * 60 * 1000,   // 30 min — sync 1x/zi
  profile:    10 * 60 * 1000,   // 10 min — se schimbă rar
  nutrition:  2  * 60 * 1000,   // 2 min  — utilizatorul adaugă mese frecvent
  water:      0,                 // 0 = mereu fresh (Realtime o gestionează)
  supplements:5  * 60 * 1000,   // 5 min
}
