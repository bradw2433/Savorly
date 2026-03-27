-- ─────────────────────────────────────────────────────────────
-- HEARTH — Supabase Database Schema
-- Run this entire file in: Supabase → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────

-- Recipes table
create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  raw         text not null,
  title       text,
  photos      text[] default '{}',
  rating      int default 0,
  is_favorite boolean default false,
  notes       text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Menus table
create table if not exists public.menus (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  recipe_ids uuid[] default '{}',
  created_at timestamptz default now()
);

-- Auto-update updated_at on recipes
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_recipe_updated on public.recipes;
create trigger on_recipe_updated
  before update on public.recipes
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — users can only see/edit their own data
-- ─────────────────────────────────────────────────────────────
alter table public.recipes enable row level security;
alter table public.menus enable row level security;

-- Recipes policies
create policy "Users can view own recipes"
  on public.recipes for select
  using (auth.uid() = user_id);

create policy "Users can insert own recipes"
  on public.recipes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own recipes"
  on public.recipes for update
  using (auth.uid() = user_id);

create policy "Users can delete own recipes"
  on public.recipes for delete
  using (auth.uid() = user_id);

-- Menus policies
create policy "Users can view own menus"
  on public.menus for select
  using (auth.uid() = user_id);

create policy "Users can insert own menus"
  on public.menus for insert
  with check (auth.uid() = user_id);

create policy "Users can update own menus"
  on public.menus for update
  using (auth.uid() = user_id);

create policy "Users can delete own menus"
  on public.menus for delete
  using (auth.uid() = user_id);
