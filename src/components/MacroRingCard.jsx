// src/components/MacroRingCard.jsx — Corectat și protejat împotriva erorilor de randare
import { useState, useEffect } from 'react'

const MICRO_TARGETS = {
  sodium_mg:     { label: 'Sodiu',    unit: 'mg',  target: 2300, warn: 1800 },
  potassium_mg:  { label: 'Potasiu',  unit: 'mg',  target: 3500, warn: null },
  calcium_mg:    { label: 'Calciu',   unit: 'mg',  target: 1000, warn: null },
  iron_mg:       { label: 'Fier',     unit: 'mg',  target: 18,   warn: null },
  vitamin_c_mg:  { label: 'Vit C',    unit: 'mg',  target: 75,   warn: null },
  vitamin_d_ug:  { label: 'Vit D',    unit: 'μg',  target: 15,   warn: null },
  magnesium_mg:  { label: 'Magneziu', unit: 'mg',  target: 350,  warn: null },
}

const MACRO_COLORS = {
  protein: '#97C459',
  carbs:   '#4A7EB5',
  fat:     '#F0A830',
}

const QTY_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]

function MacroDonut({ protein = 0, carbs = 0, fat = 0, calories = 0, targetCal = 0, c = {} }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60)
    return () => clearTimeout(t)
  }, [protein, carbs, fat])

  const kcalProt = (protein || 0) * 4
  const kcalCarb = (carbs || 0)  * 4
  const kcalFat  = (fat || 0)    * 9
  const total    = kcalProt + kcalCarb + kcalFat || 1

  const pPct = kcalProt / total
  const cPct = kcalCarb / total
  const fPct = kcalFat  / total

  const R  = 52
  const CX = 75
  const CY = 75
  const C  = 2 * Math.PI * R

  const pLen = animated ? pPct * C : 0
  const cLen = animated ? cPct * C : 0
  const fLen = animated ? fPct * C : 0

  const easing = 'stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)'
  const overCal = targetCal && calories > targetCal

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={c?.card2 || 'rgba(255,255,255,0.08)'} strokeWidth="16"/>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={MACRO_COLORS.protein} strokeWidth="16"
            strokeDasharray={`${pLen} ${C}`} strokeDashoffset={C * 0.25} strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`} style={{ transition: easing }}/>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={MACRO_COLORS.carbs} strokeWidth="16"
            strokeDasharray={`${cLen} ${C}`} strokeDashoffset={C * 0.25 - pLen} strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`} style={{ transition: easing }}/>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={MACRO_COLORS.fat} strokeWidth="16"
            strokeDasharray={`${fLen} ${C}`} strokeDashoffset={C * 0.25 - pLen - cLen} strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`} style={{ transition: easing }}/>
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: overCal ? '#F87171' : (c?.text || '#fff'), lineHeight: 1 }}>
            {Math.round(calories || 0)}
          </div>
          <div style={{ fontSize: 10, color: c?.text4 || '#888', marginTop: 2 }}>kcal</div>
          {targetCal > 0 && (
            <div style={{ fontSize: 9, color: overCal ? '#F87171' : (c?.text4 || '#888'), marginTop: 1 }}>
              / {targetCal}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 130 }}>
        {[
          ['Proteine', protein, MACRO_COLORS.protein, pPct],
          ['Carbohidrați', carbs, MACRO_COLORS.carbs, cPct],
          ['Grăsimi', fat, MACRO_COLORS.fat, fPct],
        ].map(([label, val, color, pct]) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }}/>
              <div style={{ flex: 1, fontSize: 12, color: c?.text3 || '#aaa' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c?.text || '#fff' }}>{Math.round(val || 0)}g</div>
              <div style={{ fontSize: 10, color: c?.text4 || '#888', width: 28, textAlign: 'right' }}>{Math.round((pct || 0) * 100)}%</div>
            </div>
            <div style={{ height: 3, background: 'rgba(128,128,128,0.15)', borderRadius: 2, marginLeft: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: animated ? `${Math.round((pct || 0) * 100)}%` : '0%', background: color, borderRadius: 2, transition: 'width 0.9s cubic-bezier(.4,0,.2,1)' }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MicroBar({ label, value, target, unit, warn, c, animated }) {
  if (!value && value !== 0) return null
  const pct = Math.min(100, Math.round(((value || 0) / target) * 100))
  const isHigh = warn && value > warn
  const color = isHigh ? '#F87171' : pct >= 80 ? '#97C459' : pct >= 40 ? '#4A7EB5' : '#F0A830'
  const fmtVal = value >= 1000 ? `${((value || 0) / 1000).toFixed(1)}g` : `${Math.round(value || 0)}${unit}`

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: c?.text3 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: isHigh ? '#F87171' : (c?.text || '#fff') }}>{fmtVal}</span>
          <span style={{ fontSize: 10, color: c?.text4 }}>/ {target >= 1000 ? `${(target/1000).toFixed(1)}g` : `${target}${unit}`}</span>
          <span style={{ fontSize: 10, color, fontWeight: 600, width: 28, textAlign: 'right' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: '3px', background: 'rgba(128,128,128,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: animated ? `${pct}%` : '0%', background: color, borderRadius: 2, transition: 'width 1s cubic-bezier(.4,0,.2,1) 0.2s' }}/>
      </div>
    </div>
  )
}

export default function MacroRingCard({
  data,
  targets = {},
  readonly = false,
  quantity: quantityProp = 1,
  onQuantityChange,
  onAddToLog,
  onSave,
  onRecalculate,
  c = {},
  isDark = true,
}) {
  const [qty, setQty] = useState(quantityProp || 1)
  const [showIngredients, setShowIngredients] = useState(false)
  const [animated, setAnimated] = useState(false)
  const [items, setItems] = useState(() => (Array.isArray(data?.items) ? data.items : Array.isArray(data?.ingredients) ? data.ingredients : []).map(x => (typeof x === 'object' ? { ...x } : { name: x, weight_g: 0, status: 'safe' })))

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [data])

  useEffect(() => { setQty(quantityProp || 1) }, [quantityProp])
  useEffect(() => {
    const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data?.ingredients) ? data.ingredients : []
    setItems(raw.map(x => (typeof x === 'object' ? { ...x } : { name: x, weight_g: 0, status: 'safe' })))
  }, [data])

  if (!data) return null

  const updateItem = (i, field, value) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const addItem = () => setItems(prev => [...prev, { name: '', weight_g: 0, status: 'safe' }])

  const scale = qty || 1
  const d = {
    calories:       Math.round((data.calories       || 0) * scale),
    protein_g:      Math.round((data.protein_g      || 0) * scale * 10) / 10,
    carbs_g:        Math.round((data.carbs_g        || 0) * scale * 10) / 10,
    fat_g:          Math.round((data.fat_g          || 0) * scale * 10) / 10,
    fiber_g:        Math.round((data.fiber_g        || 0) * scale * 10) / 10,
    sodium_mg:      (data.sodium_mg      || 0) * scale,
    potassium_mg:   (data.potassium_mg   || 0) * scale,
    calcium_mg:     (data.calcium_mg     || 0) * scale,
    iron_mg:        (data.iron_mg        || 0) * scale,
    vitamin_c_mg:   (data.vitamin_c_mg   || 0) * scale,
    vitamin_d_ug:   (data.vitamin_d_ug   || 0) * scale,
    magnesium_mg:   (data.magnesium_mg   || 0) * scale,
  }

  const hasMicros = ['sodium_mg','potassium_mg','calcium_mg','iron_mg','vitamin_c_mg','vitamin_d_ug','magnesium_mg']
    .some(k => (data[k] || 0) > 0)

  function handleQty(newQty) {
    setQty(newQty)
    onQuantityChange?.(newQty)
  }

  const cardStyle = {
    background: c?.card || (isDark ? '#1e1e1e' : '#fff'),
    borderRadius: c?.radius || 14,
    padding: '16px',
    boxShadow: c?.shadowCard || 'none',
  }

  const sectionLabel = {
    fontSize: 10, fontWeight: 700, color: c?.text4 || '#888',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
  }

  const score = data.quality_score || 75
  const scoreColor = score >= 70 ? '#4ADE80' : score >= 40 ? '#FACC15' : '#F87171'
  const ratingText = data.rating === 'Good' || score >= 70 ? '🟢 Bun' : data.rating === 'Caution' || score >= 40 ? '🟡 Atenție' : '🔴 Slab'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: `4px solid ${scoreColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 18, color: c?.text || '#fff', flexShrink: 0
          }}>
            {score}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c?.text || '#fff' }}>{ratingText}</div>
            <div style={{ fontSize: 11, color: c?.text3 || '#aaa', marginTop: 2 }}>
              {data.ingredients_analysis?.safe_count || items.length} ingrediente sigure · {data.ingredients_analysis?.concerns_count || 0} atenționări
            </div>
          </div>
        </div>
        {data.ingredients_analysis?.summary && (
          <div style={{ fontSize: 11, color: c?.text3 || '#aaa', lineHeight: 1.4, background: isDark ? 'rgba(0,0,0,0.2)' : '#f5efe6', padding: '8px 10px', borderRadius: 8 }}>
            {data.ingredients_analysis.summary}
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c?.text || '#fff', marginBottom: 2 }}>
              {data.name || 'Masă analizată'}
            </div>
            {data.weight_g && (
              <div style={{ fontSize: 12, color: c?.text4 || '#888' }}>Porție referință: {data.weight_g}g</div>
            )}
          </div>
        </div>

        {!readonly && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: c?.text4 || '#888', marginBottom: 7 }}>Cantitate / porție</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QTY_STEPS.map(q => (
                <button key={q} onClick={() => handleQty(q)} style={{
                  padding: '5px 10px', fontSize: 12, fontWeight: qty === q ? 700 : 500,
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  background: qty === q ? (c?.gradGreen || '#97C459') : (isDark ? 'rgba(255,255,255,0.07)' : '#F0EAE0'),
                  color: qty === q ? '#16291A' : (c?.text3 || '#aaa'),
                }}>
                  {q === 1 ? '1×' : `${q}×`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={sectionLabel}>Macronutrienți</div>
        <MacroDonut
          protein={d.protein_g}
          carbs={d.carbs_g}
          fat={d.fat_g}
          calories={d.calories}
          targetCal={targets.calories || 0}
          c={c}
        />
        {d.fiber_g > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${c?.border || 'rgba(255,255,255,0.1)'}`, fontSize: 12 }}>
            <span style={{ color: c?.text4 || '#888' }}>🌾 Fibre</span>
            <span style={{ fontWeight: 700, color: c?.text || '#fff' }}>{d.fiber_g}g</span>
          </div>
        )}
      </div>

      {hasMicros && (
        <div style={cardStyle}>
          <div style={sectionLabel}>Micronutrienți</div>
          {Object.entries(MICRO_TARGETS).map(([key, meta]) => (
            d[key] > 0 ? (
              <MicroBar key={key} label={meta.label} value={d[key]} target={meta.target} unit={meta.unit} warn={meta.warn} c={c} animated={animated}/>
            ) : null
          ))}
          <div style={{ fontSize: 10, color: c?.text4 || '#888', marginTop: 8, fontStyle: 'italic' }}>
            % din necesarul zilnic recomandat (adult)
          </div>
        </div>
      )}

      {readonly ? (
        items.length > 0 && (
          <div style={cardStyle}>
            <button onClick={() => setShowIngredients(o => !o)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit', padding: 0 }}>
              <span style={sectionLabel}>Ingrediente ({items.length})</span>
              <span style={{ fontSize: 11, color: c?.text4 || '#888', transform: showIngredients ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            {showIngredients && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {items.map((ing, i) => {
                  const status = ing?.status || 'safe'
                  const dotColor = status === 'warning' ? '#F87171' : status === 'caution' ? '#FACC15' : '#4ADE80'
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: i < items.length - 1 ? `0.5px solid ${c?.border || 'rgba(255,255,255,0.07)'}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }}/>
                        <span style={{ fontSize: 12, color: c?.text3 || '#aaa' }}>{typeof ing === 'string' ? ing : ing?.name || ''}</span>
                      </div>
                      {ing?.weight_g > 0 && <span style={{ fontSize: 11, color: c?.text4 || '#888' }}>{Math.round(ing.weight_g * scale)}g</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      ) : (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={sectionLabel}>Ingrediente & Evaluare ({items.length})</span>
            <span style={{ fontSize: 10, color: '#F0A830', fontWeight: 600 }}>AI · editabil</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {items.map((ing, i) => {
              const status = ing?.status || 'safe'
              const dotColor = status === 'warning' ? '#F87171' : status === 'caution' ? '#FACC15' : '#4ADE80'
              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.05)' : '#F6F1E8', borderRadius: 10, padding: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, marginLeft: 4 }}/>
                  <input value={typeof ing === 'string' ? ing : ing?.name || ''} placeholder="Ingredient" onChange={e => updateItem(i, 'name', e.target.value)}
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', borderBottom: `1px solid ${c?.border || 'rgba(255,255,255,0.2)'}`, color: c?.text || '#fff', fontSize: 13, padding: '3px 2px', fontFamily: 'inherit', outline: 'none' }}/>
                  <input type="number" inputMode="decimal" min="0" value={typeof ing === 'string' ? '' : ing?.weight_g ?? ''} onChange={e => updateItem(i, 'weight_g', e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: 50, background: isDark ? 'rgba(255,255,255,0.08)' : '#fff', border: '1px solid rgba(240,168,48,0.4)', borderRadius: 6, color: c?.text || '#fff', fontSize: 13, padding: '4px', textAlign: 'center', fontFamily: 'inherit', outline: 'none' }}/>
                  <span style={{ fontSize: 11, color: c?.text4 || '#888' }}>g</span>
                  <button onClick={() => removeItem(i)} aria-label="Șterge" style={{ background: 'none', border: 'none', cursor: 'pointer', color: c?.text4 || '#888', fontSize: 16, padding: '0 2px' }}>🗑</button>
                </div>
              )
            })}
          </div>
          <button onClick={addItem} style={{ width: '100%', marginTop: 10, padding: 9, background: 'transparent', border: '1px dashed rgba(240,168,48,0.5)', borderRadius: 10, color: '#F0A830', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            + Adaugă ingredient
          </button>
          {onRecalculate && (
            <button onClick={() => onRecalculate(items)} style={{ width: '100%', marginTop: 7, padding: 11, background: isDark ? 'rgba(66,133,244,0.15)' : '#E8F0FE', border: '1px solid rgba(66,133,244,0.4)', borderRadius: 10, color: '#4285F4', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              🔄 Recalculează cu AI
            </button>
          )}
        </div>
      )}

      {!readonly && (
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {onSave && (
            <button onClick={onSave} style={{ flex: '0 0 auto', padding: '13px 16px', background: isDark ? 'rgba(255,255,255,0.07)' : '#F0EAE0', border: 'none', borderRadius: c?.radiusSm || 10, color: c?.text3 || '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              ★ Favorite
            </button>
          )}
          {onAddToLog && (
            <button onClick={onAddToLog} style={{ flex: 1, padding: '13px', background: c?.gradGreen || '#97C459', border: 'none', borderRadius: c?.radiusSm || 10, color: '#16291A', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Adaugă în jurnal
            </button>
          )}
        </div>
      )}
    </div>
  )
}
