# Basaer Live: production standards (proposed 2026-11-20, awaiting owner approval)

Full review and plan: the "Basaer Live Public Launch Review & Upgrade Plan" doc (owner's Claude Docs).
Nothing below is in production yet. Public launch is blocked by rights (Content ID claimant Injaz Teqani for
Hi-Tech Music Ltd on the Minshawi recordings; Quran Foundation one-week audio cache rule).

## Audio (measured by .github/workflows/live-audio-audit.yml, run 44654588616)
- Source: Quran.com recitation 8 per-ayah files (timing exact by construction). Not quranicaudio.com full files
  (personal-use terms; different edition, e.g. Al-Ikhlas 110.2 s vs 27.7 s per-ayah).
- Target: -16 LUFS integrated per surah, -1.5 dBTP ceiling, two-pass loudnorm linear=true, no compression.
- Output: AAC-LC 128 kb/s, 48 kHz stereo, one audio stream.
- Measured on the full set: -17.5 to -10.2 LUFS (median -13.2), true peak up to +3.2 dBTP (21 files > 0),
  LRA 4.0-15.6 LU, L-R within 0.54 dB, total 62.19 h.

## Video (decided after the Phase 2 test)
- 1280x720, 30 fps, keyframe every 2 s, closed GOP, no scene-cut keyframes, CBR, BT.709 tagged, yuv420p.
- Candidate A: HEVC 2.5 Mb/s over Enhanced RTMP (library ~74 GB, fits the 90 GB volume).
- Candidate B: H.264 3.5 Mb/s (library ~102 GB, volume must grow to 120 GB).
- YouTube minimum for 720p30: 3 Mb/s H.264, 2 Mb/s HEVC (support.google.com/youtube/answer/2853702).

## Text
- Quran.com text_uthmani only, checked against a second fresh API copy (verify_text.js) and Tanzil; burned in,
  one ayah (or page of a long ayah) per screen, Bismillah before every surah except 9.
