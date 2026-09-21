import React, { useState, useRef } from 'react';
import { AlertCircle, Upload, Send, Heart, Loader } from 'lucide-react';
import { supabase } from '../config/supabase';

export function FoodPhotoAnalyzer({ user, onMealAdded }) {
  const fileInputRef = useRef(null);
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedResult, setEditedResult] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesDropdown, setShowFavoritesDropdown] = useState(false);

  // Load favorites (with local sort to avoid 500 errors)
  const loadFavorites = async () => {
    if (!user?.id) return;
    try {
      const { data, error: fetchErr } = await supabase
        .from('favorite_foods')
        .select('*')
        .eq('user_id', user.id);

      if (fetchErr) throw fetchErr;

      // Sort locally by use_count descending
      const sorted = (data || [])
        .sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
        .slice(0, 20);

      setFavorites(sorted);
    } catch (err) {
      console.error('Error loading favorites:', err.message);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    setError(null);
    setIsLoading(true);
    setResult(null);
    setEditedResult(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target.result.split(',')[1];

        try {
          // Call analyze-food edge function
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                image: base64Image,
                filename: file.name,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }

          const data = await response.json();

          setImageData({
            file,
            base64: base64Image,
            name: file.name,
          });

          // Parse analysis result
          let parsed = data.analysis;
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }

          setResult(parsed);
          setEditedResult({ ...parsed });
          setShowFavoritesDropdown(false);
        } catch (err) {
          console.error('Edge Function error:', err);
          setError(`Analiza eșuată: ${err.message}`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(`Eroare upload: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save meal to meal_entries table
  const addToTodayLog = async () => {
    if (!user?.id || !editedResult) {
      setError('Date lipsă (user sau result)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const currentTime = new Date().toTimeString().split(' ')[0];

      // ONLY include fields that exist in meal_entries schema
      const mealEntry = {
        user_id: user.id,
        date: today,
        time: currentTime,
        name: editedResult.name || 'Meniu',
        image_url: imageData ? `uploaded-${Date.now()}` : null,
        calories: editedResult.calories || 0,
        protein_g: editedResult.protein_g || 0,
        carbs_g: editedResult.carbs_g || 0,
        fat_g: editedResult.fat_g || 0,
        fiber_g: editedResult.fiber_g || 0,
        portion_desc: editedResult.portion_desc || null,
        source: imageData ? 'photo' : 'text',
        sugar_g: editedResult.sugar_g || 0,
        saturated_fat_g: editedResult.saturated_fat_g || 0,
        sodium_mg: editedResult.sodium_mg || 0,
        potassium_mg: editedResult.potassium_mg || 0,
        calcium_mg: editedResult.calcium_mg || 0,
        iron_mg: editedResult.iron_mg || 0,
        vitamin_a_mcg: editedResult.vitamin_a_mcg || 0,
        vitamin_c_mg: editedResult.vitamin_c_mg || 0,
        vitamin_d_mcg: editedResult.vitamin_d_mcg || 0,
        vitamin_b12_mcg: editedResult.vitamin_b12_mcg || 0,
        magnesium_mg: editedResult.magnesium_mg || 0,
        zinc_mg: editedResult.zinc_mg || 0,
        vitamin_b6_mg: editedResult.vitamin_b6_mg || 0,
        folate_mcg: editedResult.folate_mcg || 0,
        vitamin_e_mg: editedResult.vitamin_e_mg || 0,
        omega3_mg: editedResult.omega3_mg || 0,
        selenium_mcg: editedResult.selenium_mcg || 0,
      };

      const { data, error: insertErr } = await supabase
        .from('meal_entries')
        .insert([mealEntry])
        .select();

      if (insertErr) {
        console.error('Insert error details:', insertErr);
        throw insertErr;
      }

      setResult(null);
      setEditedResult(null);
      setImageData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      if (onMealAdded) onMealAdded(data?.[0]);
    } catch (err) {
      console.error('Error saving meal:', err);
      setError(`Eroare salvare: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // UPSERT favorite food
  const saveToFavorites = async () => {
    if (!user?.id || !editedResult?.name) {
      setError('Date lipsă (name)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const name = editedResult.name.trim();

      // Check if already exists
      const { data: existing, error: selectErr } = await supabase
        .from('favorite_foods')
        .select('id, use_count')
        .eq('user_id', user.id)
        .eq('name', name)
        .maybeSingle();

      if (selectErr) throw selectErr;

      if (existing?.id) {
        // UPDATE use_count
        const { error: updateErr } = await supabase
          .from('favorite_foods')
          .update({ use_count: (existing.use_count || 1) + 1 })
          .eq('id', existing.id);

        if (updateErr) throw updateErr;
      } else {
        // INSERT new favorite
        const newFav = {
          user_id: user.id,
          name,
          calories: editedResult.calories || 0,
          protein_g: editedResult.protein_g || 0,
          carbs_g: editedResult.carbs_g || 0,
          fat_g: editedResult.fat_g || 0,
          fiber_g: editedResult.fiber_g || 0,
          portion_desc: editedResult.portion_desc || null,
          sugar_g: editedResult.sugar_g || 0,
          saturated_fat_g: editedResult.saturated_fat_g || 0,
          sodium_mg: editedResult.sodium_mg || 0,
          potassium_mg: editedResult.potassium_mg || 0,
          calcium_mg: editedResult.calcium_mg || 0,
          iron_mg: editedResult.iron_mg || 0,
          vitamin_a_mcg: editedResult.vitamin_a_mcg || 0,
          vitamin_c_mg: editedResult.vitamin_c_mg || 0,
          vitamin_d_mcg: editedResult.vitamin_d_mcg || 0,
          vitamin_b12_mcg: editedResult.vitamin_b12_mcg || 0,
          magnesium_mg: editedResult.magnesium_mg || 0,
          zinc_mg: editedResult.zinc_mg || 0,
          vitamin_b6_mg: editedResult.vitamin_b6_mg || 0,
          folate_mcg: editedResult.folate_mcg || 0,
          vitamin_e_mg: editedResult.vitamin_e_mg || 0,
          omega3_mg: editedResult.omega3_mg || 0,
          selenium_mcg: editedResult.selenium_mcg || 0,
          use_count: 1,
        };

        const { error: insertErr } = await supabase
          .from('favorite_foods')
          .insert([newFav]);

        if (insertErr) throw insertErr;
      }

      await loadFavorites();
      setError(null);
    } catch (err) {
      console.error('Error saving favorite:', err);
      setError(`Eroare salvare favorite: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const useFavorite = async (fav) => {
    setEditedResult({
      name: fav.name,
      calories: fav.calories || 0,
      protein_g: fav.protein_g || 0,
      carbs_g: fav.carbs_g || 0,
      fat_g: fav.fat_g || 0,
      fiber_g: fav.fiber_g || 0,
      portion_desc: fav.portion_desc || null,
      sugar_g: fav.sugar_g || 0,
      saturated_fat_g: fav.saturated_fat_g || 0,
      sodium_mg: fav.sodium_mg || 0,
      potassium_mg: fav.potassium_mg || 0,
      calcium_mg: fav.calcium_mg || 0,
      iron_mg: fav.iron_mg || 0,
      vitamin_a_mcg: fav.vitamin_a_mcg || 0,
      vitamin_c_mg: fav.vitamin_c_mg || 0,
      vitamin_d_mcg: fav.vitamin_d_mcg || 0,
      vitamin_b12_mcg: fav.vitamin_b12_mcg || 0,
      magnesium_mg: fav.magnesium_mg || 0,
      zinc_mg: fav.zinc_mg || 0,
      vitamin_b6_mg: fav.vitamin_b6_mg || 0,
      folate_mcg: fav.folate_mcg || 0,
      vitamin_e_mg: fav.vitamin_e_mg || 0,
      omega3_mg: fav.omega3_mg || 0,
      selenium_mcg: fav.selenium_mcg || 0,
    });
    setShowFavoritesDropdown(false);
  };

  const handleFieldChange = (field, value) => {
    setEditedResult((prev) => ({
      ...prev,
      [field]: value === '' ? null : (isNaN(value) ? value : parseFloat(value) || 0),
    }));
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Analizor Alimente</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!result && (
        <div className="mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              Încarcă foto
            </button>
            <button
              onClick={loadFavorites}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 relative"
            >
              <Heart className="w-5 h-5" />
              {showFavoritesDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border rounded shadow-lg z-10 max-h-40 overflow-y-auto">
                  {favorites.map((fav) => (
                    <button
                      key={fav.id}
                      onClick={() => useFavorite(fav)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-800"
                    >
                      {fav.name} ({fav.use_count || 1}x)
                    </button>
                  ))}
                </div>
              )}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files?.[0])}
            className="hidden"
          />
        </div>
      )}

      {result && editedResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              value={editedResult.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className="col-span-2 px-3 py-2 border rounded"
              placeholder="Nume aliment"
            />

            {[
              ['calories', 'Calorii'],
              ['protein_g', 'Proteină (g)'],
              ['carbs_g', 'Carbohidrați (g)'],
              ['fat_g', 'Grăsimi (g)'],
              ['fiber_g', 'Fibră (g)'],
              ['sugar_g', 'Zahăr (g)'],
              ['sodium_mg', 'Sodiu (mg)'],
              ['potassium_mg', 'Potasiu (mg)'],
              ['calcium_mg', 'Calciu (mg)'],
              ['iron_mg', 'Fier (mg)'],
              ['vitamin_a_mcg', 'Vitamina A (mcg)'],
              ['vitamin_c_mg', 'Vitamina C (mg)'],
            ].map(([field, label]) => (
              <input
                key={field}
                type="number"
                value={editedResult[field] || 0}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className="px-3 py-2 border rounded"
                placeholder={label}
              />
            ))}

            <input
              type="text"
              value={editedResult.portion_desc || ''}
              onChange={(e) => handleFieldChange('portion_desc', e.target.value)}
              className="col-span-2 px-3 py-2 border rounded"
              placeholder="Descriere porție (opțional)"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={addToTodayLog}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Adaugă în jurnal
            </button>
            <button
              onClick={saveToFavorites}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
            >
              <Heart className="w-5 h-5" />
              Salvează la preferate
            </button>
            <button
              onClick={() => {
                setResult(null);
                setEditedResult(null);
                setImageData(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
            >
              Anulează
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
