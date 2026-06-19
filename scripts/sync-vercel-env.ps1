# Sync env vars to Vercel production (add or replace).
param(
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Set-VercelEnv([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return }
  Write-Host "  [set]  $Name"
  npx vercel env rm $Name production --yes 2>$null | Out-Null
  $Value | npx vercel env add $Name production --yes 2>&1 | Out-Null
}

Write-Host "=== Sync Vercel production env ==="

# Supabase — bxtx project (supabase-camel-lever)
$supabaseUrl = "https://bxtxygakafwusstpptkg.supabase.co"
$publishable = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHh5Z2FrYWZ3dXNzdHBwdGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NzM3MDYsImV4cCI6MjA5NTI0OTcwNn0.bf6lLdApnbICmMEyOvTOy7KEsBBeT5hCsjM_M6aElXg"
$serviceKeyDefault = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHh5Z2FrYWZ3dXNzdHBwdGtnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY3MzcwNiwiZXhwIjoyMDk1MjQ5NzA2fQ.wmuessNJmtjuWoydXEfG0p6ZWsLu4GQQcyewGrL1Q-M"

Set-VercelEnv "SUPABASE_URL" $supabaseUrl
Set-VercelEnv "VITE_SUPABASE_URL" $supabaseUrl
Set-VercelEnv "SUPABASE_PROJECT_ID" "bxtxygakafwusstpptkg"
Set-VercelEnv "VITE_SUPABASE_PROJECT_ID" "bxtxygakafwusstpptkg"
Set-VercelEnv "SUPABASE_PUBLISHABLE_KEY" $publishable
Set-VercelEnv "VITE_SUPABASE_PUBLISHABLE_KEY" $publishable
# AI Gateway (sibling project / existing setup)
$gwKey = "key_rXtXgAkt0pJYquVL"
Set-VercelEnv "AI_GATEWAY_KEY" $gwKey
Set-VercelEnv "VERCEL_AI_GATEWAY_KEY" $gwKey
Set-VercelEnv "AI_GATEWAY_URL" "https://ai-gateway.vercel.sh/v1/chat/completions"
Set-VercelEnv "AI_GATEWAY_MODEL" "openai/gpt-4o-mini"

# Service role — bxtx default or env override
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $serviceKey -and $args.Count -gt 0) { $serviceKey = $args[0] }
if (-not $serviceKey) { $serviceKey = $serviceKeyDefault }if ($serviceKey) {
  Set-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $serviceKey
} else {
  Write-Host "  [skip] SUPABASE_SERVICE_ROLE_KEY (not available locally)"
}

if (-not $SkipDeploy) {
  Write-Host "Redeploying production..."
  npx vercel deploy --prod --yes
}

Write-Host "Done."
