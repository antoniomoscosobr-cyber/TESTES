#!/usr/bin/env bash
# Gera um "trailer" sintético para testar o pipeline sem material com direitos autorais:
# vários cortes de cena, intro calma, bumbo a 120 BPM, impactos e um card final com logo.
set -euo pipefail
OUT="${1:-fixtures/fixture-trailer.mp4}"
DIR="$(dirname "$OUT")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DIR"

FONT="$(fc-match -f '%{file}' 'DejaVu Sans:bold' 2>/dev/null || true)"
SRCS=(testsrc2 mandelbrot rgbtestsrc smptehdbars testsrc2 cellauto life mandelbrot testsrc2 smptebars)
LENS=(4 3 1.2 0.8 2.5 1.5 0.9 3 1.1 2 0.7 1.6 2.2 1 3.5 0.8 1.4 2 1.2 0.9 2.6 1.8 1 3)

: > "$TMP/list.txt"
total=0
for i in "${!LENS[@]}"; do
  src="${SRCS[$((i % ${#SRCS[@]}))]}"
  len="${LENS[$i]}"
  hue=$(( (i * 47) % 360 ))
  case "$src" in
    cellauto|life) input="$src=s=640x360:r=30" ;;
    mandelbrot) input="$src=s=640x360:r=30" ;;
    *) input="$src=s=1920x1080:r=30" ;;
  esac
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "$input" -t "$len" \
    -vf "scale=1920:1080,hue=h=$hue,format=yuv420p" -c:v libx264 -preset ultrafast -r 30 "$TMP/c$i.mp4"
  echo "file '$TMP/c$i.mp4'" >> "$TMP/list.txt"
  total=$(echo "$total + $len" | bc)
done

# Card final: logo do "jogo" + data, seguido de 1.5s de preto.
DRAW="drawtext=text='FIXTURE GAME':fontsize=140:fontcolor=white:x=(w-tw)/2:y=(h-th)/2-60"
DRAW2="drawtext=text='DISPONIVEL 2027':fontsize=60:fontcolor=0xff3d3d:x=(w-tw)/2:y=(h/2)+80"
if [ -n "$FONT" ]; then DRAW="$DRAW:fontfile=$FONT"; DRAW2="$DRAW2:fontfile=$FONT"; fi
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=0x101018:s=1920x1080:r=30" -t 3 \
  -vf "$DRAW,$DRAW2,format=yuv420p" -c:v libx264 -preset ultrafast "$TMP/logo.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=black:s=1920x1080:r=30" -t 1.5 \
  -vf "format=yuv420p" -c:v libx264 -preset ultrafast "$TMP/black.mp4"
echo "file '$TMP/logo.mp4'" >> "$TMP/list.txt"
echo "file '$TMP/black.mp4'" >> "$TMP/list.txt"
total=$(echo "$total + 4.5" | bc)

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/video.mp4"

# Áudio: intro calma (6s), bumbo + chimbal a 120 BPM, impactos graves e silêncio no fim.
KICK="sin(2*PI*55*t)*exp(-14*mod(t,0.5))"
HAT="0.12*(random(0)*2-1)*exp(-45*mod(t+0.25,0.5))"
IMPACT=""
for T in 12 20.5 27 33; do
  IMPACT="$IMPACT+0.9*sin(2*PI*38*(t-$T))*exp(-5*(t-$T))*gte(t,$T)"
done
GAIN="if(lt(t,6),0.15,1)*lt(t,$total-1.5)"
ffmpeg -hide_banner -loglevel error -y -f lavfi \
  -i "aevalsrc='0.6*($GAIN)*($KICK+$HAT$IMPACT)':s=48000:d=$total" \
  -ac 2 -c:a aac -b:a 160k "$TMP/audio.m4a"

ffmpeg -hide_banner -loglevel error -y -i "$TMP/video.mp4" -i "$TMP/audio.m4a" \
  -c:v copy -c:a copy -shortest "$OUT"
echo "✓ fixture: $OUT (${total}s)"
