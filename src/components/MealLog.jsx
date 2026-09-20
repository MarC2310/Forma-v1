// src/components/MealLog.jsx — v3.3 cu suport complet pentru upsert favorite, upload/schimbare poză și buton export pe rând
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import MacroRingCard from './MacroRingCard'

const TRASH_W = 80   // latimea zonei rosii revelata la swipe

function fmtTime(t) { return t ? t.slice(0, 5) : '' }

// ── Modal detaliu masă (readonly + upload/schimbare poză) ─────────────────────────────────────
function MealDetailModal({ meal, onClose, onUpdate, c, isDark }) {
  const { user } = useAuth()
  const [favState, setFavState] = useState('idle') // idle | saving | saved | error
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef(null)

  // ── Editare oră/dată (înregistrare retroactivă) ──
  const [editT, setEditT] = useState(false)
  const [tVal, setTVal] = useState((meal.time || '').slice(0, 5))
  const [dVal, setDVal] = useState(meal.date || new Date().toISOString().slice(0, 10))
  const [tSaving, setTSaving] = useState(false)

  async function saveTime() {
    if (!user?.id || tSaving) return
    setTSaving(true)
    try {
      const patch = { time: tVal ? (tVal.length === 5 ? tVal + ':00' : tVal) : null, date: dVal || meal.date }
      const { error } = await supabase.from('meal_entries').update(patch).eq('id', meal.id)
      if (!error) { onUpdate?.(); onClose?.() }
    } catch (e) { console.error('[edit meal time]', e) }
    finally { setTSaving(false) }
  }

  let data = null
  try { data = meal.meta_json ? JSON.parse(meal.meta_json) : null } catch (_) {}
  if (!data) {
    data = {
      name: meal.name, calories: meal.calories,
      protein_g: meal.protein_g, carbs_g: meal.carbs_g,
      fat_g: meal.fat_g, fiber_g: meal.fiber_g,
      sodium_mg: meal.sodium_mg,
    }
  }
  // Suprascriem image_url din meta_json daca e disponibila
  if (!data.image_url && meal.image_url) data.image_url = meal.image_url

  const currentImageUrl = meal.image_url || data.image_url || null

  // ── Funcție pentru upload/înlocuire poză masă ──
  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploadingPhoto(true)
    try {
      const ext = (file.type || 'image/jpeg').split('/')[1] || 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      
      const { error: upErr } = await supabase.storage
        .from('food-images')
        .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
      
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('food-images').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) throw new Error('Nu s-a putut obține URL-ul public al pozei.')

      // Actualizăm imaginea și în meta_json pentru consistență
      let updatedMeta = data
      updatedMeta.image_url = publicUrl

      const patch = {
        image_url: publicUrl,
        meta_json: JSON.stringify(updatedMeta)
      }

      const { error: updateErr } = await supabase.from('meal_entries').update(patch).eq('id', meal.id)
      if (updateErr) throw updateErr

      // Actualizăm obiectul local pentru randare imediată
      meal.image_url = publicUrl
      data.image_url = publicUrl
      onUpdate?.()
    } catch (err) {
      console.error('[MealLog photo upload]', err)
      alert('Eroare la încărcarea pozei. Încearcă din nou.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // ── Adaugă sau actualizează masa curentă în preferate (favorite_foods cu UPSERT) ──
  async function saveToFavorites() {
    if (!user?.id || favState === 'saving' || favState === 'saved') return
    setFavState('saving')
    try {
      const name = (meal.name || data.name || 'Produs').trim()
      const imageUrl = currentImageUrl
      
      const fields = {
        user_id:      user.id,
        name:         name,
        image_url:    imageUrl,
        calories:     Math.round(meal.calories ?? data.calories ?? 0),
        protein_g:    meal.protein_g ?? data.protein_g ?? 0,
        carbs_g:      meal.carbs_g   ?? data.carbs_g   ?? 0,
        fat_g:        meal.fat_g     ?? data.fat_g     ?? 0,
        fiber_g:      meal.fiber_g   ?? data.fiber_g   ?? 0,
        portion_desc: data.portion_desc || null,
        meta_json:    meal.meta_json || (data ? JSON.stringify(data) : null),
        quality_score: meal.quality_score ?? data.quality_score ?? data.score ?? null,
        score:         meal.score ?? data.score ?? data.quality_score ?? null,
      }

      // Verificăm dacă există deja un favorit cu același nume pentru acest user
      const { data: existing } = await supabase
        .from('favorite_foods')
        .select('id, use_count')
        .eq('user_id', user.id)
        .eq('name', name)
        .maybeSingle()

      let error = null

      if (existing?.id) {
        // Dacă există, facem UPDATE pe rândul existent pentru a actualiza structura și ingredientele
        const { error: updateErr } = await supabase
          .from('favorite_foods')
          .update({
            ...fields,
            use_count: (existing.use_count || 1) + 1
          })
          .eq('id', existing.id)
        error = updateErr
      } else {
        // Dacă nu există, facem INSERT curat
        const { error: insertErr } = await supabase
          .from('favorite_foods')
          .insert({
            ...fields,
            use_count: 1
          })
        error = insertErr
      }

      if (error) throw error
      setFavState('saved')
    } catch (e) {
      console.error('[fav from journal error]', e)
      setFavState('error')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: isDark ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.55)',
      overflowY: 'auto',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: c.bg, minHeight: '100dvh',
        maxWidth: 480, margin: '0 auto', width: '100%', fontFamily: c.fontFamily,
      }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, background: c.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px', borderBottom: `0.5px solid ${c.border}`,
        }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: c.text3,
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}>← Inapoi</button>
          <div style={{
            fontSize: 14, fontWeight: 700, color: c.text,
            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{meal.name || 'Detalii masa'}</div>
          <div style={{ fontSize: 12, color: c.text4 }}>{fmtTime(meal.time)}</div>
        </div>
        <div style={{ padding: '16px' }}>
          
          {/* Zona Poză (afișare sau buton adăugare dacă lipsește) */}
          <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', background: isDark ? 'rgba(255,255,255,0.04)' : '#F0EAE0', textAlign: 'center', position: 'relative' }}>
            {currentImageUrl ? (
              <div style={{ position: 'relative' }}>
                <img src={currentImageUrl} alt={meal.name || 'masa'}
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}/>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} style={{
                  position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                }}>
                  {uploadingPhoto ? 'Se încarcă...' : '📷 Schimbă poza'}
                </button>
              </div>
            ) : (
              <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ fontSize: 13, color: c.text3 }}>Această masă nu are nicio poză atașată.</div>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} style={{
                  padding: '10px 18px', background: c.green2 || '#97C459', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
                }}>
                  {uploadingPhoto ? 'Se încarcă...' : '+ Adaugă poză'}
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload}/>
          </div>

          <MacroRingCard data={data} readonly={true} quantity={1} c={c} isDark={isDark}/>

          {/* Adaugă / Actualizează în preferate */}
          <button onClick={saveToFavorites} disabled={favState === 'saving' || favState === 'saved'}
            style={{
              width: '100%', marginTop: 14, padding: '13px',
              background: favState === 'saved' ? (isDark ? 'rgba(151,196,89,0.15)' : '#EEF7E0') : (c.gradGreen || '#97C459'),
              border: favState === 'saved' ? `1px solid ${c.green2 || '#97C459'}` : 'none',
              borderRadius: c.radiusSm || 10,
              color: favState === 'saved' ? (c.green2 || '#97C459') : '#16291A',
              fontSize: 14, fontWeight: 700, cursor: favState === 'saved' ? 'default' : 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {favState === 'saved' ? '★ Actualizat în favorite'
              : favState === 'saving' ? 'Se salvează...'
              : '★ Adaugă / Actualizează în favorite'}
          </button>
          {favState === 'error' && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: isDark ? 'rgba(248,113,113,0.12)' : '#FDECEC', fontSize: 12, color: '#F87171', textAlign: 'center' }}>
              ⚠ Nu s-a putut salva în preferate.
            </div>
          )}

          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#F5F0E8',
            fontSize: 12, color: c.text4, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{meal.source === 'photo' ? 'Scanata cu AI' : meal.source === 'favorite' ? 'Din preferate' : 'Introdusa manual'}</span>
            <button onClick={() => setEditT(o => !o)}
              style={{ background: 'transparent', border: 'none', color: c.green2, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {meal.date}{meal.time ? ' · ' + fmtTime(meal.time) : ''} ✏️
            </button>
          </div>

          {/* Editare oră + dată (înregistrare retroactivă) */}
          {editT && (
            <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : '#EFEAE0' }}>
              <div style={{ fontSize: 11, color: c.text4, marginBottom: 8, fontWeight: 600 }}>Modifică data și ora înregistrării</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input type="date" value={dVal} onChange={e => setDVal(e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: isDark ? 'rgba(255,255,255,0.08)' : '#fff', border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, padding: '8px 10px', fontFamily: 'inherit' }}/>
                <input type="time" value={tVal} onChange={e => setTVal(e.target.value)}
                  style={{ width: 120, background: isDark ? 'rgba(255,255,255,0.08)' : '#fff', border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, padding: '8px 10px', fontFamily: 'inherit' }}/>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditT(false)}
                  style={{ flex: '0 0 auto', padding: '9px 16px', background: 'transparent', border: `1px solid ${c.border}`, borderRadius: 9, color: c.text3, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Anulează</button>
                <button onClick={saveTime} disabled={tSaving}
                  style={{ flex: 1, padding: '9px', background: c.green2, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {tSaving ? 'Se salvează...' : '✓ Salvează ora/data'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card cu swipe-to-delete ───────────────────────────────────────────
function SwipeCard({ meal, c, isDark, onDelete, onDetail, onExport, isDeleting }) {
  const [open, setOpen]   = useState(false)
  const [offset, setOffset] = useState(0)
  const touch = useRef(null)

  function onTouchStart(e) {
    const t = e.touches[0]
    touch.current = { startX: t.clientX, startY: t.clientY, moved: false }
  }

  function onTouchMove(e) {
    if (!touch.current) return
    const t = e.touches[0]
    const dx = touch.current.startX - t.clientX
    const dy = Math.abs(touch.current.startY - t.clientY)
    if (dy > dx && !touch.current.moved) return    // scroll vertical
    touch.current.moved = true
    if (open) {
      const raw = TRASH_W + (touch.current.startX - t.clientX)
      setOffset(Math.max(0, Math.min(TRASH_W, raw)))
    } else {
      if (dx > 0) {
        setOffset(Math.min(dx, TRASH_W))
      }
    }
  }

  function onTouchEnd() {
    if (!touch.current) return
    if (offset > TRASH_W * 0.45) {
      setOpen(true)
      setOffset(TRASH_W)
    } else {
      setOpen(false)
      setOffset(0)
    }
    touch.current = null
  }

  function handleCardClick() {
    if (touch.current?.moved) return
    if (open) { setOpen(false); setOffset(0); return }
    onDetail()
  }

  let imageUrl = meal.image_url || null
  if (!imageUrl && meal.meta_json) {
    try { imageUrl = JSON.parse(meal.meta_json)?.image_url || null } catch(_) {}
  }

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 6 }}>
      {/* Zona rosie cos gunoi */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: TRASH_W,
        background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', borderRadius: '0 12px 12px 0',
      }} onClick={isDeleting ? undefined : onDelete}>
        {isDeleting
          ? <span style={{ fontSize: 18, color: '#fff' }}>...</span>
          : <span style={{ fontSize: 26 }}>🗑️</span>
        }
      </div>

      {/* Card — gliseaza stanga */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          transform: `translateX(-${offset}px)`,
          transition: touch.current ? 'none' : 'transform 0.22s ease',
          background: c.card || (isDark ? '#1C1C1E' : '#fff'),
          border: `0.5px solid ${c.border}`,
          borderRadius: 12,
          display: 'flex', alignItems: 'stretch', cursor: 'pointer', overflow: 'hidden',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleCardClick}
      >
        {/* Thumbnail */}
        <div style={{
          width: 68, height: 68, flexShrink: 0,
          background: isDark ? 'rgba(255,255,255,0.06)' : '#EDE6DB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {imageUrl
            ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            : <span style={{ fontSize: 26 }}>
                {meal.source === 'favorite' ? '★' : meal.source === 'photo' ? '🍽️' : '🥗'}
              </span>
          }
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: c.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4,
          }}>
            {meal.name || 'Masa fotografiata'}
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, flexWrap: 'wrap' }}>
            {meal.time && <span style={{ color: c.text4 }}>{fmtTime(meal.time)}</span>}
            {meal.protein_g > 0 && <span style={{ color: '#6fa832', fontWeight: 500 }}>P {Math.round(meal.protein_g)}g</span>}
            {meal.carbs_g  > 0 && <span style={{ color: '#3d6fa8', fontWeight: 500 }}>C {Math.round(meal.carbs_g)}g</span>}
            {meal.fat_g    > 0 && <span style={{ color: '#c28010', fontWeight: 500 }}>G {Math.round(meal.fat_g)}g</span>}
          </div>
        </div>

        {/* Calorii + Buton Export + chevron */}
        <div style={{
          flexShrink: 0, padding: '10px 10px 10px 6px',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Buton Export (📤) pe rând */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport?.(meal);
              }}
              title="Exportă produs"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 14, padding: '2px 4px', display: 'flex', alignItems: 'center'
              }}
            >
              📤
            </button>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{Math.round(meal.calories || 0)}</div>
          </div>
          <div style={{ fontSize: 10, color: c.text4, marginBottom: 4 }}>kcal</div>
          <span style={{ fontSize: 16, color: c.text4, lineHeight: 1 }}>›</span>
        </div>
      </div>
    </div>
  )
}

