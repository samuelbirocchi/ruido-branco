#!/usr/bin/env bash
set -euo pipefail

# Gera 60 minutos de drone grave ("zoom"): ruído marrom + lowpass duplo em
# 500 Hz (24 dB/oitava) — zero chiado, tipo cabine de avião. 96 kbps estéreo
# ~= 43 MB, abaixo do limite de 50 MB do GitHub. Requisito Alexa AudioPlayer:
# MP3, 16-384 kbps, HTTPS. Alternativas: c=pink, ou c=brown sem lowpass.
cd "`dirname "$0"`/.."

ffmpeg -y -f lavfi -i "anoisesrc=d=3600:c=brown:a=0.7:r=44100" \
  -af "lowpass=f=500:p=2,lowpass=f=500:p=2,volume=5dB" \
  -ac 2 -b:a 96k -c:a libmp3lame \
  audio/ruido-branco-60min.mp3

ffprobe -v error -show_entries format=duration,bit_rate \
  -of default=noprint_wrappers=1 audio/ruido-branco-60min.mp3
