import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function extractTitle(raw = '') {
  const match = raw.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : 'Untitled Recipe'
}

export function useRecipes(user) {
  const [recipes, setRecipes] = useState([])
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)

  // Load all recipes for this user
  const loadRecipes = useCallback(async () => {
    if (!user) { setRecipes([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('hearth_recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setRecipes(data || [])
    setLoading(false)
  }, [user])

  // Load all menus for this user
  const loadMenus = useCallback(async () => {
    if (!user) { setMenus([]); return }
    const { data, error } = await supabase
      .from('hearth_menus')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setMenus(data || [])
  }, [user])

  useEffect(() => {
    loadRecipes()
    loadMenus()
  }, [loadRecipes, loadMenus])

  // Add a new recipe
  const addRecipe = useCallback(async (recipe) => {
    if (!user) return
    const title = extractTitle(recipe.raw)
    const { data, error } = await supabase
      .from('hearth_recipes')
      .insert({
        user_id: user.id,
        raw: recipe.raw,
        title,
        photos: recipe.photos || [],
        rating: recipe.rating || 0,
        is_favorite: false,
        notes: recipe.notes || '',
      })
      .select()
      .single()
    if (!error && data) {
      setRecipes(prev => [data, ...prev.filter(r => r.id !== data.id)])
      return data
    }
  }, [user])

  // Update a recipe
  const updateRecipe = useCallback(async (updated) => {
    if (!user) return
    const { data, error } = await supabase
      .from('hearth_recipes')
      .update({
        raw: updated.raw,
        title: extractTitle(updated.raw),
        photos: updated.photos || [],
        rating: updated.rating || 0,
        is_favorite: updated.is_favorite || false,
        notes: updated.notes || '',
      })
      .eq('id', updated.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (!error && data) {
      setRecipes(prev => prev.map(r => r.id === data.id ? data : r))
      return data
    }
  }, [user])

  // Toggle favorite — prevents duplicates by checking local recipes list first
  const toggleFavorite = useCallback(async (recipe) => {
    if (!user) return
    // Check if already in DB by matching on raw content (for unsaved generated recipes)
    let dbRecipe = recipe
    if (!recipe.created_at) {
      // Check if a matching recipe already exists in local state
      const existing = recipes.find(r => r.raw === recipe.raw)
      if (existing) {
        dbRecipe = existing
      } else {
        // Not in DB yet — save it first with is_favorite: true directly
        const title = extractTitle(recipe.raw)
        const { data, error } = await supabase
          .from('hearth_recipes')
          .insert({
            user_id: user.id,
            raw: recipe.raw,
            title,
            photos: recipe.photos || [],
            rating: recipe.rating || 0,
            is_favorite: true,
            notes: recipe.notes || '',
          })
          .select()
          .single()
        if (!error && data) {
          setRecipes(prev => [data, ...prev])
        }
        return
      }
    }
    const newVal = !dbRecipe.is_favorite
    const { data, error } = await supabase
      .from('hearth_recipes')
      .update({ is_favorite: newVal })
      .eq('id', dbRecipe.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (!error && data) {
      setRecipes(prev => prev.map(r => r.id === data.id ? data : r))
    }
  }, [user, recipes])

  // Delete a recipe
  const deleteRecipe = useCallback(async (id) => {
    if (!user) return
    await supabase.from('hearth_recipes').delete().eq('id', id).eq('user_id', user.id)
    setRecipes(prev => prev.filter(r => r.id !== id))
  }, [user])

  // Create a menu
  const createMenu = useCallback(async (name, recipeIds) => {
    if (!user) return
    const { data, error } = await supabase
      .from('hearth_menus')
      .insert({ user_id: user.id, name, recipe_ids: recipeIds })
      .select()
      .single()
    if (!error && data) {
      setMenus(prev => [data, ...prev])
    }
  }, [user])

  // Delete a menu
  const deleteMenu = useCallback(async (id) => {
    if (!user) return
    await supabase.from('hearth_menus').delete().eq('id', id).eq('user_id', user.id)
    setMenus(prev => prev.filter(m => m.id !== id))
  }, [user])

  const favorites = recipes.filter(r => r.is_favorite)

  return {
    recipes, favorites, menus, loading,
    addRecipe, updateRecipe, toggleFavorite, deleteRecipe,
    createMenu, deleteMenu,
    reload: loadRecipes,
  }
}
