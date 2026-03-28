import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const usePreferences = (user) => {
  const [allergens, setAllergens] = useState([])
  const [defaultServings, setDefaultServings] = useState(4)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const load = async () => {
      const { data } = await supabase
        .from('hearth_preferences')
        .select('allergens, default_servings')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setAllergens(data.allergens || [])
        setDefaultServings(data.default_servings || 4)
      }
      setLoading(false)
    }
    load()
  }, [user])

  const saveAllergens = async (list) => {
    setAllergens(list)
    await supabase.from('hearth_preferences').upsert(
      { user_id: user.id, allergens: list, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  }

  const saveDefaultServings = async (n) => {
    setDefaultServings(n)
    await supabase.from('hearth_preferences').upsert(
      { user_id: user.id, default_servings: n, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  }

  return { allergens, saveAllergens, defaultServings, saveDefaultServings, loading }
}
