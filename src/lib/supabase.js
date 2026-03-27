import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://praotrojrxdrjifuvhtz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByYW90cm9qcnhkcmppZnV2aHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzkyNDgsImV4cCI6MjA4ODA1NTI0OH0.vixhzlNix3qc23pVT95P6SAofpa6maideDSoc2MByCA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
