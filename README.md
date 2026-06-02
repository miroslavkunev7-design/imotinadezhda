# Vercel Deployment Guide

## Required Environment Variables

Add the following variables in your Vercel project settings (Settings → Environment Variables).

| Variable | Description | Where to find it |
|----------|-------------|------------------|
| `VITE_SUPABASE_URL` | Your backend database URL | `.env` file → `VITE_SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public Supabase API key (safe for client) | `.env` file → `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project identifier | `.env` file → `VITE_SUPABASE_PROJECT_ID` |

### How to get these values

All three values are already configured in the project's `.env` file at the root of the repository. Copy them directly from there into Vercel.

> ⚠️ **Important:** `VITE_SUPABASE_PUBLISHABLE_KEY` is the **public** key — it is safe to expose in client-side code. Do NOT use the service role key (`SUPABASE_SERVICE_ROLE_KEY`) in any `VITE_` variable.

## Build Configuration

The project uses TanStack Start with a custom Vite configuration. The `vercel.json` file is already set up with:

- `buildCommand`: `DEPLOY_TARGET=vercel vite build`
- `framework`: `null` (custom build)

No additional build settings are required in the Vercel dashboard.

## Steps to Deploy

1. Connect your GitHub repository to Vercel.
2. Add the three environment variables above in **Vercel Dashboard → Project Settings → Environment Variables**.
3. Deploy. The build will automatically use the `vercel` Nitro preset for SSR support.
