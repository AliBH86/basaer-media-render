#!/usr/bin/env bash
# Renders the 94:6 test Reel: background + word-synced Arabic highlight + audio.
# Enforces a render budget - if the requested background style doesn't finish within
# its slice of the budget, falls back to a known-fast style and logs a clear warning
# (this warning is where a Telegram notification will hook in once that's wired up).
set -euo pipefail

STYLE="${1:-stars}"
OUT="${2:-out/test_94_6.mp4}"
ASSETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/assets"
WORK="$(mktemp -d)"
TOTAL_BUDGET_SEC=180
BG_BUDGET_SEC=60
FALLBACK_STYLE="mist"

t_start=$(date +%s)

# --- 1. Audio: trim chapter 94 to verse 6's span, shift to start at 0 ---
CHAPTER_URL="https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/94.mp3"
VERSE_START=21.505
VERSE_END=25.680
DUR=$(node -e "console.log((${VERSE_END}-${VERSE_START}).toFixed(3))")

echo "Downloading chapter audio..."
curl -sS -L "${CHAPTER_URL}" -o "${WORK}/chapter.mp3"

echo "Trimming to verse 6 (${VERSE_START}s - ${VERSE_END}s, duration ${DUR}s)..."
ffmpeg -y -i "${WORK}/chapter.mp3" -ss "${VERSE_START}" -t "${DUR}" -c:a aac -b:a 128k "${WORK}/verse_audio.m4a"

# --- 2. Background, with render-budget fallback ---
mkdir -p "$(dirname "${OUT}")"
echo "Generating '${STYLE}' background (budget: ${BG_BUDGET_SEC}s)..."
bg_start=$(date +%s)
if ! timeout "${BG_BUDGET_SEC}" ./scripts/generate_background.sh "${STYLE}" "${DUR}" "${WORK}/bg.mp4"; then
  echo "WARNING: style '${STYLE}' exceeded its ${BG_BUDGET_SEC}s render budget or failed. Falling back to '${FALLBACK_STYLE}'." >&2
  STYLE="${FALLBACK_STYLE}"
  ./scripts/generate_background.sh "${STYLE}" "${DUR}" "${WORK}/bg.mp4"
fi
bg_end=$(date +%s)
echo "Background ('${STYLE}') took $((bg_end - bg_start))s"

# --- 3. Composite word-synced overlays onto the background ---
# Word boundaries (seconds, relative to verse start at 0):
#   word0 إِنَّ      0.000 - 1.400
#   word1 مَعَ       1.400 - 1.780
#   word2 ٱلْعُسْرِ   1.780 - 2.650
#   word3 يُسْرًا     2.650 - end
echo "Compositing word-synced Arabic overlay..."
ffmpeg -y \
  -i "${WORK}/bg.mp4" \
  -i "${ASSETS_DIR}/test_94_6/word_0.png" \
  -i "${ASSETS_DIR}/test_94_6/word_1.png" \
  -i "${ASSETS_DIR}/test_94_6/word_2.png" \
  -i "${ASSETS_DIR}/test_94_6/word_3.png" \
  -i "${WORK}/verse_audio.m4a" \
  -filter_complex "
    [0:v][1:v]overlay=enable='between(t,0.000,1.400)'[v1];
    [v1][2:v]overlay=enable='between(t,1.400,1.780)'[v2];
    [v2][3:v]overlay=enable='between(t,1.780,2.650)'[v3];
    [v3][4:v]overlay=enable='gte(t,2.650)'[vout]
  " -map "[vout]" -map 5:a \
  -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -shortest \
  "${OUT}"

t_end=$(date +%s)
elapsed=$((t_end - t_start))
echo "Total render time: ${elapsed}s (budget: ${TOTAL_BUDGET_SEC}s)"
if [ "${elapsed}" -gt "${TOTAL_BUDGET_SEC}" ]; then
  echo "FAIL: render exceeded the ${TOTAL_BUDGET_SEC}s total budget." >&2
  exit 1
fi

ls -la "${OUT}"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name,avg_frame_rate -of default=noprint_wrappers=1 "${OUT}"