// ── Componentă principală ─────────────────────────────────────────────
export default function MealLog({
  c,
  date,
  onTotalsChange,
  onUpdate,
  onDelete,
  onExportMeal,
  meals: mealsProp,
  loading: loadingProp,
}) {
  const { user } = useAuth()
  const isDark = !!(c.bg && (c.bg.startsWith('#0') || c.bg.startsWith('#1') || c.bg.startsWith('#2')))

  const [meals, setMeals]             = useState(mealsProp || [])
  const [loading, setLoading]         = useState(loadingProp || false)
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [deletingId, setDeletingId]   = useState(null)

  useEffect(() => {
    if (mealsProp !== undefined) {
      setMeals(mealsProp)
      emitTotals(mealsProp)
    }
  }, [mealsProp])

  useEffect(() => {
    if (mealsProp !== undefined) return
    if (!user?.id || !date) return
    fetchMeals()
  }, [user, date])

  async function fetchMeals() {
    setLoading(true)
    try {
      const { data } = await supabase.from('meal_entries').select('*')
        .eq('user_id', user.id).eq('date', date).order('time', { ascending: true })
      const list = data || []
      setMeals(list)
      emitTotals(list)
    } catch (err) { console.warn('[MealLog]', err); setMeals([]) }
    finally { setLoading(false) }
  }

  function emitTotals(list) {
    if (!onTotalsChange) return
    const t = (list || []).reduce((acc, m) => ({
      calories:  acc.calories  + (m.calories  || 0),
      protein_g: acc.protein_g + (m.protein_g || 0),
      carbs_g:   acc.carbs_g   + (m.carbs_g   || 0),
      fat_g:     acc.fat_g     + (m.fat_g     || 0),
      fiber_g:   acc.fiber_g   + (m.fiber_g   || 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 })
    onTotalsChange(t)
  }

  async function deleteMeal(id) {
    setDeletingId(id)
    try {
      await supabase.from('meal_entries').delete().eq('id', id)
      const updated = meals.filter(m => m.id !== id)
      setMeals(updated)
      emitTotals(updated)
      onDelete?.()
    } catch (err) { console.error('[MealLog delete]', err) }
    finally { setDeletingId(null) }
  }

  // Funcție locală de export dacă nu este pasată ca prop
  function handleDefaultExport(meal) {
    const exportData = JSON.stringify({
      name: meal.name,
      calories: meal.calories,
      protein_g: meal.protein_g || meal.protein || 0,
      carbs_g: meal.carbs_g || meal.carbs || 0,
      fat_g: meal.fat_g || meal.fat || 0,
      fiber_g: meal.fiber_g || meal.fiber || 0,
      total_weight_g: meal.total_weight_g || null,
      image_url: meal.image_url || null,
      meta_json: meal.meta_json || null,
      quality_score: meal.quality_score || null,
      score: meal.score || null
    });
    navigator.clipboard.writeText(exportData);
    alert(`Masa „${meal.name || 'Produs'}" a fost copiată în clipboard! Poți s-o trimiți prietenului.`);
  }

  const totals = meals.reduce((acc, m) => ({
    calories:  acc.calories  + (m.calories  || 0),
    protein_g: acc.protein_g + (m.protein_g || 0),
    carbs_g:   acc.carbs_g   + (m.carbs_g   || 0),
    fat_g:     acc.fat_g     + (m.fat_g     || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: c.text4, fontSize: 13 }}>
      Se incarca mesele...
    </div>
  )

  if (meals.length === 0) return (
    <div style={{
      textAlign: 'center', padding: '24px 16px', color: c.text4, fontSize: 13,
      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
      borderRadius: 10,
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🍽️</div>
      Nicio masa inregistrata inca.
    </div>
  )

  return (
    <>
      <div>
        {meals.map(meal => (
          <SwipeCard
            key={meal.id}
            meal={meal}
            c={c}
            isDark={isDark}
            isDeleting={deletingId === meal.id}
            onDelete={() => deleteMeal(meal.id)}
            onDetail={() => setSelectedMeal(meal)}
            onExport={onExportMeal || handleDefaultExport}
          />
        ))}

        {/* Total jurnal */}
        {meals.length > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 4px 0',
            borderTop: `0.5px solid ${c.border}`,
            marginTop: 2, fontSize: 12,
          }}>
            <span style={{ color: c.text4 }}>{meals.length} mese</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: '#6fa832', fontWeight: 500 }}>P {Math.round(totals.protein_g)}g</span>
              <span style={{ color: '#3d6fa8', fontWeight: 500 }}>C {Math.round(totals.carbs_g)}g</span>
              <span style={{ color: '#c28010', fontWeight: 500 }}>G {Math.round(totals.fat_g)}g</span>
              <span style={{ fontWeight: 700, color: c.text }}>{Math.round(totals.calories)} kcal</span>
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: c.text4, textAlign: 'center', marginTop: 10, opacity: 0.6 }}>
          Gliseaza stanga pentru stergere · Tap pentru detalii
        </div>
      </div>

      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          onClose={() => setSelectedMeal(null)}
          onUpdate={() => { fetchMeals(); onUpdate?.() }}
          c={c}
          isDark={isDark}
        />
      )}
    </>
  )
}
