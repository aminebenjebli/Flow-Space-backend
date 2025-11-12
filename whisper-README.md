# Whisper — Guide d'installation et de test (FR)

Ce document explique en quelques commandes comment préparer une machine (Windows ou macOS/Linux) pour tester localement l'endpoint `/whisper/transcribe` du projet.

Fichiers utiles dans le dépôt
- `scripts/ensure-whisper-windows.ps1` — script PowerShell (vérif + install automatique via Chocolatey si demandé)
- `scripts/ensure-whisper-macos.sh` — script Bash (vérif + install automatique via Homebrew si demandé)

 
Résumé rapide
- Exécuter le script `ensure` correspondant à votre OS pour vérifier et (optionnellement) installer tout ce qu'il faut.

Commandes copiables
- Windows (interactif — propose les installations) :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ensure-whisper-windows.ps1
```

- Windows (non-interactif — force les installations quand possible) :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ensure-whisper-windows.ps1 --yes
```

- macOS / Linux (interactif) :

```bash
bash scripts/ensure-whisper-macos.sh
```

- macOS / Linux (non-interactif / CI) :

```bash
bash scripts/ensure-whisper-macos.sh --yes
```

Que font les scripts
- Vérifient la présence de : Python (respectent `WHISPER_PYTHON_CMD` si défini), `openai-whisper` (pip) et `ffmpeg` (respectent `FFMPEG_BINARY` si défini)
- En mode `--yes`, tentent d'installer automatiquement :
  - Windows : Chocolatey (si absent), Python, ffmpeg via choco, puis `openai-whisper` via pip
  - macOS : Homebrew (si absent), Python, ffmpeg via brew, puis `openai-whisper` via pip
- Affichent des messages clairs et des codes de sortie (0 = OK, 1 = échec)

Variables d'environnement utiles
- `WHISPER_PYTHON_CMD` : chemin ou nom du binaire python à utiliser par le service (ex: `C:\Python39\python.exe`, `python3`)
- `FFMPEG_BINARY` : chemin absolu vers `ffmpeg`/`ffmpeg.exe` si non présent dans le PATH

Tester l'API (exemple)
- Démarrez le serveur NestJS localement (ex: `npm run start:dev` ou `npm run start`).
- Envoyez une requête multipart/form-data avec le champ `audio` (fichier) :

```bash
curl -X POST http://localhost:3000/whisper/transcribe -F "audio=@/chemin/vers/audio.wav" -F "language=en"
```

Conseils de dépannage rapide
- `python -m whisper not available` → installez `openai-whisper` avec le python ciblé :

```bash
python -m pip install -U openai-whisper
```

- `ffmpeg not found` → installez ffmpeg :
  - macOS : `brew install ffmpeg`
  - Windows : `choco install ffmpeg -y` ou téléchargez un build et ajoutez `ffmpeg.exe` au PATH

- Permissions d'installation : exécutez PowerShell en Administrateur (Windows) ou lancez le script avec `--yes` sur macOS après avoir autorisé Homebrew.


