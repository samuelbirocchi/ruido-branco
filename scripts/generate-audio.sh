#!/usr/bin/env bash
set -euo pipefail

# Gera 60 minutos de ruído marrom (graves, tipo cachoeira — branco puro é
# agudo demais pra dormir). 96 kbps estéreo ~= 43 MB, abaixo do limite de
# 50 MB do GitHub. Requisito Alexa AudioPlayer: MP3, 16-384 kbps, HTTPS.
# Alternativas: c=pink (médio) ou c=white com lowpass (agudo suavizado).
cd "`dirname "$0"`/.."

ffmpeg -y -f lavfi -i "anoisesrc=d=3600:c=brown:a=0.7:r=44100" \
  -af "volume=2dB" \
  -ac 2 -b:a 96k -c:a libmp3lame \
  audio/ruido-branco-60min.mp3

ffprobe -v error -show_entries format=duration,bit_rate \
  -of default=noprint_wrappers=1 audio/ruido-branco-60min.mp3
