# Basaer Media

**Read `docs/HANDOFF.md` first, every session, before touching anything.** It has the full state, pending blockers, and what to do next.

## Hard rules

- Ayah text: only from the Quran.com API (or alquran.cloud fallback) at render time. Never hand-typed or guessed.
- The only AI-authored text anywhere in a caption is the one-line reflection. Dua comes from the user's approved fixed list only (never AI-generated). Hashtags, credit, ayah, translation are all sourced or fixed, never invented.
- No faces, no music, no sectarian symbols in any visual.
- Secrets never go in chat, never in a file. Everything lives in n8n's credential store. If you ever receive a token/key in chat, store it via the credential system immediately and never echo it back.
- Never touch anything prefixed "AH Brands —" on the shared n8n instance (workflows or credentials). Only "Basaer - ..." prefixed resources.
- Instagram publish nodes stay disabled until the user explicitly says to enable them (review mode: manual approval for the first 5-7 days of going live).
- Verify anything visual by actually downloading and looking at it. Upload success, ffprobe output, and stats JSON are not sufficient — this session had three separate bugs that looked fixed on paper and weren't.

## Architecture (one line each)

- **n8n** (DigitalOcean droplet, shared with AH Brands, RAM is tight) orchestrates: picks an ayah, fetches text, triggers rendering, builds captions, sends review notifications. Nothing publishes yet.
- **GitHub Actions** (`AliBH86/basaer-media-render`, private repo) does all Reel video rendering — ffmpeg + headless Chrome for text overlays, triggered by n8n's GitHub node or manually via `gh workflow run`.
- **Gotenberg** (on the droplet) renders the static Daily Post images from HTML.
- **Cloudinary** hosts all rendered media.
- **Quran.com API v4** is the primary text/audio source; **alquran.cloud** is the fallback.

## Three n8n workflows

- `Basaer - Daily Post (Quran Image)` — static image carousel posts.
- `Basaer - Reel (Quran)` — multi-ayah video Reels via GitHub Actions.
- `Basaer - Reel Error Alerts` — failure notifications (needs to be assigned as the Reel workflow's Error Workflow via the n8n UI — no MCP tool for that).

All three are currently inactive/disabled. Full details, blockers, and exact next steps are in `docs/HANDOFF.md`.
