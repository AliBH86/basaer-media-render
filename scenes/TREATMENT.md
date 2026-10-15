# Basaer scene library: treatment (samples 1-3)

Motion-graphic backgrounds for Basaer Studio speech Reels (owner, 2026-10-15: "design the video with things related to
the speech in an attractive way"). Quran clips keep the Coverr/Pexels footage. Each scene is a silent BACKGROUND: the
render repo cuts it into 3-4 s shots (push-in, warm grade, white-flash cuts) and lays the Basaer text layer, the voice
and the wave bar on top. So: no text, no sound, no people, faces or figures, no religious or sectarian symbols.

## 0. Constraints that shape every frame

- 1080x1920, 30 fps. The text band is y = 290-1320 (header at 290-450, lines at 556-1160, handle 1190, wave 1256) under
  a navy scrim. The scene's subject lives in the **lower third (y 1320-1920)** and the **top (0-290)**; the middle stays
  calm, darker and low in detail so Arabic text reads over it.
- The render repo uses only the **first ~2-5 s of each clip** (start 0.3-2.3 s, shot length ~3.4 s, slowed up to 2.5x
  if short). So a scene is delivered as **4 takes of 6 s**, each its own framing and move, registered as 4 clips of one
  pool. Every take is already moving in its first frame (no fade from black, no build-up).
- The push-in and grade are added later: keep moves gentle (they compound) and leave ~8 % margin at the frame edges.

## 1. Three candidate structures (for the set) and the choice

1. **One world, many rooms**: all scenes in one style (paper-cut), each a place tied to a theme (road, garden, sea,
   night sky). Strong identity, but every Reel looks the same lamp.
2. **Two families**: warm, tactile **paper-cut places** for stories and reminders (journey, rest, mercy), and clean
   **gold-line Art Deco geometry** for dua, hope and wisdom (motion graphics proper). Variety without losing navy+gold.
3. **Kinetic abstraction only**: pure gold particles, rays and lines (no places). Very "motion graphic", but generic and
   cold, the opposite of what the owner asked ("our reels feel cold").

**Chosen: 2, two families.** The samples are two paper-cut places and one Art Deco scene so the owner can compare.

## 2. The three samples: logline and arc (per take)

Each take is a loop-free 6 s moment; the arc of a scene is spread over its 4 takes, so any take works alone.

### S1. The road to a lit house (paper-cut, pool `pcRoad`): patience, the journey, arriving

A paper desert at night: a road winds through dunes toward one warm window far away; stars burn through the sky sheet.
- Take 1 (wide, the whole road): locked frame, micro-drift; the far window flickers warm, dune rims glow.
- Take 2 (lateral travel): the camera tracks along the dunes, layers slide at depth speeds; the road passes below.
- Take 3 (tilt down the stack, sky → road): stars to the horizon, the house rises into frame.
- Take 4 (slow dolly in on the house): the window grows, warm light spills down the dunes. Hope at the end.
Ladder (night, cool): sky `#0b1638` → far dunes `#4a5f93` → mid `#2a3a6c` → near `#141c3e` → front `#070b1e`; light
`#ffbe6a`, accent: the one window (gold `#C9A24B` family).

### S2. The courtyard garden (paper-cut, pool `pcGarden`): mercy, rest, reward

A Gulf courtyard at blue hour: arches, palm fronds, a water channel catching light; soft specks of light drift down
through the sky layer like slow rain.
- Take 1 (frontal, full courtyard): specks fall, the water channel shimmers.
- Take 2 (rack focus): front palm fronds sharp → far arch sharp.
- Take 3 (top of the stack, tilting up): from the water up to the arch and sky; specks pass close to the lens.
- Take 4 (slow dolly out): the garden revealed whole, light settling.
Ladder (blue hour, warmer than S1): sky `#13274f` → far wall `#5d73a8` → arches `#33497e` → palms `#1a2550` → front
`#0a1028`; light `#ffc878`; accent: the water channel's gold glints.

### S3. Sunburst dawn (Art Deco, pool `decoDawn`): hope, dua, a new beginning

Warm navy lacquer, engraved gold lines drawing themselves from the centre axis; a stepped arch frame; a sunburst rising
behind a stepped horizon at the bottom of the frame; four-point sparkles.
- Take 1: gold rays draw on from the bottom-centre point, one by one, sheen sweeping across.
- Take 2: stepped arch frame unfolds symmetrically from the axis (bars open), stars twinkle above.
- Take 3: the sun disc rises a little behind the stepped horizon; rays rotate very slowly.
- Take 4: everything lit; a slow sheen sweep and sparkles; the gentlest take.
Palette: ground lacquer navy `#0a1230` → `#111d45` (Basaer navy instead of black: the owner's identity wins), gold
banded `#5c4518 / #C9A24B / #f3d98c`, ivory `#F2ECE1`; accent: the sun's warm core `#ffcf7a`.

## 3. Benchmark

- Paper-cut: learn from shadow-box lamps (value ladder, rim light, cast shadows) and Reiniger's one-silhouette clarity.
  Don't take any lamp design or motif set; no Chinese motifs: the vocabulary is Gulf (arches, palms, dunes, a water
  channel, a plain house), no crescents, domes or minarets (no religious symbols in a background).
- Art Deco: learn from Cassandre posters (axis, rays) and engraved gold line. Don't take any building, poster layout,
  sunburst design or type design.

## 4. Shot list

| Scene | Take | Framing | Camera | 6 s | Why |
|---|---|---|---|---|---|
| S1 | 1 | wide, whole box | locked, micro-drift | yes | establish the place; light only |
| S1 | 2 | full | lateral track L→R with parallax | yes | the journey; time passing |
| S1 | 3 | full | tilt down sky → road | yes | from hope (sky) to the path |
| S1 | 4 | medium on the house | slow dolly in | yes | arriving; warmth |
| S2 | 1 | full courtyard | locked, micro-drift | yes | rest; light falling |
| S2 | 2 | medium | rack focus front → far | yes | attention moving to what lasts |
| S2 | 3 | medium-close low | tilt up water → sky | yes | rising; specks pass the lens |
| S2 | 4 | full → wide | slow dolly out | yes | the whole garden; reward revealed |
| S3 | 1 | full, axis centred | locked | yes | rays draw on (draw-on native move) |
| S3 | 2 | full | locked, arch unfolds from axis | yes | a threshold opening |
| S3 | 3 | full | very slow push-in | yes | dawn rising |
| S3 | 4 | full | locked, sheen sweep | yes | calm, complete |

Signature shot: S1 take 4, the dolly into the one lit window.

## 5. Beat sheet (per take, 0-6 s)

- 0.0: already lit and moving (never a dark or empty first frame).
- 0.3-2.3: the stretch the render repo usually starts from: the take's main motion is visible here.
- 2.3-6.0: the move continues at the same speed (no ending, no settle): any 3-4 s window looks alive.

## 6-7. Cue map and sound

None: the Reel's sound is the speaker's voice (plus, for non-Quran clips, the owner-approved options) added later.
The scenes are timed to nothing; cuts are made by the render repo.

## 8. Titles and subtitles

None in the scene: the Basaer text layer (Amiri / Montserrat, gold word highlight) does all type.
