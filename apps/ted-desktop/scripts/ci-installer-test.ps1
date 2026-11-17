# Real installs of the just-built installer on the Windows CI runner (per-user, silent).
#
#   A) normal install            -> the installed program is complete and passes the smoke test;
#   B) %TEMP% on a small disk,   -> the installer keeps its temporary files next to the install
#      install folder elsewhere     folder and the install still succeeds (the "disk C: is full" case);
#   C) %TEMP% and the install    -> refused with exit code 3 before anything is written.
#      folder on the small disk
#   D) (optional, -OldSetupUrl)  -> the same small %TEMP% with an older installer, to show what the
#                                   checks in build/installer.nsh prevent. Never fails the run.
#
# Every result is also written as a workflow annotation (::notice / ::error).
param(
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][string]$Unpacked,
  [string]$OldSetupUrl = ''
)
$ErrorActionPreference = 'Stop'
$ExeName = 'TedImotiNadezhda.exe'
$Work = $env:RUNNER_TEMP
if (-not $Work) { $Work = [System.IO.Path]::GetTempPath() }

function Note([string]$m) { Write-Host "::notice title=Installer test::$m" }
function Fail([string]$m) { Write-Host "::error title=Installer test::$m"; exit 1 }

# NSIS: /D= must be the last argument and must not be quoted.
function Invoke-Setup([string]$exe, [string]$dir, [string]$temp) {
  $oldTemp = $env:TEMP; $oldTmp = $env:TMP
  if ($temp) { $env:TEMP = $temp; $env:TMP = $temp }
  try {
    $p = Start-Process -FilePath $exe -ArgumentList "/currentuser /S /D=$dir" -PassThru
    $null = $p.Handle # keep the handle so ExitCode stays readable after exit
    if (-not $p.WaitForExit(600000)) { try { $p.Kill() } catch { }; return 9999 }
    return $p.ExitCode
  } finally { $env:TEMP = $oldTemp; $env:TMP = $oldTmp }
}

