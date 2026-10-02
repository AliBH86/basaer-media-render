#!/usr/bin/env bash
# Generates one procedural background clip (1080x1920, 30fps) for the Basaer Media Reel
# pipeline. Every style is synthesized entirely by FFmpeg (plus two small self-authored
# SVG-derived PNG assets committed in assets/) - no stock photo/video API involved.
#
# Usage: generate_background.sh <style> <duration_seconds> <output_path>
# style: gradient | stars | rays | mist | lattice | bokeh

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
    ffmpeg -y -loop 1 -i "${ASSETS_DIR}/gradient_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*10,1320)':y='mod(t*7,480)'" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  stars)
    # Navy base + sparse bright pixels from thresholded temporal noise, added on top so
    # black contributes nothing and only the rare bright noise peaks show as "stars".
    ffmpeg -y \
      -f lavfi -i "color=c=0x0B1F2A:s=${W}x${H}:d=${DUR}:r=${FPS}" \
      -f lavfi -i "color=c=black:s=${W}x${H}:d=${DUR}:r=${FPS},noise=alls=45:allf=t,lutyuv=y='if(gt(val\,250)\,val\,0)':u=128:v=128" \
      -filter_complex "[0:v][1:v]blend=all_mode=addition" \
      -c:v libx264 -pix_fmt yuv420p -t "${DUR}" "${OUT}"
    ;;

  rays)
    # Self-authored diagonal light-ray pattern (assets/rays_tile.png, our own SVG),
    # panned slowly across a larger canvas. Source is 2400x2400, crop is 1080x1920,
    # so x must stay in [0,1320] and y in [0,480].
    ffmpeg -y -loop 1 -i "${ASSETS_DIR}/rays_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*18,1320)':y='mod(t*4,480)'" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  mist)
    # Heavily blurred temporal+uniform noise averaged with a flat navy base - soft,
    # slow-shifting cloud-like texture, low contrast by construction (average blend).
    ffmpeg -y \
      -f lavfi -i "color=c=0x0F2A3D:s=${W}x${H}:d=${DUR}:r=${FPS}" \
      -f lavfi -i "color=c=0x0F2A3D:s=${W}x${H}:d=${DUR}:r=${FPS},noise=alls=25:allf=t+u,gblur=sigma=60" \
      -filter_complex "[0:v][1:v]blend=all_mode=average" \
      -c:v libx264 -pix_fmt yuv420p -t "${DUR}" "${OUT}"
    ;;

  lattice)
    # Self-authored low-contrast Islamic-style lattice tile (assets/lattice_tile.png,
    # generated locally from our own SVG, not sourced from any stock library), panned
    # slowly across a larger canvas for a drifting effect.
    # Source tile is 2200x2200; crop window is 1080x1920, so x must stay in [0,1120]
    # and y in [0,280] or the crop rectangle runs off the edge of the source image.
    ffmpeg -y -loop 1 -i "${ASSETS_DIR}/lattice_tile.png" \
      -vf "crop=${W}:${H}:x='mod(t*14,1120)':y='mod(t*6,280)'" \
      -t "${DUR}" -r "${FPS}" -c:v libx264 -pix_fmt yuv420p "${OUT}"
    ;;

  bokeh)
    # A handful of soft gold glow particles (assets/gold_blob.png, self-authored radial
    # gradient) drifting slowly upward with gentle horizontal sway, wrapping vertically.
    ffmpeg -y -f lavfi -i "color=c=0x0F2A3D:s=${W}x${H}:d=${DUR}:r=${FPS}" \
      -i "${ASSETS_DIR}/gold_blob.png" \
      -filter_complex "
        [1:v]scale=160:160[p1];[1:v]scale=100:100[p2];[1:v]scale=130:130[p3];
        [1:v]scale=90:90[p4];[1:v]scale=150:150[p5];[1:v]scale=110:110[p6];
        [0:v][p1]overlay=x='140+40*sin(2*PI*(t*0.07))':y='mod(-t*60+1900,2100)-200':format=auto[s1];
        [s1][p2]overlay=x='820+30*sin(2*PI*(t*0.09+0.3))':y='mod(-t*50+2400,2100)-200':format=auto[s2];
        [s2][p3]overlay=x='460+50*sin(2*PI*(t*0.05+0.6))':y='mod(-t*45+1600,2100)-200':format=auto[s3];
        [s3][p4]overlay=x='950+25*sin(2*PI*(t*0.11+0.1))':y='mod(-t*70+1200,2100)-200':format=auto[s4];
        [s4][p5]overlay=x='260+35*sin(2*PI*(t*0.06+0.8))':y='mod(-t*40+2000,2100)-200':format=auto[s5];
        [s5][p6]overlay=x='650+45*sin(2*PI*(t*0.08+0.4))':y='mod(-t*55+900,2100)-200':format=auto[outv]
      " -map "[outv]" \
      -c:v libx264 -pix_fmt yuv420p -t "${DUR}" "${OUT}"
    ;;

  *)
    echo "Unknown style: ${STYLE}" >&2
    exit 1
    ;;
esac
