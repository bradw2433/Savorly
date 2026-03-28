import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = {
  produce: ['onion','garlic','tomato','potato','carrot','celery','pepper','lemon','lime','lettuce','spinach','kale','mushroom','zucchini','squash','cucumber','avocado','apple','banana','berry','herb','basil','parsley','cilantro','thyme','rosemary','ginger','scallion','shallot','leek'],
  meat: ['chicken','beef','pork','lamb','turkey','bacon','sausage','steak','ground','filet','breast','thigh','shrimp','salmon','fish','tuna','cod','halibut','duck','veal'],
  dairy: ['milk','cream','butter','cheese','yogurt','egg','parmesan','mozzarella','cheddar','feta','ricotta','sour cream','heavy cream','half and half','ghee'],
  pantry: ['oil','olive oil','flour','sugar','salt','pepper','rice','pasta','bread','stock','broth','vinegar','sauce','wine','honey','maple','mustard','soy','coconut','cornstarch','baking','vanilla','cinnamon','cumin','paprika','oregano','bay'],
  canned: ['can','tomatoes','beans','lentils','chickpea','coconut milk','broth'],
}

export const categorizeIngredient = (name) => {
  const low = name.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => low.includes(k))) return cat
  }
  return 'other'
}

export function useShoppingList(user) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    const load = async () => {
      const { data } = await supabase
        .from('hearth_shopping_lists')
        .select('items')
        .eq('user_id', user.id)
        .single()
      setItems(data?.items || [])
      setLoading(false)
    }
    load()
  }, [user])

  const save = useCallback(async (newItems) => {
    if (!user) return
    setItems(newItems)
    await supabase.from('hearth_shopping_lists').upsert(
      { user_id: user.id, items: newItems, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  }, [user])

  const addItems = useCallback(async (ingredients) => {
    const newItems = [...items]
    ingredients.forEach(ing => {
      const exists = newItems.find(i => i.name.toLowerCase() === ing.toLowerCase())
      if (!exists) {
        newItems.push({ id: Date.now() + Math.random(), name: ing, category: categorizeIngredient(ing), checked: false })
      }
    })
    await save(newItems)
  }, [items, save])

  const toggleItem = useCallback(async (id) => {
    const newItems = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i)
    await save(newItems)
  }, [items, save])

  const removeItem = useCallback(async (id) => {
    await save(items.filter(i => i.id !== id))
  }, [items, save])

  const clearChecked = useCallback(async () => {
    await save(items.filter(i => !i.checked))
  }, [items, save])

  const clearAll = useCallback(async () => {
    await save([])
  }, [save])

  return { items, loading, addItems, toggleItem, removeItem, clearChecked, clearAll }
}
