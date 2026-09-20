// src/pages/NutritionImport.jsx — Import CSV din MyFitnessPal
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function NutritionImport({ onBack, onImported }) {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    parseCSV(f)
  }

  function parseCSV(f) {
    setParsing(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target.result
        const rows = text.trim().split('\n')
        const header = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

        const colMap = {
          date:     header.findIndex(h => h === 'date'),
          calories: header.findIndex(h => h.includes('calori')),
          carbs:    header.findIndex(h => h.includes('carbohydrate') || h === 'carbs'),
          fat:      header.findIndex(h => h === 'fat' || h === 'fat (g)'),
          protein:  header.findIndex(h => h.includes('protein')),
          fiber:    header.findIndex(h => h.includes('fiber') || h.includes('fibre')),
          sugar:    header.findIndex(h => h.includes('sugar')),
          sodium:   header.findIndex(h => h.includes('sodium')),
        }

        // Agregare per dată — MFP are rânduri separate per masă
        const byDate = {}

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
          if (!row[colMap.date] || row[colMap.date] === '') continue

          let date = row[colMap.date]
          if (date.includes('/')) {
            const parts = date.split('/')
            if (parts.length === 3) {
              date = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`
            }
          }

          if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue

          const num = (idx) => {
            if (idx < 0 || !row[idx]) return 0
            return parseFloat(row[idx].replace(',', '')) || 0
          }

          if (!byDate[date]) {
            byDate[date] = { date, calories: 0, carbs_g: 0, fat_g: 0, protein_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 }
          }

          byDate[date].calories  += num(colMap.calories)
          byDate[date].carbs_g   += num(colMap.carbs)
          byDate[date].fat_g     += num(colMap.fat)
          byDate[date].protein_g += num(colMap.protein)
          byDate[date].fiber_g   += num(colMap.fiber)
          byDate[date].sugar_g   += num(colMap.sugar)
          byDate[date].sodium_mg += num(colMap.sodium)
        }

        const valid = Object.values(byDate)
          .map(r => ({
            ...r,
            calories:  Math.round(r.calories),
            carbs_g:   Math.round(r.carbs_g),
            fat_g:     Math.round(r.fat_g),
            protein_g: Math.round(r.protein_g),
            fiber_g:   Math.round(r.fiber_g),
            sugar_g:   Math.round(r.sugar_g),
            sodium_mg: Math.round(r.sodium_mg),
          }))
          .filter(r => r.calories > 0)
          .sort((a, b) => b.date.localeCompare(a.date))

        setPreview(valid)
        setParsing(false)
      } catch (err) {
        setError('Eroare la parsarea CSV: ' + err.message)
        setParsing(false)
      }
    }
    reader.readAsText(f)
  }

  async function importData() {
    if (!preview?.length) return
    setImporting(true)
    setError(null)

    try {
      let imported = 0
      for (const r of preview) {
        const row = {
          user_id:   user.id,
          date:      r.date,
          calories:  r.calories || null,
          carbs_g:   r.carbs_g || null,
          fat_g:     r.fat_g || null,
          protein_g: r.protein_g || null,
          fiber_g:   r.fiber_g || null,
          sugar_g:   r.sugar_g || null,
          sodium_mg: r.sodium_mg || null,
        }
        const { error } = await supabase
          .from('nutrition_logs')
          .upsert(row, { onConflict: 'user_id,date' })
        if (error) throw error
        imported++
      }

      setResult({ ok: true, count: imported })
      if (onImported) onImported()
    } catch (err) {
      setError('Eroare la import: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={s.page}>

      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Înapoi</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E8E4', letterSpacing: '0.1em' }}>IMPORT NUTRIȚIE</div>
        <div style={{ width: 60 }}/>
      </div>

      <div style={s.card}>
        <div style={s.sectionLabel}>Cum exporti din MyFitnessPal</div>
        {['1. Deschide MyFitnessPal → Settings (roată)',
          '2. Scroll jos → "Export Data"',
          '3. Selectează intervalul dorit',
          '4. Apasă "Download" → salvează fișierul CSV',
          '5. Urcă fișierul mai jos'].map(step => (
          <div key={step} style={{ fontSize: 13, color: '#6B6F7A', display: 'flex', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#639922', flexShrink: 0 }}>·</span>{step}
          </div>
        ))}
      </div>

      <div style={{ ...s.card, border: file ? '0.5px solid #2A5A1A' : '0.5px solid #2A2D38' }}>
        <div style={s.sectionLabel}>Selectează fișierul CSV</div>
        <label style={s.uploadLabel}>
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }}/>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 14, color: file ? '#97C459' : '#6B6F7A', fontWeight: file ? 600 : 400 }}>
            {file ? file.name : 'Click pentru a selecta fișierul CSV'}
          </div>
          <div style={{ fontSize: 12, color: '#4A4E5A', marginTop: 4 }}>
            {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Fișier .csv din MyFitnessPal'}
          </div>
        </label>
      </div>

      {parsing && <div style={{ textAlign: 'center', padding: '1rem', color: '#4A4E5A', fontSize: 13 }}>Se parsează fișierul...</div>}

      {error && (
        <div style={{ background: '#2A1A1A', border: '0.5px solid #5A2A2A', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, color: '#F09595' }}>
          {error}
        </div>
      )}

      {result?.ok && (
        <div style={{ background: '#1A3A0A', border: '0.5px solid #2A5A1A', borderRadius: 10, padding: '1rem', marginBottom: '1rem', fontSize: 14, color: '#97C459', textAlign: 'center', fontWeight: 600 }}>
          ✓ {result.count} zile importate cu succes în FORMA!
        </div>
      )}

      {preview && preview.length > 0 && !result?.ok && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={s.sectionLabel}>{preview.length} zile detectate</div>
            <button onClick={importData} disabled={importing}
              style={{ ...s.importBtn, opacity: importing ? 0.7 : 1 }}>
              {importing ? 'Se importă...' : `Importă ${preview.length} zile →`}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: '1rem' }}>
            {[
              ['Zile', preview.length],
              ['Cal medie', Math.round(preview.reduce((s, r) => s + (r.calories || 0), 0) / preview.length)],
              ['Prot medie', Math.round(preview.reduce((s, r) => s + (r.protein_g || 0), 0) / preview.length) + 'g'],
              ['Interval', `${preview[preview.length-1]?.date?.slice(0,7)} → ${preview[0]?.date?.slice(0,7)}`],
            ].map(([label, val]) => (
              <div key={label} style={{ background: '#1E2028', borderRadius: 8, padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#4A4E5A', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#E8E8E4' }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Data', 'Calorii', 'Proteine', 'Carbohidrați', 'Grăsimi', 'Fibre'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#4A4E5A', fontWeight: 600, borderBottom: '0.5px solid #2A2D38', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #1E2028' }}>
                    <td style={{ padding: '8px', color: '#E8E8E4', fontWeight: 500 }}>{row.date}</td>
                    <td style={{ padding: '8px', color: '#C0DD97' }}>{row.calories || '—'}</td>
                    <td style={{ padding: '8px', color: '#6B6F7A' }}>{row.protein_g ? `${row.protein_g}g` : '—'}</td>
                    <td style={{ padding: '8px', color: '#6B6F7A' }}>{row.carbs_g ? `${row.carbs_g}g` : '—'}</td>
                    <td style={{ padding: '8px', color: '#6B6F7A' }}>{row.fat_g ? `${row.fat_g}g` : '—'}</td>
                    <td style={{ padding: '8px', color: '#6B6F7A' }}>{row.fiber_g ? `${row.fiber_g}g` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <div style={{ fontSize: 12, color: '#4A4E5A', padding: '8px', textAlign: 'center' }}>
                + {preview.length - 10} rânduri suplimentare
              </div>
            )}
          </div>
        </div>
      )}

      {preview && preview.length === 0 && !parsing && (
        <div style={{ ...s.card, color: '#F0A830', fontSize: 13 }}>
          ⚠ Nu s-au detectat rânduri valide. Asigură-te că e un export CSV din MyFitnessPal.
        </div>
      )}

    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0F1117', padding: '1rem 1.25rem', fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 900, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '0.5px solid #1E2028' },
  backBtn: { fontSize: 13, color: '#639922', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  card: { background: '#16181F', border: '0.5px solid #2A2D38', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1rem' },
  sectionLabel: { fontSize: 11, fontWeight: 600, color: '#4A4E5A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' },
  uploadLabel: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', border: '1px dashed #2A2D38', borderRadius: 10, cursor: 'pointer', background: '#0F1117', minHeight: 120 },
  importBtn: { padding: '8px 20px', background: '#639922', border: 'none', borderRadius: 8, color: '#0F1117', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}
