# Fetch service_role JWT from Supabase CLI (requires: npx supabase login once).
# Usage: .\scripts\fetch-supabase-service-key.ps1
# Then pipes into bootstrap or setup-vercel-service-key.

$ErrorActionPreference = "Stop"
$ProjectRef = "zcrzxgzyptqibsajoece"

Write-Host "Fetching API keys for $ProjectRef ..."
$json = npx supabase@latest projects api-keys --project-ref $ProjectRef -o json 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host $json
  Write-Host ""
  Write-Host "Run first: npx supabase login"
  exit 1
}

$data = $json | ConvertFrom-Json
$service = $data | Where-Object { $_.name -eq "service_role" -or $_.role -eq "service_role" } | Select-Object -First 1
$key = $service.api_key
if (-not $key) {
  # older CLI shape
  $key = ($data | ForEach-Object { $_.service_role }) | Where-Object { $_ } | Select-Object -First 1
}
if (-not $key -and $data.service_role) { $key = $data.service_role }

if (-not $key) {
  Write-Host "Could not parse service_role from CLI output:"
  Write-Host $json
  exit 1
}

Write-Host "Got service_role key (${key.Substring(0, [Math]::Min(24, $key.Length))}...)"
& (Join-Path (Split-Path $PSScriptRoot -Parent) "scripts\bootstrap-vercel-env.ps1") -ServiceRoleKey $key
