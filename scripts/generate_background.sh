#!/usr/bin/env bash
# Generates one procedural background clip (1080x1920, 30fps) for the Basaer Media Reel
# pipeline. Every style is synthesized entirely by FFmpeg (plus two small self-authored
# SVG-derived PNG assets committed in assets/) - no stock photo/video API involved.
#
# Usage: generate_background.sh <style> <duration_seconds> <output_path>
# style: gradient | stars | rays | mist | lattice
# (bokeh was dropped: its gold particles were the same color as the word-highlight gold,
# which is confusing on screen - see scripts/pick_style.js for the rotation logic.)

set -euo pipefail

STYLE="$1"
DUR="$2"
OUT="$3"
W=1080
H=1920
FPS=30
ASSETS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/assets"

case "$STYLE" in

  gradient)
    # Self-authored diagonal two-tone navy gradient (assets/gradient_tile.png, our own
    # SVG), panned slowly across a larger canvas. Source is 2400x2400, crop is
    # 1080x1920, so x must stay in [0,1320] and y in [0,480].
    ffmpeg -y -nostdin -loop 1 -i "${ASSETS_DIR}/gradient_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*10,1320)':y='mod(t*7,480)'" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  stars)
    # Self-authored starfield (assets/stars_tile.png: navy + ~180 scattered white/gold
    # dots, our own SVG), panned slowly across a larger canvas - same proven technique
    # as gradient/rays/lattice. (An earlier version used blend=all_mode=addition to
    # composite a noise-based starfield onto navy, which rendered as solid magenta: YUV
    # chroma planes are offset-centered at 128, and addition without rebasing that
    # offset pushes U/V to extremes across the whole frame, not just at the bright
    # dots. Forcing format=rgb24 around the blend did not fix it either, so this asset
    # + crop-pan approach replaces it entirely rather than chasing the blend filter.)
    # Source tile is 2400x2400, crop is 1080x1920, so x must stay in [0,1320] and y in
    # [0,480].
    ffmpeg -y -nostdin -loop 1 -i "${ASSETS_DIR}/stars_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*8,1320)':y='mod(t*5,480)'" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  rays)
    # Self-authored diagonal light-ray pattern (assets/rays_tile.png, our own SVG),
    # panned slowly across a larger canvas. Source is 2400x2400, crop is 1080x1920,
    # so x must stay in [0,1320] and y in [0,480].
    ffmpeg -y -nostdin -loop 1 -i "${ASSETS_DIR}/rays_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*18,1320)':y='mod(t*4,480)'" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  mist)
    # Self-authored soft cloud shapes (assets/mist_tile.png: overlapping navy-tone
    # ellipses, sharp-edged on purpose - blur is applied here via gblur rather than
    # baked into the SVG, since Chrome's feGaussianBlur filter region clipped at each
    # shape's edge and left visible hard seams), panned faster than the other styles
    # and blurred for a clearly-visible drifting cloud effect. (Replaces an earlier
    # version that blended live per-frame noise against flat navy - technically
    # correct, but the motion was too subtle to read as "mist" on screen.)
    # Source tile is 2400x2400, crop is 1080x1920, so x must stay in [0,1320] and y in
    # [0,480].
    ffmpeg -y -nostdin -loop 1 -i "${ASSETS_DIR}/mist_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*22,1320)':y='mod(t*12,480)',gblur=sigma=40" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  lattice)
    # Self-authored low-contrast Islamic-style lattice tile (assets/lattice_tile.png,
    # generated locally from our own SVG, not sourced from any stock library), panned
    # slowly across a larger canvas for a drifting effect.
    # Source tile is 2200x2200; crop window is 1080x1920, so x must stay in [0,1120]
    # and y in [0,280] or the crop rectangle runs off the edge of the source image.
    ffmpeg -y -nostdin -loop 1 -i "${ASSETS_DIR}/lattice_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*14,1120)':y='mod(t*6,280)'" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  *)
    echo "Unknown style: ${STYLE}" >&2
    exit 1
    ;;
esac
