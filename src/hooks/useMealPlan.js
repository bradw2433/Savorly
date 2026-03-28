import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const getWeekStart = (date = new Date()) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.toISOString().split('T')[0]
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0]
}

export function useMealPlan(user) {
  const [plan, setPlan] = useState({})
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [loading, setLoading] = useState(true)

  const loadPlan = useCallback(async (ws) => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('hearth_meal_plans')
      .select('plan')
      .eq('user_id', user.id)
      .eq('week_start', ws)
      .single()
    setPlan(data?.plan || {})
    setLoading(false)
  }, [user])

  useEffect(() => { loadPlan(weekStart) }, [loadPlan, weekStart])

  const savePlan = useCallback(async (newPlan) => {
    if (!user) return
    setPlan(newPlan)
    await supabase.from('hearth_meal_plans').upsert(
      { user_id: user.id, week_start: weekStart, plan: newPlan, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,week_start' }
    )
  }, [user, weekStart])

  const assignRecipe = useCallback(async (day, meal, recipe) => {
    const newPlan = { ...plan, [`${day}_${meal}`]: recipe ? { id: recipe.id, raw: recipe.raw } : null }
    await savePlan(newPlan)
  }, [plan, savePlan])

  const clearSlot = useCallback(async (day, meal) => {
    const newPlan = { ...plan }
    delete newPlan[`${day}_${meal}`]
    await savePlan(newPlan)
  }, [plan, savePlan])

  const goToWeek = (offset) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + offset * 7)
    const ws = d.toISOString().split('T')[0]
    setWeekStart(ws)
    loadPlan(ws)
  }

  return { plan, weekStart, loading, assignRecipe, clearSlot, goToWeek }
}
