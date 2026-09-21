// src/pages/NutritionTracker.jsx — v2.4.3 fără cardul de aport manual (slidere)
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme, getColors } from '../lib/theme.jsx'
import { supabase } from '../lib/supabase'
import MealLog from '../components/MealLog'
import SplineChart from '../components/SplineChart'
import VitaminDTracker from '../components/VitaminDTracker'

// ── Bază de date surse recomandate pentru micronutrienți cu valoare zero ──────
const MICRO_SOURCES_RECOMMENDATIONS = {
  'Vitamina A': 'Surse recomandate: Ficat, morcovi, cartofi dulci, spanac, ouă, unt.',
  'Vitamina D': 'Surse recomandate: Pește gras (somon, macrou), ulei de ficat de cod, Gălbenuș de ou, expunere la soare.',
  'Vitamina E': 'Surse recomandate: Semințe de floarea-soarelui, migdale, alune, avocado, ulei de măsline.',
  'Vitamina K': 'Surse recomandate: Leguminoase cu frunze verzi (spanac, kale, broccoli), uleiuri vegetale.',
  'Vitamina B6': 'Surse recomandate: Carne de pasăre, pește, cartofi, banane, semințe de floarea-soarelui.',
  'Vitamina B12': 'Surse recomandate: Carne de vită, pește, ouă, lactate, produse fortificate.',
  'Vitamina C': 'Surse recomandate: Ardei gras, citrice (portocale, lămâi), kiwi, căpșuni, broccoli.',
  'Folat (B9)': 'Surse recomandate: Frunze verzi, linte, fasole, sparanghel, avocado, ficat.',
  'Niacin (B3)': 'Surse recomandate: Carne de pui, ton, somon, carne de vită, arahide, ciuperci.',
  'Thiamin (B1)': 'Surse recomandate: Carne de porc, semințe de floarea-soarelui, nuci, cereale integrale.',
  'Riboflavin (B2)': 'Surse recomandate: Lactate, ouă, carne slabă, migdale, spanac.',
  'Biotin (B7)': 'Surse recomandate: Gălbenuș de ou, ficat, nuci, semințe, cartofi dulci.',
  'Acid pantotenic (B5)': 'Surse recomandate: Ficat, carne de pui, ciuperci, avocado, nuci, cereale integrale.',
  'Colină': 'Surse recomandate: Gălbenuș de ou, carne de vită, ficat, somon, broccoli.',
  'Potasiu': 'Surse recomandate: Banane, cartofi dulci, spanac, avocado, fasole albă, iaurt.',
  'Calciu': 'Surse recomandate: Lactate (lapte, brânză, iaurt), semințe de chia, sardine, broccoli.',
  'Fier': 'Surse recomandate: Carne roșie, ficat, spanac, linte, semințe de dovleac.',
  'Magneziu': 'Surse recomandate: Nuci (migdale, caju), semințe, spanac, avocado, ciocolată neagră.',
  'Zinc': 'Surse recomandate: Stridie, carne roșie, carne de pasăre, semințe de dovleac, linte.',
  'Fosfor': 'Surse recomandate: Lactate, carne, pește, nuci, semințe, cereale integrale.',
  'Seleniu': 'Surse recomandate: nuci Brazilia, pește, fructe de mare, carne de pui, ouă.',
  'Cupru': 'Surse recomandate: Ficat, fructe de mare (stridii), nuci (caju), semințe de floarea-soarelui, ciocolată neagră.',
  'Mangan': 'Surse recomandate: Nuci, leguminoase, orez brun, ceai negru, spanac.',
  'Fibre': 'Surse recomandate: Leguminoase, cereale integrale, ovăz, semințe de chia, fructe de pădure.',
  'Omega-3': 'Surse recomandate: Pește gras (somon, sardine), semințe de in, nuci, ulei de pește.',
  'Crom': 'Surse recomandate: Broccoli, carne de vită, cereale integrale, mere, nuci.',
  'Iod': 'Surse recomandate: Fructe de mare, pește de ocean, sare iodată, lactate, alge marine.',
  'Zahar': 'Sursă de carbohidrați simpli (de limitat în dietă).',
  'Grasimi saturate': 'Prezente în carne grasă, unt, ulei de cocos (de consumat cu moderație).'
}

// ── Calcule TDEE ──────────────────────────────────────────────────────────────
function calcTDEE(profile) {
  if (!profile?.weight_kg || !profile?.height_cm || !profile?.age) return null
  const bmr = Math.round(88.36 + 13.4 * profile.weight_kg + 4.8 * profile.height_cm - 5.7 * profile.age)
  return Math.round(bmr * (1 + (profile.days_per_week || 4) * 0.075))
}

function calcTargets(profile, tdee) {
  if (!tdee) return { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, fiber_g: 30 }
  const goal = profile?.goal || 'hipertrofie'
  const weight = profile?.weight_kg || 80
  const calTarget = goal === 'slabit' ? Math.round(tdee * 0.85)
    : goal === 'hipertrofie' || goal === 'forta' ? Math.round(tdee * 1.1)
    : tdee
  const proteinTarget = goal === 'slabit' ? Math.round(weight * 2.2)
    : goal === 'hipertrofie' || goal === 'forta' ? Math.round(weight * 2.0)
    : Math.round(weight * 1.6)
  const fatTarget = Math.round(calTarget * 0.25 / 9)
  const carbTarget = Math.round((calTarget - proteinTarget * 4 - fatTarget * 9) / 4)
  return { calories: calTarget, protein_g: proteinTarget, carbs_g: Math.max(carbTarget, 50), fat_g: fatTarget, fiber_g: 30 }
}

function MacroDonut({ protein, carbs, fat, calories, target, c }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [protein, carbs, fat])

  const total = protein * 4 + carbs * 4 + fat * 9
  const protPct = total > 0 ? (protein * 4 / total) * 100 : 0
  const carbPct = total > 0 ? (carbs * 4 / total) * 100 : 0
  const fatPct  = total > 0 ? (fat * 9  / total) * 100 : 0

  const R = 44
  const C = 2 * Math.PI * R
  const protLen = animated ? (protPct / 100) * C : 0
  const carbLen = animated ? (carbPct / 100) * C : 0
  const fatLen  = animated ? (fatPct  / 100) * C : 0

  const transition = 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1), stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r={R} fill="none" stroke={c.card2} strokeWidth="14"/>
          <circle cx="75" cy="75" r={R} fill="none" stroke="#97C459" strokeWidth="14"
            style={{ transition }}
            strokeDasharray={`${protLen} ${C}`}
            strokeDashoffset={C * 0.25}
            strokeLinecap="butt" transform="rotate(-90 75 75)"/>
          <circle cx="75" cy="75" r={R} fill="none" stroke="#4A7EB5" strokeWidth="14"
            style={{ transition }}
            strokeDasharray={`${carbLen} ${C}`}
            strokeDashoffset={C * 0.25 - protLen}
            strokeLinecap="butt" transform="rotate(-90 75 75)"/>
          <circle cx="75" cy="75" r={R} fill="none" stroke="#F0A830" strokeWidth="14"
            style={{ transition }}
            strokeDasharray={`${fatLen} ${C}`}
            strokeDashoffset={C * 0.25 - protLen - carbLen}
            strokeLinecap="butt" transform="rotate(-90 75 75)"/>
        </svg>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: calories > target ? c.red : c.text }}>{Math.round(calories)}</div>
          <div style={{ fontSize: 9, color: c.text4 }}>kcal</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        {[['Proteine', protein, '#97C459', 'g'], ['Carbohidrați', carbs, '#4A7EB5', 'g'], ['Grăsimi', fat, '#F0A830', 'g']].map(([label, val, color, unit]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}/>
            <div style={{ flex: 1, fontSize: 12, color: c.text3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{Math.round(val)}{unit}</div>
            <div style={{ fontSize: 11, color: c.text4, width: 30, textAlign: 'right' }}>{total > 0 ? Math.round(val * (label === 'Grăsimi' ? 9 : 4) / total * 100) : 0}%</div>
          </div>
        ))}
        <div style={{ height: '0.5px', background: c.border, margin: '8px 0' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: c.text4 }}>Total calorii</span>
          <span style={{ color: c.text, fontWeight: 600 }}>{Math.round(total)} kcal</span>
        </div>
      </div>
    </div>
  )
}

