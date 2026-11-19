#!/usr/bin/env bash
# YouTube LIVE (2026-11-20): build one YouTube-ready file per surah, ONCE, so the streaming server only copies (-c copy).
# Picture: the surah's title card (scripts/live_cards.js) over a 112 s loop of eye-checked, pre-graded nature shots
# (data/youtube_footage.json). Only the 112 s loop is video-encoded; the surah-length file repeats it by stream copy, so a
# whole-Quran build is a few runner-hours. Audio: Minshawi Mujawwad full-surah MP3 (quranicaudio.com) -> AAC.
# EVERY file has the same parameters (below), so the server can play them back to back with no re-encoding.
# Usage: CHROME_BIN=... scripts/live_encode.sh <outDir> <surahs: "1,112-114">
set -euo pipefail
OUT=$(realpath -m "$1"); LIST=$2
ROOT=$(cd "$(dirname "$0")/.." && pwd)
# ---- fixed stream format (change only for the WHOLE library, never per surah) ----
W=1280; H=720; FPS=30; GOP=60                 # 2 s keyframes (YouTube: <= 4 s)
VBR=1100k; VMAX=1200k; VBUF=2400k; CRF=23     # H.264 High, capped CRF
ABR=128k; AR=48000                            # AAC-LC stereo 48 kHz
LOOP_SHOTS=8; SHOT=14                         # 8 x 14 s = 112 s loop (a multiple of the 2 s GOP)
AUDIO_BASE=https://download.quranicaudio.com/quran/minshawi_mujawwad
RECITER=8
# ---------------------------------------------------------------------------------
mkdir -p "$OUT" "$OUT/stills"; WORK=$(mktemp -d)
expand() { tr ',' '\n' <<< "$1" | while IFS=- read -r a b; do seq "$a" "${b:-$a}"; done; }
SURAHS=$(expand "$LIST" | sort -n | uniq | tr '\n' ',' | sed 's/,$//')
echo "surahs: $SURAHS"

ONLY=$SURAHS node "$ROOT/scripts/live_cards.js" "$WORK/cards" $RECITER
mapfile -t CLIPS < <(jq -r '.clips[]' "$ROOT/data/youtube_footage.json")
NCLIP=${#CLIPS[@]}
declare -A HAVE

for s in ${SURAHS//,/ }; do
  id=$(printf '%03d' "$s"); t0=$(date +%s)
  # 1. footage loop shots (start shot varies by surah, same rule as yt_surah.js)
  : > "$WORK/bg.txt"
  for ((k=0; k<LOOP_SHOTS; k++)); do
    c=${CLIPS[$(( (s * 7 + RECITER * 3 + k) % NCLIP ))]}
    if [ -z "${HAVE[$c]:-}" ]; then
      node "$ROOT/scripts/r2_download.js" "$WORK/$c.mp4" "https://basaer-media.ahbrandsbh.com/basaer/youtube/footage-graded/$c.mp4" >/dev/null
      HAVE[$c]=1
    fi
    echo "file '$WORK/$c.mp4'" >> "$WORK/bg.txt"
  done
  # 2. the 112 s picture loop: footage + card, encoded once
  ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$WORK/bg.txt" -loop 1 -i "$WORK/cards/$id.png" \
    -filter_complex "[0:v]fps=$FPS,scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,setsar=1[bg];[bg][1:v]overlay=0:0:shortest=1,format=yuv420p[v]" \
    -map "[v]" -t $((LOOP_SHOTS * SHOT)) -an \
    -c:v libx264 -preset medium -profile:v high -level:v 3.1 -crf $CRF -b:v $VBR -maxrate $VMAX -bufsize $VBUF \
    -g $GOP -keyint_min $GOP -sc_threshold 0 -bf 2 -x264-params "open-gop=0:repeat-headers=1" \
    -video_track_timescale 15360 "$WORK/loop.mp4"
  # 3. audio
  curl -sfL --retry 3 -o "$WORK/a.mp3" "$AUDIO_BASE/$id.mp3"
  ffmpeg -hide_banner -loglevel error -y -i "$WORK/a.mp3" -vn -c:a aac -b:a $ABR -ar $AR -ac 2 "$WORK/a.m4a"
  adur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/a.m4a")
  # 4. surah file: loop repeated by STREAM COPY under the audio (no second video encode)
  ffmpeg -hide_banner -loglevel error -y -stream_loop -1 -i "$WORK/loop.mp4" -i "$WORK/a.m4a" \
    -map 0:v:0 -map 1:a:0 -c copy -t "$adur" -movflags +faststart "$OUT/$id.mp4"
  # 5. checks: same format for every file, video covers the audio
  p=$(ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,sample_rate,channels -of csv=p=0 "$OUT/$id.mp4" | tr '\n' ' ')
  want="h264,High,1280,720,30/1 aac,LC,48000,2 "
  [ "$p" = "$want" ] || { echo "$id: unexpected format: $p"; exit 1; }
  fdur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$id.mp4")
  awk -v a="$adur" -v f="$fdur" 'BEGIN { d = f - a; if (d < -1 || d > 2.5) exit 1 }' || { echo "$id: duration $fdur vs audio $adur"; exit 1; }
  ffmpeg -hide_banner -loglevel error -y -ss 30 -i "$OUT/$id.mp4" -frames:v 1 -q:v 3 "$OUT/stills/$id.jpg"
  printf '%s\t%.3f\t%s\t%s\n' "$id" "$fdur" "$(sha256sum "$OUT/$id.mp4" | cut -d' ' -f1)" "$(stat -c %s "$OUT/$id.mp4")" >> "$OUT/manifest.tsv"
  echo "$id ok: ${fdur}s, $(( $(stat -c %s "$OUT/$id.mp4") / 1048576 )) MB, $(( $(date +%s) - t0 ))s to build"
done
rm -rf "$WORK"
