// src/components/FoodPhotoAnalyzer.jsx — v2.3.4 cu catalog comun de favorite (fără constrângere strictă user_id)
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import MacroRingCard from './MacroRingCard'

const DEFAULT_TARGETS = {
  calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, fiber_g: 30,
}

const KNOWN_MICROS_DB = {
  'ouă fierte': {
    vitamins: [
      { name: 'Vitamina A', val: '540 mcg', pct: '60%' },
      { name: 'Vitamina D', val: '4.4 mcg (176 UI)', pct: '22%' },
      { name: 'Vitamina E', val: '2.1 mg', pct: '14%' },
      { name: 'Vitamina K', val: '0.3 mcg', pct: '0.4%' },
      { name: 'Vitamina B6', val: '0.2 mg', pct: '15%' },
      { name: 'Vitamina B12', val: '2.4 mcg', pct: '100%' },
      { name: 'Vitamina C', val: '0 mg', pct: '0%' },
      { name: 'Folat (B9)', val: '88 mcg', pct: '22%' },
      { name: 'Niacin (B3)', val: '0.1 mg', pct: '1%' },
      { name: 'Thiamin (B1)', val: '0.04 mg', pct: '3%' },
      { name: 'Riboflavin (B2)', val: '0.9 mg', pct: '70%' },
      { name: 'Biotin (B7)', val: '20 mcg', pct: '67%' },
      { name: 'Acid pantotenic (B5)', val: '2.8 mg', pct: '56%' },
      { name: 'Colină', val: '580 mg', pct: '105%' },
    ],
    minerals: [
      { name: 'Potasiu', val: '140 mg', pct: '4%' },
      { name: 'Calciu', val: '56 mg', pct: '6%' },
      { name: 'Fier', val: '2.4 mg', pct: '13%' },
      { name: 'Magneziu', val: '12 mg', pct: '3%' },
      { name: 'Zinc', val: '2.6 mg', pct: '24%' },
      { name: 'Fosfor', val: '400 mg', pct: '57%' },
      { name: 'Seleniu', val: '62 mcg', pct: '112%' },
      { name: 'Cupru', val: '0.1 mg', pct: '11%' },
      { name: 'Mangan', val: '0.03 mg', pct: '1%' },
    ],
    antioxidants: [
      { name: 'Luteină + Zeaxantină', val: '700 mcg' }
    ]
  }
}