# '' when the installed folder holds every file of win-unpacked and the .exe has the same size.
function Test-Installed([string]$dir) {
  $exe = Join-Path $dir $ExeName
  if (-not (Test-Path $exe)) { return "no $ExeName in $dir" }
  $have = (Get-Item $exe).Length
  $want = (Get-Item (Join-Path $Unpacked $ExeName)).Length
  if ($have -ne $want) { return "$ExeName is $have bytes, expected $want" }
  $root = (Resolve-Path $Unpacked).Path.TrimEnd('\')
  $missing = @(Get-ChildItem $root -Recurse -File | ForEach-Object { $_.FullName.Substring($root.Length + 1) } |
    Where-Object { -not (Test-Path (Join-Path $dir $_)) })
  if ($missing.Count) { return 'missing files: ' + ($missing -join ', ') }
  return ''
}

function Invoke-Smoke([string]$dir, [string]$name) {
  $exe = Join-Path $dir $ExeName
  $report = Join-Path $Work "smoke-$name.json"
  Remove-Item $report -ErrorAction SilentlyContinue
  $p = Start-Process -FilePath $exe -ArgumentList @('--smoke-test', "`"--smoke-report=$report`"") -PassThru
  $null = $p.Handle
  if (-not $p.WaitForExit(120000)) {
    Get-Process -Name 'TedImotiNadezhda' -ErrorAction SilentlyContinue | Stop-Process -Force
    return 'the smoke test did not finish within 120 s'
  }
  if (-not (Test-Path $report)) { return "no smoke report (exit code $($p.ExitCode))" }
  if ($p.ExitCode -ne 0) { Write-Host (Get-Content -Raw -Encoding utf8 $report); return "smoke test failed (exit code $($p.ExitCode))" }
  return ''
}

function New-SmallDisk([int]$mb) {
  $vhd = Join-Path $Work 'ted-small.vhdx'
  Remove-Item $vhd -ErrorAction SilentlyContinue
  $lines = @(
    "create vdisk file=`"$vhd`" maximum=$mb type=expandable",
    "select vdisk file=`"$vhd`"",
    'attach vdisk',
    'create partition primary',
    'format fs=ntfs quick label=TEDTMP',
    'assign letter=T'
  )
  $script = Join-Path $Work 'ted-diskpart.txt'
  Set-Content -Path $script -Value $lines -Encoding ascii
  try { & diskpart /s $script | Out-Host } catch { Write-Host "diskpart: $_" }
  if (-not (Test-Path 'T:\')) { return $false }
  New-Item -ItemType Directory -Force -Path 'T:\tmp' | Out-Null
  return $true
}

function Get-FreeMb([string]$drive) { [int]((Get-PSDrive $drive).Free / 1MB) }

if (-not (Test-Path $Setup)) { Fail "Missing installer $Setup" }
if (-not (Test-Path (Join-Path $Unpacked $ExeName))) { Fail "Missing $Unpacked\$ExeName" }

# ---- A) normal install ---------------------------------------------------------------------
$dirA = Join-Path $Work 'ted-install-a'
$code = Invoke-Setup $Setup $dirA ''
if ($code -ne 0) { Fail "A) normal silent install: exit code $code (expected 0)" }
$bad = Test-Installed $dirA
if ($bad) { Fail "A) normal silent install is incomplete: $bad" }
$bad = Invoke-Smoke $dirA 'a'
if ($bad) { Fail "A) installed program: $bad" }
Note "A) normal install: exit 0, all files present, the installed program passes the smoke test."

# ---- small disk for %TEMP% -----------------------------------------------------------------
if (-not (New-SmallDisk 450)) {
  Write-Host "::warning title=Installer test::Could not create the small test disk (diskpart); tests B, C and D were skipped."
  exit 0
}
Note "Small test disk T: ready, $(Get-FreeMb 'T') MB free (the installer needs about 580 MB of temporary space)."

# ---- B) temp on the small disk, install folder on a roomy one -------------------------------
$dirB = Join-Path $Work 'ted-install-b\Ted'
$code = Invoke-Setup $Setup $dirB 'T:\tmp'
if ($code -ne 0) { Fail "B) full temp drive, install folder on another drive: exit code $code (expected 0)" }
$bad = Test-Installed $dirB
if ($bad) { Fail "B) full temp drive: the install is incomplete: $bad" }
$bad = Invoke-Smoke $dirB 'b'
if ($bad) { Fail "B) full temp drive: installed program: $bad" }
$left = @(Get-ChildItem (Split-Path $dirB -Parent) -Force | Where-Object { $_.Name -ne 'Ted' } | ForEach-Object { $_.Name })
Note "B) temp drive too small, install folder on another drive: exit 0, all files present, smoke test passed. Left next to the install folder: [$($left -join ', ')]. T: now has $(Get-FreeMb 'T') MB free."

# ---- C) temp and install folder both on the small disk -------------------------------------
$code = Invoke-Setup $Setup 'T:\Ted' 'T:\tmp'
if ($code -ne 3) { Fail "C) no room anywhere: exit code $code (expected 3)" }
if (Test-Path "T:\Ted\$ExeName") { Fail "C) no room anywhere: the installer left a $ExeName behind" }
$bad = Test-Installed $dirB
if ($bad) { Fail "C) the refused install damaged the existing installation: $bad" }
Note "C) no room on any drive: refused with exit code 3, nothing written, the existing installation is intact."

# ---- D) the same situation with an older installer (information only) ------------------------
if ($OldSetupUrl) {
  try {
    $old = Join-Path $Work 'ted-old-setup.exe'
    Invoke-WebRequest -Uri $OldSetupUrl -OutFile $old -UseBasicParsing
    $dirD = Join-Path $Work 'ted-install-d\Ted'
    $code = Invoke-Setup $old $dirD 'T:\tmp'
    $exe = Join-Path $dirD $ExeName
    $size = if (Test-Path $exe) { (Get-Item $exe).Length } else { -1 }
    $want = (Get-Item (Join-Path $Unpacked $ExeName)).Length
    $files = if (Test-Path $dirD) { @(Get-ChildItem $dirD -File).Count } else { 0 }
    Note "D) OLD installer with the same too-small temp drive: exit code $code, $ExeName = $size bytes (a complete one is about $want), $files files in the folder."
  } catch {
    Write-Host "::warning title=Installer test::D) old installer check failed to run: $_"
  }
}
exit 0
