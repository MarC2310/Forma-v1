// src/components/OnboardingWrapper.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import { supabase } from '../lib/supabase'
import OnboardingFlow from './OnboardingFlow'

export default function OnboardingWrapper({ children }) {
  const { user, isAuthenticated } = useAuth()
  const { theme } = useTheme()
  const c = getColors(theme)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !user?.id) { setChecked(true); return }

    supabase.from('profiles')
      .select('goal')           // doar 'goal' — coloana garantat existentă
      .eq('id', user.id)
      .maybeSingle()            // maybeSingle nu dă 406 dacă nu găsește
      .then(({ data, error }) => {
        if (error) {
          // La eroare DB nu blocăm utilizatorul — sărim onboarding
          setChecked(true); return
        }
        // Onboarding necesar doar dacă nu are obiectiv setat
        setNeedsOnboarding(!data?.goal)
        setChecked(true)
      })
  }, [user?.id, isAuthenticated])

  if (!checked) return null

  if (isAuthenticated && needsOnboarding) {
    return (
      <OnboardingFlow
        userId={user.id}
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''}
        c={c}
        onComplete={() => setNeedsOnboarding(false)}
      />
    )
  }

  return children
}
