# Basaer Media — Handoff

Last updated: 2026-10-03 (end of day). Read this file first in any new session before touching the project. No secrets appear anywhere in this file — see "Secrets" at the bottom for where they actually live.

---

## PENDING / BLOCKERS

### Needs the user

| # | Item | Why it matters | Est. time | Blocks |
|---|---|---|---|---|
| 1 | GitHub PAT (fine-grained, repo=`basaer-media-render`, permissions: Actions read+write) attached to the "Dispatch Reel Render & Wait" node in n8n workflow **Basaer - Reel (Quran)** | Without it the n8n workflow cannot trigger GitHub Actions at all | 5 min | Any n8n-triggered Reel render |
| 2 | Confirm which Telegram credential/chat to use for Basaer notifications | Two Telegram credentials exist on this **shared** n8n instance: "Telegram account" and "AH Brands Telegram Bot (@Ahbrands_bot)". Neither was attached to the Reel workflow's notification nodes — using the AH Brands one by mistake would violate the no-AH-Brands-access rule | 2 min | Review notifications, failure alerts |
| 3 | Instagram Business Account ID for @basaer.media.bh | Needed in the two disabled "IG - Create Reel Container" / "IG - Publish Reel" nodes (currently `SET_IG_BUSINESS_ACCOUNT_ID` placeholder) | 2 min | Nothing yet — nodes stay disabled regardless |
| 4 | Regenerate the Instagram access token and put the new one only in n8n | The token pasted into chat earlier today was stored immediately into the n8n credential "Basaer Media — Instagram Graph API" (id `xbA6KXbSCE7hfo1C`) and never echoed back or written to any file — but it passed through chat text, so treat it as potentially exposed and rotate it when convenient | 5 min | Nothing urgent — publishing nodes are disabled |
| 5 | Approve the reciter Arabic-name table (sent twice this session, API-sourced from alquran.cloud, never guessed) | Arabic reciter names are not yet used anywhere in renders — English only until approved | 5 min | Arabic reciter name display |
| 6 | Approve the caption wording (dua pool placeholder, reflection-line draft, rotating CTA pool) | Current caption code reuses the same 3 placeholder duas already marked placeholder in the Daily Post workflow — a real approved dua list has never been provided | — | Final caption text |
| 7 | Assign **Basaer - Reel Error Alerts** as the Error Workflow for **Basaer - Reel (Quran)** via Workflow Settings → Error Workflow in the n8n UI | No MCP tool can set this | 1 min | Failure notifications actually firing |
| 8 | Apply for Quran.Foundation production API access | Current Quran.com v4 calls use the "legacy"/open endpoints — see API notes below | — | Long-term API stability |
| 9 | Free space on the C: drive | Was at 0.03 GB free at the start of this session; npm cache clear freed ~2.9 GB. OneDrive (31.78 GB, physically local) and Windows Disk Cleanup are the two biggest remaining levers, both need the user's own action | — | General machine health, not blocking this project directly |

### Needs Claude Code tomorrow, in priority order

1. **Wire the n8n GitHub/Telegram credentials once the user provides them** (items 1–2 above), then do one real end-to-end test of "Basaer - Reel (Quran)" from n8n (not just from `gh workflow run` directly).
2. **Assign the Error Workflow** if the user hasn't done it via UI (item 7) — remind them again if so.
3. **Wire the dua list and reflection-line approach for real** once the user sends the approved list — this is currently a hardcoded 3-item placeholder array in two separate Build Caption code nodes (Daily Post + Reel). Consider extracting it to one shared n8n Data Table so it's not duplicated.
4. **Port the ayah-selection/history logic** from "Basaer - Daily Post" → "Pick Ayah" into the Reel workflow's Config node — right now Reel's surah/ayah is hardcoded to 112:1 for testing.
5. **Decide on a scheduler/trigger** for the Reel workflow (currently Manual Trigger only) once review mode is approved to go live.
6. Once Quran.Foundation production access is granted (item 8), swap the Daily Post / Reel API calls over and retire the "legacy endpoint" risk note below.

---

## 1. Project goal & account

**Account**: Instagram `@basaer.media.bh`. Bilingual (Arabic + English) Quran content — verses with translation, aimed at both Sunni and Shia audiences, so content and framing stay neutral/inclusive (no sect-specific wording, no sectarian symbols).

