// src/lib/supabase.js — client Supabase singleton
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Lipsesc variabilele de mediu Supabase.\n' +
    'Copiază .env.example → .env și completează valorile din Supabase Dashboard.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Păstrează sesiunea în localStorage (persistă la refresh)
    persistSession: true,
    // Detectează automat sesiunea din URL după OAuth redirect
    detectSessionInUrl: true,
    // Redirect URL după autentificare
    flowType: 'pkce',
  },
})
