param(
  [Parameter(Mandatory = $true)]
  [string]$ServiceRoleKey
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Adding SUPABASE_SERVICE_ROLE_KEY to Vercel (production)..."
$ServiceRoleKey | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --yes

Write-Host "Redeploying production..."
npx vercel deploy --prod --yes

Write-Host "Running smoke test..."
node scripts/diagnose-production.mjs
