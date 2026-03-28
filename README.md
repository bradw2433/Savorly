# 🍽️ Savorly — AI Recipe App

An AI-powered recipe app built for discovering, saving, and personalizing recipes.

## Features
- AI recipe generation via Claude
- Recipe chat — modify recipes on the fly
- Favorites with polished cookbook view
- Pantry scan — photo or text → recipe
- Allergen/diet filters
- User accounts with cloud-saved recipes
- PWA — installable to iPhone home screen

## Stack
- React + Vite (PWA)
- Supabase (auth + database)
- Netlify (hosting + serverless functions)
- Anthropic Claude API

## Deploy
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Environment variable: `ANTHROPIC_API_KEY`
