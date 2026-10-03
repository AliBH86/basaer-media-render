# Basaer Media — Handoff

Last updated: 2026-10-03 (evening, after the Telegram approval flow, caption/slide rework and Reel renderer fixes). Read this file first in any new session before touching the project. No secrets appear anywhere in this file — see "Secrets" at the bottom for where they actually live.

---

## PENDING / BLOCKERS

### Resolved 2026-10-03

- **Instagram credential FIXED and verified.** Root cause: the httpQueryAuth credential's *Name* field was empty, so n8n sent the token with no parameter name (proved by comparing with a no-token request: identical `IGApiException` 190, while any real token string returns "Failed to decrypt"). Name is now `access_token`. Read-only `GET graph.instagram.com/v25.0/me?fields=user_id,username,account_type` → 200, `basaer.media.bh`, `MEDIA_CREATOR`.
- **Instagram account ID (`user_id`, the `<IG_ID>` used for publishing): `17841414160930384`** (the `/me` `id` 28886708307608776 is app-scoped — do not use it for publishing). Token expires **Tue Dec 1, 2026**.
- **Publish nodes rebuilt** on graph.instagram.com v25.0 in both the Reel workflow and the Draft Approval workflow. **All DISABLED.**
- **GitHub credential** saved and verified: n8n dispatched a real render (workflow_dispatch). Minimal PAT permissions: Actions read+write (+ Metadata read, automatic), one repo, 90 days.
- **Telegram draft-approval flow** built, credentialed, and tested with real button presses (see the Draft Approval workflow below).
- **Content set approved by the user**: 68 daily ayahs + 8 Friday (Al-Kahf), caption layout, render style, reflection lines (treated as approved unless the user says otherwise after reading the Arabic).
- **Two Reel renderer bugs found and fixed today** (both visible only by looking at the frames): (1) `fetch_timeline.js` decoded each HTTPS chunk separately, so a 2-byte Arabic character split across chunks became two U+FFFD chars (a broken "Allah" in 112:1) — now Buffers are concatenated and decoded once, and any U+FFFD aborts the render (commit 04ffc80); (2) `.arabic { overflow:hidden }` sliced the tails of ق/ل/و on one-line ayahs — now `overflow:visible` plus more space above the English line (commits 08678f8 and the spacing follow-up).

### Needs the user

| # | Item | Why it matters | Blocks |
|---|---|---|---|
| 1 | Press **Reject** on the newest test draft in Telegram (and optionally press a button on an already-handled draft to see "Already … – ignored") | Completes the real-press test of the reject path | Sign-off of the approval flow |
| 2 | Tell Claude the **go-live date** → set `Config.CYCLE_START_DATE` in the Daily Post workflow | Rotation start (until set, today = day 0) | Go-live |
| 3 | Choose the **failure-alert Telegram chat** (different from the review chat) | "Basaer - Reel Error Alerts" has no credential/chat yet | Failure notifications |
| 4 | **Rotate tokens before go-live**: Instagram, Telegram bot (both passed through chat text). Paste only into the n8n credential fields (Instagram credential Name must stay `access_token`). Note the GitHub PAT expires ~2027-01-01 | Treat chat-exposed tokens as leaked | Go-live |
| 5 | Plan the Instagram token refresh before **Dec 1, 2026** | Publishing stops at expiry | Go-live after Dec 1 |
| 6 | Finish reading the Arabic reflection lines (treated as approved) | One-time approval | — |
| 7 | Approve the reciter Arabic-name table (API-sourced) | Arabic reciter names not used in renders until approved | Arabic reciter display |
| 8 | Apply for Quran.Foundation production API access | Quran.com v4 calls use the open endpoints today | Long-term API stability |
| 9 | Free space on the C: drive | General machine health | — |

### Needs Claude Code next, in priority order

