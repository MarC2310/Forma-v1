// src/lib/intervals.js — Client wrapper pentru Intervals.icu (HRV, somn, puls repaus, CTL/ATL nativ)
import { supabase } from './supabase'

export async function fetchIntervalsData(userId, daysBack) {
  const { data, error } = await supabase.functions.invoke('intervals-data', {
    body: { userId, daysBack }
  })
  if (error) throw new Error(error.message)
  if (!data?.ok) throw new Error(data?.error || 'Eroare Intervals.icu')
  return data.data
}
