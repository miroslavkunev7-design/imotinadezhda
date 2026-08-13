# Sync / create missing Vercel production env vars for imotinadezhda-lovable-vercel.
# Run from repo root: .\scripts\bootstrap-vercel-env.ps1
# Optional: -ServiceRoleKey "eyJ..." or set SUPABASE_ACCESS_TOKEN + run fetch first.

param(
  [string]$ServiceRoleKey = "",
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Test-VercelEnv([string]$Name) {
  $out = npx vercel env ls production 2>&1 | Out-String
  return $out -match [regex]::Escape($Name)
}

function Add-VercelEnv([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  if (Test-VercelEnv $Name) {
    Write-Host "  [skip] $Name (already set)"
    return
  }
  Write-Host "  [add]  $Name"
  $Value | npx vercel env add $Name production --yes 2>&1 | Out-Null
}

Write-Host "=== Bootstrap Vercel env (production) ==="

# --- Site (safe defaults) ---
Add-VercelEnv "VITE_SITE_URL" "https://imotinadezhda.bg"
Add-VercelEnv "VITE_ASSET_BASE_URL" ""
Add-VercelEnv "VITE_LOVABLE_ASSET_BASE" ""

# --- Supabase public (from .env) ---
$dotenv = @{}
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*') {
      $dotenv[$matches[1]] = $matches[2].Trim()
    }
  }
}
Add-VercelEnv "SUPABASE_URL" ($dotenv["SUPABASE_URL"])
Add-VercelEnv "SUPABASE_PUBLISHABLE_KEY" ($dotenv["SUPABASE_PUBLISHABLE_KEY"])
Add-VercelEnv "SUPABASE_PROJECT_ID" ($dotenv["SUPABASE_PROJECT_ID"])
Add-VercelEnv "VITE_SUPABASE_URL" ($dotenv["VITE_SUPABASE_URL"])
Add-VercelEnv "VITE_SUPABASE_PUBLISHABLE_KEY" ($dotenv["VITE_SUPABASE_PUBLISHABLE_KEY"])
Add-VercelEnv "VITE_SUPABASE_PROJECT_ID" ($dotenv["VITE_SUPABASE_PROJECT_ID"])

# --- AI gateway (sibling project fallback) ---
$siblingEnv = "C:\Users\Agenciq\Desktop\IM\imoti-nadezhda-temp\.env.local"
if (Test-Path $siblingEnv) {
  $gw = (Select-String -Path $siblingEnv -Pattern '^\s*VERCEL_AI_GATEWAY_KEY\s*=\s*(.+)\s*$').Matches
  if ($gw.Count -gt 0) {
    $gwKey = $gw[0].Groups[1].Value.Trim().Trim('"')
    Add-VercelEnv "AI_GATEWAY_KEY" $gwKey
    Add-VercelEnv "VERCEL_AI_GATEWAY_KEY" $gwKey
  }
}
Add-VercelEnv "AI_GATEWAY_URL" "https://ai-gateway.vercel.sh/v1/chat/completions"
Add-VercelEnv "AI_GATEWAY_MODEL" "openai/gpt-4o-mini"

# --- Email defaults ---
Add-VercelEnv "MARKETING_FROM_EMAIL" "no-reply@imotinadezhda.bg"
Add-VercelEnv "EMAIL_FROM" "no-reply@imotinadezhda.bg"
Add-VercelEnv "VAPID_SUBJECT" "mailto:agenciq_nadejdi@abv.bg"

# --- Service role (must be real JWT from Supabase; never invent) ---
if ($ServiceRoleKey) {
  Add-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $ServiceRoleKey
} elseif ($env:SUPABASE_SERVICE_ROLE_KEY) {
  Add-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $env:SUPABASE_SERVICE_ROLE_KEY
} else {
  Write-Host ""
  Write-Host "  [warn] SUPABASE_SERVICE_ROLE_KEY not set."
  Write-Host "         Fetch: npx supabase login"
  Write-Host "                npx supabase projects api-keys --project-ref zcrzxgzyptqibsajoece"
  Write-Host "         Then:  .\scripts\bootstrap-vercel-env.ps1 -ServiceRoleKey 'eyJ...'"
}

Write-Host ""
if (-not $SkipDeploy) {
  Write-Host "Redeploying production..."
  npx vercel deploy --prod --yes
  Write-Host "Running smoke test..."
  node scripts/diagnose-production.mjs
}

Write-Host "Done."
