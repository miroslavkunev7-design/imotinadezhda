# Sync ALL production env vars to Vercel (force overwrite).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/sync-all-vercel-env.ps1 [-SkipDeploy]
param([switch]$SkipDeploy)

$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Set-VercelEnv([string]$Name, [string]$Value, [switch]$Sensitive) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "  [skip] $Name (empty)"
    return
  }
  Write-Host "  [set]  $Name"
  npx vercel env rm $Name production --yes 2>$null | Out-Null
  $args = @("env", "add", $Name, "production", "--value", $Value, "--yes", "--force")
  if ($Sensitive) { $args += "--sensitive" }
  & npx vercel @args 2>&1 | Out-Null
}

Write-Host "=== Sync ALL Vercel production env ==="

# Parse .env
$dotenv = @{}
if (Test-Path ".env") {
  Get-Content ".env" -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$') {
      $dotenv[$matches[1]] = $matches[2].Trim()
    }
  }
}

# Parse .env.vercel.prod for AI/email keys if present
$vercelProd = ".env.vercel.prod"
if (Test-Path $vercelProd) {
  Get-Content $vercelProd -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*"(.+)"\s*$') {
      $v = $matches[2]
      if ($v -and -not $dotenv.ContainsKey($matches[1])) {
        $dotenv[$matches[1]] = $v
      }
    }
  }
}

# Site
Set-VercelEnv "VITE_SITE_URL" "https://imotinadezhda.bg"
Set-VercelEnv "VITE_ASSET_BASE_URL" ""
Set-VercelEnv "VITE_LOVABLE_ASSET_BASE" ""

# Supabase bxtx
Set-VercelEnv "SUPABASE_URL" $dotenv["SUPABASE_URL"] -Sensitive
Set-VercelEnv "SUPABASE_PROJECT_ID" $dotenv["SUPABASE_PROJECT_ID"]
Set-VercelEnv "SUPABASE_PUBLISHABLE_KEY" $dotenv["SUPABASE_PUBLISHABLE_KEY"] -Sensitive
Set-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $dotenv["SUPABASE_SERVICE_ROLE_KEY"] -Sensitive
Set-VercelEnv "VITE_SUPABASE_URL" $dotenv["VITE_SUPABASE_URL"] -Sensitive
Set-VercelEnv "VITE_SUPABASE_PROJECT_ID" $dotenv["VITE_SUPABASE_PROJECT_ID"]
Set-VercelEnv "VITE_SUPABASE_PUBLISHABLE_KEY" $dotenv["VITE_SUPABASE_PUBLISHABLE_KEY"] -Sensitive

# AI
$gw = $dotenv["AI_GATEWAY_KEY"]
if (-not $gw) { $gw = "key_rXtXgAkt0pJYquVL" }
Set-VercelEnv "AI_GATEWAY_KEY" $gw -Sensitive
Set-VercelEnv "VERCEL_AI_GATEWAY_KEY" $gw -Sensitive
Set-VercelEnv "AI_GATEWAY_URL" "https://ai-gateway.vercel.sh/v1/chat/completions"
Set-VercelEnv "AI_GATEWAY_MODEL" "openai/gpt-4o-mini"
if ($dotenv["GEMINI_API_KEY"]) { Set-VercelEnv "GEMINI_API_KEY" $dotenv["GEMINI_API_KEY"] -Sensitive }
if ($dotenv["GOOGLE_GENERATIVE_AI_API_KEY"]) { Set-VercelEnv "GOOGLE_GENERATIVE_AI_API_KEY" $dotenv["GOOGLE_GENERATIVE_AI_API_KEY"] -Sensitive }

# Email
Set-VercelEnv "MARKETING_FROM_EMAIL" "no-reply@imotinadezhda.bg"
Set-VercelEnv "EMAIL_FROM" "no-reply@imotinadezhda.bg"
if ($dotenv["RESEND_API_KEY"]) { Set-VercelEnv "RESEND_API_KEY" $dotenv["RESEND_API_KEY"] -Sensitive }
if ($dotenv["EMAIL_API_KEY"]) { Set-VercelEnv "EMAIL_API_KEY" $dotenv["EMAIL_API_KEY"] -Sensitive }

# VAPID (from vercel prod if available)
foreach ($k in @("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT")) {
  if ($dotenv[$k]) { Set-VercelEnv $k $dotenv[$k] -Sensitive }
}
if (-not $dotenv["VAPID_SUBJECT"]) { Set-VercelEnv "VAPID_SUBJECT" "mailto:agenciq_nadejdi@abv.bg" }

Write-Host ""
if (-not $SkipDeploy) {
  Write-Host "Redeploying production..."
  npx vercel deploy --prod --yes
  Write-Host "Smoke test..."
  node scripts/diagnose-production.mjs
}
Write-Host "Done."