export default function FoodPhotoAnalyzer({
  c: cProp,
  onClose,
  onAddToLog,
  targets: targetsProp,
  date,
}) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const c    = cProp || getColors(theme)
  const isDark = theme === 'dark'
  const targets = targetsProp || DEFAULT_TARGETS
  const selectedDate = date || new Date().toISOString().slice(0, 10)

  const fileRef   = useRef(null)
  const cameraRef = useRef(null)

  const [phase, setPhase]        = useState('idle')
  const [preview, setPreview]     = useState(null)
  const [result, setResult]       = useState(null)
  const [quantity, setQuantity]   = useState(1)
  const [error, setError]         = useState(null)
  const [favSaved, setFavSaved]   = useState(false)
  const [favError, setFavError]   = useState(null)
  const [lastBase64, setLastBase64]        = useState(null)
  const [lastMediaType, setLastMediaType] = useState(null)
  const uploadedUrlRef = useRef(null)

  const manualPhotoRef = useRef(null)
  const [manualForm, setManualForm] = useState({
    name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', sodium_mg: '',
    items: [{ name: '', weight_g: '' }],
  })

  function attachMicronutrientsIfNeeded(dataObj) {
    if (!dataObj) return dataObj
    
    const nameLower = (dataObj.name || '').toLowerCase()
    let matchedMicros = null

    for (const key in KNOWN_MICROS_DB) {
      if (nameLower.includes(key)) {
        matchedMicros = KNOWN_MICROS_DB[key]
        break
      }
    }

    const defaultFullMicros = {
      vitamins: [
        { name: 'Vitamina A', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('A'))?.val || '0 mcg', pct: '0%' },
        { name: 'Vitamina D', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('D'))?.val || '0 mcg', pct: '0%' },
        { name: 'Vitamina E', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('E'))?.val || '0 mg', pct: '0%' },
        { name: 'Vitamina K', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('K'))?.val || '0 mcg', pct: '0%' },
        { name: 'Vitamina B6', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('B6'))?.val || '0 mg', pct: '0%' },
        { name: 'Vitamina B12', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('B12'))?.val || '0 mcg', pct: '0%' },
        { name: 'Vitamina C', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('C'))?.val || '0 mg', pct: '0%' },
        { name: 'Folat (B9)', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('Folat'))?.val || '0 mcg', pct: '0%' },
        { name: 'Niacin (B3)', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('Niacin'))?.val || '0 mg', pct: '0%' },
        { name: 'Thiamin (B1)', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('Thiamin'))?.val || '0 mg', pct: '0%' },
        { name: 'Riboflavin (B2)', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('Riboflavin'))?.val || '0 mg', pct: '0%' },
        { name: 'Biotin (B7)', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('Biotin'))?.val || '0 mcg', pct: '0%' },
        { name: 'Acid pantotenic (B5)', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('pantotenic'))?.val || '0 mg', pct: '0%' },
        { name: 'Colină', val: dataObj.micronutrients?.vitamins?.find(v => v.name.includes('Colină'))?.val || '0 mg', pct: '0%' },
      ],
      minerals: [
        { name: 'Potasiu', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Potasiu'))?.val || '0 mg', pct: '0%' },
        { name: 'Calciu', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Calciu'))?.val || '0 mg', pct: '0%' },
        { name: 'Fier', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Fier'))?.val || '0 mg', pct: '0%' },
        { name: 'Magneziu', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Magneziu'))?.val || '0 mg', pct: '0%' },
        { name: 'Zinc', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Zinc'))?.val || '0 mg', pct: '0%' },
        { name: 'Fosfor', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Fosfor'))?.val || '0 mg', pct: '0%' },
        { name: 'Seleniu', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Seleniu'))?.val || '0 mcg', pct: '0%' },
        { name: 'Cupru', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Cupru'))?.val || '0 mg', pct: '0%' },
        { name: 'Mangan', val: dataObj.micronutrients?.minerals?.find(m => m.name.includes('Mangan'))?.val || '0 mg', pct: '0%' },
      ]
    }

    const quality_score = Number(dataObj.quality_score) >= 0 ? Number(dataObj.quality_score) : 75
    const rating = dataObj.rating || (quality_score >= 70 ? 'Good' : quality_score >= 40 ? 'Caution' : 'Poor')
    
    const ingredients_analysis = dataObj.ingredients_analysis || {
      summary: 'Analiză nutrițională completă bazată pe ingrediente.',
      safe_count: 5,
      concerns_count: 1,
      items: (dataObj.items || []).map(it => ({ name: it.name || it, status: 'safe' }))
    }

    return {
      ...dataObj,
      quality_score,
      rating,
      ingredients_analysis,
      micronutrients: matchedMicros || dataObj.micronutrients || defaultFullMicros
    }
  }

  async function handleFile(file) {
    if (!file) return
    setError(null); setResult(null); setQuantity(1); setFavSaved(false)
    uploadedUrlRef.current = null

    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(file)

    setPhase('analyzing')
    try {
      const resized = await resizeToBase64(file, 1024, 0.85)
      const b64 = resized ? resized.b64 : await fileToBase64(file)
      const mediaType = resized ? resized.mediaType : (file.type || 'image/jpeg')
      setLastBase64(b64)
      setLastMediaType(mediaType)

      const { data, error: fnErr } = await supabase.functions.invoke('analyze-food', {
        body: { imageBase64: b64, mediaType },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)
      let resultData = data?.result || data
      if (!resultData?.calories && !resultData?.protein_g) throw new Error('Raspuns invalid de la AI')

      resultData = attachMicronutrientsIfNeeded(resultData)

      setResult(resultData)
      setPhase('result')
    } catch (err) {
      console.error('[FoodPhotoAnalyzer]', err)
      setError(err.message || 'Eroare la analiza. Incearca din nou.')
      setPhase('error')
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = e => resolve(e.target.result.split(',')[1] || e.target.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function resizeToBase64(file, maxDim = 1024, quality = 0.9) {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader()
        reader.onload = e => {
          const img = new Image()
          img.onload = () => {
            try {
              const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
              const w = Math.max(1, Math.round(img.width * scale))
              const h = Math.max(1, Math.round(img.height * scale))
              const canvas = document.createElement('canvas')
              canvas.width = w; canvas.height = h
              canvas.getContext('2d').drawImage(img, 0, 0, w, h)
              const dataUrl = canvas.toDataURL('image/jpeg', quality)
              resolve({ b64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
            } catch (_) { resolve(null) }
          }
          img.onerror = () => resolve(null)
          img.src = e.target.result
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      } catch (_) { resolve(null) }
    })
  }

  async function uploadPhotoToStorage(b64, mediaType) {
    try {
      const ext   = (mediaType || 'image/jpeg').split('/')[1] || 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))
      const { error: upErr } = await supabase.storage
        .from('meal-photos')
        .upload(path, bytes, { contentType: mediaType, upsert: false })
      if (upErr) { console.warn('[upload fail non-fatal]', upErr.message); return null }
      const { data: urlData } = supabase.storage.from('meal-photos').getPublicUrl(path)
      return urlData?.publicUrl || null
    } catch (e) { console.warn('[upload exc]', e); return null }
  }

  async function ensurePhotoUploaded() {
    if (uploadedUrlRef.current) return uploadedUrlRef.current
    if (!lastBase64 || !lastMediaType) return preview || null
    let url = await uploadPhotoToStorage(lastBase64, lastMediaType)
    if (!url) url = preview
    if (url) uploadedUrlRef.current = url
    return url
  }

  function downloadPhotoToDevice() {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview
    a.download = `masa-${Date.now()}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleAddToLog() {
    if (!result || !user?.id) return
    setPhase('saving')
    try {
      const now  = new Date()
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

      const imageUrl = await ensurePhotoUploaded()
      const enrichedResult = attachMicronutrientsIfNeeded(result)
      const scale = quantity

      const metaToSave = {
        ...enrichedResult,
        quality_score: enrichedResult.quality_score,
        quantity_saved: quantity,
        image_url: imageUrl,
        sodium_mg: Math.round((enrichedResult.sodium_mg || 0) * scale),
        potassium_mg: Math.round((enrichedResult.potassium_mg || 0) * scale),
        calcium_mg: Math.round((enrichedResult.calcium_mg || 0) * scale),
        iron_mg: Math.round((enrichedResult.iron_mg || 0) * scale * 10) / 10,
        vitamin_c_mg: Math.round((enrichedResult.vitamin_c_mg || 0) * scale * 10) / 10,
        vitamin_d_mcg: Math.round((enrichedResult.vitamin_d_mcg || 0) * scale * 10) / 10,
        magnesium_mg: Math.round((enrichedResult.magnesium_mg || 0) * scale),
      }

      const entry = {
        user_id:   user.id,
        date:      selectedDate,
        time,
        name:      enrichedResult.name || 'Masa fotografiata',
        calories:  Math.round((enrichedResult.calories  || 0) * scale),
        protein_g: Math.round((enrichedResult.protein_g || 0) * scale * 10) / 10,
        carbs_g:   Math.round((enrichedResult.carbs_g   || 0) * scale * 10) / 10,
        fat_g:     Math.round((enrichedResult.fat_g     || 0) * scale * 10) / 10,
        fiber_g:   Math.round((enrichedResult.fiber_g   || 0) * scale * 10) / 10,
        sodium_mg: metaToSave.sodium_mg,
        source:    'photo',
        image_url: imageUrl,
        meta_json: JSON.stringify(metaToSave),
      }

      const { error: insertErr } = await supabase.from('meal_entries').insert(entry)
      if (insertErr) throw insertErr

      setPhase('saved')
      onAddToLog?.()
      setTimeout(() => onClose?.(), 1500)
    } catch (err) {
      console.error('[FoodPhotoAnalyzer addToLog]', err)
      setError(err.message || 'Eroare la salvare.')
      setPhase('result')
    }
  }

  async function handleSaveFavorite() {
    if (!result || !user?.id || favSaved) return
    setFavError(null)
    try {
      downloadPhotoToDevice()

      const imageUrl = await ensurePhotoUploaded()
      const enrichedResult = attachMicronutrientsIfNeeded(result)
      const name = (enrichedResult.name || 'Masa fotografiata').trim()
      
      const metaPayload = {
        ...enrichedResult,
        score: enrichedResult.quality_score,
        description: enrichedResult.description || enrichedResult.ingredients_analysis?.summary || '',
        micronutrients: enrichedResult.micronutrients,
        image_url: imageUrl,
      }

      const fields = {
        image_url:    imageUrl || preview || null,
        calories:     Math.round(enrichedResult.calories || 0),
        protein_g:    enrichedResult.protein_g || 0,
        carbs_g:      enrichedResult.carbs_g    || 0,
        fat_g:        enrichedResult.fat_g      || 0,
        fiber_g:      enrichedResult.fiber_g    || 0,
        portion_desc: enrichedResult.portion_desc || '1 porție',
        meta_json:    JSON.stringify(metaPayload),
      }

      // Verificăm în catalogul comun (fără constrângere de user_id)
      const { data: existing } = await supabase.from('favorite_foods')
        .select('id, use_count').eq('name', name).maybeSingle()

      let dbErr = null
      if (existing?.id) {
        const { error } = await supabase.from('favorite_foods').update({
          ...fields,
          use_count: (existing.use_count || 1) + 1
        }).eq('id', existing.id)
        dbErr = error
      } else {
        const { error } = await supabase.from('favorite_foods').insert({
          user_id: user.id, 
          name, 
          use_count: 1, 
          ...fields 
        })
        dbErr = error
      }

      if (dbErr) throw dbErr
      setFavSaved(true)
    } catch (err) {
      console.error('[saveFavorite]', err)
      setFavError(err?.message || 'Nu s-a putut salva în preferate.')
    }
  }

  async function handleRecalculate(editedItems) {
    const valid = (editedItems || []).filter(it => (it.name || '').trim())
    if (valid.length === 0) return
    setError(null)
    setPhase('analyzing')
    try {
      const desc = valid.map(it => `${it.name.trim()} ${it.weight_g || 0}g`).join(', ')
      const { data, error: fnErr } = await supabase.functions.invoke('analyze-food', {
        body: { textDescription: `Masă compusă din următoarele ingrediente cu gramaje exacte: ${desc}. Calculează valorile nutriționale totale și scorul de calitate.` },
      })
      if (fnErr) throw fnErr
      if (data?.error) throw new Error(data.error)
      let resultData = data?.result || data
      if (!resultData?.calories && !resultData?.protein_g) throw new Error('Raspuns invalid de la AI')
      
      resultData = attachMicronutrientsIfNeeded(resultData)

      setResult(resultData)
      setQuantity(1)
      setPhase('result')
    } catch (err) {
      console.error('[FoodPhotoAnalyzer recalc]', err)
      setError(err.message || 'Eroare la recalculare. Incearca din nou.')
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle'); setPreview(null); setResult(null)
    setError(null); setQuantity(1); setFavSaved(false)
    setLastBase64(null); setLastMediaType(null)
    uploadedUrlRef.current = null
  }

  function openManual() {
    setError(null); setResult(null); setPreview(null); setQuantity(1); setFavSaved(false)
    setLastBase64(null); setLastMediaType(null); uploadedUrlRef.current = null
    setManualForm({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '', sodium_mg: '', items: [{ name: '', weight_g: '' }] })
    setPhase('manual')
  }

  function handleManualPhoto(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(file)
    fileToBase64(file).then(b64 => {
      setLastBase64(b64); setLastMediaType(file.type || 'image/jpeg'); uploadedUrlRef.current = null
    })
  }

  function updateManual(field, val) { setManualForm(f => ({ ...f, [field]: val })) }
  function updateManualItem(i, field, val) {
    setManualForm(f => { const items = [...f.items]; items[i] = { ...items[i], [field]: val }; return { ...f, items } })
  }
  function addManualItem() { setManualForm(f => ({ ...f, items: [...f.items, { name: '', weight_g: '' }] })) }
  function removeManualItem(i) { setManualForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })) }

  function submitManual() {
    const name = (manualForm.name || '').trim()
    const cal = Number(manualForm.calories) || 0
    const p   = Number(manualForm.protein_g) || 0
    const cb  = Number(manualForm.carbs_g) || 0
    const ft  = Number(manualForm.fat_g) || 0
    if (!name) { setError('Adaugă un nume pentru masă.'); return }
    if (!cal && !p && !cb && !ft) { setError('Completează caloriile sau măcar un macronutrient.'); return }
    const items = (manualForm.items || [])
      .filter(it => (it.name || '').trim())
      .map(it => ({ name: it.name.trim(), weight_g: Number(it.weight_g) || 0, status: 'safe' }))
    const totalW = items.reduce((s, it) => s + (it.weight_g || 0), 0)

    let rawResult = {
      name,
      portion_desc: totalW > 0 ? `~${totalW}g` : '1 porție',
      total_weight_g: totalW > 0 ? totalW : 100,
      calories: cal, protein_g: p, carbs_g: cb, fat_g: ft,
      fiber_g: Number(manualForm.fiber_g) || 0,
      sodium_mg: Number(manualForm.sodium_mg) || 0,
      quality_score: 80,
      rating: 'Good',
      ingredients_analysis: {
        summary: 'Produs introdus manual cu profil curat.',
        safe_count: items.length,
        concerns_count: 0,
        items
      },
      items,
    }

    rawResult = attachMicronutrientsIfNeeded(rawResult)

    setResult(rawResult)
    setError(null); setQuantity(1); setPhase('result')
  }

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: isDark ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
  }
  const sheet = {
    background: c.bg, minHeight: '100dvh',
    padding: '0 0 env(safe-area-inset-bottom)',
    maxWidth: 480, margin: '0 auto', width: '100%',
    fontFamily: c.fontFamily,
  }
  const header = {
    position: 'sticky', top: 0, zIndex: 10, background: c.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px 10px',
    borderBottom: `0.5px solid ${c.border}`,
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div style={sheet}>
        <div style={header}>
          <button onClick={phase === 'result' || phase === 'error' || phase === 'manual' ? reset : onClose}
            style={{ background: 'transparent', border: 'none', color: c.text3, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            {phase === 'result' || phase === 'error' || phase === 'manual' ? '<- Inapoi' : 'X Inchide'}
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Analiza masa</div>
          <div style={{ width: 60 }}/>
        </div>

        <div style={{ padding: '16px' }}>
          {phase === 'idle' && (
            <div>
              <div style={{
                border: `2px dashed ${c.border}`, borderRadius: 16,
                padding: '48px 24px', textAlign: 'center', marginBottom: 20,
                background: isDark ? 'rgba(255,255,255,0.02)' : '#F9F5EF',
              }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>🍽️</div>
                <div style={{ fontSize: 14, color: c.text3, marginBottom: 6 }}>Fotografiaza sau incarca o imagine cu mancarea sau eticheta</div>
                <div style={{ fontSize: 12, color: c.text4 }}>AI-ul va evalua scorul de calitate, ingredientele și valorile nutriționale</div>
              </div>
              <button onClick={() => cameraRef.current?.click()} style={{
                width: '100%', padding: '16px', marginBottom: 12,
                background: c.gradGreen || '#97C459', border: 'none',
                borderRadius: c.radiusSm || 10, color: '#16291A',
                fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                📷 Fotografiaza acum
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])}/>
              <button onClick={() => fileRef.current?.click()} style={{
                width: '100%', padding: '14px',
                background: isDark ? 'rgba(255,255,255,0.07)' : '#F0EAE0',
                border: 'none', borderRadius: c.radiusSm || 10,
                color: c.text3, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                🖼 Alege din galerie
              </button>
              <input ref={fileRef} type="file" accept="image/*"
                style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])}/>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
                <div style={{ flex: 1, height: 1, background: c.border }}/>
                <div style={{ fontSize: 11, color: c.text4 }}>sau</div>
                <div style={{ flex: 1, height: 1, background: c.border }}/>
              </div>
              <button onClick={openManual} style={{
                width: '100%', padding: '14px',
                background: isDark ? 'rgba(255,255,255,0.07)' : '#F0EAE0',
                border: `1px solid ${c.border}`, borderRadius: c.radiusSm || 10,
                color: c.text, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                ✏️ Creează manual (fără AI)
              </button>
            </div>
          )}

          {phase === 'manual' && (() => {
            const inp = { width: '100%', padding: '11px 12px', borderRadius: 10, border: `1px solid ${c.border}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', color: c.text, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
            const lbl = { fontSize: 12, fontWeight: 600, color: c.text3, marginBottom: 6, display: 'block' }
            const macro = (key, label, unit) => (
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={lbl}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" inputMode="decimal" value={manualForm[key]} placeholder="0"
                    onChange={e => updateManual(key, e.target.value)} style={inp}/>
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: c.text4 }}>{unit}</span>
                </div>
              </div>
            )
            return (
              <div>
                <div onClick={() => manualPhotoRef.current?.click()} style={{
                  border: `2px dashed ${c.border}`, borderRadius: 14, overflow: 'hidden',
                  marginBottom: 18, cursor: 'pointer', textAlign: 'center',
                  background: isDark ? 'rgba(255,255,255,0.02)' : '#F9F5EF',
                }}>
                  {preview ? (
                    <img src={preview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}/>
                  ) : (
                    <div style={{ padding: '28px 16px' }}>
                      <div style={{ fontSize: 34, marginBottom: 6 }}>📷</div>
                      <div style={{ fontSize: 12, color: c.text4 }}>Adaugă o poză (opțional)</div>
                    </div>
                  )}
                </div>
                <input ref={manualPhotoRef} type="file" accept="image/*"
                  style={{ display: 'none' }} onChange={e => handleManualPhoto(e.target.files[0])}/>

                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Nume masă / produs *</label>
                  <input value={manualForm.name} placeholder="ex: Baton proteic / Salată"
                    onChange={e => updateManual('name', e.target.value)} style={inp}/>
                </div>

                <label style={lbl}>Ingrediente</label>
                {manualForm.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input value={it.name} placeholder="ingredient"
                      onChange={e => updateManualItem(i, 'name', e.target.value)} style={{ ...inp, flex: 2 }}/>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input type="number" inputMode="decimal" value={it.weight_g} placeholder="g"
                        onChange={e => updateManualItem(i, 'weight_g', e.target.value)} style={inp}/>
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: c.text4 }}>g</span>
                    </div>
                    <button onClick={() => removeManualItem(i)} disabled={manualForm.items.length <= 1} style={{
                      background: 'transparent', border: 'none', color: manualForm.items.length <= 1 ? c.text4 : '#F87171',
                      fontSize: 18, cursor: manualForm.items.length <= 1 ? 'default' : 'pointer', padding: '0 4px',
                    }}>×</button>
                  </div>
                ))}
                <button onClick={addManualItem} style={{
                  background: 'transparent', border: `1px dashed ${c.border}`, borderRadius: 8,
                  color: c.text3, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  padding: '8px 12px', marginBottom: 20, width: '100%',
                }}>+ Adaugă ingredient</button>

                <label style={lbl}>Valori nutriționale</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {macro('calories', 'Calorii', 'kcal')}
                  {macro('protein_g', 'Proteine', 'g')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {macro('carbs_g', 'Carbo', 'g')}
                  {macro('fat_g', 'Grăsimi', 'g')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {macro('fiber_g', 'Fibre', 'g')}
                  {macro('sodium_mg', 'Sodiu', 'mg')}
                </div>

                {error && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10,
                    background: isDark ? 'rgba(248,113,113,0.12)' : '#FDECEC', fontSize: 12, color: '#F87171' }}>
                    ⚠ {error}
                  </div>
                )}

                <button onClick={submitManual} style={{
                  width: '100%', padding: '16px', background: c.gradGreen || '#97C459',
                  border: 'none', borderRadius: c.radiusSm || 10, color: '#16291A',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Continuă →
                </button>
              </div>
            )
          })()}

          {phase === 'analyzing' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              {preview && (
                <img src={preview} alt="" style={{
                  width: '100%', maxHeight: 240, objectFit: 'cover',
                  borderRadius: 14, marginBottom: 24, opacity: 0.7,
                }}/>
              )}
              <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 8 }}>Se analizeaza produsul/masa...</div>
              <div style={{ fontSize: 13, color: c.text4 }}>AI generează scorul de calitate, ingredientele și valorile nutriționale</div>
            </div>
          )}

          {phase === 'result' && result && (
            <>
              {preview && (
                <div style={{ position: 'relative', marginBottom: 16, borderRadius: 14, overflow: 'hidden' }}>
                  <img src={preview} alt="" style={{
                    width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block',
                  }}/>
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(0,0,0,0.6)', borderRadius: 8,
                    padding: '4px 10px', fontSize: 12, color: '#fff',
                  }}>
                    ✓ Analizat
                  </div>
                </div>
              )}
              
              <div style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : '#FAF6F0',
                borderRadius: 16, padding: '16px', marginBottom: 16,
                border: `1px solid ${c.border}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    border: `4px solid ${result.quality_score >= 70 ? '#4ADE80' : result.quality_score >= 40 ? '#FACC15' : '#F87171'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 18, color: c.text
                  }}>
                    {result.quality_score}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c.text, textTransform: 'capitalize' }}>
                      {result.rating === 'Good' ? '🟢 Bun' : result.rating === 'Caution' ? '🟡 Atenție' : '🔴 Slab'}
                    </div>
                    <div style={{ fontSize: 12, color: c.text3, marginTop: 2 }}>
                      {result.ingredients_analysis?.safe_count || 0} ingrediente sigure · {result.ingredients_analysis?.concerns_count || 0} atenționări
                    </div>
                  </div>
                </div>
                {result.ingredients_analysis?.summary && (
                  <div style={{ fontSize: 12, color: c.text3, lineHeight: 1.4, background: isDark ? 'rgba(0,0,0,0.2)' : '#fff', padding: 10, borderRadius: 8 }}>
                    {result.ingredients_analysis.summary}
                  </div>
                )}
              </div>

              <MacroRingCard
                data={result}
                targets={targets}
                readonly={false}
                quantity={quantity}
                onQuantityChange={setQuantity}
                onAddToLog={handleAddToLog}
                onRecalculate={handleRecalculate}
                c={c}
                isDark={isDark}
              />

              <div style={{ marginTop: 16, marginBottom: 24 }}>
                <button 
                  onClick={handleSaveFavorite} 
                  disabled={favSaved}
                  style={{
                    width: '100%', padding: '14px',
                    background: favSaved ? (isDark ? 'rgba(151,196,89,0.2)' : '#EEF7E0') : (isDark ? 'rgba(255,255,255,0.08)' : '#F0EAE0'),
                    border: `1px solid ${c.border}`,
                    borderRadius: c.radiusSm || 10,
                    color: favSaved ? (c.green2 || '#97C459') : c.text,
                    fontSize: 14, fontWeight: 700,
                    cursor: favSaved ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {favSaved ? '★ Salvat în Favorite' : '☆ Salvează în Favorite (și descarcă poza)'}
                </button>
                {favError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#F87171', textAlign: 'center' }}>
                    {favError}
                  </div>
                )}
              </div>
            </>
          )}

          {phase === 'saving' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>💾</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.text }}>Se adauga in jurnal...</div>
            </div>
          )}

          {phase === 'saved' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: c.green2 || '#97C459', marginBottom: 8 }}>Adaugat in jurnal și raportat la Nutriție!</div>
              <div style={{ fontSize: 13, color: c.text4 }}>
                {result?.name || 'Masa'} · {Math.round((result?.calories || 0) * quantity)} kcal (Scor: {result?.quality_score || 75})
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 8 }}>Analiza nu a reusit</div>
              <div style={{ fontSize: 13, color: c.text4, marginBottom: 28 }}>
                {error || 'Incearca cu o poza mai clara.'}
              </div>
              <button onClick={reset} style={{
                padding: '13px 28px', background: c.gradGreen || '#97C459',
                border: 'none', borderRadius: c.radiusSm || 10,
                color: '#16291A', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Incearca din nou
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
