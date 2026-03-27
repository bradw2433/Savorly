# 🔥 Hearth — Deploy Guide

Your database is already set up and ready. You just need to deploy to Netlify and add one environment variable.

---

## What's Already Done ✅

- **Supabase database** — live at praotrojrxdrjifuvhtz.supabase.co
- **hearth_recipes table** — with RLS (each user only sees their own recipes)
- **hearth_menus table** — with RLS
- **Supabase credentials** — baked into the app

---

## What You Need To Do (3 steps)

### Step 1 — Get Your Anthropic API Key

1. Go to https://console.anthropic.com → sign up or log in (free)
2. Click "API Keys" in the left sidebar → "Create Key"
3. Copy the key — starts with sk-ant-...

---

### Step 2 — Deploy to Netlify

1. Go to https://netlify.com → sign up free
2. Click "Add new site" → "Deploy manually"
3. Drag this entire hearth-prod folder into the drop zone
4. Wait ~30 seconds for first deploy

5. Go to Site configuration → Environment variables → Add a variable:
   Key:   ANTHROPIC_API_KEY
   Value: your sk-ant-... key from Step 1

6. Go to Deploys → Trigger deploy → Deploy site
7. In ~1 minute you get a live URL like hearth-xyz.netlify.app

---

### Step 3 — Add to Her iPhone Home Screen

1. Send her the Netlify URL
2. She opens it in Safari (must be Safari, not Chrome)
3. Tap the Share button (bottom of screen)
4. Scroll down → "Add to Home Screen" → Add

Done. Installs with flame icon, opens full screen, feels native. ✅

---

## Her First Time

1. She sees the Sign Up screen
2. Enters email + password → Create Account
3. Confirmation email arrives — she taps the link
4. Signs in — recipes save to cloud permanently, accessible from any device

---

## Costs

- Netlify: Free
- Supabase: Free (already set up)
- Anthropic AI: ~$0.003 per recipe (~30 cents per 100 recipes)