**Bio**: should NOT contain the word "Sadaqa" in the account name itself (it's fine inside caption CTAs, e.g. "Share it as Sadaqa Jariya" — just not in the profile name/bio headline). Bio includes a dedication line (exact wording not yet finalized — pending the user).

**Review mode**: for the first 5–7 days of going live, every post/Reel must be manually approved before publishing — this is why every Instagram publish node in both workflows is built but **disabled**, and why both workflows currently end at a Telegram review notification rather than an actual publish call.

---

## 2. Hard rules (never relax these without the user explicitly saying so)

- **Ayah text**: only ever sourced from the Quran.com API (or alquran.cloud as fallback) at render time. Never hand-typed, never guessed, never cached/edited by hand.
- **AI-authored text**: the only AI-written text allowed anywhere in a caption is the **one-line reflection**. Everything else (ayah, translation, dua, hashtags, credit) is either API-sourced or from an approved fixed list.
- **Dua**: must come from the user's approved fixed list once provided. Never AI-generated, never guessed. Current code has a 3-item **placeholder** pool, explicitly flagged `dua_is_placeholder: true` in the output — this is not real content, just scaffolding.
- **No faces, no music, no sectarian symbols** in any visual asset.
- **Secrets**: never printed to chat, never written into any file in this repo or elsewhere. Credentials live only in n8n's credential store. See "Secrets" at the bottom.
- **AH Brands**: never touch any "AH Brands —" prefixed workflow, credential, or resource on the shared n8n instance. Only ever create/edit "Basaer - ..." prefixed workflows and Basaer-labeled credentials.

---

## 3. Architecture

```
n8n (DigitalOcean droplet, RAM is tight — this is why Gotenberg runs the HTML->image
rendering for static posts rather than doing it in-process in n8n)
  │
  ├── Basaer - Daily Post (Quran Image)
  │     Schedule 7PM Bahrain → pick ayah → fetch text → Build HTML → Gotenberg render
  │     → Cloudinary upload → [caption + logging: built but disabled]
  │     → if too long for a 10-slide carousel: hands off to the Reel workflow (not yet wired)
  │
  └── Basaer - Reel (Quran)
        Manual Trigger → Config → GitHub Actions dispatch (dispatchAndWait) → wait for
        the Action to render + upload + POST results back → Build Caption → Telegram
        review notification → [IG publish: built but disabled]

GitHub Actions (AliBH86/basaer-media-render, PRIVATE repo)
  - All Reel video rendering happens here, not in n8n or locally. ffmpeg + headless
    Chrome (for text overlays), triggered either manually (gh workflow run) or from n8n.
  - n8n's GitHub node uses "Dispatch and Wait for Completion": n8n auto-generates a
    resumeUrl and passes it to the Action as an input; the Action POSTs its results
    (Cloudinary links, render stats, caption) back to that URL as its last step.

Cloudinary (cloud name: b72gfdzx, unsigned preset: ml_default)
  - All rendered media (images, Reel videos, test stills) uploaded here.
  - Folders used so far: reel-bg-test/ (background style samples), reel-test/ (full
    test Reels + stills). Production folder naming not yet decided.

Quran.com API v4 (base URL in the Daily Post workflow's "Config" node:
https://api.quran.com/api/v4) — primary source for ayah text, translations, chapter
names, and audio timing.
alquran.cloud — fallback source (same data, different shape), used for the Arabic
reciter-name lookups this session; not yet wired as an automatic fallback in either
workflow.
```

---

## 4. n8n workflows (all inactive/disabled as of this handoff)

### Basaer - Daily Post (Quran Image) — id `0rDJEBadks8oiKiL`, inactive, 13 nodes

`Schedule - Daily 7PM Bahrain` → `Config` (holds `QURAN_API_BASE`) → `Get Posted Ayahs History` (Data Table) → `Pick Ayah` (Code: weekly theme rotation — Monday=mercy pool, Thursday=dua pool, Friday=all of Surah Al-Kahf, otherwise a random chapter/ayah — all pools exclude anything already in history) → `Get Verse` → `Get Chapter` → `Build HTML` (Code: builds the full slide HTML(s), decides 1-slide vs multi-slide vs "too long for carousel" — see design spec below) → `If Too Long For Carousel` → true branch: `Too Long - Needs Reel` (NoOp placeholder, not yet connected to the Reel workflow) / false branch: `Render via Gotenberg` → `Upload to Cloudinary` → `Build Caption` **(disabled)** → `Log Posted Ayah` **(disabled)**.

Fonts used here: Scheherazade (Arabic) + Inter (Latin), loaded from Cloudinary raw-upload URLs — a different font stack and hosting approach than the Reel workflow (see design spec). Not a bug, just worth knowing they diverge.

### Basaer - Reel (Quran) — id `DDATobrIvVhVGmr0`, inactive, 7 nodes

`Manual Trigger (test)` → `Config` (surah/ayahStart/reciterId/style — **currently hardcoded to 112/1/7/stars for testing**, reviewChatId placeholder `SET_ME`) → `Dispatch Reel Render & Wait` (GitHub node, needs a PAT credential attached — see blockers) → `Build Caption` (Code, full template — see below) → `Send Review Notification` (Telegram, needs a credential attached — see blockers) → `IG - Create Reel Container (DISABLED)` → `IG - Publish Reel (DISABLED)`.

Both Instagram nodes have the Basaer Instagram credential attached already but are `disabled: true` and need a real IG Business Account ID (currently `SET_IG_BUSINESS_ACCOUNT_ID` placeholder).

### Basaer - Reel Error Alerts — id `oltrBGOHGXhdMXBY`, inactive, 3 nodes

`Error Trigger` → `Build Alert` (Set: formats workflow name, failed node, error message, execution URL) → `Send Failure Notification` (Telegram, needs a credential + chat id — recommend a **different** chat than the review notification, so a Telegram outage doesn't silently swallow both). Needs to be assigned as the Error Workflow for "Basaer - Reel (Quran)" via the n8n UI (Workflow Settings → Error Workflow — no MCP tool exposes this setting).

---

## 5. Design spec

**Colors**: navy `#0F2A3D` / `#0B1F2A`, gold `#C9A24B`, cream `#F2ECE1`.

**Fonts (Reel pipeline)**: Amiri Quran (Arabic) + Montserrat (Latin), self-hosted as base64-embedded data URIs in `scripts/font_data.js` — not loaded from Google Fonts at render time. See "Font self-hosting fix" below for why.

**Fonts (Daily Post / image pipeline)**: Scheherazade (Arabic) + Inter (Latin), loaded from Cloudinary-hosted raw files. Different stack from the Reel pipeline — not unified, not currently a problem, just a known divergence.

**Reel text sizes**: Arabic auto-fits between 46px and 190px targeting roughly 70-80% of the 1080px canvas width on short ayahs, shrinking (and wrapping to 2 lines if needed) for longer ones. Translation 46px, reciter name 32px, @handle 28px. On-screen credit line was removed entirely (safe-zone space was too tight with everything else) — credit lives in the caption only.

**Safe zones (Reel, 1080×1920 canvas)**: top 270px, bottom 670px, sides 65px kept clear, per Meta's current Reels guidance (user-supplied figures, cross-checked against current third-party guidance and confirmed consistent).

**Carousel / "too long" rule (Daily Post)**: a single combined slide is used if the ayah is ≤150 chars AND the translation is ≤300 chars. Otherwise the ayah is split at waqf (pause) marks into ≤190-char segments and the translation into ≤480-char segments (preferring sentence boundaries), each becoming its own slide. If the total slide count exceeds Instagram's 10-slide carousel limit, the post is flagged `tooLongForCarousel: true` with a reason string — this is meant to hand off to the Reel workflow, but that connection isn't wired yet (the `Too Long - Needs Reel` node is a NoOp placeholder).

**Reel background styles**: `gradient`, `stars`, `rays`, `mist`, `lattice` — five self-authored procedural styles (SVG-rendered tiles, panned via FFmpeg crop + time expressions), no stock photo/video API involved anywhere. A sixth style, `bokeh` (gold floating particles), was built and then **dropped**: its gold color collided visually with the gold word-highlight, which was confusing on screen.

**Rotation rule**: `scripts/pick_style.js` picks a style seeded by `surah*1000+ayah`, excluding whatever style was used last (tracked in `state/last_style.txt`, committed to the repo so rotation persists across separate runs). Never the same style twice in a row.

**Font self-hosting fix — root cause**: the Arabic auto-fit function originally shrank font-size in a ~70-step linear loop (190px down to 46px in steps of 2px), each step mutating the DOM and triggering a reflow. This corrupted Arabic ligature shaping for some words in some renders — different words broke on different runs, including the word "Allah" itself, rendering as broken/tofu placeholder glyphs. It was initially misdiagnosed as a Google Fonts network-loading race (fonts.ready gating + embedding the fonts locally both failed to fix it). The actual fix was switching the auto-fit algorithm to **binary search** (~8 mutations instead of ~70) with a forced synchronous reflow (`void el.offsetHeight`) after each mutation and two animation-frame settle ticks before the screenshot. Verified with 5 consecutive identical local runs and one full GitHub Actions pipeline run, all byte-identical and correctly shaped. The font self-hosting (base64-embedded fonts, `scripts/font_data.js`) was kept even though it wasn't the root cause — it's still a legitimate robustness improvement (zero network dependency at render time) and shouldn't be reverted.

**Render-time budget**: 180 seconds total per Reel, with a 60-second sub-budget for the background-generation step specifically — if a requested style blows that sub-budget or fails outright, the pipeline automatically falls back to the `mist` style (chosen for being reliably fast) and logs a clear warning. A 10-minute hard job timeout is set on both GitHub Actions workflows as the outer backstop.

---

## 6. Reciter shortlist

9 unique reciters (10 rows — AbdulBaset AbdulSamad has two legitimate style variants), IDs and English names verified fresh against the Quran.com API this session. One reciter (Khalifa at-Tunaiji) was excluded per the user's earlier decision.

| ID | English name (Quran.com API) | Arabic name (alquran.cloud API) |
|---|---|---|
| 7 | Mishari Rashid al-`Afasy | مشاري راشد العفاسي |
| 2 | AbdulBaset AbdulSamad (Murattal) | عبد الباسط عبد الصمد (مرتَّل) |
| 1 | AbdulBaset AbdulSamad (Mujawwad) | عبد الباسط عبد الصمد (مجوَّد) |
| 6 | Mahmoud Khalil Al-Husary | محمود خليل الحصري |
| 9 | Mohamed Siddiq al-Minshawi (Murattal) | محمد صديق المنشاوي |
| 3 | Abdur-Rahman as-Sudais | عبدالرحمن السديس |
| 97 | Yasser Ad Dussary | ياسر الدوسري |
| 5 | Hani ar-Rifai | هاني الرفاعي |
| 4 | Abu Bakr al-Shatri | أبو بكر الشاطري |
| 10 | Sa`ud ash-Shuraym | سعود الشريم |

**Status**: sent to the user twice for approval. Arabic names are **not yet used** anywhere in renders — only English names appear (e.g. "Mishari Rashid al-`Afasy") until approval lands.

---

## 7. Caption template

Established pattern (found already drafted, but disabled pending approval, in the Daily Post workflow's `Build Caption` node; reused in the Reel workflow's `Build Caption` node):

```
﴿ Arabic ayah text in ornate brackets ﴾
سورة <Arabic surah name> · <Eastern-Arabic-numeral ref>

<one-line AI-authored reflection — the ONLY AI text allowed>

<dua, from the approved fixed list — currently a placeholder pool>

<one rotating CTA line, Arabic>

━━━━━━━━━━

<English translation(s), quoted>
Surah <English surah name> <ref>

<rotating CTA line, English>

<5-8 hashtags, Arabic + English mixed>

Text and recitation: Quran.com / Quran Foundation. Translation: Saheeh International.
```

The rotating CTA pool (reused verbatim from the Daily Post workflow's own earlier draft, just changed from "show all 3 every time" to "rotate one per post"):
- 💾 Save this for the day you need it / احفظ المنشور لوقت تحتاجه
- 📤 Share it as Sadaqa Jariya / انشره صدقة جارية
- 👤 Tag someone who needs this today / شاركه مع من يحتاج هذه الآية اليوم

Credit line is fixed, always present, and goes in the caption on both workflows (and is additionally written to a standalone `caption.txt` / `out/caption.txt` file by the Reel pipeline for easy reuse).

---

## 8. API and licensing notes

- **Quran.com v4**: currently used via its open/"legacy" endpoints (no API key required, no formal production approval). This works today but carries ongoing risk — Quran.Foundation (the org behind Quran.com) offers a separate, more durable production API program that the user has not yet applied for (see blockers).
- **Credit requirement**: Quran.com / Quran Foundation's terms require attribution — this is exactly what the fixed credit line in every caption satisfies. Do not remove or shorten it.
- **1-week caching limit**: per Quran.com's API terms, fetched content should not be cached/reused beyond about a week — relevant if any future caching layer is added; the current pipeline always fetches fresh at render time, so it's compliant by construction.
- **alquran.cloud**: used this session only for reciter Arabic-name lookups. Positioned as a fallback data source generally, not yet wired as an automatic fallback in either workflow.
- **Pexels**: API key issuance is currently paused (confirmed by directly checking this session) — this is why backgrounds are 100% procedurally generated rather than stock photo/video based.
- **Pixabay**: deliberately not used — their API terms conflict with this kind of automated pipeline use.

---

## 9. Test results so far

**Background styles** (15s samples, 1080×1920, 30fps): gradient 12.8s render / stars ~4s / rays 21.8s / mist 8.1s / lattice 18.3s. All five visually verified correct by actually downloading and viewing frames (not just trusting upload success — see bug list below for why that distinction mattered).

**Reel renders** (Surah Al-Ikhlas 112:1-4, reciter 7, "stars" background, 4 ayahs, 13.35s duration): render times ranged 36.2s–66.2s across iterations (budget 180s), final file size ~553 KB, 1080×1920 H.264/AAC 30fps. Instagram Reel spec compliant on every dimension checked. Duration (13.35s) is naturally under the 15s target because Al-Ikhlas only has 4 ayahs total — the pipeline correctly stops at the end of the surah rather than padding or repeating (`stoppedBySurahEnd: true`). Final verified-correct run: GitHub Actions run `37064344020`, Reel at `https://res.cloudinary.com/b72gfdzx/video/upload/v1790974999/reel-test/reel-37064344020.mp4`, all 4 still frames downloaded and visually confirmed with correct Arabic shaping (including every occurrence of "Allah"), correct per-ayah reference numbers, correct gold word-highlight.

**Audio**: lead-in logic verified — requests a 200ms lead-in from before the first word when the source has that much audio available; when it doesn't (e.g. ayah 1 of a surah, nothing precedes it), falls back to an 80ms fade-in and reports that it did so. End of clip is never padded or trimmed early.

**Bugs found and fixed this session** (chronological):
1. `generate_background.sh` using `geq` (per-pixel software filter) for gradient/rays — 4-5 minutes per 15s clip. Fixed: switched to pre-rendered SVG asset + FFmpeg crop-pan, same technique as the other styles. Render time dropped to 13-22s.
2. "stars" background rendering solid magenta instead of navy — `blend=all_mode=addition` pushing YUV chroma planes to extremes across the whole frame, not just at bright spots. First fix attempt (force `format=rgb24` around the blend) did NOT actually work — caught by downloading and viewing the re-rendered frame, still magenta. Real fix: dropped the blend filter entirely, switched to the same asset+pan technique as the other styles.
3. `generate_background.sh` losing its executable bit on a fresh checkout — fixed by invoking it via `bash script.sh` explicitly instead of relying on the execute permission.
4. Still-frame extraction loop silently losing data after the first iteration — ffmpeg reads stdin for keyboard control by default, stealing input from a `node ... | while read` pipe. Fixed with `-nostdin` on every ffmpeg invocation in CI.
5. A YAML indentation mistake (2 spaces instead of 12) inside a `run: |` block scalar silently broke parsing for an entire workflow file (GitHub showed the raw file path instead of the declared `name:`, and `workflow_dispatch` appeared unavailable). Fixed the indentation, then went further and extracted the fragile inline multi-line `node -e "..."` blocks into proper committed scripts (`pick_still_times.js`, `upload_cloudinary.js`) to remove the whole class of YAML/bash/JS nesting risk.
6. n8n GitHub node's `inputs` field (type `json`) needed a specific format: a JSON-looking string prefixed with `=` and containing embedded `{{ }}` expressions, not a whole-field `={{ object }}` expression. The validator's own error message gave the exact fix.
7. **The big one** — Arabic text rendering as broken/tofu glyphs on inconsistent words across different runs. Misdiagnosed twice as a font-loading timing issue (gating on `document.fonts.ready` + `--virtual-time-budget`, then fully self-hosting the fonts as embedded data) — both looked locally plausible but didn't fix it in the real pipeline, and self-hosting didn't fix it even in a from-scratch local test with zero network involved, which ruled out loading timing entirely. The actual cause: the auto-fit algorithm's ~70-step linear font-size-shrink loop was corrupting Arabic ligature shaping through rapid repeated DOM mutation. Fixed by switching to binary search (~8 mutations) with a forced reflow after each one. Verified with 5 identical local runs and a full pipeline run, byte-identical and correctly shaped every time.

The throughline worth remembering: **upload success and ffprobe/stats output are not sufficient verification for anything visual in this pipeline.** Every background style and every text-rendering fix in this list was confirmed only by actually downloading and looking at a rendered frame — several "fixes" that looked correct on paper (or even in an isolated local test) turned out not to be, and were only caught that way.

---

## Secrets

Nothing in this repo, nowhere in chat going forward, nowhere in any file Claude Code writes. All credentials live in n8n's credential store on the DigitalOcean droplet:

- `Basaer Media — Instagram Graph API` (facebookGraphApi, id `xbA6KXbSCE7hfo1C`) — created this session, holds the Instagram access token the user pasted into chat. Recommend rotating it (see blockers item 4) since it passed through chat text even though it was never echoed back or written anywhere.
- GitHub PAT, Telegram bot credential(s), and the Instagram Business Account ID are all still needed — see "PENDING / BLOCKERS" at the top.