export default function NutritionTracker({ onBack }) {
  const { user } = useAuth()
  const { theme } = useTheme()
  const c = getColors(theme)

  const today = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(today)
  const [profile, setProfile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('today')
  const [showPhotoAnalyzer, setShowPhotoAnalyzer] = useState(false)
  const [meals, setMeals] = useState([])
  const [mealsLoading, setMealsLoading] = useState(false)
  const [solarVitaminD, setSolarVitaminD] = useState(0)
  const [recentActivities, setRecentActivities] = useState([])

  // Stări pentru Favorite & Modal Gramaj Avansat
  const [showFavoritesModal, setShowFavoritesModal] = useState(false)
  const [favoriteFoodsList, setFavoriteFoodsList] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [favoritesFilter, setFavoritesFilter] = useState('recente')
  
  const [selectedFavForModal, setSelectedFavForModal] = useState(null)
  const [customQuantityGrams, setCustomQuantityGrams] = useState(100)

  // Stări pentru secțiunile informative extinse (Vitamine și Minerale)
  const [showMoreVit, setShowMoreVit] = useState(false)
  const [showMoreMin, setShowMoreMin] = useState(false)

  // Stare pentru rândul expandat din tabelul de micronutrienți
  const [activeMicroSource, setActiveMicroSource] = useState(null)
  const [showQualityModal, setShowQualityModal] = useState(false)

  // Stări pentru secțiunea Suplimente
  const [suppInputMode, setSuppInputMode] = useState('manual')
  const [manualSuppForm, setManualSuppForm] = useState({ name: '', key: 'Vitamina D', value: '', saveToProfile: true })
  const [aiSuppText, setAiSuppText] = useState('')
  const [aiAnalyzing, setAiAnalyzing] = useState(false)

  const [takenSavedSupps, setTakenSavedSupps] = useState({})
  const [manualSupps, setManualSupps] = useState([])

  const [takenSupplements, setTakenSupplements] = useState([])
  const [values, setValues] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 })

  const tdee = calcTDEE(profile)
  const targets = calcTargets(profile, tdee)

  useEffect(() => {
    try {
      const savedManual = localStorage.getItem('forma_supps_' + selectedDate)
      if (savedManual) setManualSupps(JSON.parse(savedManual))
      else setManualSupps([])

      const savedTaken = localStorage.getItem('forma_taken_saved_' + selectedDate)
      if (savedTaken) setTakenSavedSupps(JSON.parse(savedTaken))
      else setTakenSavedSupps({})
    } catch (e) {
      setManualSupps([])
      setTakenSavedSupps({})
    }
  }, [selectedDate])

  const vitaminGuides = [
    {
      title: "Ghid esențial: Vitaminele și Limitele Admise",
      img: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=150&auto=format&fit=crop&q=80",
      text: "Vitaminele sunt compuși organici esențiali pe care organismul nu îi poate sintetiza în cantități suficiente. Cele mai critice includ **Vitamina D** (esențială pentru imunitate și osatură), **Vitamina C** (puternic antioxidant) și complexul **B**.",
      more: " Aportul excesiv (supradozajul) apare de obicei doar în cazul suplimentelor în doze masive. Vitaminele hidrosolubile (C și complexul B) se elimină ușor prin urină, însă un exces cronic de Vitamina C poate provoca disconfort gastric sau pietre la rinichi. În schimb, vitaminele liposolubile (A, D, E, K) se acumulează în ficat și țesutul adipos; hipervitaminoza A sau D poate duce la toxicitate gravă, afectând ficatul, oasele și sistemul cardiovascular. Respectarea dozelor zilnice recomandate (RDA) este esențială pentru echilibru."
    },
    {
      title: "Aprofundare: Rolul Vitaminelor Liposolubile vs Hidrosolubile",
      img: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=150&auto=format&fit=crop&q=80",
      text: "Înțelegerea diferenței dintre vitaminele hidrosolubile și cele liposolubile te ajută să evite carențele, dar și riscul de supradozaj prin suplimente neavizate.",
      more: " Vitaminele B și C trebuie consumate constant prin dietă deoarece nu se stochează în corp. În schimb, Vitamina A, D, E și K se depozitează în rezervele organismului. De aceea, suplimentarea cu doze mari de vitamine liposolubile se face doar la recomandarea medicală bazată pe analize de sânge, pentru a preveni acumularea toxică."
    }
  ];

  const mineralGuides = [
    {
      title: "Ghid esențial: Mineralele și Pragurile Critice",
      img: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=150&auto=format&fit=crop&q=80",
      text: "Mineralele precum **Magneziul, Potasiul, Calciul și Fierul** susțin contracția musculară, echilibrul electrolitic și funcția nervoasă. Carențele duc rapid la oboseală, crampe sau scăderea randamentului fizic.",
      more: " Pe de altă parte, depășirea limitelor admise (Upper Limits) comportă riscuri notabile. Un exces de **Fier** poate genera stres oxidativ și toxicitate la nivelul organelor interne. Dozele masive de **Magneziu** din suplimente provoacă frecvent tulburări digestive severe (diaree), în timp ce excesul de **Sodiu** contribuie direct la hipertensiune arterială și retenție de apă. Echilibrul prin alimentație diversificată și suplimentare avizată rămâne regula de aur."
    },
    {
      title: "Aprofundare: Echilibrul Electroliților și Performanța",
      img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=150&auto=format&fit=crop&q=80",
      text: "Electroliții (Sodiu, Potasiu, Magneziu, Calciu) sunt responsabili pentru transmiterea impulsurilor nervoase și hidratarea celulară optimă, mai ales în zilele cu antrenamente intense.",
      more: " Pierderea lor prin transpirație poate cauza crampe musculare și scăderea forței. Asigură-te că incluzi în alimentație surse bogate în potasiu (banane, cartofi dulci) și magneziu (nuci, semințe, legume cu frunze verzi) pentru a menține un homeostasis corect fără a depăși pragurile maxime admise."
    }
  ];

  const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return weekNo;
  }

  const currentWeekIndex = getWeekNumber(new Date());
  const [vitIndexOffset, setVitIndexOffset] = useState(0);
  const [minindexOffset, setMinIndexOffset] = useState(0);

  const activeVitIndex = (currentWeekIndex + vitIndexOffset) % vitaminGuides.length;
  const activeMinIndex = (currentWeekIndex + minindexOffset) % mineralGuides.length;

  const currentVitGuide = vitaminGuides[(activeVitIndex + vitaminGuides.length) % vitaminGuides.length];
  const currentMinGuide = mineralGuides[(activeMinIndex + mineralGuides.length) % mineralGuides.length];

  const touchVitRef = useRef({ startX: 0 });
  const handleVitTouchStart = (e) => { touchVitRef.current.startX = e.touches[0].clientX; }
  const handleVitTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchVitRef.current.startX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setVitIndexOffset(prev => prev - 1);
      else setVitIndexOffset(prev => prev + 1);
    }
  }

  const touchMinRef = useRef({ startX: 0 });
  const handleMinTouchStart = (e) => { touchMinRef.current.startX = e.touches[0].clientX; }
  const handleMinTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - touchMinRef.current.startX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) setMinIndexOffset(prev => prev - 1);
      else setMinIndexOffset(prev => prev + 1);
    }
  }

  const loadMeals = useCallback(async (date) => {
    if (!user?.id) return
    setMealsLoading(true)
    try {
      const { data } = await supabase
        .from('meal_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at', { ascending: true })
      
      if (data) setMeals(data)
      else setMeals([])
    } catch (err) { 
      console.warn(err); 
      setMeals([]) 
    } finally { 
      setMealsLoading(false) 
    }
  }, [user])

  const loadDay = useCallback(async (date) => {
    if (!user?.id) return
    const { data } = await supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', date).single()
    if (data) {
      setValues({ calories: data.calories || 0, protein_g: data.protein_g || 0, carbs_g: data.carbs_g || 0, fat_g: data.fat_g || 0, fiber_g: data.fiber_g || 0, sugar_g: data.sugar_g || 0 })
      setSolarVitaminD(data.solar_vitamin_d || 0)
      if (data.supplements) setTakenSupplements(data.supplements)
      else setTakenSupplements([])
    } else {
      setValues({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 })
      setSolarVitaminD(0)
      setTakenSupplements([])
    }
    loadMeals(date)
  }, [user, loadMeals])

  useEffect(() => {
    if (!user?.id) return
    loadProfile()
    loadHistory()
    loadActivities()
  }, [user, selectedDate])

  useEffect(() => {
    loadDay(selectedDate)
  }, [selectedDate, loadDay])

  async function loadActivities() {
    try {
      const { data } = await supabase.from('activities').select('*').eq('user_id', user.id).eq('date', selectedDate)
      if (data) setRecentActivities(data)
    } catch (e) {}
  }

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('goal,level,days_per_week,age,height_cm,weight_kg,skin_type,saved_supplements').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  async function loadHistory() {
    const { data: logs } = await supabase.from('nutrition_logs').select('*')
      .eq('user_id', user.id).order('date', { ascending: false }).limit(30)

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    const { data: mealsData } = await supabase.from('meal_entries').select('date,calories,protein_g,carbs_g,fat_g,fiber_g')
      .eq('user_id', user.id).gte('date', cutoff.toISOString().slice(0,10))

    const byDate = {}
    for (const m of (mealsData || [])) {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
      byDate[m.date].calories  += m.calories  || 0
      byDate[m.date].protein_g += m.protein_g || m.protein || 0
      byDate[m.date].carbs_g   += m.carbs_g   || m.carbs || 0
      byDate[m.date].fat_g     += m.fat_g     || m.fat || 0
      byDate[m.date].fiber_g   += m.fiber_g   || m.fiber || 0
    }
    for (const l of (logs || [])) {
      if (!byDate[l.date]) byDate[l.date] = l
      else {
        byDate[l.date].calories  = (byDate[l.date].calories  || 0) + (l.calories  || 0)
        byDate[l.date].protein_g = (byDate[l.date].protein_g || 0) + (l.protein_g || 0)
        byDate[l.date].carbs_g   = (byDate[l.date].carbs_g   || 0) + (l.carbs_g   || 0)
        byDate[l.date].fat_g     = (byDate[l.date].fat_g     || 0) + (l.fat_g     || 0)
      }
    }

    const combined = Object.values(byDate).sort((a,b) => b.date.localeCompare(a.date))
    setHistory(combined)
  }

  async function loadFavoriteFoods() {
    if (!user?.id) return
    setFavoritesLoading(true)
    try {
      let query = supabase.from('favorite_foods').select('*')
      
      if (favoritesFilter === 'recente') {
        query = query.order('created_at', { ascending: false })
      } else if (favoritesFilter === 'des') {
        query = query.order('use_count', { ascending: false })
      } else if (favoritesFilter === 'az') {
        query = query.order('name', { ascending: true })
      } else if (favoritesFilter === 'ora') {
        query = query.order('updated_at', { ascending: false })
      }

      const { data, error } = await query
      if (error) throw error
      setFavoriteFoodsList(data || [])
    } catch (err) {
      console.warn("Eroare la încărcarea favoritelor:", err)
      setFavoriteFoodsList([])
    } finally {
      setFavoritesLoading(false)
    }
  }

  useEffect(() => {
    if (showFavoritesModal) {
      loadFavoriteFoods()
    }
  }, [favoritesFilter, showFavoritesModal])

  async function confirmAddFavoriteWithQuantity() {
    if (!selectedFavForModal) return
    const fav = selectedFavForModal
    const baseWeight = fav.total_weight_g || 100
    const ratio = customQuantityGrams / baseWeight

    const finalCals = Math.round((fav.calories || 0) * ratio)
    const finalProt = Math.round((fav.protein_g || 0) * ratio * 10) / 10
    const finalCarbs = Math.round((fav.carbs_g || 0) * ratio * 10) / 10
    const finalFat = Math.round((fav.fat_g || 0) * ratio * 10) / 10
    const finalFiber = Math.round((fav.fiber_g || 0) * ratio * 10) / 10

    try {
      const { error } = await supabase.from('meal_entries').insert({
        user_id: user.id,
        date: selectedDate,
        name: `${fav.name} (${customQuantityGrams}g)`,
        calories: finalCals,
        protein_g: finalProt,
        carbs_g: finalCarbs,
        fat_g: finalFat,
        fiber_g: finalFiber,
        meta_json: fav.meta_json || null,
        image_url: fav.image_url || null
      })

      if (error) throw error

      await supabase
        .from('favorite_foods')
        .update({ use_count: (fav.use_count || 1) + 1 })
        .eq('id', fav.id)

      setSelectedFavForModal(null)
      setShowFavoritesModal(false)
      loadDay(selectedDate)
    } catch (err) {
      alert("Eroare la adăugarea în jurnal: " + err.message)
    }
  }

  async function handleAddSupplementSubmit(suppItem) {
    const nextManual = [...manualSupps, suppItem]
    setManualSupps(nextManual)
    try { localStorage.setItem('forma_supps_' + selectedDate, JSON.stringify(nextManual)) } catch (e) {}

    if (suppItem.saveToProfile) {
      try {
        const currentSaved = profile?.saved_supplements || []
        if (!currentSaved.some(s => s.name.toLowerCase() === suppItem.name.toLowerCase())) {
          const newSavedItem = {
            id: 'supp_' + Date.now(),
            name: suppItem.name,
            micros: suppItem.micros || [{ key: suppItem.key, value: suppItem.value }]
          }
          const updatedSaved = [...currentSaved, newSavedItem]
          await supabase.from('profiles').update({ saved_supplements: updatedSaved }).eq('id', user.id)
          setProfile(p => ({ ...p, saved_supplements: updatedSaved }))
        }
      } catch (e) {
        console.warn("Eroare la salvarea în profil:", e)
      }
    }
  }

  async function handleAiAnalyzeSupplement() {
    if (!aiSuppText.trim()) return
    setAiAnalyzing(true)
    try {
      const text = aiSuppText.trim()
      let detectedKey = 'Vitamina C'
      let detectedVal = 500
      let micros = []

      const lower = text.toLowerCase()
      if (lower.includes('magneziu') || lower.includes('magnesium')) {
        detectedKey = 'Magneziu'
        detectedVal = 250
        micros = [{ key: 'Magneziu', value: 250 }]
      } else if (lower.includes('vitamina c') || lower.includes('vitamin c')) {
        detectedKey = 'Vitamina C'
        detectedVal = 600
        micros = [{ key: 'Vitamina C', value: 600 }]
      } else if (lower.includes('vitamina d') || lower.includes('d3')) {
        detectedKey = 'Vitamina D'
        detectedVal = 100
        micros = [{ key: 'Vitamina D', value: 100 }]
      } else if (lower.includes('zinc')) {
        detectedKey = 'Zinc'
        detectedVal = 15
        micros = [{ key: 'Zinc', value: 15 }]
      } else if (lower.includes('omega') || lower.includes('fish oil')) {
        detectedKey = 'Omega-3'
        detectedVal = 1000
        micros = [{ key: 'Omega-3', value: 1000 }]
      } else {
        micros = [{ key: 'Vitamina C', value: 100 }]
      }

      const newItem = {
        id: Date.now(),
        name: text,
        key: detectedKey,
        value: detectedVal,
        micros,
        saveToProfile: true
      }

      await handleAddSupplementSubmit(newItem)
      setAiSuppText('')
    } catch (err) {
      alert("Eroare la analiza AI: " + err.message)
    } finally {
      setAiAnalyzing(false)
    }
  }

  async function saveDay() {
    setSaving(true)
    try {
      await supabase.from('nutrition_logs').upsert({
        user_id: user.id,
        date: selectedDate,
        ...values,
        solar_vitamin_d: solarVitaminD,
        supplements: takenSupplements,
      }, { onConflict: 'user_id,date' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      loadHistory()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const isD3Taken = takenSupplements.some(s => {
    const name = typeof s === 'string' ? s : (s?.name || s?.title || '')
    const lower = name.toLowerCase()
    return lower.includes('vitamina d3') || lower.includes('d3') || lower.includes('vitamina d')
  }) || manualSupps.some(m => m.key === 'Vitamina D' || m.key === 'vit_d')

  const isVitaminCTaken = takenSupplements.some(s => {
    const name = typeof s === 'string' ? s : (s?.name || s?.title || '')
    return name.toLowerCase().includes('vitamina c')
  }) || manualSupps.some(m => m.key === 'Vitamina C' || m.key === 'vit_c')

  const isMagnesiumTaken = takenSupplements.some(s => {
    const name = typeof s === 'string' ? s : (s?.name || s?.title || '')
    return name.toLowerCase().includes('magneziu')
  }) || manualSupps.some(m => m.key === 'Magneziu' || m.key === 'magnesium')

  const isCalciumTaken = takenSupplements.some(s => {
    const name = typeof s === 'string' ? s : (s?.name || s?.title || '')
    return name.toLowerCase().includes('calciu') || name.toLowerCase().includes('fleximobil')
  }) || manualSupps.some(m => m.key === 'Calciu' || m.key === 'calcium')

  const mealsTotal = meals.reduce((acc, m) => ({
    calories: acc.calories + Number(m.calories || 0),
    protein_g: acc.protein_g + Number(m.protein_g || m.protein || 0),
    carbs_g: acc.carbs_g + Number(m.carbs_g || m.carbs || 0),
    fat_g: acc.fat_g + Number(m.fat_g || m.fat || 0),
    fiber_g: acc.fiber_g + Number(m.fiber_g || m.fiber || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 })

  const combinedTotals = {
    calories: values.calories + mealsTotal.calories,
    protein_g: values.protein_g + mealsTotal.protein_g,
    carbs_g: values.carbs_g + mealsTotal.carbs_g,
    fat_g: values.fat_g + mealsTotal.fat_g,
    fiber_g: values.fiber_g + mealsTotal.fiber_g,
  }

  const aggregatedMicros = meals.reduce((acc, m) => {
    try {
      const meta = typeof m.meta_json === 'string' ? JSON.parse(m.meta_json) : m.meta_json
      const micros = meta?.micronutrients

      if (micros) {
        ;(micros.vitamins || []).forEach(v => {
          if (!acc.vitamins[v.name]) acc.vitamins[v.name] = []
          const num = parseFloat(v.val) || 0
          if (num > 0) acc.vitamins[v.name].push({ mealName: m.name || 'Masă', val: num })
        })
        ;(micros.minerals || []).forEach(min => {
          if (!acc.minerals[min.name]) acc.minerals[min.name] = []
          const num = parseFloat(min.val) || 0
          if (num > 0) acc.minerals[min.name].push({ mealName: m.name || 'Masă', val: num })
        })
        ;(micros.antioxidants || []).forEach(ant => {
          if (!acc.antioxidants[ant.name]) acc.antioxidants[ant.name] = []
          const num = parseFloat(ant.val) || 0
          if (num > 0) acc.antioxidants[ant.name].push({ mealName: m.name || 'Masă', val: num })
        })
        ;(micros.others || micros.other || []).forEach(oth => {
          if (!acc.others[oth.name]) acc.others[oth.name] = []
          const num = parseFloat(oth.val) || 0
          if (num > 0) acc.others[oth.name].push({ mealName: m.name || 'Masă', val: num })
        })
      }

      const directVitamins = m.vitamins || meta?.vitamins || {}
      Object.entries(directVitamins).forEach(([k, v]) => {
        if (!acc.vitamins[k]) acc.vitamins[k] = []
        const num = parseFloat(v) || 0
        if (num > 0) acc.vitamins[k].push({ mealName: m.name || 'Masă', val: num })
      })

      const directMinerals = m.minerals || meta?.minerals || {}
      Object.entries(directMinerals).forEach(([k, v]) => {
        if (!acc.minerals[k]) acc.minerals[k] = []
        const num = parseFloat(v) || 0
        if (num > 0) acc.minerals[k].push({ mealName: m.name || 'Masă', val: num })
      })

      const directAntioxidants = m.antioxidants || meta?.antioxidants || {}
      Object.entries(directAntioxidants).forEach(([k, v]) => {
        if (!acc.antioxidants[k]) acc.antioxidants[k] = []
        const num = parseFloat(v) || 0
        if (num > 0) acc.antioxidants[k].push({ mealName: m.name || 'Masă', val: num })
      })

      const directOthers = m.others || meta?.others || {}
      Object.entries(directOthers).forEach(([k, v]) => {
        if (!acc.others[k]) acc.others[k] = []
        const num = parseFloat(v) || 0
        if (num > 0) acc.others[k].push({ mealName: m.name || 'Masă', val: num })
      })
    } catch (e) {}
    return acc
  }, { vitamins: {}, minerals: {}, antioxidants: {}, others: {} })

  const totalFiberVal = Math.round(((combinedTotals.fiber_g || 0) + (aggregatedMicros.others['Fibre'] || []).reduce((a,b)=>a+b.val,0)) * 10) / 10

  manualSupps.forEach(ms => {
    const microsList = ms.micros || [{ key: ms.key, value: ms.value }]
    microsList.forEach(micro => {
      const k = micro.key
      const val = micro.value
      const name = ms.name || ms.key

      const targetMap = {
        'Vitamina D': 'Vitamina D', 'vit_d': 'Vitamina D',
        'Vitamina C': 'Vitamina C', 'vit_c': 'Vitamina C',
        'Vitamina B12': 'Vitamina B12', 'vit_b12': 'Vitamina B12',
        'Vitamina A': 'Vitamina A', 'vit_a': 'Vitamina A',
        'Magneziu': 'Magneziu', 'magnesium': 'Magneziu',
        'Calciu': 'Calciu', 'calcium': 'Calciu',
        'Fier': 'Fier', 'iron': 'Fier',
        'Potasiu': 'Potasiu', 'potassium': 'Potasiu',
        'Sodiu': 'Sodiu', 'sodium': 'Sodiu',
        'Fibre': 'Fibre', 'fiber': 'Fibre',
        'Zinc': 'Zinc', 'zinc': 'Zinc',
        'Cupru': 'Cupru', 'copper': 'Cupru',
        'Mangan': 'Mangan', 'manganese': 'Mangan',
        'Seleniu': 'Seleniu', 'selenium': 'Seleniu',
        'Crom': 'Crom', 'chromium': 'Crom',
        'Iod': 'Iod', 'iodine': 'Iod',
        'Vitamina B1': 'Thiamin (B1)', 'vit_b1': 'Thiamin (B1)',
        'Vitamina B2': 'Riboflavin (B2)', 'vit_b2': 'Riboflavin (B2)',
        'Vitamina B3': 'Niacin (B3)', 'vit_b3': 'Niacin (B3)',
        'Vitamina B5': 'Acid pantotenic (B5)', 'vit_b5': 'Acid pantotenic (B5)',
        'Vitamina B6': 'Vitamina B6', 'vit_b6': 'Vitamina B6',
        'Biotina (B7)': 'Biotin (B7)', 'biotin': 'Biotin (B7)',
        'Folat (B9)': 'Folat (B9)', 'folate': 'Folat (B9)',
        'Vitamina E': 'Vitamina E', 'vit_e': 'Vitamina E',
        'Vitamina K': 'Vitamina K', 'vit_k': 'Vitamina K',
        'Omega-3': 'Omega-3', 'omega3': 'Omega-3',
        'Creatină': 'Creatină', 'creatine': 'Creatină',
        'L-Carnitină': 'L-Carnitină', 'carnitine': 'L-Carnitină',
        'L-Citrulină': 'L-Citrulină', 'citrulline': 'L-Citrulină'
      }

      const mappedName = targetMap[k] || targetMap[k?.toLowerCase()] || name
      if (['Vitamina A', 'Vitamina D', 'Vitamina E', 'Vitamina K', 'Vitamina B6', 'Vitamina B12', 'Vitamina C', 'Folat (B9)', 'Niacin (B3)', 'Thiamin (B1)', 'Riboflavin (B2)', 'Biotin (B7)', 'Acid pantotenic (B5)', 'Colină'].includes(mappedName)) {
        if (!aggregatedMicros.vitamins[mappedName]) aggregatedMicros.vitamins[mappedName] = []
        aggregatedMicros.vitamins[mappedName].push({ mealName: `💊 ${name}`, val })
      } else if (['Potasiu', 'Calciu', 'Fier', 'Magneziu', 'Zinc', 'Fosfor', 'Seleniu', 'Cupru', 'Mangan', 'Sodiu', 'Crom', 'Iod'].includes(mappedName)) {
        if (!aggregatedMicros.minerals[mappedName]) aggregatedMicros.minerals[mappedName] = []
        aggregatedMicros.minerals[mappedName].push({ mealName: `💊 ${name}`, val })
      } else {
        if (!aggregatedMicros.others[mappedName]) aggregatedMicros.others[mappedName] = []
        aggregatedMicros.others[mappedName].push({ mealName: `💊 ${name}`, val })
      }
    })
  })

  const calRemaining = targets.calories - combinedTotals.calories
  const calPct = Math.min(100, Math.round((combinedTotals.calories / targets.calories) * 100))

  const supplementVitD_UI = isD3Taken ? 100 * 40 : 0
  const totalVitaminD_UI = supplementVitD_UI + (solarVitaminD || 0)
  const totalVitaminD_mcg = Math.round((totalVitaminD_UI / 40) * 10) / 10

  const getVitValNum = (name, suppVal = 0) => {
    const list = aggregatedMicros.vitamins[name] || []
    const sumMeals = list.reduce((acc, item) => acc + item.val, 0)
    return Math.round((sumMeals + suppVal) * 10) / 10
  }

  const getMinValNum = (name, suppVal = 0) => {
    const list = aggregatedMicros.minerals[name] || []
    const sumMeals = list.reduce((acc, item) => acc + item.val, 0)
    return Math.round((sumMeals + suppVal) * 10) / 10
  }

  const getOthValNum = (name) => {
    if (name === 'Fibre') return totalFiberVal
    const list = aggregatedMicros.others[name] || []
    const sumMeals = list.reduce((acc, item) => acc + item.val, 0)
    return Math.round(sumMeals * 10) / 10
  }

  const getAntValNum = (name, suppVal = 0) => {
    const list = aggregatedMicros.antioxidants[name] || []
    const sumMeals = list.reduce((acc, item) => acc + item.val, 0)
    return Math.round((sumMeals + suppVal) * 10) / 10
  }

  const seleniuVal = getMinValNum('Seleniu')
  const vitCVal = getVitValNum('Vitamina C', isVitaminCTaken ? 600 : 0)
  const vitAVal = getVitValNum('Vitamina A')
  const vitEVal = getVitValNum('Vitamina E')
  const luteinVal = getAntValNum('Luteină + Zeaxantină')
  
  // Calcul scor antioxidant robust, plafonat individual la 100% per nutrient
  const seleniuPct = Math.min(100, (seleniuVal / 55) * 100)
  const vitCPct = Math.min(100, (vitCVal / 90) * 100)
  const vitAPct = Math.min(100, (vitAVal / 900) * 100)
  const vitEPct = Math.min(100, (vitEVal / 15) * 100)
  const luteinPct = Math.min(100, (luteinVal / 1000) * 100)

  const antScoreRaw = Math.round(
    (seleniuPct * 0.25) +
    (vitCPct * 0.25) +
    (vitAPct * 0.20) +
    (vitEPct * 0.15) +
    (luteinPct * 0.15)
  )
  const antioxidantScore = isNaN(antScoreRaw) ? 0 : antScoreRaw
  const antScoreColor = antioxidantScore >= 80 ? '#4ade80' : antioxidantScore >= 50 ? '#f0a830' : '#f87171'

  const getMicroSourcesDetail = (name, suppVal, suppLabel) => {
    const isVit = ['Vitamina A', 'Vitamina D', 'Vitamina E', 'Vitamina K', 'Vitamina B6', 'Vitamina B12', 'Vitamina C', 'Folat (B9)', 'Niacin (B3)', 'Thiamin (B1)', 'Riboflavin (B2)', 'Biotin (B7)', 'Acid pantotenic (B5)', 'Colină'].includes(name)
    const isAnt = ['Seleniu', 'Vitamina C', 'Vitamina A', 'Vitamina E', 'Luteină + Zeaxantină'].includes(name)
    const isMin = ['Potasiu', 'Calciu', 'Fier', 'Magneziu', 'Zinc', 'Fosfor', 'Cupru', 'Mangan', 'Sodiu', 'Crom', 'Iod'].includes(name)
    
    let rawList = []
    if (isAnt && aggregatedMicros.antioxidants[name]) {
      rawList = aggregatedMicros.antioxidants[name]
    } else if (isVit) {
      rawList = aggregatedMicros.vitamins[name] || []
    } else if (isMin) {
      rawList = aggregatedMicros.minerals[name] || []
    } else {
      rawList = aggregatedMicros.others[name] || []
    }
    
    let sources = [...rawList]
    if (suppVal > 0) {
      sources.push({ mealName: suppLabel, val: suppVal })
    }

    return sources
  }

  const filteredFavorites = favoriteFoodsList.filter(fav => 
    fav.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const s = {
    page: { minHeight: '100vh', background: c.bg, padding: '0.75rem 1rem', fontFamily: c.fontFamily, maxWidth: 640, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem', paddingBottom: '0.5rem' },
    card: { background: c.card, borderRadius: c.radius, padding: '1.2rem', marginBottom: '1.1rem', boxShadow: c.shadowCard, touchAction: 'pan-y' },
    sectionLabel: { fontSize: 11, fontWeight: 600, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.85rem' },
    tab: { padding: '7px 16px', fontSize: 12, borderRadius: c.radiusSm, cursor: 'pointer', color: c.text3, border: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 500 },
    tabActive: { background: c.card3, color: c.text, fontWeight: 700 },
    saveBtn: { padding: '12px 20px', background: saved ? c.green3 : saving ? c.card2 : c.gradGreen, border: 'none', borderRadius: c.radiusSm, color: saved ? c.green : '#16291A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxShadow: saved || saving ? 'none' : c.shadowGlow(c.green) },
  }

  const otherNutrientNames = Object.keys(aggregatedMicros.others).filter(n => !['Fibre'].includes(n))
  const defaultOthers = ['Fibre', 'Omega-3', 'Creatină', 'L-Carnitină', 'L-Citrulină', 'Zahar', 'Grasimi saturate']
  const allOtherKeys = Array.from(new Set([...defaultOthers, ...otherNutrientNames]))

  // Lista completă de opțiuni pentru meniul derulant manual de suplimente
  const supplementDropdownOptions = [
    'Vitamina D',
    'Vitamina C',
    'Vitamina B12',
    'Vitamina A',
    'Magneziu',
    'Calciu',
    'Fier',
    'Potasiu',
    'Sodiu',
    'Fibre',
    'Zinc',
    'Cupru',
    'Mangan',
    'Seleniu',
    'Crom',
    'Iod',
    'Vitamina B1',
    'Vitamina B2',
    'Vitamina B3',
    'Vitamina B5',
    'Vitamina B6',
    'Biotina (B7)',
    'Folat (B9)',
    'Vitamina E',
    'Vitamina K',
    'Omega-3',
    'Creatină',
    'L-Carnitină',
    'L-Citrulină'
  ]

  return (
    <div style={s.page}>

      <div style={s.header}>
        <button onClick={onBack} style={{ fontSize: 13, color: c.green2, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Dashboard</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: c.text, letterSpacing: '0.1em' }}>NUTRIȚIE</div>
        <button onClick={saveDay} disabled={saving} style={{ fontSize: 13, fontWeight: 600, padding: '6px 16px', background: saved ? c.green3 : c.green2, border: 'none', borderRadius: 8, color: saved ? c.green : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
          {saving ? '...' : saved ? '✓' : 'Salvează'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().slice(0,10)) }}
          style={{ width: 38, height: 38, borderRadius: c.radiusSm, background: c.card, border: 'none', cursor: 'pointer', fontSize: 16, color: c.text3, boxShadow: c.shadowCard }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: c.text }}>
          {selectedDate === today ? '📅 Astăzi' : selectedDate === new Date(Date.now()-86400000).toISOString().slice(0,10) ? '📅 Ieri' : selectedDate}
        </div>
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); if (d.toISOString().slice(0,10) <= today) setSelectedDate(d.toISOString().slice(0,10)) }}
          style={{ width: 38, height: 38, borderRadius: c.radiusSm, background: c.card, border: 'none', cursor: 'pointer', fontSize: 16, color: selectedDate >= today ? c.text4 : c.text3, opacity: selectedDate >= today ? 0.4 : 1, boxShadow: c.shadowCard }}>›</button>
      </div>

      <div style={{ display: 'flex', gap: 4, background: c.card, padding: 4, borderRadius: 10, marginBottom: '1rem' }}>
        {[['today','Azi'],['history','Istoric'],['targets','Targeturi']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ ...s.tab, ...(activeTab===id?s.tabActive:{}), flex: 1 }}>{label}</button>
        ))}
      </div>

      {activeTab === 'today' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setShowPhotoAnalyzer(true)}
              style={{ flex: 2, minWidth: '200px', padding: '14px', background: c.gradGreen, border: 'none', borderRadius: c.radiusSm, color: '#16291A', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: c.shadowGlow(c.green) }}>
              📸 Fotografiază masa — analiză AI
            </button>
            <button onClick={() => { loadFavoriteFoods(); setShowFavoritesModal(true); }}
              style={{ flex: 1, minWidth: '130px', padding: '14px', background: c.card, border: `1px solid ${c.orange || '#F0A830'}`, borderRadius: c.radiusSm, color: c.orange || '#F0A830', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: c.shadowCard }}>
              ⭐ Favorite
            </button>
          </div>

          <VitaminDTracker 
            userProfile={profile} 
            selectedDate={selectedDate} 
            onUpdateSolarVitD={(val) => setSolarVitaminD(val)} 
            supplementMcg={100}
            activities={recentActivities}
            c={c}
            isSupplementTaken={isD3Taken}
          />

          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: combinedTotals.calories > targets.calories ? c.red : c.text }}>{Math.round(combinedTotals.calories)}</div>
                <div style={{ fontSize: 12, color: c.text4 }}>kcal consumate</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: calRemaining < 0 ? c.red : c.green }}>{Math.abs(Math.round(calRemaining))}</div>
                <div style={{ fontSize: 12, color: c.text4 }}>{calRemaining < 0 ? 'kcal depășite' : 'kcal rămase'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c.text2 }}>{targets.calories}</div>
                <div style={{ fontSize: 12, color: c.text4 }}>kcal target</div>
              </div>
            </div>
            <div style={{ height: 10, background: c.card2, borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${calPct}%`, height: '100%', background: calPct > 100 ? c.red : calPct > 85 ? c.orange : c.green2, borderRadius: 5, transition: 'width 0.3s' }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: c.text4 }}>
              <span>0</span><span>TDEE: {tdee || targets.calories} kcal</span><span>+20%</span>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.sectionLabel}>Distribuție macronutrienți</div>
            <MacroDonut protein={combinedTotals.protein_g} carbs={combinedTotals.carbs_g} fat={combinedTotals.fat_g} calories={combinedTotals.calories} target={targets.calories} c={c}/>
          </div>

          {/* Card Calitate Alimentație & Notă Mese */}
          {(() => {
            if (meals.length === 0) return null

            const nameToScoreMap = {}
            meals.forEach(m => {
              let rawMeta = m.meta_json
              if (typeof rawMeta === 'string') { try { rawMeta = JSON.parse(rawMeta) } catch(_) {} }
              
              let s = m.quality_score != null ? Number(m.quality_score) : m.score != null ? Number(m.score) : null
              if (!s && rawMeta && typeof rawMeta === 'object') {
                const foundKey = Object.keys(rawMeta).find(k => k.toLowerCase().includes('score') || k.toLowerCase().includes('nota') || k.toLowerCase().includes('rating') || k.toLowerCase().includes('quality'))
                if (foundKey) s = Number(rawMeta[foundKey])
              }
              if (s != null && !isNaN(s) && s <= 10 && s > 0) s = s * 10
              if (s != null && !isNaN(s) && m.name) {
                nameToScoreMap[m.name.trim().toLowerCase()] = {
                  score: Math.min(100, Math.max(0, s)),
                  reasons: rawMeta?.quality_reasons || rawMeta?.reasons || rawMeta?.feedback || ['Evaluat automat pe baza produselor similare.']
                }
              }
            })

            let totalScore = 0
            let scoredCount = 0
            const mealScores = meals.map(m => {
              let score = null
              let reasons = []
              let rawMeta = m.meta_json
              if (typeof rawMeta === 'string') { try { rawMeta = JSON.parse(rawMeta) } catch(_) {} }

              if (m.quality_score != null) score = Number(m.quality_score)
              else if (m.score != null) score = Number(m.score)
              else if (rawMeta && typeof rawMeta === 'object') {
                const foundKey = Object.keys(rawMeta).find(k => k.toLowerCase().includes('score') || k.toLowerCase().includes('nota') || k.toLowerCase().includes('rating') || k.toLowerCase().includes('quality'))
                if (foundKey && rawMeta[foundKey] != null && !isNaN(rawMeta[foundKey])) score = Number(rawMeta[foundKey])
                reasons = rawMeta.quality_reasons || rawMeta.reasons || rawMeta.feedback || rawMeta.details || []
              }

              if ((score == null || isNaN(score)) && m.name) {
                const match = nameToScoreMap[m.name.trim().toLowerCase()]
                if (match) {
                  score = match.score
                  reasons = match.reasons
                }
              }

              if (score !== null && !isNaN(score) && score <= 10 && score > 0) score = score * 10
              if (typeof reasons === 'string') reasons = [reasons]

              const hasValidScore = score !== null && !isNaN(score)
              const finalScore = hasValidScore ? Math.min(100, Math.max(0, score)) : null
              
              if (hasValidScore) {
                totalScore += finalScore
                scoredCount++
              }

              return { 
                name: m.name || 'Masă', 
                score: finalScore, 
                reasons, 
                calories: m.calories || 0,
                hasValidScore 
              }
            })

            const avgScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0
            const scoreColor = avgScore >= 85 ? '#4ade80' : avgScore >= 70 ? '#a3e635' : avgScore >= 50 ? '#f0a830' : '#f87171'
            const scoreLabel = scoredCount === 0 ? 'Fără scor' : avgScore >= 85 ? 'Excelent' : avgScore >= 70 ? 'Bun' : avgScore >= 50 ? 'Moderat' : 'Slab'

            return (
              <>
                <div onClick={() => setShowQualityModal(true)}
                  style={{ background: c.card, borderRadius: c.radius, padding: '1.2rem', marginBottom: '1.1rem', boxShadow: c.shadowCard, cursor: 'pointer', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Calitate Alimentație Mese</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: scoredCount > 0 ? scoreColor : c.text4, padding: '2px 8px', borderRadius: 8, background: scoredCount > 0 ? `${scoreColor}28` : c.card2 }}>{scoreLabel}</div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ position: 'relative', width: 54, height: 54, flexShrink: 0 }}>
                      <svg width="54" height="54" viewBox="0 0 54 54" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="27" cy="27" r="22" fill="none" stroke={c.card2} strokeWidth="5" />
                        {scoredCount > 0 && (
                          <circle cx="27" cy="27" r="22" fill="none" stroke={scoreColor} strokeWidth="5"
                            strokeDasharray="138.2" strokeDashoffset={138.2 * (1 - avgScore / 100)} strokeLinecap="round" />
                        )}
                      </svg>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: c.text, lineHeight: 1 }}>{scoredCount > 0 ? avgScore : '—'}</div>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 2 }}>Media calității pe zi</div>
                      <div style={{ fontSize: 11, color: c.text3, lineHeight: 1.3 }}>
                        {scoredCount > 0 ? `Calculat din ${scoredCount} mese evaluate.` : 'Nicio masă nu are scor salvat.'} Apasă pentru detalii.
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>›</div>
                  </div>
                </div>

                {showQualityModal && (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                    onClick={() => setShowQualityModal(false)}>
                    <div style={{ background: c.card, borderRadius: '20px 20px 0 0', padding: '1.25rem', width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }}
                      onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 22 }}>⭐</span>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: scoredCount > 0 ? scoreColor : c.text }}>Calitate Alimentație Mese</div>
                            <div style={{ fontSize: 11, color: c.text4 }}>Medie generală: <strong style={{ color: scoreColor }}>{scoredCount > 0 ? `${avgScore}/100` : 'Indisponibilă'}</strong></div>
                          </div>
                        </div>
                        <button onClick={() => setShowQualityModal(false)}
                          style={{ background: 'transparent', border: 'none', color: c.text4, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {mealScores.map((m, i) => {
                          const mColor = !m.hasValidScore ? c.text4 : m.score >= 85 ? '#4ade80' : m.score >= 70 ? '#a3e635' : m.score >= 50 ? '#f0a830' : '#f87171'
                          return (
                            <div key={i} style={{ background: c.card2, borderRadius: 12, padding: '10px 12px', border: `1px solid ${c.border}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: c.text, flex: 1, paddingRight: 8 }}>{m.name}</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: mColor, background: `${mColor}20`, padding: '2px 8px', borderRadius: 8 }}>
                                  {m.hasValidScore ? `${m.score} pct` : 'Fără scor'}
                                </div>
                              </div>
                              {m.reasons && m.reasons.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                                  {m.reasons.map((r, idx) => (
                                    <div key={idx} style={{ fontSize: 11, color: c.text3 }}>• {r}</div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: 11, color: c.text4 }}>
                                  {m.hasValidScore ? 'Scor preluat de la un produs similar.' : 'Nu există un scor salvat pentru această masă.'}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={s.sectionLabel}>Jurnal mese {meals.length > 0 ? `(${meals.length})` : ''}</div>
              {meals.length > 0 && (
                <div style={{ fontSize: 11, color: c.text4 }}>
                  Total jurnal: <strong style={{ color: c.text }}>{Math.round(mealsTotal.calories)} kcal</strong>
                </div>
              )}
            </div>
            <MealLog meals={meals} c={c} loading={mealsLoading}
              onUpdate={() => loadDay(selectedDate)}
              onDelete={() => loadDay(selectedDate)}/>
          </div>

          {/* Card Suplimente cu listă completă în select */}
          <div style={{ background: c?.card, borderRadius: c?.radius || 16, padding: '1.2rem', marginBottom: '1.1rem', border: `1px solid ${c?.border}`, boxShadow: c?.shadowCard }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c?.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Suplimentele tale
              </div>
              <button onClick={() => {
                const saved = profile?.saved_supplements || []
                saved.forEach(sv => {
                  if (!takenSavedSupps[sv.id]) {
                    const nextTaken = { ...takenSavedSupps, [sv.id]: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) }
                    setTakenSavedSupps(nextTaken)
                    try { localStorage.setItem('forma_taken_saved_' + selectedDate, JSON.stringify(nextTaken)) } catch (e) {}
                    
                    const newItems = (sv.micros || []).map(m => ({ id: Date.now() + Math.random(), key: m.key, name: sv.name, value: m.value, _savedId: sv.id }))
                    if (newItems.length) {
                      const nextSupps = [...manualSupps, ...newItems]
                      setManualSupps(nextSupps)
                      try { localStorage.setItem('forma_supps_' + selectedDate, JSON.stringify(nextSupps)) } catch (e) {}
                    }
                  }
                })
              }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 16, border: `1px solid ${c?.border}`, background: c?.card2, color: c?.text, cursor: 'pointer', fontWeight: 600 }}>
                + Adaugă pe toate
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {(profile?.saved_supplements || [
                { id: 's1', name: 'L-Carnitina 840mg', micros: [{ key: 'L-Carnitină', value: 840 }] },
                { id: 's2', name: 'Creatina monohidrat 5g Creapure', micros: [{ key: 'Creatină', value: 5000 }] },
                { id: 's3', name: 'Vitamina C Liposomal 600mg', micros: [{ key: 'Vitamina C', value: 600 }] },
                { id: 's4', name: 'L - Citrulina 3000mg', micros: [{ key: 'L-Citrulină', value: 3000 }] },
                { id: 's5', name: 'Magneziu Taurate 40 mg', micros: [{ key: 'Magneziu', value: 40 }] },
                { id: 's6', name: 'Magneziu Glycinate 250mg', micros: [{ key: 'Magneziu', value: 250 }] },
                { id: 's7', name: 'Fleximobil Aktiv', micros: [{ key: 'Calciu', value: 40 }, { key: 'Vitamina C', value: 80 }, { key: 'Vitamina D', value: 5 }] },
                { id: 's8', name: 'Vitamina D3 100 mcg+K2 200mcg', micros: [{ key: 'Vitamina D', value: 100 }] }
              ]).map(sv => {
                const isTaken = !!takenSavedSupps[sv.id]
                const timeStr = takenSavedSupps[sv.id]

                const toggleTake = () => {
                  if (isTaken) {
                    const nextTaken = { ...takenSavedSupps }
                    delete nextTaken[sv.id]
                    setTakenSavedSupps(nextTaken)
                    try { localStorage.setItem('forma_taken_saved_' + selectedDate, JSON.stringify(nextTaken)) } catch (e) {}
                    const nextSupps = manualSupps.filter(m => m._savedId !== sv.id)
                    setManualSupps(nextSupps)
                    try { localStorage.setItem('forma_supps_' + selectedDate, JSON.stringify(nextSupps)) } catch (e) {}
                  } else {
                    const nowStr = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
                    const nextTaken = { ...takenSavedSupps, [sv.id]: nowStr }
                    setTakenSavedSupps(nextTaken)
                    try { localStorage.setItem('forma_taken_saved_' + selectedDate, JSON.stringify(nextTaken)) } catch (e) {}
                    
                    const newItems = (sv.micros || []).map(m => ({ id: Date.now() + Math.random(), key: m.key, name: sv.name, value: m.value, _savedId: sv.id }))
                    if (newItems.length) {
                      const nextSupps = [...manualSupps, ...newItems]
                      setManualSupps(nextSupps)
                      try { localStorage.setItem('forma_supps_' + selectedDate, JSON.stringify(nextSupps)) } catch (e) {}
                    }
                  }
                }

                const removeSaved = async () => {
                  const updated = (profile?.saved_supplements || []).filter(item => item.id !== sv.id)
                  try {
                    await supabase.from('profiles').update({ saved_supplements: updated }).eq('id', user.id)
                    setProfile(p => ({ ...p, saved_supplements: updated }))
                  } catch (e) {}
                }

                return (
                  <div key={sv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: c?.card2, borderRadius: 10, padding: '8px 12px', border: `1px solid ${c?.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14 }}>💊</span>
                      <div style={{ fontSize: 12, fontWeight: 600, color: c?.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sv.name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button onClick={toggleTake} style={{
                        fontSize: 11, padding: '4px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, border: 'none',
                        background: isTaken ? 'rgba(74,222,128,0.2)' : c?.green2,
                        color: isTaken ? '#4ade80' : '#fff'
                      }}>
                        {isTaken ? `✓ Luat · ${timeStr}` : '+ Azi'}
                      </button>
                      <button onClick={removeSaved} style={{ background: 'transparent', border: 'none', color: c?.text4, fontSize: 14, cursor: 'pointer', padding: '0 2px' }} title="Șterge din listă">
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c?.text3, textTransform: 'uppercase' }}>ADAUGĂ:</div>
              <div style={{ display: 'flex', gap: 4, background: c?.card2, padding: 3, borderRadius: 10, border: `1px solid ${c?.border}` }}>
                <button onClick={() => setSuppInputMode('manual')} style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: suppInputMode === 'manual' ? c?.card3 : 'transparent',
                  color: suppInputMode === 'manual' ? c?.text : c?.text4
                }}>
                  Manual
                </button>
                <button onClick={() => setSuppInputMode('ai')} style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: suppInputMode === 'ai' ? c?.card3 : 'transparent',
                  color: suppInputMode === 'ai' ? '#4ade80' : c?.text4, display: 'flex', alignItems: 'center', gap: 4
                }}>
                  ✨ AI
                </button>
              </div>
            </div>

            {suppInputMode === 'manual' ? (
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <input placeholder="Denumire (ex: Magneziu 250mg)" value={manualSuppForm.name} onChange={e => setManualSuppForm(p => ({ ...p, name: e.target.value }))}
                    style={{ flex: 2, minWidth: '140px', padding: '8px 10px', borderRadius: 8, border: `1px solid ${c?.border}`, background: c?.card2, color: c?.text, fontSize: 12, outline: 'none' }} />
                  
                  {/* Lista derulantă extinsă cu toate variantele solicitate */}
                  <select value={manualSuppForm.key} onChange={e => setManualSuppForm(p => ({ ...p, key: e.target.value }))}
                    style={{ flex: 1.5, minWidth: '130px', padding: '8px 10px', borderRadius: 8, border: `1px solid ${c?.border}`, background: c?.card2, color: c?.text, fontSize: 12, outline: 'none' }}>
                    {supplementDropdownOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>

                  <input type="number" placeholder="Valoare (mg/mcg)" value={manualSuppForm.value} onChange={e => setManualSuppForm(p => ({ ...p, value: e.target.value }))}
                    style={{ flex: 1, minWidth: '80px', padding: '8px 10px', borderRadius: 8, border: `1px solid ${c?.border}`, background: c?.card2, color: c?.text, fontSize: 12, outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: c?.text3, cursor: 'pointer' }}>
                    <input type="checkbox" checked={manualSuppForm.saveToProfile} onChange={e => setManualSuppForm(p => ({ ...p, saveToProfile: e.target.checked }))} style={{ accentColor: c?.green2 }} />
                    Salvează în lista permanentă
                  </label>
                  <button onClick={() => {
                    if (!manualSuppForm.name.trim() || !manualSuppForm.value) return
                    const newItem = {
                      id: Date.now(),
                      name: manualSuppForm.name.trim(),
                      key: manualSuppForm.key,
                      value: Number(manualSuppForm.value),
                      micros: [{ key: manualSuppForm.key, value: Number(manualSuppForm.value) }],
                      saveToProfile: manualSuppForm.saveToProfile
                    }
                    handleAddSupplementSubmit(newItem)
                    setManualSuppForm({ name: '', key: 'Vitamina D', value: '', saveToProfile: true })
                  }} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: c?.green2, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Adaugă
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: c?.text4, marginBottom: 4 }}>Scrie suplimentul cu doza — AI identifică micronutrienții și îl poți salva pentru data viitoare.</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input placeholder="ex: Magneziu Taurate 40mg, Ashwagandha KSM-66 300mg" value={aiSuppText} onChange={e => setAiSuppText(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${c?.border}`, background: c?.card2, color: c?.text, fontSize: 12, outline: 'none' }} />
                  <button onClick={handleAiAnalyzeSupplement} disabled={aiAnalyzing}
                    style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(74,222,128,0.2)', color: '#4ade80', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {aiAnalyzing ? 'Analizez...' : '✨ Analizează'}
                  </button>
                </div>
              </div>
            )}

            {manualSupps.length > 0 && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${c?.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c?.text3, textTransform: 'uppercase', marginBottom: 6 }}>AZI</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {manualSupps.map(ms => (
                    <div key={ms.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: c?.text }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>💊</span>
                        <span><strong>{ms.name}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: '#4ade80' }}>11:05</span>
                        <span onClick={() => {
                          const next = manualSupps.filter(m => m.id !== ms.id)
                          setManualSupps(next)
                          try { localStorage.setItem('forma_supps_' + selectedDate, JSON.stringify(next)) } catch (e) {}
                        }} style={{ cursor: 'pointer', color: c?.red, fontWeight: 700 }}>×</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Secțiunea Tabelară Micronutrienți & Vitamine */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ ...s.sectionLabel, margin: 0 }}>Micronutrienți & Vitamine Zilnice (% din Necesar)</div>
              <div style={{ fontSize: 10, color: c.text4, fontStyle: 'italic' }}>* Apasă pe un rând pentru detalii</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}`, color: c.text3 }}>
                    <th style={{ padding: '8px 4px' }}>Nutrient</th>
                    <th style={{ padding: '8px 4px' }}>Consumat</th>
                    <th style={{ padding: '8px 4px' }}>Target (RDA)</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>% / Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { type: 'header', label: '• VITAMINE' },
                    { name: 'Vitamina A', val: getVitValNum('Vitamina A'), unit: 'mcg', rda: 900, supp: 0 },
                    { name: 'Vitamina D', val: totalVitaminD_mcg, unit: 'mcg', rda: 15, supp: isD3Taken ? 100 : 0, suppLabel: 'Supliment Vitamina D3' },
                    { name: 'Vitamina E', val: getVitValNum('Vitamina E'), unit: 'mg', rda: 15, supp: 0 },
                    { name: 'Vitamina K', val: getVitValNum('Vitamina K'), unit: 'mcg', rda: 120, supp: 0 },
                    { name: 'Vitamina B6', val: getVitValNum('Vitamina B6'), unit: 'mg', rda: 1.7, supp: 0 },
                    { name: 'Vitamina B12', val: getVitValNum('Vitamina B12'), unit: 'mcg', rda: 2.4, supp: 0 },
                    { name: 'Vitamina C', val: getVitValNum('Vitamina C', isVitaminCTaken ? 600 : 0), unit: 'mg', rda: 90, supp: isVitaminCTaken ? 600 : 0, suppLabel: 'Supliment Vitamina C' },
                    { name: 'Folat (B9)', val: getVitValNum('Folat (B9)'), unit: 'mcg', rda: 400, supp: 0 },
                    { name: 'Niacin (B3)', val: getVitValNum('Niacin (B3)'), unit: 'mg', rda: 16, supp: 0 },
                    { name: 'Thiamin (B1)', val: getVitValNum('Thiamin (B1)'), unit: 'mg', rda: 1.2, supp: 0 },
                    { name: 'Riboflavin (B2)', val: getVitValNum('Riboflavin (B2)'), unit: 'mg', rda: 1.3, supp: 0 },
                    { name: 'Biotin (B7)', val: getVitValNum('Biotin (B7)'), unit: 'mcg', rda: 30, supp: 0 },
                    { name: 'Acid pantotenic (B5)', val: getVitValNum('Acid pantotenic (B5)'), unit: 'mg', rda: 5, supp: 0 },
                    { name: 'Colină', val: getVitValNum('Colină'), unit: 'mg', rda: 550, supp: 0 },
                    
                    { type: 'header', label: '• MINERALE' },
                    { name: 'Potasiu', val: getMinValNum('Potasiu'), unit: 'mg', rda: 3400, supp: 0 },
                    { name: 'Calciu', val: getMinValNum('Calciu', isCalciumTaken ? 40 : 0), unit: 'mg', rda: 1000, supp: isCalciumTaken ? 40 : 0, suppLabel: 'Supliment Calciu / Fleximobil' },
                    { name: 'Fier', val: getMinValNum('Fier'), unit: 'mg', rda: 8, supp: 0 },
                    { name: 'Magneziu', val: getMinValNum('Magneziu', isMagnesiumTaken ? 290 : 0), unit: 'mg', rda: 420, supp: isMagnesiumTaken ? 290 : 0, suppLabel: 'Supliment Magneziu' },
                    { name: 'Zinc', val: getMinValNum('Zinc'), unit: 'mg', rda: 11, supp: 0 },
                    { name: 'Fosfor', val: getMinValNum('Fosfor'), unit: 'mg', rda: 700, supp: 0 },
                    { name: 'Seleniu', val: getMinValNum('Seleniu'), unit: 'mcg', rda: 55, supp: 0 },
                    { name: 'Cupru', val: getMinValNum('Cupru'), unit: 'mg', rda: 0.9, supp: 0 },
                    { name: 'Mangan', val: getMinValNum('Mangan'), unit: 'mg', rda: 2.3, supp: 0 },
                  ].map((item, idx) => {
                    if (item.type === 'header') {
                      return (
                        <tr key={idx}>
                          <td colSpan="4" style={{ padding: '12px 4px 4px', fontWeight: 700, color: c.green2, fontSize: 11, letterSpacing: '0.05em' }}>
                            {item.label}
                          </td>
                        </tr>
                      )
                    }

                    const pct = Math.round((item.val / item.rda) * 100)
                    const color = pct > 150 ? c.red : pct > 100 ? c.orange : c.green2
                    const isSelected = activeMicroSource === item.name

                    return (
                      <>
                        <tr key={idx} 
                          onClick={() => setActiveMicroSource(activeMicroSource === item.name ? null : item.name)}
                          style={{ borderBottom: isSelected ? 'none' : `0.5px solid ${c.card2}`, cursor: 'pointer', background: isSelected ? c.card2 : 'transparent' }}>
                          <td style={{ padding: '8px 4px', color: isSelected ? c.text : c.text3, fontWeight: isSelected ? 600 : 400 }}>
                            {item.name} <span style={{ fontSize: 10, opacity: 0.6 }}>{isSelected ? '▲' : '▼'}</span>
                          </td>
                          <td style={{ padding: '8px 4px', fontWeight: 600, color: c.text }}>{item.val} {item.unit}</td>
                          <td style={{ padding: '8px 4px', color: c.text4 }}>{item.rda} {item.unit}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                            <span style={{ 
                              padding: '2px 6px', 
                              borderRadius: 4, 
                              fontSize: 11, 
                              fontWeight: 700, 
                              background: pct > 150 ? 'rgba(248,113,113,0.15)' : pct > 100 ? 'rgba(240,168,48,0.15)' : 'rgba(151,196,89,0.15)',
                              color: color 
                            }}>
                              {pct}%
                            </span>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr key={idx + '_detail'} style={{ background: c.card2, borderBottom: `1px solid ${c.border}` }}>
                            <td colSpan="4" style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: c.green2, marginBottom: 6 }}>
                                🔍 Surse pentru {item.name}:
                              </div>
                              {(() => {
                                const sources = getMicroSourcesDetail(item.name, item.supp || 0, item.suppLabel || 'Supliment')

                                if (sources.length === 0) {
                                  return (
                                    <div>
                                      <div style={{ fontSize: 11, color: c.text4, marginBottom: 4 }}>Consumat azi: 0 {item.unit}</div>
                                      <div style={{ fontSize: 11, color: c.text3, fontStyle: 'italic', background: c.card, padding: '8px 10px', borderRadius: 6, lineHeight: 1.4 }}>
                                        💡 {MICRO_SOURCES_RECOMMENDATIONS[item.name] || 'Nu există recomandări specifice.'}
                                      </div>
                                    </div>
                                  )
                                }

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {sources.map((src, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: `0.5px solid ${c.border}` }}>
                                        <span style={{ color: c.text3 }}>• {src.mealName}</span>
                                        <span style={{ fontWeight: 600, color: c.text }}>+{Math.round(src.val * 10) / 10} {item.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                )
                              })()}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card Alți Nutrienți */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>🧬</span>
                <div style={{ ...s.sectionLabel, margin: 0 }}>Alți Nutrienți & Factori Dietetici</div>
              </div>
              <div style={{ fontSize: 10, color: c.text4, fontStyle: 'italic' }}>* Fibre, Omega-3, Suplimente speciale etc.</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}`, color: c.text3 }}>
                    <th style={{ padding: '8px 4px' }}>Nutrient / Element</th>
                    <th style={{ padding: '8px 4px' }}>Valoare curentă</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Status / Detalii</th>
                  </tr>
                </thead>
                <tbody>
                  {allOtherKeys.map((keyName, idx) => {
                    const val = getOthValNum(keyName)
                    const isSelected = activeMicroSource === keyName
                    const unit = keyName === 'Fibre' || keyName.includes('g') ? 'g' : keyName === 'Omega-3' || keyName.includes('Creatină') || keyName.includes('Carnitină') || keyName.includes('Citrulină') ? 'mg' : 'g'
                    const targetVal = keyName === 'Fibre' ? targets.fiber_g : null
                    const pct = targetVal ? Math.round((val / targetVal) * 100) : null

                    return (
                      <>
                        <tr key={idx}
                          onClick={() => setActiveMicroSource(activeMicroSource === keyName ? null : keyName)}
                          style={{ borderBottom: isSelected ? 'none' : `0.5px solid ${c.card2}`, cursor: 'pointer', background: isSelected ? c.card2 : 'transparent' }}>
                          <td style={{ padding: '8px 4px', color: isSelected ? c.text : c.text3, fontWeight: isSelected ? 600 : 400 }}>
                            {keyName} <span style={{ fontSize: 10, opacity: 0.6 }}>{isSelected ? '▲' : '▼'}</span>
                          </td>
                          <td style={{ padding: '8px 4px', fontWeight: 600, color: c.text }}>
                            {val > 0 ? `${val} ${unit}` : '—'}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                            <span style={{ 
                              padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, 
                              background: val > 0 ? 'rgba(74,222,128,0.15)' : c.card2, 
                              color: val > 0 ? '#4ade80' : c.text4 
                            }}>
                              {val > 0 ? (pct != null ? `${pct}%` : 'Prezent') : '—'}
                            </span>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr key={idx + '_detail'} style={{ background: c.card2, borderBottom: `1px solid ${c.border}` }}>
                            <td colSpan="3" style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: c.green2, marginBottom: 6 }}>
                                🔍 Surse pentru {keyName}:
                              </div>
                              {(() => {
                                const sources = getMicroSourcesDetail(keyName, 0, '')
                                if (sources.length === 0) {
                                  return (
                                    <div style={{ fontSize: 11, color: c.text3, fontStyle: 'italic', background: c.card, padding: '8px 10px', borderRadius: 6, lineHeight: 1.4 }}>
                                      💡 {MICRO_SOURCES_RECOMMENDATIONS[keyName] || 'Componentă adăugată din mese sau suplimente.'}
                                    </div>
                                  )
                                }
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {sources.map((src, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: `0.5px solid ${c.border}` }}>
                                        <span style={{ color: c.text3 }}>• {src.mealName}</span>
                                        <span style={{ fontWeight: 600, color: c.text }}>+{Math.round(src.val * 10) / 10} {unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                )
                              })()}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card Antioxidanți cu culori corectate pentru praguri */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>🛡️</span>
                <div style={{ ...s.sectionLabel, margin: 0 }}>Antioxidanți</div>
              </div>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                background: `${antScoreColor}20`, border: `1px solid ${antScoreColor}`, 
                padding: '4px 10px', borderRadius: 20 
              }}>
                <span style={{ fontSize: 11 }}>✨</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: antScoreColor }}>
                  Scor AI: {antioxidantScore}/100
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${c.border}`, color: c.text3 }}>
                    <th style={{ padding: '8px 4px' }}>Antioxidant / Nutrient cheie</th>
                    <th style={{ padding: '8px 4px' }}>Valoare curentă</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Status / Contribuție</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Seleniu', val: seleniuVal, unit: 'mcg', target: 55 },
                    { name: 'Vitamina C', val: vitCVal, unit: 'mg', target: 90 },
                    { name: 'Vitamina A', val: vitAVal, unit: 'mcg', target: 900 },
                    { name: 'Vitamina E', val: vitEVal, unit: 'mg', target: 15 },
                    { name: 'Luteină + Zeaxantină', val: getAntValNum('Luteină + Zeaxantină'), unit: 'mcg', target: 1000 },
                  ].map((ant, idx) => {
                    const isSelected = activeMicroSource === ant.name
                    const antPct = ant.target ? Math.round((ant.val / ant.target) * 100) : 0
                    const badgeColor = ant.val === 0 ? c.text4 : antPct > 150 ? c.red : antPct > 100 ? c.orange : c.green2

                    return (
                      <>
                        <tr key={idx}
                          onClick={() => setActiveMicroSource(activeMicroSource === ant.name ? null : ant.name)}
                          style={{ borderBottom: isSelected ? 'none' : `0.5px solid ${c.card2}`, cursor: 'pointer', background: isSelected ? c.card2 : 'transparent' }}>
                          <td style={{ padding: '8px 4px', color: isSelected ? c.text : c.text3, fontWeight: isSelected ? 600 : 400 }}>
                            {ant.name} <span style={{ fontSize: 10, opacity: 0.6 }}>{isSelected ? '▲' : '▼'}</span>
                          </td>
                          <td style={{ padding: '8px 4px', fontWeight: 600, color: c.text }}>
                            {ant.val > 0 ? `${ant.val} ${ant.unit}` : '—'}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                            <span style={{ 
                              padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, 
                              background: ant.val > 0 ? `${badgeColor}20` : c.card2, 
                              color: ant.val > 0 ? badgeColor : c.text4 
                            }}>
                              {ant.val > 0 ? `${antPct}%` : '—'}
                            </span>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr key={idx + '_detail'} style={{ background: c.card2, borderBottom: `1px solid ${c.border}` }}>
                            <td colSpan="3" style={{ padding: '10px 12px' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: c.green2, marginBottom: 6 }}>
                                🔍 Surse pentru {ant.name}:
                              </div>
                              {(() => {
                                const sources = getMicroSourcesDetail(ant.name, 0, '')
                                if (sources.length === 0) {
                                  return (
                                    <div style={{ fontSize: 11, color: c.text3, fontStyle: 'italic', background: c.card, padding: '8px 10px', borderRadius: 6, lineHeight: 1.4 }}>
                                      💡 {MICRO_SOURCES_RECOMMENDATIONS[ant.name] || 'Contribuie la apărarea antioxidantă și reducerea stresului oxidativ.'}
                                    </div>
                                  )
                                }
                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {sources.map((src, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: `0.5px solid ${c.border}` }}>
                                        <span style={{ color: c.text3 }}>• {src.mealName}</span>
                                        <span style={{ fontWeight: 600, color: c.text }}>+{Math.round(src.val * 10) / 10} {ant.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                )
                              })()}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Secțiune Informativă: Vitamine */}
          <div 
            style={s.card}
            onTouchStart={handleVitTouchStart}
            onTouchEnd={handleVitTouchEnd}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <img 
                src={currentVitGuide.img} 
                alt="Vitamine" 
                style={{ width: 64, height: 64, borderRadius: c.radiusSm, objectFit: 'cover', flexShrink: 0 }} 
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={s.sectionLabel}>{currentVitGuide.title}</div>
                  <div style={{ fontSize: 10, color: c.text4, fontStyle: 'italic' }}>↔ Glisează</div>
                </div>
                <div style={{ fontSize: 12, color: c.text3, lineHeight: 1.5, maxHeight: showMoreVit ? 'none' : '5.5em', overflow: 'hidden', position: 'relative' }}>
                  {currentVitGuide.text}
                  {showMoreVit && currentVitGuide.more}
                </div>
                <button 
                  onClick={() => setShowMoreVit(prev => !prev)}
                  style={{ background: 'transparent', border: 'none', color: c.green2, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {showMoreVit ? '▲ Mai puțin' : '▼ Mai mult'}
                </button>
              </div>
            </div>
          </div>

          {/* Secțiune Informativă: Minerale */}
          <div 
            style={s.card}
            onTouchStart={handleMinTouchStart}
            onTouchEnd={handleMinTouchEnd}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <img 
                src={currentMinGuide.img} 
                alt="Minerale" 
                style={{ width: 64, height: 64, borderRadius: c.radiusSm, objectFit: 'cover', flexShrink: 0 }} 
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={s.sectionLabel}>{currentMinGuide.title}</div>
                  <div style={{ fontSize: 10, color: c.text4, fontStyle: 'italic' }}>↔ Glisează</div>
                </div>
                <div style={{ fontSize: 12, color: c.text3, lineHeight: 1.5, maxHeight: showMoreMin ? 'none' : '5.5em', overflow: 'hidden', position: 'relative' }}>
                  {currentMinGuide.text}
                  {showMoreMin && currentMinGuide.more}
                </div>
                <button 
                  onClick={() => setShowMoreMin(prev => !prev)}
                  style={{ background: 'transparent', border: 'none', color: c.green2, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {showMoreMin ? '▲ Mai puțin' : '▼ Mai mult'}
                </button>
              </div>
            </div>
          </div>

          <button onClick={saveDay} style={s.saveBtn}>
            {saving ? 'Se salvează...' : saved ? '✓ Salvat pentru ' + selectedDate : 'Salvează ziua'}
          </button>
        </div>
      )}

      {/* TAB ISTORIC COMPLET */}
      {activeTab === 'history' && (
        <div>
          <div style={s.card}>
            <div style={s.sectionLabel}>Istoricul Nutrițional (Ultimele zile)</div>
            {history.length === 0 ? (
              <div style={{ fontSize: 13, color: c.text4, padding: '20px 0', textAlign: 'center' }}>
                Nu există înregistrări în istoric momentan.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((day, idx) => (
                  <div key={idx} style={{ 
                    background: c.card2, 
                    borderRadius: 10, 
                    padding: '12px 14px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderLeft: `4px solid ${c.green2}`
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>
                        📅 {day.date}
                      </div>
                      <div style={{ fontSize: 11, color: c.text3, display: 'flex', gap: 10 }}>
                        <span>P: <strong>{Math.round(day.protein_g || 0)}g</strong></span>
                        <span>C: <strong>{Math.round(day.carbs_g || 0)}g</strong></span>
                        <span>F: <strong>{Math.round(day.fat_g || 0)}g</strong></span>
                        <span>Fibre: <strong>{Math.round(day.fiber_g || 0)}g</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: c.green2 }}>
                        {Math.round(day.calories || 0)} kcal
                      </div>
                      <button onClick={() => { setSelectedDate(day.date); setActiveTab('today'); }} style={{
                        background: 'transparent', border: 'none', color: c.green, fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: 4
                      }}>
                        Vezi zi →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB TARGETURI COMPLET */}
      {activeTab === 'targets' && (
        <div>
          <div style={s.card}>
            <div style={s.sectionLabel}>Obiective și Necesar Zilnic (TDEE)</div>
            
            <div style={{ background: c.card2, borderRadius: 12, padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 8 }}>Parametri Corporali & Obiectiv</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: c.text3 }}>
                <div>Greutate: <strong style={{ color: c.text }}>{profile?.weight_kg || '--'} kg</strong></div>
                <div>Înălțime: <strong style={{ color: c.text }}>{profile?.height_cm || '--'} cm</strong></div>
                <div>Vârstă: <strong style={{ color: c.text }}>{profile?.age || '--'} ani</strong></div>
                <div>Obiectiv: <strong style={{ color: c.text, textTransform: 'capitalize' }}>{profile?.goal || 'Menținere/Hipertrofie'}</strong></div>
                <div>Antrenamente: <strong style={{ color: c.text }}>{profile?.days_per_week || 4} zile/săpt</strong></div>
                <div>TDEE calculat: <strong style={{ color: c.green2 }}>{tdee || 'Indisponibil'} kcal</strong></div>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: c.text3, marginBottom: 10 }}>Ținte Macronutrienți Zilnici</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: c.card2, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: c.text3 }}>🎯 Calorii Recomandate</span>
                <span style={{ fontWeight: 700, color: c.text }}>{targets.calories} kcal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: c.card2, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: c.text3 }}>🥩 Proteine (Target)</span>
                <span style={{ fontWeight: 700, color: '#97C459' }}>{targets.protein_g} g</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: c.card2, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: c.text3 }}>🍞 Carbohidrați (Target)</span>
                <span style={{ fontWeight: 700, color: '#4A7EB5' }}>{targets.carbs_g} g</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: c.card2, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: c.text3 }}>🥑 Grăsimi (Target)</span>
                <span style={{ fontWeight: 700, color: '#F0A830' }}>{targets.fat_g} g</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: c.card2, borderRadius: 8, fontSize: 13 }}>
                <span style={{ color: c.text3 }}>🌾 Fibre (Target)</span>
                <span style={{ fontWeight: 700, color: '#1D9E75' }}>{targets.fiber_g} g</span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: c.text4, marginTop: 16, textAlign: 'center', fontStyle: 'italic' }}>
              Targeturile sunt calculate automat pe baza datelor din profilul tău și a coeficientului de activitate fizică.
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECTARE FAVORITE */}
      {showFavoritesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowFavoritesModal(false)}>
          <div style={{ background: c.card, borderRadius: '24px 24px 0 0', padding: '1.25rem', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🍽️</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>Adaugă masă</div>
              </div>
              <button onClick={() => setShowFavoritesModal(false)}
                style={{ background: 'transparent', border: 'none', color: c.text4, fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>✕</button>
            </div>

            <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
              <input type="text" placeholder="Caută în preferate..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '10px 12px 10px 36px', background: c.card2, border: `1px solid ${c.border}`, borderRadius: 12, color: c.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: '1.1rem', overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { id: 'recente', label: '⏱️ Recente' },
                { id: 'des', label: '🔥 Des folosite' },
                { id: 'az', label: '🔤 A-Z' },
                { id: 'ora', label: '🕒 Ora actuală' }
              ].map(f => (
                <button key={f.id} onClick={() => setFavoritesFilter(f.id)} style={{
                  padding: '6px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer', border: 'none',
                  background: favoritesFilter === f.id ? '#2E6930' : c.card2,
                  color: favoritesFilter === f.id ? '#fff' : c.text3,
                  boxShadow: favoritesFilter === f.id ? '0 2px 8px rgba(46,105,48,0.4)' : 'none'
                }}>
                  {f.label}
                </button>
              ))}
            </div>

            {favoritesLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: c.text4, fontSize: 13 }}>Se încarcă favoritele...</div>
            ) : filteredFavorites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: c.text4, fontSize: 13 }}>Niciun produs găsit.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredFavorites.map((fav) => {
                  const scoreVal = fav.quality_score || (fav.use_count > 5 ? 90 : 75)
                  const dotColor = scoreVal >= 85 ? '#4ade80' : scoreVal >= 70 ? '#f0a830' : '#f87171'

                  return (
                    <div key={fav.id} style={{ 
                      background: c.card2, borderRadius: 16, padding: '10px 12px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      border: `1px solid ${c.border}` 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 10, background: c.card, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${c.border}` }}>
                          {fav.image_url ? (
                            <img src={fav.image_url} alt={fav.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: 20 }}>🥗</span>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fav.name}</div>
                          </div>
                          <div style={{ fontSize: 11, color: c.text3 }}>
                            🔥 <strong>{Math.round(fav.calories || 0)} kcal</strong> · P: {Math.round(fav.protein_g || 0)}g · C: {Math.round(fav.carbs_g || 0)}g · F: {Math.round(fav.fat_g || 0)}g
                          </div>
                        </div>
                      </div>

                      <button onClick={() => { setSelectedFavForModal(fav); setCustomQuantityGrams(fav.total_weight_g || 100); }}
                        style={{ background: '#2E6930', border: 'none', borderRadius: 10, color: '#fff', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: '0', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✏️ Editează
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL SELECTARE GRAMAJ */}
      {selectedFavForModal && (() => {
        const baseWeight = selectedFavForModal.total_weight_g || 100
        const ratio = customQuantityGrams / baseWeight
        const currentCals = Math.round((selectedFavForModal.calories || 0) * ratio)
        const currentProt = Math.round((selectedFavForModal.protein_g || 0) * ratio * 10) / 10
        const currentCarbs = Math.round((selectedFavForModal.carbs_g || 0) * ratio * 10) / 10
        const currentFat = Math.round((selectedFavForModal.fat_g || 0) * ratio * 10) / 10

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 700, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setSelectedFavForModal(null)}>
            <div style={{ background: c.card, borderRadius: '24px 24px 0 0', padding: '1.5rem', width: '100%', maxWidth: 480 }}
              onClick={e => e.stopPropagation()}>
              
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: '1.2rem' }}>
                <div style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', background: c.card2, flexShrink: 0, border: `1px solid ${c.border}` }}>
                  {selectedFavForModal.image_url ? (
                    <img src={selectedFavForModal.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24 }}>☕</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 2 }}>{selectedFavForModal.name}</div>
                  <div style={{ fontSize: 12, color: c.text4 }}>Bază: {baseWeight}g · {selectedFavForModal.calories || 0} kcal</div>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: c.text3, marginBottom: 6 }}>Cât mănânci (grame)</div>
              
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <input type="number" value={customQuantityGrams} onChange={e => setCustomQuantityGrams(Math.max(1, Number(e.target.value)))}
                  style={{ width: '100%', padding: '12px 16px', background: c.card2, border: `1px solid ${c.border}`, borderRadius: 12, color: c.text, fontSize: 18, fontWeight: 700, outline: 'none' }} />
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: c.text4, fontWeight: 600 }}>g</span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: '1.2rem' }}>
                {[
                  { label: '½×', val: 0.5 },
                  { label: '1×', val: 1 },
                  { label: '1½×', val: 1.5 },
                  { label: '2×', val: 2 }
                ].map(m => (
                  <button key={m.label} onClick={() => setCustomQuantityGrams(Math.round(baseWeight * m.val))} style={{
                    flex: 1, padding: '10px 0', background: c.card2, border: `1px solid ${c.border}`, borderRadius: 10,
                    color: c.text, fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}>
                    {m.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: '1.5rem' }}>
                <div style={{ background: c.card2, padding: '10px 4px', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c.text }}>{currentCals}</div>
                  <div style={{ fontSize: 10, color: c.text4 }}>kcal</div>
                </div>
                <div style={{ background: c.card2, padding: '10px 4px', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#4A7EB5' }}>{currentProt}g</div>
                  <div style={{ fontSize: 10, color: c.text4 }}>P</div>
                </div>
                <div style={{ background: c.card2, padding: '10px 4px', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#F0A830' }}>{currentCarbs}g</div>
                  <div style={{ fontSize: 10, color: c.text4 }}>C</div>
                </div>
                <div style={{ background: c.card2, padding: '10px 4px', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f87171' }}>{currentFat}g</div>
                  <div style={{ fontSize: 10, color: c.text4 }}>G</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setSelectedFavForModal(null)} style={{
                  flex: 1, padding: '14px', background: c.card2, border: `1px solid ${c.border}`, borderRadius: 12,
                  color: c.text, fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}>
                  Anulează
                </button>
                <button onClick={confirmAddFavoriteWithQuantity} style={{
                  flex: 2, padding: '14px', background: c.gradGreen || '#2E6930', border: 'none', borderRadius: 12,
                  color: '#16291A', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(46,105,48,0.3)'
                }}>
                  Adaugă · {currentCals} kcal
                </button>
              </div>

            </div>
          </div>
        )
      })()}

          </div>
  )
}