1. Attach the Basaer Telegram credential + chat id to "Basaer - Reel Error Alerts" (item 3 above).
2. At go-live: set `CYCLE_START_DATE`, activate the Daily Post workflow (7 PM Bahrain schedule is re-enabled but the workflow is inactive). Review mode: every draft goes to Telegram and nothing publishes. Keep "Basaer - Draft Approval (Telegram)" active.
3. **Before enabling any IG node** (only on the user's explicit say-so): add the `status_code = FINISHED` retry loop/If gate in both the Draft Approval and Reel workflows; decide whether Approve should publish immediately or queue for a time slot.
4. Reel workflow: port the approved-ayah selection (it is hardcoded to 112:1) and decide on a trigger. Reels currently pick the reflection by `Config.theme`/`dayIndex`.
5. The Daily Post "Too Long - Needs Reel" branch is dead for the approved list; remove it or wire it to the Reel workflow if non-listed ayahs are ever used.
6. Once Quran.Foundation access is granted, swap the API calls over.

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

## 4. n8n workflows (Daily Post and Reel INACTIVE; Draft Approval ACTIVE; all Instagram nodes DISABLED)

### Basaer - Daily Post (Quran Image) — id `0rDJEBadks8oiKiL`, INACTIVE, 15 nodes

`Schedule - Daily 7PM Bahrain` → `Config` (`QURAN_API_BASE`, `REVIEW_CHAT_ID`, `CYCLE_START_DATE`) → `Get Posted Ayahs History` → `Pick Ayah` → `Get Verse` → `Get Chapter` → `Build HTML` → `If Too Long For Carousel` (true branch `Too Long - Needs Reel` is now effectively unused: every listed ayah is single-slide) → `Render via Gotenberg` → `Upload to Cloudinary` → `Build Caption` → `Save Draft` → `Telegram - Send Draft Image` → `Telegram - Send Caption + Approve/Reject`.

- **Pick Ayah** is a fixed, user-approved rotation (references only; text always comes from the Quran.com API): a 68-day cycle Saturday–Thursday (no surah on two consecutive days, no theme more than twice in a row, checked including the wrap-around) plus an 8-week Al-Kahf cycle on Fridays. Themes: Mercy, Patience, Gratitude, Dua, Trust, Family & forgiveness, Parents & departed, Friday. Day 0 = `Config.CYCLE_START_DATE` (yyyy-MM-dd, Bahrain time). **It is currently the placeholder `SET_GO_LIVE_DATE`; while unset, "today" counts as day 0 (test mode).** Set it to the go-live day.
- **Build HTML**: single combined slide (1080×1350) in Scheherazade + Inter. English shown exactly as the API returns it (footnote markers removed only — no quote stripping, no added quotes). The ۞ marker is hidden on slides only. Fit-to-frame: binary search, Arabic floor 56px, English floor 26px; a red OVERFLOW bar appears if it still doesn't fit; Gotenberg waits for `window.__fitDone`. The end-of-ayah marker is glued to the last word with a non-breaking space; the footer has a spacing guard so the handle never touches the text above.
- **Build Caption**: Arabic block, divider, English block, ONE credit line after both, 5–8 mixed Arabic/English hashtags. Reflection line is PICKED from the user-approved list (3 per theme, Arabic + English) by day index — **no AI call at publish time**. CTA rotates (save / share as Sadaqa Jariya / tag 🏷️). The dua line was removed at the user's request. The ۞ marker is hidden in captions too (display only). Caption length is checked against Instagram's 2,200 limit.
- **Draft flow (review mode)**: `Save Draft` writes a row to Data Table "Basaer drafts" (id `o2gqjZsMDJThOcWL`; columns draft_id, ayah_key, theme, posted_date, image_url, caption, status) with status `pending`. `draft_id` = `<date>_<ayah>_<execution id>`. The two Telegram nodes send the image, then the caption with ✅ Approve / ❌ Reject buttons (HTML parse mode, caption HTML-escaped — raw Markdown/entities broke the first attempt with "can't parse entities").
- The old "Log Posted Ayah" node moved into the approval workflow (below); the date-based rotation does not need posting history, so `Get Posted Ayahs History` is now vestigial.

### Basaer - Draft Approval (Telegram) — id `1E3k34CoG6qn7ZTj`, **ACTIVE** (it must be on to hear button presses), 17 nodes

`Telegram Trigger (button press)` → `Parse Button (owner only)` → `Get Draft` → `Validate Press` → `Answer Button` (Telegram toast) → `Valid Press?` → `Approved?` → `Mark Approved/Rejected (only if still pending)` → Telegram confirmation. Approve then continues into IG nodes that are all **DISABLED** (create container → wait → status → publish → `Log Posted Ayah (DISABLED)`); disabled nodes just pass data through, nothing is posted.

Guards (all tested 2026-10-03):
1. **Owner only**: presses from any Telegram user id other than `8704731927` are dropped at `Parse Button` — no reply, no data-table access.
2. **Draft must exist, be `pending`, and be from today or yesterday (Bahrain)**: otherwise ignored with a toast ("Already approved/rejected – ignored", "Draft expired", "Draft not found").
3. **Conditional update** (draft_id AND status = pending): if two presses race, the second matches zero rows and nothing downstream runs.
Simulated edge cases: other account → dropped; Approve on a 3-day-old pending draft → "expired", status unchanged; second press on a handled draft → "Already rejected – ignored"; unknown draft id → "not found". Real presses: Approve on drafts …_40192 and …_40210 → status `approved`, confirmation sent, nothing published.
Settings: Error Workflow = "Basaer - Reel Error Alerts".

### Basaer - Reel (Quran) — id `DDATobrIvVhVGmr0`, INACTIVE, 9 nodes

`Manual Trigger (test)` → `Config` (surah/ayahStart/reciterId/style — **hardcoded 112/1/7/stars for testing**; reviewChatId `8704731927`; `igUserId` `17841414160930384`; `igApiBase`; `theme`/`dayIndex` for the reflection pick) → `Dispatch Reel Render & Wait` (GitHub node with credential `Basaer - GitHub (render dispatch)`; workflow = `test-reel-general.yml` selected **by filename** — the "name" mode failed activation; `workflow_dispatch` + resumeUrl callback, no polling) → `Build Caption` (same approved template and reflection list as the Daily Post, no dua line, no AI) → `Send Review Notification` (Telegram, Basaer credential, HTML parse mode, escaped) → `IG - Create Reel Container (DISABLED)` → `Wait for Processing (DISABLED)` → `IG - Check Container Status (DISABLED)` → `IG - Publish Reel (DISABLED)`.

Verified end to end 2026-10-03 (n8n execution 40197, GitHub run 37132183857; later runs 37135515508 / 37135660732 for the render fixes): n8n dispatched the render, GitHub called back, caption built, review message delivered to Telegram. Error Workflow = "Basaer - Reel Error Alerts" (set via API; no UI step needed).

All four Instagram nodes are HTTP Request nodes on `graph.instagram.com/v25.0` using credential "Basaer Media — Instagram Login token", and are `disabled: true`. Endpoints (Meta "Instagram API with Instagram Login" content publishing): `POST /{igUserId}/media` (media_type=REELS, video_url, caption) → `GET /{containerId}?fields=status_code` → `POST /{igUserId}/media_publish` (creation_id). Before enabling: add a retry loop + If gate so publish only runs when `status_code` = `FINISHED`.

### Basaer - Reel Error Alerts — id `oltrBGOHGXhdMXBY`, inactive, 3 nodes

`Error Trigger` → `Build Alert` → `Send Failure Notification` (Telegram). **Still needs the Basaer Telegram credential attached and a real chat id (currently `SET_ME`)** — use a DIFFERENT chat than the review chat so a Telegram outage doesn't swallow both. It is already assigned as the Error Workflow of both "Basaer - Reel (Quran)" and "Basaer - Draft Approval (Telegram)".

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

- `Basaer Media — Instagram Login token` (httpQueryAuth, id `qxx0V2sGYu8YXpZM`) — Instagram Login token (IGAA…), Name field `access_token`, works only on graph.instagram.com (not graph.facebook.com, and not with n8n's Facebook Graph API node). Expires Dec 1, 2026. Rotate before go-live.
- `Basaer Media — Telegram Bot (Basaermedia_bot)` (telegramApi, id `blya0LlxCW6TePBT`) — attached to every Basaer Telegram node. The credential was updated by the user at 14:50 UTC on 2026-10-03 (id unchanged), presumably with a fresh token entered directly in n8n — confirm the earlier chat-exposed bot token was revoked in @BotFather.
- `Basaer - GitHub (render dispatch)` (githubApi, id `ow7HoLJbFb5jaq19`) — fine-grained PAT, repo basaer-media-render only, Actions read/write, 90-day expiry from 2026-10-03. Attached to "Dispatch Reel Render & Wait"; verified working.
- The old `Basaer Media — Instagram Graph API` (facebookGraphApi, id `xbA6KXbSCE7hfo1C`) no longer exists.
