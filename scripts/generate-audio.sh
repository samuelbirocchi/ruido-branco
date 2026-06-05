#!/usr/bin/env bash
set -euo pipefail

# Gera 60 minutos de ruído branco suavizado (corte de agudos para ficar
# menos áspero ao ouvido). 96 kbps estéreo ~= 43 MB, abaixo do limite de
# 50 MB do GitHub. Requisito Alexa AudioPlayer: MP3, 16-384 kbps, HTTPS.
cd "`dirname "$0"`/.."

ffmpeg -y -f lavfi -i "anoisesrc=d=3600:c=white:a=0.6:r=44100" \
  -af "lowpass=f=7500,treble=g=-4:f=4000,volume=1.2" \
  -ac 2 -b:a 96k -c:a libmp3lame \
  audio/ruido-branco-60min.mp3

ffprobe -v error -show_entries format=duration,bit_rate \
  -of default=noprint_wrappers=1 audio/ruido-branco-60min.mp3
