import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [session, setSession]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [profileAvatar, setProfileAvatar] = useState(null) // din profiles table

  // Încarcă avatar din profiles (prioritate față de OAuth avatar)
  const loadProfileAvatar = useCallback(async (userId) => {
    if (!userId) return
    try {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single()
      if (data?.avatar_url) setProfileAvatar(data.avatar_url)
    } catch { /* avatar opțional */ }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user?.id) loadProfileAvatar(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        setError(null)
        if (session?.user?.id) loadProfileAvatar(session.user.id)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  async function signInWithEmail(email, password) {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    return { error }
  }

  async function signUpWithEmail(email, password, fullName) {
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
      },
    })
    if (error) setError(error.message)
    return { data, error }
  }

  async function signOut() {
    setError(null)
    const { error } = await supabase.auth.signOut()
    if (error) setError(error.message)
  }

  async function resetPassword(email) {
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${import.meta.env.VITE_APP_URL}/auth/reset-password`,
    })
    if (error) setError(error.message)
    return { error }
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    return { error }
  }

  // Apelat din Profile după upload reușit — actualizează avatarul în timp real
  function refreshAvatar(url) {
    setProfileAvatar(url)
  }

  // Prioritate: 1. avatar din profiles DB, 2. avatar OAuth (Google)
  const userAvatar = profileAvatar || user?.user_metadata?.avatar_url || null

  const value = {
    user, session, loading, error,
    signInWithGoogle, signInWithEmail, signUpWithEmail,
    signOut, resetPassword, updatePassword,
    refreshAvatar,
    isAuthenticated: !!user,
    userEmail:  user?.email,
    userName:   user?.user_metadata?.full_name || user?.user_metadata?.name,
    userAvatar,
  }

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth trebuie folosit in interiorul AuthProvider')
  return ctx
}
