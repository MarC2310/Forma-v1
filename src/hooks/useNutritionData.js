// src/hooks/useNutritionData.js
import { useState, useEffect } from 'react'

export function useNutritionData(selectedDate) {
  const [nutritionData, setNutritionData] = useState({
    items: [],
    supplements: [],
    solarVitaminD: 0, // Valoarea provenită din expunere solară / activități
    waterMl: 0,
  })

  // Încărcare date pentru data selectată (ex: localStorage sau Supabase)
  useEffect(() => {
    const saved = localStorage.getItem(`forma_nutrition_${selectedDate}`)
    if (saved) {
      try {
        setNutritionData(JSON.parse(saved))
      } catch (e) {
        console.error('Eroare parsare nutriție', e)
      }
    } else {
      setNutritionData({ items: [], supplements: [], solarVitaminD: 0, waterMl: 0 })
    }
  }, [selectedDate])

  // Funcție dedicată pentru actualizarea Vitaminei D solare
  const updateSolarVitaminD = (uiValue) => {
    setNutritionData(prev => {
      const updated = { ...prev, solarVitaminD: uiValue }
      localStorage.setItem(`forma_nutrition_${selectedDate}`, JSON.stringify(updated))
      return updated
    })
  }

  // Calcul total Vitamina D (alimente + suplimente + soare)
  const totalVitaminD = (nutritionData.items.reduce((acc, item) => acc + (item.vitaminD || 0), 0)) +
                        (nutritionData.supplements.reduce((acc, sup) => acc + (sup.vitaminD || 0), 0)) +
                        (nutritionData.solarVitaminD || 0)

  return {
    nutritionData,
    setNutritionData,
    updateSolarVitaminD,
    totalVitaminD
  }
}
