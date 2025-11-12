#!/usr/bin/env bash
# scripts/ensure-whisper-macos.sh
# Vérifie et installe automatiquement (si demandé) :
#  - Homebrew (si nécessaire)
#  - Python (via brew si absent)
#  - ffmpeg (via brew si absent)
#  - le package Python `openai-whisper`

set -euo pipefail

noninteractive=false
if [ "${1:-}" = "--yes" ] || [ "${NONINTERACTIVE:-}" = "1" ]; then
  noninteractive=true
fi

echo "=== Ensure Whisper (macOS/Linux) — vérification et installation ==="

errors=()

install_brew() {
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
}

# 1) Homebrew
if command -v brew >/dev/null 2>&1; then
  echo "[OK]  Homebrew détecté"
else
  echo "[WARN] Homebrew non détecté"
  if [ "$noninteractive" = true ]; then
    echo "Tentative d'installation automatique de Homebrew..."
    if install_brew; then
      echo "[OK]  Homebrew installé"
    else
      echo "[ERR] Impossible d'installer Homebrew automatiquement. Installez manuellement: https://brew.sh/" >&2
      errors+=(homebrew)
    fi
  else
    echo "Pour installer automatiquement, relancez avec --yes"
    errors+=(homebrew)
  fi
fi

# 2) Python
python_cmd=${WHISPER_PYTHON_CMD:-}
if [ -z "$python_cmd" ]; then
  if command -v python3 >/dev/null 2>&1; then
    python_cmd=python3
  elif command -v python >/dev/null 2>&1; then
    python_cmd=python
  fi
fi

if [ -z "$python_cmd" ]; then
  echo "[WARN] Python non détecté"
  if [ "$noninteractive" = true ] && command -v brew >/dev/null 2>&1; then
    echo "Tentative d'installation de Python via Homebrew..."
    if brew install python; then
      python_cmd=python3
      echo "[OK]  Python installé via Homebrew"
    else
      echo "[ERR] Échec de l'installation Python via brew" >&2
      errors+=(python)
    fi
  else
    echo "Pour installer automatiquement, relancez avec --yes et assurez-vous d'avoir Homebrew";
    errors+=(python)
  fi
else
  echo "[OK]  Python détecté: $python_cmd"
fi

# 3) ffmpeg
ffmpeg_ok=false
if [ -n "${FFMPEG_BINARY:-}" ] && [ -x "${FFMPEG_BINARY}" ]; then
  echo "[OK]  FFMPEG_BINARY pointe vers: $FFMPEG_BINARY"
  ffmpeg_ok=true
fi

if ! $ffmpeg_ok; then
  if command -v ffmpeg >/dev/null 2>&1; then
    echo "[OK]  ffmpeg trouvé dans PATH"
    ffmpeg_ok=true
  fi
fi

if ! $ffmpeg_ok; then
  echo "[WARN] ffmpeg non trouvé"
  if [ "$noninteractive" = true ] && command -v brew >/dev/null 2>&1; then
    echo "Tentative d'installation de ffmpeg via Homebrew..."
    if brew install ffmpeg; then
      echo "[OK]  ffmpeg installé via Homebrew"
      ffmpeg_ok=true
    else
      echo "[ERR] Échec de l'installation ffmpeg via brew" >&2
      errors+=(ffmpeg)
    fi
  else
    echo "Pour installer automatiquement, relancez avec --yes et assurez-vous d'avoir Homebrew";
    errors+=(ffmpeg)
  fi
fi

# 4) Install openai-whisper
if [ -n "${python_cmd:-}" ]; then
  echo "[INFO] Installation / mise à jour du package Python 'openai-whisper' avec $python_cmd"
  if $python_cmd -m pip install --upgrade pip && $python_cmd -m pip install -U openai-whisper; then
    echo "[OK]  openai-whisper installé"
  else
    echo "[ERR] Échec de l'installation openai-whisper" >&2
    errors+=(whisper_pkg)
  fi
else
  echo "[ERR] Aucun python disponible pour installer openai-whisper" >&2
  errors+=(whisper_pkg)
fi

echo "\n=== Résultat ==="
if [ ${#errors[@]} -eq 0 ]; then
  echo "[OK]  Environnement prêt pour tester la transcription locale"
  exit 0
else
  echo "[ERR] Problèmes détectés: ${errors[*]}"
  echo "Si une installation automatique a échoué pour cause de permissions, exécutez à nouveau le script avec --yes et les droits appropriés, ou installez manuellement."
  exit 1
fi
