# Basaer Media

**Read `docs/HANDOFF.md` first, every session, before touching anything.** It has the full state, pending blockers, and what to do next.

## Hard rules

- Ayah text: only from the Quran.com API (or alquran.cloud fallback) at render time. Never hand-typed or guessed.
- The only AI-authored text anywhere in a caption is the one-line reflection. Dua comes from the user's approved fixed list only (never AI-generated). Hashtags, credit, ayah, translation are all sourced or fixed, never invented.
- No faces, no music, no sectarian symbols in any visual.
- Secrets never go in chat, never in a file. Everything lives in n8n's credential store. If you ever receive a token/key in chat, store it via the credential system immediately and never echo it back.
- Never touch anything prefixed "AH Brands —" on the shared n8n instance (workflows or credentials). Only "Basaer - ..." prefixed resources.
- Instagram publish nodes stay disabled until the user explicitly says to enable them (review mode: manual approval for the first 5-7 days of going live).
- Instagram calls go to `graph.instagram.com/v25.0` only (Instagram Login token), via HTTP Request + the httpQueryAuth credential whose Name is `access_token`. Never graph.facebook.com, never n8n's Facebook Graph API node. Account ID (`user_id`): `17841414160930384`.
- Verify anything visual by actually downloading and looking at it. Upload success, ffprobe output, and stats JSON are not sufficient — this session had three separate bugs that looked fixed on paper and weren't.

## Architecture (one line each)

- **n8n** (DigitalOcean droplet, shared with AH Brands, RAM is tight) orchestrates: picks an ayah, fetches text, triggers rendering, builds captions, sends review notifications. Nothing publishes yet.
- **GitHub Actions** (`AliBH86/basaer-media-render`, private repo) does all Reel video rendering — ffmpeg + headless Chrome for text overlays, triggered by n8n's GitHub node or manually via `gh workflow run`.
- **Gotenberg** (on the droplet) renders the static Daily Post images from HTML.
- **Cloudinary** hosts all rendered media.
- **Quran.com API v4** is the primary text/audio source; **alquran.cloud** is the fallback.

## Five n8n workflows

- `Basaer - Daily Post (Quran Image)` — single-slide image posts from a fixed approved rotation; sends each draft (image + caption + Approve/Reject) to the owner on Telegram. INACTIVE until go-live.
- `Basaer - Draft Approval (Telegram)` — handles the button presses (owner-only, pending-only, expires after a day). ACTIVE; its Instagram nodes are DISABLED.
- `Basaer - Reel (Quran)` — multi-ayah video Reels via GitHub Actions. INACTIVE.
- `Basaer - Reel Error Alerts` — failure notifications to the owner on Telegram. **Must stay ACTIVE** (this n8n ignores inactive error workflows); it only has an Error Trigger.
- `Basaer - Instagram Token Monitor` — twice-daily read-only token check + expiry reminders (14/7/3/1 days) to Telegram. ACTIVE by design; renewal is manual (HANDOFF > "Renew the Instagram token"). Never create an n8n API key with write access to automate it.

Captions: the reflection line is picked from the user-approved list — never call an AI at publish time. No dua line in captions. **Integrity guards**: slides, captions and Reels are compared character by character with a fresh Quran.com API copy; any difference voids the draft and alerts the owner — never bypass them, and keep the Reel `integrityTest` input empty. Rotation starts 2026-10-10 (Config.CYCLE_START_DATE); Daily Post and Reel skip silently (and log) before that date. Go-live steps are in the GO-LIVE CHECKLIST at the top of `docs/HANDOFF.md`. Full details, blockers and next steps are in `docs/HANDOFF.md`.
