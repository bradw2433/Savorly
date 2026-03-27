import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

  // Toggle favorite
  const toggleFavorite = useCallback(async (recipe) => {
    if (!user) return
    // If recipe has no DB id yet, save it first
    let dbRecipe = recipe
    if (!recipe.created_at) {
      dbRecipe = await addRecipe(recipe)
      if (!dbRecipe) return
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
  }, [user, addRecipe])

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

function extractTitle(raw = '') {
  const match = raw.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : 'Untitled Recipe'
}
