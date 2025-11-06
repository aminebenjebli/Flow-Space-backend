<#
  scripts/ensure-whisper-windows.ps1
  Vérifie et (si demandé) installe automatiquement tout ce qu'il faut pour tester Whisper

  Usage:
    # interactif (par défaut) — affiche actions et propose d'installer lorsque possible
    powershell -ExecutionPolicy Bypass -File .\scripts\ensure-whisper-windows.ps1

    # non-interactif (force les installations quand possible)
    powershell -ExecutionPolicy Bypass -File .\scripts\ensure-whisper-windows.ps1 --yes

  Remarques:
  - L'installation automatique via Chocolatey requiert souvent des droits administrateur.
  - Si une étape échoue à cause de permissions, relancez PowerShell en mode Administrateur et réessayez.
#>

param(
  [switch]$Yes
)

function Write-Ok($m) { Write-Host "[OK]   " -ForegroundColor Green -NoNewline; Write-Host " $m" }
function Write-Warn($m) { Write-Host "[WARN] " -ForegroundColor Yellow -NoNewline; Write-Host " $m" }
function Write-Err($m) { Write-Host "[ERR]  " -ForegroundColor Red -NoNewline; Write-Host " $m" }

Write-Host "=== Ensure Whisper (Windows) — vérification et installation ===`n"

$failures = @()

function Run-Command($c) {
  try { Invoke-Expression $c; return $true } catch { return $false }
}

function AutoInstall-Available() { return $Yes.IsPresent }

# 1) Chocolatey
$choco = Get-Command choco -ErrorAction SilentlyContinue
if ($null -eq $choco) {
  Write-Warn "Chocolatey (choco) non trouvé. Nécessaire pour installations automatiques via choco."
  if (AutoInstall-Available) {
    Write-Host "Tentative d'installation automatique de Chocolatey..."
    $install = 'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))'
    if (Run-Command $install) { Write-Ok "Chocolatey installé (ou script exécuté)." } else { Write-Err "Impossible d'installer Chocolatey automatiquement."; $failures += 'choco' }
  } else {
    Write-Warn "Pour autoriser l'installation automatique, relancez le script avec --yes depuis une PowerShell en Administrateur."
    $failures += 'choco'
  }
} else { Write-Ok "Chocolatey détecté" }

# 2) Python
$pythonCmd = $env:WHISPER_PYTHON_CMD
if (-not $pythonCmd) {
  $candidate = (Get-Command python -ErrorAction SilentlyContinue) || (Get-Command py -ErrorAction SilentlyContinue)
  if ($candidate) { $pythonCmd = $candidate.Name }
}

if (-not $pythonCmd) {
  Write-Warn "Python (avec 'python -m') non trouvé."
  if (AutoInstall-Available -and (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installation automatique de Python via choco..."
    if (Run-Command 'choco install python -y') { Write-Ok "Python installé via choco"; $pythonCmd = 'python' } else { Write-Err "Échec de l'installation Python via choco"; $failures += 'python' }
  } else {
    Write-Warn "Installez Python manuellement depuis https://www.python.org/downloads/ ou relancez avec --yes en Administrateur pour installer automatiquement."; $failures += 'python'
  }
} else { Write-Ok "Python détecté : $pythonCmd" }

# 3) ffmpeg
$ffPath = $env:FFMPEG_BINARY
if (-not $ffPath) { $ffPath = (Get-Command ffmpeg -ErrorAction SilentlyContinue)?.Source }
if (-not $ffPath) {
  Write-Warn "ffmpeg non trouvé."
  if (AutoInstall-Available -and (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installation automatique de ffmpeg via choco..."
    if (Run-Command 'choco install ffmpeg -y') { Write-Ok "ffmpeg installé via choco" } else { Write-Err "Échec de l'installation ffmpeg via choco"; $failures += 'ffmpeg' }
  } else {
    Write-Warn "Installez ffmpeg via Chocolatey: 'choco install ffmpeg -y' ou ajoutez votre ffmpeg.exe et définissez FFMPEG_BINARY."; $failures += 'ffmpeg'
  }
} else { Write-Ok "ffmpeg détecté : $ffPath" }

# 4) openai-whisper Python package
if ($pythonCmd) {
  Write-Host "Vérification / installation du package Python 'openai-whisper'..."
  if (Run-Command "$pythonCmd -m pip install --upgrade pip") { Write-Ok "pip mis à jour" } else { Write-Warn "Impossible de mettre à jour pip" }
  if (Run-Command "$pythonCmd -m pip show openai-whisper > $null 2>&1") { Write-Ok "openai-whisper déjà installé" } else {
    if (Run-Command "$pythonCmd -m pip install -U openai-whisper") { Write-Ok "openai-whisper installé" } else { Write-Err "Échec de l'installation openai-whisper"; $failures += 'whisper_pkg' }
  }
} else {
  Write-Err "Impossible d'installer le package Python car Python introuvable."; $failures += 'whisper_pkg'
}

Write-Host "`n=== Résultat ==="
if ($failures.Count -eq 0) { Write-Ok "Environnement prêt pour tester la transcription locale"; exit 0 } else { Write-Err "Problèmes détectés pour : $($failures -join ', ')"; Write-Host "Consignes: installez manuellement ou relancez ce script avec --yes en Administrateur pour tenter l'installation automatique."; exit 1 }
