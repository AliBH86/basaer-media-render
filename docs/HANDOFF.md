# Basaer Media — Handoff

Last updated: 2026-10-04 afternoon (ACTIVATION RUNBOOK for 10-11 Oct; Draft Approval publish path: FINISHED gate + no-double-publish guard; live Gotenberg check of 57:9 and 18:1; 59:10 spacing; Reel 42:25-26 replaced by 7:55-56; privacy policy draft). Earlier the same day (overnight): PUBLISH_ENABLED hard switch, surah spellings, Al-Kahf Reels re-tagged, Daily Post + Reel QA, prayer-time and hadith research, Quran.Foundation application text, GO-LIVE READINESS table. Read this file first in any new session before touching the project. No secrets appear anywhere in this file; see "Secrets" at the bottom for where they actually live.

---

## GO-LIVE READINESS (updated 2026-10-04, overnight)

Status of everything needed before the first scheduled run. **DONE** = finished and checked; **BLOCKED (you)** = waiting on the owner; **TODO** = Claude can do it on request.

| # | Item | Status |
|---|---|---|
| 1 | Error alerts workflow "Basaer - Reel Error Alerts" active | **DONE** (active, tested) |
| 2 | Instagram token monitor active (reminders 14/7/3/1 days, twice-daily read-only check) | **DONE** (active) |
| 3 | Rotate the Instagram token (GO-LIVE CHECKLIST step 1), then set `TOKEN_EXPIRY_DATE` in the Token Monitor Config to the new date | **BLOCKED (you)**: you rotate it yourself; the monitor still holds 2026-12-01 |
| 4 | Telegram bot token: revoke with @BotFather if it was ever pasted in chat, put the new one only in the n8n credential | **BLOCKED (you)** (if needed) |
| 5 | `PUBLISH_ENABLED=false` hard switch before every Instagram container and publish step (Reel: Config; Draft Approval: node "Publish Switch"), Instagram nodes disabled | **DONE** (2026-10-04, wiring verified) |
| 6 | REVIEW MODE: every Daily Post and Reel goes to Telegram first; Approve only marks the draft approved and never publishes | **DONE** (this is how the system works today; there is no separate REVIEW_MODE flag; the hard switch in item 5 is what keeps it in review mode) |
| 7 | `status_code = FINISHED` gate in the production Instagram chains (needed only when publishing is switched on) | **DONE for Daily Post** (Draft Approval, 2026-10-04: FINISHED gate + "do not publish twice" guard + "Mark Published"; still disabled). Reel chain: TODO before any Reel "PUBLISH NOW" |
| 8 | Rotation and schedules: Daily Post day 1 = 2026-10-10 at 19:00; Reels Sun/Tue/Thu/Sat 20:00, first Reel Sunday 2026-10-11; before-start guards skip earlier runs | **DONE** (configured, tested in simulation and with real n8n runs) |
| 9 | Activate "Basaer - Daily Post (Quran Image)" | **BLOCKED (you)**: say when. Safe any time before 2026-10-10 19:00 (the guard skips earlier days) |
| 10 | Activate "Basaer - Reel (Quran)" | **BLOCKED (you)**: say when. Safe any time before 2026-10-11 20:00 |
| 11 | Content approvals: reciters, Reel list, captions (layout, SAVE/SHARE, surah names), reflections | **DONE**, except the 3 draft "Reminder" lines for Reel 18:46 (it uses the Gratitude set until you approve them) |
| 12 | QA: all 76 Daily Post slides and 10 Reels rendered and checked | **DONE** (see docs/QA_DAILY_2026-10-04.md and docs/MORNING_REPORT.md) |
| 13 | Privacy policy page (Meta asks for one when the app leaves development mode) | **BLOCKED (you)**: text ready in docs/PRIVACY_POLICY_DRAFT.md (not published); it needs your contact email |
| 14 | Quran.Foundation production API access | **BLOCKED (you)**: text ready in docs/QF_APPLICATION.md, add your email and send |
| 15 | GitHub token "Basaer - GitHub (render dispatch)" expires about 2027-01-01 | reminder for you |
| 16 | Delete `New folder/instagram App Graph Api token.txt` from the project folder on C: after rotating the token | **BLOCKED (you)** |

**Activation order** (each step only on your word): 1) Error Alerts, 2) Token Monitor, 3) Draft Approval (all three already active); 4) Daily Post; 5) Reel. Publishing stays off throughout (PUBLISH_ENABLED=false) until you write "PUBLISH NOW" for a named action.

**First-week routine** (review mode, 5-7 days):
- 19:00 every day: the Daily Post draft (image + caption + Approve/Reject) arrives on Telegram. Check the Arabic, the end-of-ayah number, the English, the reference line and the CTA lines; press Approve or Reject.
- 20:00 Sun/Tue/Thu/Sat: the Reel review message (caption, Reel link, 4 stills). Watch the Reel once with sound: first word not cut, gold word follows the voice, end not abrupt.
- Any "TEXT INTEGRITY CHECK FAILED", "render failed" or token alert: do nothing on Instagram; tell Claude.
- Keep a tally (approved / rejected / voided); anything rejected or voided gets fixed before go-live.

**Rollback** (any time): deactivate "Basaer - Daily Post" and/or "Basaer - Reel" (nothing else runs on its own); PUBLISH_ENABLED stays false; delete a wrong post in the Instagram app; n8n keeps version history for every node change (Claude can restore a previous version), and every code change is a commit in AliBH86/basaer-media-render (git revert).

## ACTIVATION RUNBOOK (Sat 10 Oct and Sun 11 Oct 2026)

Activating a workflow is **not** publishing. Through all of this `PUBLISH_ENABLED=false` and every Instagram node stays disabled, so drafts come to Telegram and nothing reaches Instagram.

**A. Evening before (Fri 9 Oct)**
1. If you have not done it yet: rotate the Instagram token (GO-LIVE CHECKLIST step 1) and set `TOKEN_EXPIRY_DATE` in the Token Monitor.
2. Write **"PRE-FLIGHT"**. Claude checks, read-only, and replies with one table:
   - Active: Draft Approval, Reel Error Alerts and Token Monitor. Inactive: Daily Post and Reel.
   - Daily Post Config: `CYCLE_START_DATE=2026-10-10`, `ENFORCE_START_DATE=true`.
   - Reel Config: `CYCLE_START_DATE=2026-10-10`, `REEL_START_DATE=2026-10-11`, `REEL_WEEKDAYS=7,2,4,6`, `USE_PICKER=true`, `PUBLISH_ENABLED=false`, `integrityTest` empty.
   - Draft Approval: "Publish Switch" = false; all Instagram nodes disabled (4 in Draft Approval, 4 in Reel, plus Log Posted Ayah).
   - Error Workflow = "Basaer - Reel Error Alerts" on Daily Post, Reel and Draft Approval.
   - Instagram token: read-only `me` check returns 200 and `user_id` 17841414160930384.
   - Droplet RAM: at least ~500 MB available (Claude can read it; otherwise run `ssh root@68.183.138.209 'free -m'` yourself and look at the "available" column).
3. What runs first: Sat 10 Oct, Daily Post day 1 = **70:5** (Patience). Sun 11 Oct, Daily Post **28:24** (Dua) and the first Reel, **14:40-41** (Al-Minshawi, gradient).

**B. What you write** (one line, in your own message; Claude does nothing without it)
- `ACTIVATE: Daily Post`: Claude activates "Basaer - Daily Post (Quran Image)" and confirms it is active and the 19:00 schedule is registered.
- `ACTIVATE: Reel`: the same for "Basaer - Reel (Quran)" (Sun/Tue/Thu/Sat 20:00).
- Publishing is a separate step for later (after the review week), and always starts with **PUBLISH NOW** plus the exact action:
  - `PUBLISH NOW: publish draft <draft_id>`: one Daily Post draft, published once, then everything is switched off again.
  - `PUBLISH NOW: enable Daily Post publishing on Approve`: Claude sets "Publish Switch" to true and enables the 4 Instagram nodes plus Log Posted Ayah in Draft Approval. From then on ✅ Approve publishes that draft.
  - `PUBLISH NOW: publish Reel <date>`: one Reel, published once. Note that the Reel chain has no Approve button: enabling it would publish every Reel right after its review message, so keep Reels one at a time until a Reel approval step exists.

**C. Order and timing**
1. Draft Approval, Reel Error Alerts and Token Monitor are already active and stay active. Do not deactivate them.
2. **Daily Post: activate on Sat 10 Oct before 19:00 Bahrain.** Best is 17:00-18:30; any time earlier is also safe, because the before-start guard skips quietly. Avoid 18:55-19:05.
3. **Reel: activate on Sun 11 Oct before 20:00.** Best is after the 19:00 Daily Post draft has arrived (around 19:10-19:45); any time earlier is also safe. Avoid 19:55-20:05.
4. One at a time: Claude confirms each activation before the next one.

**D. What you should see in Telegram**
- **Sat 19:00**:
  - A photo with the caption "DRAFT (not published) · 70:5 · Patience".
  - A second message with the full caption, the draft id and ✅ Approve / ❌ Reject buttons.
  - Pressing ✅ shows the toast "Approved (publishing is still disabled)." plus a confirmation message. Nothing appears on Instagram.
- **Sun 19:00**: the 28:24 draft, the same two messages.
- **Sun about 20:05-20:10** (the render takes a few minutes): the Reel review message with the caption, the Reel link and 4 stills (start, two middle, end). It has no buttons; watch it once with sound.
- **Never expected**:
  - "TEXT INTEGRITY CHECK FAILED", "render failed", a workflow error alert or a token alert.
  - Any message at another time.
  - Anything new on Instagram.
  - If one of these happens: do nothing on Instagram, and tell Claude.
- **Silence at 19:00 or 20:00** (nothing arrived by 19:15 or 20:20): tell Claude. It will check the executions; do not re-run anything yourself.

**E. Rollback**
- **Wrong or unwanted drafts:** write `DEACTIVATE: Daily Post` and/or `DEACTIVATE: Reel`, or switch the toggle off in n8n yourself. Nothing else runs on its own.
- **Something appeared on Instagram that you did not order:**
  1. Write `STOP`.
  2. Claude deactivates Daily Post, Reel and Draft Approval, checks that "Publish Switch" is false and that the Instagram nodes are disabled, and reports what ran.
  3. You delete the post in the Instagram app.
- **A change made things worse:** n8n keeps every version of every node (Claude restores the previous one), and code changes are commits in AliBH86/basaer-media-render (git revert).
- **Re-activate** only after the cause is understood, with the same one-line instruction as in B.

## GO-LIVE CHECKLIST

Do these in order. **Nothing publishes to Instagram until step 4, and step 4 needs the user's explicit instruction.** Every Instagram node in every Basaer workflow is DISABLED today.

**0. Before anything (already done unless noted)**
- [x] Arabic/English integrity guards in the Daily Post and Reel pipelines (tested 2026-10-03).
- [x] "Basaer - Reel Error Alerts" active, using the Basaer bot and the owner's chat (tested with a forced failure).
- [x] Rotation start date set: `CYCLE_START_DATE` = **2026-10-10** (Saturday, day 1; Fridays always use the Al-Kahf set, starting 2026-10-16).
- [x] Instagram token monitor built and tested (reminders 14/7/3/1 days before expiry + health check twice a day; renewal stays manual): see "Renew the Instagram token" below. The current token expires **2026-12-01**.

**1. Rotate the Instagram token (and the Telegram bot token if it was ever pasted in chat)**
1. In Instagram (account @basaer.media.bh): Settings → **Apps and websites** → remove the app "Basaer Publisher". This revokes every existing token.
2. In the Meta app dashboard (Basaer Publisher → Instagram → API setup with Instagram login): add the account again and **Generate token** for @basaer.media.bh, accepting all permissions (including content publishing).
3. In n8n: Credentials → "Basaer Media — Instagram Login token" (id `qxx0V2sGYu8YXpZM`). **Name must stay `access_token`**, Value = the new token only, no spaces or quotes. Save and wait for the confirmation. Never paste the token into chat.
4. Read-only check (ask Claude): `GET graph.instagram.com/v25.0/me?fields=user_id,username,account_type` through that credential must return 200 and `user_id` = `17841414160930384`.
5. Update `TOKEN_EXPIRY_DATE` in "Basaer - Instagram Token Monitor" > Config (see "Renew the Instagram token" below).
6. Telegram bot: if its token ever appeared in chat, revoke it with @BotFather (`/revoke`), put the new token only into the n8n credential "Basaer Media — Telegram Bot (Basaermedia_bot)", and press Start on the bot again if asked.
7. GitHub PAT "Basaer - GitHub (render dispatch)" expires about **2027-01-01** (90 days from 2026-10-03): put a reminder in your calendar.

**2. One manual test post (needs the user's explicit go-ahead in chat for each post)**
1. The `status_code = FINISHED` gate and the "do not publish twice" guard are in the Draft Approval chain (added 2026-10-04, still disabled). The Reel chain does not have them yet.
2. The user picks one approved draft (for example the day-1 post, 70:5) and says "go" in chat.
3. Claude enables only that chain for a single manual run, publishes that one draft, then disables the nodes again.
4. The user looks at the live post: Arabic text and diacritics, translation, caption, hashtags, credit line, image framing. Delete the post if anything is wrong.

**3. Review week (7 days)**
1. Activate "Basaer - Daily Post (Quran Image)" (best on 2026-10-10 before 19:00). A before-start guard now skips silently and logs a row in Basaer drafts if it ever runs before `CYCLE_START_DATE` (2026-10-10), so an early activation is harmless. The 19:00 Bahrain schedule then sends one draft per day to Telegram.
2. Each day press ✅ Approve or ❌ Reject. In review mode **Approve only means "this draft is good"** — nothing publishes. If you want real posts during this week, do them one at a time with the manual procedure in step 2.
3. Keep a tally: approved / rejected / voided by the integrity guard. Investigate any void or any rejected draft before moving on; there should be none for text corruption.
4. "Basaer - Draft Approval (Telegram)", "Basaer - Reel Error Alerts" and "Basaer - Instagram Token Monitor" must stay active throughout.

**4. Auto-publish switch (only after the review week AND the user's explicit instruction)**
1. Confirm: token rotated and read-only check passed, expiry reminder running, Error Alerts active, review week clean.
2. Claude enables, in "Basaer - Draft Approval (Telegram)", the chain: Create Image Container → Wait → Check Container Status (FINISHED gate) → Publish → Log Posted Ayah. Decide first whether Approve publishes immediately or at a scheduled time.
3. Rollback at any time: disable those five nodes (or deactivate the Draft Approval workflow). Drafts keep arriving; nothing publishes.
4. Reels follow the same pattern later: enable the four disabled nodes in "Basaer - Reel (Quran)" only on the user's say-so.

### Renew the Instagram token (2 minutes)

The token lasts 60 days (current one: expires **2026-12-01**). The monitor (below) messages you on Telegram 14, 7, 3 and 1 days before the date stored in its Config, and the same day the token stops working. Renewal is always manual:

1. **Generate a new token.** developers.facebook.com → My Apps → **Basaer Publisher** → Instagram → *API setup with Instagram login* → step *Generate access tokens* → click **Generate token** next to @basaer.media.bh → confirm the login/permissions → copy the token (it is shown once). Do not paste it anywhere except step 2. (For a full security rotation at go-live use GO-LIVE CHECKLIST step 1 instead: it removes the app first.)
2. **Put it in n8n.** Credentials → **"Basaer Media — Instagram Login token"** → *Value* = the new token only (no spaces, no quotes, no line break) → the *Name* field must stay exactly `access_token` → **Save** and wait for the confirmation.
3. **Update the expiry date.** Workflow **"Basaer - Instagram Token Monitor"** → node **Config** → set `TOKEN_EXPIRY_DATE` to today + 60 days (`yyyy-MM-dd`; the Meta Access Token Debugger shows the exact "Expires" date if you want to be precise) → Save. (If you forget, the monitor sends "the stored expiry date has passed but the token still works" every run until you do.)
4. **Check it.** In the same workflow click *Execute workflow* once: **no Telegram message = healthy** (a message means it found a problem and says which). Or ask Claude for the read-only `me` check.

Never create an n8n API key with write access just to automate this. If the monitor reports a failure that is not an expiry (revoked app, password change), the same steps fix it.

---

## PENDING / BLOCKERS

### Done 2026-10-04 afternoon (user's 8-item message)

**1. 59:10 spacing**
- The Daily Post fit-to-frame now keeps a 56 px reserve (was 16 px) in the live Build HTML and in `n8n/daily_build_html.js`.
- 59:10 now renders at Arabic 58 px / English 26 px, with a clear gap under the header (viewed).
- Full QA run 37199177266: 76/76 integrity OK, no OVERFLOW.
- Tightest slides: 57:9, 11:123, 20:114, 2:186, 31:12, 65:3 and 40:8 have 1 px spare beyond the reserve, so about 57 px real room.
- Slide: https://res.cloudinary.com/b72gfdzx/image/upload/qa-overnight/daily-49-59_10-1-37199177266.png

**2. Reel 42:25-26 replaced by 7:55-56**
- 42:25 alone is 8.6 s with reciter 10, so it was too short.
- 7:55-56 (Mercy) is two ayahs from the approved Daily rotation; it lasts 18.8 s with Saud Ash-Shuraim on gradient.
- Updated in the list row, the live Pick Reel and the content doc. Simulation clean.
- Test render 37199272986: integrity OK, stills viewed.
- Reel: https://res.cloudinary.com/b72gfdzx/video/upload/qa-overnight/reel-37199272986.mp4

**3. 18:46** uses the Gratitude lines (alias `Reminder` → `Gratitude`) until the Reminder lines are approved.

**4. Live production check (draft only)**
- A temporary webhook copy of the Daily Post render path ran 57:9 (exec 40562) and 18:1 (exec 40563) through the droplet's Gotenberg. Its code segments were checked character for character against the production nodes before running.
- Daily Post itself stayed inactive. The temporary workflow was deleted afterwards.
- Both drafts went to Telegram with integrity OK.
- ﷺ renders in Gotenberg; the 57:9 PNG is byte-identical to the GitHub render.
- RAM available: 806 MB before, 809 MB during, 822 MB after.

**5. Draft Approval publish path**
- FINISHED gate, do-not-publish-twice guard, media-id check and Mark Published added; nothing enabled (see section 4).

**6. ACTIVATION RUNBOOK** added (above).

**7. Privacy policy** text in `docs/PRIVACY_POLICY_DRAFT.md` (not published; needs your contact email).

### Done 2026-10-04 (user's review of the Reels and captions)

- **FIRST LIVE POST (user's explicit instruction, 2026-10-04: "share one post on instagram")**: Daily Post 94:6, draft `2026-10-04_94:6_40424` (the user pressed Approve on it in Telegram), published 2026-10-04 04:02:47 UTC: https://www.instagram.com/p/DeDusHzFoRe/ (media id 18391121536165913). Published through a TEMPORARY one-off workflow that copied the disabled production node settings, added the `status_code = FINISHED` gate, accepted only that one draft id, and was **deleted** right after. The caption on Instagram was read back through the API and matches the draft exactly. Draft row status = `published (one manual post authorised by the user 2026-10-04)`. **The production Instagram nodes are still DISABLED** and both content workflows are INACTIVE. Note: `Log Posted Ayah` was not run (its table is not used by the date-based rotation).
- **Reel audio (1a/1b)**: every render now (a) finds the real voice onset in the source, trims leading silence to 150 ms before it and shifts all word timings, so the first gold word never appears before the voice (39:53 Minshawi: onset 640 ms, 490 ms trimmed; 14:40 Minshawi: onset 700 ms, 550 ms trimmed; 93:1 Husary: first word moved from 0 to the 70 ms onset). Recitations that run straight in from the previous ayah (sound before the first word within 20 dB of the recitation's peak, e.g. Hani Ar-Rifai 3:200) keep the API timing. (b) At the end, if the voice is still sounding, it extends up to 250 ms to the first natural low point and fades out (40 ms at a low point, 100 ms otherwise). 3:200 is the last ayah of Al 'Imran and the recording itself ends ~280 ms after the API end while the voice still sounds, so it is extended 250 ms with a 100 ms fade (last 300 ms: mean -29.5 dB, last 50 ms: mean -37.9 dB). Stats: `voiceOnset`, `naturalEnd`, `audioLevels.last300ms`, `envelope.tailSource`.
- **Caption layout (2)**: line 1 = bilingual reference ("سورة الشرح · ٩٤:٦ | Surah Ash-Sharh 94:6"); then Arabic ayah, reflection, SAVE + SHARE; divider; English ayah, reflection, SAVE + SHARE; credit; hashtags. Reference lines inside the blocks removed. Reference now visible before "more" in 115 of 115 captions; longest possible caption 1,277 characters. Both integrity checks updated to the new layout.
- **Surah names (3)**: `data/surah_names.json`, only the `approved` section is applied (14 → إبراهيم, in the Daily Post slide + caption and the Reel overlay + caption). Scan of all 45 surahs used: no other Arabic name needs a change. English names proposed (NOT applied, waiting for the user): 3 "Ali 'Imran" → "Al 'Imran", 21 "Al-Anbya" → "Al-Anbiya", 42 "Ash-Shuraa" → "Ash-Shura", 93 "Ad-Duhaa" → "Ad-Duha".
- **Reflections (4)**: Faith = one line, Unity = three lines, verbatim from the user; all reflection lines are now approved (`data/reflections.json`).
- **Translation (5)**: Saheeh International kept for launch. ONE config value: `Config.TRANSLATION_ID` (20) and `Config.TRANSLATION_NAME` (credit line + slide) in both workflows; the Reel passes them to GitHub as inputs `translationId` / `translationName` (env `TRANSLATION_ID` / `TRANSLATION_NAME`). Keyword scan of all 115 passages (Throne, Face, Hand, above, Eye, plurals): only 3 hits, all Daily Posts: 20:114 ("So high [above all] is Allāh"), 25:74 ("comfort to our eyes"), 9:129 ("Lord of the Great Throne"). No Reel passage contains any of them.
- **Reel schedule (6)**: Sunday, Tuesday, Thursday, Saturday at 20:00 Asia/Bahrain (schedule node, cron `0 20 * * 0,2,4,6`, workflow timezone Asia/Bahrain), never on Fridays. `Config.REEL_START_DATE` = 2026-10-11 (first Reel, used by the before-start guard), `Config.REEL_WEEKDAYS` = 7,2,4,6, `CYCLE_START_DATE` = 2026-10-10 (Daily Post day 0, used by the picker for the "not the Daily Post's surah" rule). Daily Post unchanged at 19:00. Test: 160 Reels from 2026-10-11 to 2027-07-17, all on Sun/Tue/Thu/Sat, 0 collisions with that day's Daily Post (4 forced skips), Monday/Friday return no Reel, 2026-10-10 is blocked. The three Friday-themed Reels (18:10-12, 18:46, 18:23-24) now run on Reel weekdays with the Friday reflection set.
- **Bug fixed**: the n8n Reel text check compared raw strings, so 108:1 (shadda/fatha in a different order in the API's verse text and word list) would have been falsely voided; it now uses the same NFC display rule as the GitHub guard.

### Resolved 2026-10-03

- **Instagram credential FIXED and verified.** Root cause: the httpQueryAuth credential's *Name* field was empty, so n8n sent the token with no parameter name (proved by comparing with a no-token request: identical `IGApiException` 190, while any real token string returns "Failed to decrypt"). Name is now `access_token`. Read-only `GET graph.instagram.com/v25.0/me?fields=user_id,username,account_type` → 200, `basaer.media.bh`, `MEDIA_CREATOR`.
- **Instagram account ID (`user_id`, the `<IG_ID>` used for publishing): `17841414160930384`** (the `/me` `id` 28886708307608776 is app-scoped — do not use it for publishing). Token expires **Tue Dec 1, 2026**.
- **Publish nodes rebuilt** on graph.instagram.com v25.0 in both the Reel workflow and the Draft Approval workflow. **All DISABLED.**
- **GitHub credential** saved and verified: n8n dispatched a real render (workflow_dispatch). Minimal PAT permissions: Actions read+write (+ Metadata read, automatic), one repo, 90 days.
- **Telegram draft-approval flow** built, credentialed, and tested with real button presses and simulated edge cases (see the Draft Approval workflow below).
- **Content set approved by the user**: 68 daily ayahs + 8 Friday (Al-Kahf), caption layout, render style, reflection lines (treated as approved unless the user says otherwise after reading the Arabic).
- **Arabic/English integrity guards** (after the corrupted-"Allah" bug) in both pipelines — see "Arabic integrity guard" under section 4. Each was proven with a clean run (passes, no false alarm) and a deliberately corrupted run (blocked, owner alerted on Telegram).
- **Error alerts working.** Finding: this n8n only runs an Error Workflow when that workflow is **active (published)**. While "Basaer - Reel Error Alerts" was inactive, failures were silent. It is now active and tested with a harmless forced failure; it is attached to the Reel, Daily Post and Draft Approval workflows. It contains only an Error Trigger (no schedule/webhook), so it can fire only when one of those workflows fails.
- **Rotation start date** set: `CYCLE_START_DATE` = 2026-10-10 (Saturday = day 1). First Friday (2026-10-16) = 18:1.
- **Before-start guard** (Daily Post and Reel): if today (Bahrain) is earlier than `CYCLE_START_DATE`, the run skips silently and logs a row in Basaer drafts (status `skipped: Before CYCLE_START_DATE 2026-10-10`); no render, no GitHub dispatch, no Telegram. Tested 2026-10-03 on both workflows (before the date: skipped; Daily Post on the start date: ran and sent a draft). `Config.ENFORCE_START_DATE=false` disables it for deliberate manual tests.
- **Instagram Token Monitor** built, tested and active (see section 4). The instance timezone was verified as Asia/Bahrain, so the 19:00 and 09:00/21:00 schedules mean Bahrain time.
- **Real double-press proof**: four ❌ taps on already-approved drafts (16:55) were all answered "Already approved - ignored" and changed nothing.
- **Two Reel renderer bugs found and fixed earlier today** (both visible only by looking at the frames): (1) `fetch_timeline.js` decoded each HTTPS chunk separately, so a 2-byte Arabic character split across chunks became two U+FFFD chars (a broken "Allah" in 112:1) — now Buffers are concatenated and decoded once, and any U+FFFD aborts the render; (2) `.arabic { overflow:hidden }` sliced the tails of ق/ل/و on one-line ayahs — now `overflow:visible` plus more space above the English line.

### Needs the user

| # | Item | Why it matters | Blocks |
|---|---|---|---|
| 1 | Real ❌ **Reject** press: the fresh draft `_40245` was answered with ✅ (status `approved`), so the reject path is still proven only by simulation. Ask Claude to "send another draft" and press ❌. (The double-press guard IS proven for real: four ❌ taps on already-approved drafts at 16:55 were all answered "Already approved - ignored" and changed nothing.) | The reject path | Sign-off of the approval flow |
| 2 | ~~Reciter table~~ **APPROVED 2026-10-03** (display names in `data/reciters.json`, Arabic + English on every Reel) | — | — |
| 3 | ~~Reel content list~~ **APPROVED 2026-10-03** (39 Reels, `docs/REEL_CONTENT_LIST.md` / `data/reel_list.json`) | — | — |
| 3b | Approve or change the **English surah-name spellings** proposed in `data/surah_names.json` (section `proposed`) | Not applied until approved | — |
| 3c | Decide whether to keep or drop the Daily Posts **20:114, 25:74, 9:129** (translation keyword scan) | Content choice | — |
| 3d | Look at the **first live post** https://www.instagram.com/p/DeDusHzFoRe/ and say what to amend (delete it in the Instagram app if anything is wrong) | First public post | — |
| 4 | Send the **notes on the Reel** | Pending review feedback | Reel go-live |
| 5 | **Rotate tokens before go-live** — GO-LIVE CHECKLIST step 1 | Chat-exposed tokens must be treated as leaked | Go-live |
| 6 | Finish reading the Arabic reflection lines (treated as approved) | One-time approval | — |
| 7 | Apply for Quran.Foundation production API access | Quran.com v4 calls use the open endpoints today | Long-term API stability |
| 8 | Free space on the C: drive | General machine health | — |

### Needs Claude Code next, in priority order

1. ~~Explicit `ayahEnd`~~ **DONE 2026-10-03** (workflow input, `fetch_timeline.js`, n8n dispatch; soft cap 40 s flagged, hard cap 45 s fails the render). Three test Reels rendered and checked (see section 9).
2. ~~Reel list into the workflow~~ **DONE 2026-10-03** as the `Pick Reel` node (list embedded in the node, generated from `data/reel_list.json` by `scripts/make_n8n_code.js pick_reel`; `Config.USE_PICKER=false` bypasses it for manual tests). **Still to decide: the Reel trigger** (schedule node, time of day, `REEL_EVERY_N_DAYS`, default 1). The Reel workflow has only a Manual Trigger today and is INACTIVE.
2b. Keep `Pick Reel` and the Daily Post `Pick Ayah` rotation in sync: both embed the 68 + 8 rotation (`data/daily_rotation.json`); change one, change both and re-run the 160-day check before go-live (`node scripts/make_n8n_code.js pick_reel_test --raw` generates the test harness; run it in an n8n Code node, or locally with the `luxon` package providing `DateTime`).
2c. **First-word highlight timing** (observed in test 3, Minshawi 39:53): the API timestamp of the first word was ~0.4 s before the voice actually starts (voice onset about 620 ms vs word timing 200 ms), so the first gold word can appear slightly early for some reciters. Not a clipping problem. Possible fix: detect voice onset in the lead-in and start the first word there.
2d. Caption head: the Arabic ayah comes first, so for ayahs longer than ~100 characters Instagram's fold hides the reference line. `node scripts/preview_caption.js audit` lists all of them. Awaiting the user's decision (see "Needs the user" 3c).
3. **Before enabling any IG node** (only on the user's explicit say-so): add the `status_code = FINISHED` retry loop/If gate in both the Draft Approval and Reel workflows; decide whether Approve publishes immediately or at a scheduled time.
4. The Daily Post "Too Long - Needs Reel" branch is dead for the approved list; remove it or wire it to the Reel workflow if non-listed ayahs are ever used.
5. Once Quran.Foundation access is granted, swap the API calls over.

---

## 1. Project goal & account

**Account**: Instagram `@basaer.media.bh`. Bilingual (Arabic + English) Quran content — verses with translation, aimed at both Sunni and Shia audiences, so content and framing stay neutral/inclusive (no sect-specific wording, no sectarian symbols).

**Bio**: should NOT contain the word "Sadaqa" in the account name itself (it's fine inside caption CTAs, e.g. "Share it as Sadaqa Jariya" — just not in the profile name/bio headline). Bio includes a dedication line (exact wording not yet finalized — pending the user).

**Review mode**: for the first 5–7 days of going live, every post/Reel must be manually approved before publishing — this is why every Instagram publish node in both workflows is built but **disabled**, and why both workflows currently end at a Telegram review notification rather than an actual publish call.

---

## 2. Hard rules (never relax these without the user explicitly saying so)

- **Ayah text**: only ever sourced from the Quran.com API (or alquran.cloud as fallback) at render time. Never hand-typed, never guessed, never cached/edited by hand.
- **AI-authored text**: the only AI-written text anywhere in a caption is the one-line reflection, and it is written ONCE, approved by the user, and stored as a fixed list. At publish time the workflows only PICK from that list — they never call an AI. Everything else (ayah, translation, hashtags, credit) is API-sourced or fixed.
- **Dua**: there is no dua line in captions any more. Duas appear only as ayahs in the approved rotation (text from the API). Never AI-generated.
- **Integrity**: the Arabic/English text of every slide, caption and Reel must match a fresh API copy character for character; any difference voids the draft and alerts the owner (see section 4). Do not remove or bypass the guards, and keep the Reel `integrityTest` input empty.
- **Error alerts**: "Basaer - Reel Error Alerts" must stay ACTIVE (this n8n ignores inactive error workflows).
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

## 4. n8n workflows (Daily Post and Reel INACTIVE; Draft Approval, Reel Error Alerts and Instagram Token Monitor ACTIVE; all Instagram PUBLISH nodes DISABLED)

Schedule triggers: Daily Post (19:00 Bahrain) sits in an INACTIVE workflow, so it cannot fire; Instagram Token Monitor (09:00 and 21:00 Bahrain) is ACTIVE by design and only makes one read-only call. Draft Approval has a Telegram button trigger; Reel Error Alerts has an Error Trigger.

### Basaer - Daily Post (Quran Image) — id `0rDJEBadks8oiKiL`, INACTIVE, 21 nodes

`Schedule - Daily 7PM Bahrain` → `Config` (`QURAN_API_BASE`, `REVIEW_CHAT_ID`, `CYCLE_START_DATE`) → `Get Posted Ayahs History` → `Pick Ayah` → **`Before Start?`** (true: `Log Skip (before start)`; false: continue) → `Get Verse` → `Get Chapter` → `Build HTML` → `If Too Long For Carousel` (true branch `Too Long - Needs Reel` is effectively unused: every listed ayah is single-slide) → `Render via Gotenberg` → `Upload to Cloudinary` → `Build Caption` → **`Verify Text Integrity`** → **`Integrity OK?`** → true: `Save Draft` → `Telegram - Send Draft Image` → `Telegram - Send Caption + Approve/Reject`; false: `Save Void Draft` → `Telegram - Integrity Alert`. Error Workflow = "Basaer - Reel Error Alerts".

- **Pick Ayah** is a fixed, user-approved rotation (references only; text always comes from the Quran.com API): a 68-day cycle Saturday–Thursday (no surah on two consecutive days, no theme more than twice in a row, checked including the wrap-around) plus an 8-week Al-Kahf cycle on Fridays. Fridays do not consume a daily slot. Themes: Mercy, Patience, Gratitude, Dua, Trust, Family & forgiveness, Parents & departed, Friday. Day 0 = `Config.CYCLE_START_DATE` = **2026-10-10** (Saturday, yyyy-MM-dd, Bahrain time): 10-10 → 70:5, 10-11 → 28:24, 10-12 → 25:58, 10-13 → 42:28, 10-14 → 2:152, 10-15 → 29:60, **10-16 (Fri) → 18:1**, 10-17 → 57:9. **Before-start guard**: if today (Bahrain) is earlier than `CYCLE_START_DATE`, `Pick Ayah` emits a skip item and `Before Start?` routes it to `Log Skip (before start)` (a row in Basaer drafts, status `skipped: Before CYCLE_START_DATE ...`); nothing is fetched, rendered or sent to Telegram. `Config.ENFORCE_START_DATE=false` turns the guard off for deliberate manual tests (keep it `true`). If the date is blank/invalid, "today" counts as day 0 (test mode).
- **Build HTML**: single combined slide (1080×1350) in Scheherazade + Inter. English shown exactly as the API returns it (footnote markers removed only — no quote stripping, no added quotes). The ۞ marker is hidden on slides only. Fit-to-frame: binary search, Arabic floor 56px, English floor 26px; a red OVERFLOW bar appears if it still doesn't fit; Gotenberg waits for `window.__fitDone`. The end-of-ayah marker is glued to the last word with a non-breaking space; the footer has a spacing guard so the handle never touches the text above. It also records `rendered_arabic` / `rendered_english`, read back out of the final HTML, for the integrity guard.
- **Build Caption**: Arabic block, divider, English block, ONE credit line after both, 5–8 mixed Arabic/English hashtags. Reflection line is PICKED from the user-approved list (3 per theme, Arabic + English) by day index — **no AI call at publish time**. Two CTA lines (one SAVE + one SHARE, see section 7), rotated by post number (`post_number` from `Pick Ayah` = days since `CYCLE_START_DATE`; SAVE = n mod 3, SHARE = n mod 5, so consecutive posts never repeat either line). No dua line (removed by the user). ۞ hidden in captions too (display only). Caption length is checked against Instagram's 2,200 limit.
- **Draft flow (review mode)**: `Save Draft` writes a row to Data Table "Basaer drafts" (id `o2gqjZsMDJThOcWL`; columns draft_id, ayah_key, theme, posted_date, image_url, caption, status) with status `pending`. `draft_id` = `<date>_<ayah>_<execution id>`. The two Telegram nodes send the image, then the caption with ✅ Approve / ❌ Reject buttons (HTML parse mode, caption HTML-escaped — raw Markdown/entities broke the first attempt with "can't parse entities").
- The old "Log Posted Ayah" node moved into the approval workflow; the date-based rotation does not need posting history, so `Get Posted Ayahs History` is vestigial.

### Arabic integrity guard (after the corrupted-"Allah" bug)

Purpose: never send the user a draft, and never render a Reel, whose Arabic or English differs from the Quran.com API by even one character, or that contains corrupted characters.

- **Daily Post — `Verify Text Integrity` (Code node, after `Build Caption`)** re-fetches the ayah fresh from the API and compares, character by character: the Arabic and English text read back from the rendered slide HTML, the Arabic and English inside the caption, and the earlier `Get Verse` copy against the fresh copy. It also checks for U+FFFD, mojibake patterns, non-Arabic characters inside the Arabic, and the end-of-ayah number. The only differences it tolerates are the display-only ones: ۞ hidden, spaces before waqf marks turned into non-breaking spaces, the trailing ornament. On any difference: `Save Void Draft` (status `void: integrity check failed`, issues in the caption column), a Telegram alert with the ayah reference and the first differing position/code points, and **no draft is sent for approval**. The approval workflow ignores any draft whose status is not `pending`.
- **Reel, layer 1 — inside the GitHub render (`scripts/verify_text.js`)**: after every overlay's HTML is built and before any frame is drawn, the text in each overlay (read back from the HTML) and in the timeline is compared with a fresh API copy. Also an offline `--selftest` (8 corruption cases) runs at the start of every render. Failure → `out/integrity_report.json`, the job fails, and `scripts/notify_failure.js` + a workflow step POST the failure to n8n's `resumeUrl` so the waiting execution continues instead of hanging. n8n: `Render OK?` → `Build Render Failure Alert` → `Telegram - Render Failure Alert`.
- **Reel, layer 2 — n8n `Verify Text Integrity` + `Text OK?`** after `Build Caption`: the caption and the render payload are compared with a fresh API copy. Failure → `Telegram - Integrity Alert`, no review message.
- **What it cannot see**: pixels. A missing glyph (tofu) or clipped text in the drawn image is not detectable from the text; that is covered by the human review in Telegram, the OVERFLOW bar, and the fixes listed under Resolved.
- **Test hook (leave empty!)**: the Reel workflow input `integrityTest` / env `INTEGRITY_TEST_TAMPER` removes one diacritic from ayah 1 to prove the guard blocks. n8n's Config has `integrityTest` = "" and must stay empty.
- **Proven 2026-10-03**: Daily Post clean run (exec 40220: ok, 0 issues, draft sent) and tampered run (exec 40221: 4 issues, void row, alert, no draft). Reel render tampered (GitHub run 37136954534: blocked at the guard, no frame drawn) and through n8n (exec 40226: callback + alert, no caption built); clean (run 37137317936 / exec 40227: 15 overlays checked, passes); caption-only tamper (exec 40228: blocked, alert, no review message).

### Basaer - Draft Approval (Telegram) — id `1E3k34CoG6qn7ZTj`, **ACTIVE** (it must be on to hear button presses), 27 nodes

`Telegram Trigger (button press)` → `Parse Button (owner only)` → `Get Draft` → `Validate Press` → `Answer Button` (Telegram toast) → `Valid Press?` → `Approved?` → `Mark Approved/Rejected (only if still pending)` → Telegram confirmation.

**Publish path after ✅ Approve (checked 2026-10-04; every Instagram node DISABLED, Publish Switch = false):**
1. `Publish Switch (PUBLISH_ENABLED=false)` (Set): the hard switch.
2. `PUBLISH_ENABLED? (before container)`: false → `Publishing disabled (PUBLISH_ENABLED=false)` (NoOp; **this is where every Approve ends today**).
3. `Re-read Draft (before publishing)`: a fresh data-table read.
4. `Not published yet? (status = approved)`: the do-not-publish-twice guard; any other status → `Stopped - not published`.
5. `IG - Create Image Container (DISABLED)`: `POST graph.instagram.com/v25.0/17841414160930384/media`, form fields `image_url` and `caption` from `Get Draft`.
6. `Wait for Processing (DISABLED)`: 30 s.
7. `IG - Check Container Status (DISABLED)`: `GET /v25.0/{container id}?fields=status_code`.
8. `Container FINISHED?`: anything other than `FINISHED` → `Stopped - not published` (no retry; for an image 30 s has been enough).
9. `PUBLISH_ENABLED? (before publish)`: the second check of the switch.
10. `IG - Publish (DISABLED)`: `POST /v25.0/17841414160930384/media_publish` with `creation_id`.
11. `Publish returned a media id?`: must be numeric, else `Stopped - not published`.
12. `Mark Published (only if still approved)`: status → `published`, so the guard in step 4 refuses that draft forever after.
13. `Log Posted Ayah (DISABLED)`.

API version, endpoints, fields and the 30 s wait are the same as the one-off workflow that published the 94:6 post on 2026-10-03, and all three calls use credential "Basaer Media — Instagram Login token" (query auth `access_token`). A second ✅ press is also stopped earlier, by `Validate Press` (the draft must still be `pending`).

The do-not-publish-twice guard (step 4) can stop a draft for three different reasons:
- it was already published;
- it was rejected or voided in the meantime;
- `Mark Approved` did not update it.

Disabled HTTP nodes just pass data through, so with `PUBLISH_ENABLED=false` the chain never even reaches them.

Guards (all tested 2026-10-03):
1. **Owner only**: presses from any Telegram user id other than `8704731927` are dropped at `Parse Button` — no reply, no data-table access.
2. **Draft must exist, be `pending`, and be from today or yesterday (Bahrain)**: otherwise ignored with a toast ("Already approved/rejected – ignored", "Draft expired", "Draft not found").
3. **Conditional update** (draft_id AND status = pending): if two presses race, the second matches zero rows and nothing downstream runs.
Simulated edge cases: other account → dropped; Approve on a 3-day-old pending draft → "expired", status unchanged; second press on a handled draft → "Already rejected – ignored"; unknown draft id → "not found". Real presses: Approve on drafts …_40192, …_40210 and …_40212 → status `approved`, confirmation sent, nothing published.
Settings: Error Workflow = "Basaer - Reel Error Alerts".

### Basaer - Reel (Quran) — id `DDATobrIvVhVGmr0`, INACTIVE, 20 nodes (Schedule Sun/Tue/Thu/Sat 20:00 Bahrain + Manual Trigger; see "Done 2026-10-04" for the schedule and config keys)

`Manual Trigger (test)` → `Config` (surah/ayahStart/`ayahEnd`/reciterId/style/theme/dayIndex — manual-test values (112/1/blank/7/stars), used only when `USE_PICKER` = false; `USE_PICKER` = true; `REEL_EVERY_N_DAYS` = 1; reviewChatId `8704731927`; `igUserId` `17841414160930384`; `igApiBase`; `theme`/`dayIndex` for the reflection pick; `integrityTest` = ""; `CYCLE_START_DATE` = 2026-10-10; `ENFORCE_START_DATE` = true — set it to `false` to run manual test renders before the start date) → **`Before Start Guard`** → **`Before Start?`** (true: `Log Skip (before start)`) → **`Pick Reel`** (picks today's Reel from the approved 39-entry list; hard rule: never the same surah, hence never the same ayah, as that day's Daily Post; returns nothing on non-Reel days when `REEL_EVERY_N_DAYS` > 1) → `Dispatch Reel Render & Wait` (GitHub node with credential `Basaer - GitHub (render dispatch)`; workflow = `test-reel-general.yml` selected **by filename** — the "name" mode failed activation; `workflow_dispatch` + resumeUrl callback, no polling) → `Render OK?` → `Build Caption` (same approved template and reflection list as the Daily Post, no dua line, no AI; reads the pick from `Pick Reel`; theme aliases `Family & parents`→`Parents & departed`, `Friday (Al-Kahf)`→`Friday`; Faith/Unity use DRAFT lines; CTA says "this recitation") → `Verify Text Integrity` → `Text OK?` → `Send Review Notification` (Telegram, Basaer credential, HTML parse mode, escaped; caption + Reel URL + the four review stills: start, middle 1, middle 2, end) → `IG - Create Reel Container (DISABLED)` → `Wait for Processing (DISABLED)` → `IG - Check Container Status (DISABLED)` → `IG - Publish Reel (DISABLED)`. Failure branches: see "Arabic integrity guard". Error Workflow = "Basaer - Reel Error Alerts".

All four Instagram nodes are HTTP Request nodes on `graph.instagram.com/v25.0` using credential "Basaer Media — Instagram Login token", and are `disabled: true`. Endpoints (Meta "Instagram API with Instagram Login" content publishing): `POST /{igUserId}/media` (media_type=REELS, video_url, caption) → `GET /{containerId}?fields=status_code` → `POST /{igUserId}/media_publish` (creation_id). Before enabling: add a retry loop + If gate so publish only runs when `status_code` = `FINISHED`.

**Reel picker (`Pick Reel`, source `n8n/pick_reel.js`, generated into the node by `scripts/make_n8n_code.js pick_reel`)**: stateless. It simulates the schedule slot by slot from `CYCLE_START_DATE` (slot 0 = start date, one slot per `REEL_EVERY_N_DAYS`). Each slot takes the first unused list entry that (hard rule, user 2026-10-03) is **not from the same surah as that day's Daily Post** (the Daily Post of any date is computed with a copy of the `Pick Ayah` arithmetic, Fridays included) and (soft rules) not the same surah / reciter / background as the previous Reel; skipped entries stay in the list and are used later; after all 39 the cycle restarts. Output adds `reel_ref`, `daily_post_ref`, `skipped_for_daily_post_rule`, `dayIndex` (= slot number, drives the reflection and CTA rotation). Tests 2026-10-03: 160 simulated days from 2026-10-10 → 0 same-surah collisions with the Daily Post (7 days where the rule forced a skip, e.g. 2026-10-23 Daily Post 18:10 → 18:10-12 skipped, 93:6-11 used), 0 same-surah or same-reciter repeats in a row; a synthetic list proves the rule (day 1 Daily Post 70:5 → a leading 70:5-6 is skipped and used on day 2); and a real n8n run with a test start date (2026-09-05) picked 96:1-5 and skipped 16:78 because that day's Daily Post was 16:114.

### Basaer - Reel Error Alerts — id `oltrBGOHGXhdMXBY`, **ACTIVE** (required), 3 nodes

`Error Trigger` → `Build Alert` (HTML-escaped text: workflow, failed node, error, execution link, "Nothing was published.") → `Send Failure Notification` (Telegram, Basaer bot credential `blya0LlxCW6TePBT`, chat `8704731927` — the same chat as the review messages, chosen by the user). **It must be active: this n8n does not run an inactive Error Workflow** (proved: forced failure with it inactive → no alert; active → alert delivered). It has no schedule/webhook trigger, so it cannot fire by itself. Used as the Error Workflow of the Reel, Daily Post, Draft Approval and Instagram Token Monitor workflows. Because it shares the review chat, a Telegram outage would hide both reviews and alerts.

### Basaer - Instagram Token Monitor — id `BFKgkxQsL6ZaYjbP`, **ACTIVE** (by design), 5 nodes

`Schedule - 09:00 and 21:00 Bahrain` → `Config` (`TOKEN_EXPIRY_DATE` = 2026-12-01, `EXPECTED_IG_ID` = 17841414160930384, `ALERT_CHAT_ID` = 8704731927, `REMINDER_DAYS` = 14,7,3,1) → `IG Health Check (read-only)` (ONE `GET graph.instagram.com/v25.0/me?fields=user_id` through the Instagram credential; no retry; nothing is ever written) → `Evaluate` (Code) → `Telegram - Token Alert`. Workflow timezone Asia/Bahrain; Error Workflow = "Basaer - Reel Error Alerts".

It stays silent unless one of these happens, and it never changes any token:
- the health call fails or answers for a different account → "INSTAGRAM TOKEN HEALTH CHECK FAILED" with Meta's HTTP status/message/code (no token in it). Two checks a day (09:00 and 21:00) so a failure is reported the same day;
- the stored expiry is exactly 14, 7, 3 or 1 days away → "Instagram token expires in N days" (morning run only, token still working);
- the stored expiry date has passed but the token still works → "update TOKEN_EXPIRY_DATE" (every run until fixed);
- `TOKEN_EXPIRY_DATE` missing/invalid → config alert.

Tested 2026-10-03 (all alerts delivered, exact texts checked): normal run (silent), 14-day reminder, invalid token (Meta 190 relayed), stale expiry date. Not run: the "different account" branch (simple code path; the other three exercise the same alert/Telegram plumbing). The test trigger and test overrides were removed afterwards. Note: Meta's response header shows the API's current default version is v26.0; every call here uses an explicit `v25.0`, which still works. Revisit the version number in the Instagram nodes when v25 approaches deprecation.


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

## 6. Reciters (APPROVED 2026-10-03)

Source of truth: `data/reciters.json` (key = Quran.com audio API reciter id; the renderer refuses to render a reciter that is missing from it). Every Reel shows the reciter in **Arabic + English** under the surah line. Word-level timing data exists for all of them (checked on surahs 112, 93 and 18). One reciter (Khalifa at-Tunaiji) was excluded per the user; ID 1 (AbdulBaset, Mujawwad: very slow) is not in the rotation.

| ID | English display name | Arabic display name |
|---|---|---|
| 7 | Mishary Alafasy | مشاري راشد العفاسي |
| 2 | Abdul Basit Abdus-Samad | عبد الباسط عبد الصمد |
| 6 | Mahmoud Khalil Al-Husary | محمود خليل الحصري |
| 9 | Mohamed Siddiq Al-Minshawi | محمد صديق المنشاوي |
| 3 | Abdur-Rahman As-Sudais | عبدالرحمن السديس |
| 97 | Yasser Al-Dosari | ياسر الدوسري |
| 5 | Hani Ar-Rifai | هاني الرفاعي |
| 4 | Abu Bakr Al-Shatri | أبو بكر الشاطري (ending in ي, user's choice) |
| 10 | Saud Ash-Shuraim | سعود الشريم |

---

## 7. Caption template

Layout approved by the user 2026-10-04 (built in the Daily Post and Reel `Build Caption` nodes; preview with `node scripts/preview_caption.js daily 94:6`):

```
سورة <Arabic surah name> · <Eastern-Arabic ref> | Surah <English surah name> <ref>
﴿ Arabic ayah text (API) ﴾

<reflection line, Arabic - picked from the approved list, no AI call>

<SAVE line, Arabic>
<SHARE line, Arabic>

━━━━━━━━━━

<English translation exactly as the API returns it>

<same reflection line, English>

<SAVE line, English>
<SHARE line, English>

Text and recitation: Quran.com / Quran Foundation. Translation: <Config.TRANSLATION_NAME>.

<hashtags, Arabic + English mixed>
```

- **No dua line** in captions (removed by the user; the duas live in the ayah rotation itself).
- The ۞ marker is hidden in captions and on slides (display only; the stored text is unchanged).
- The reflection list is 3 lines per theme (Mercy, Patience, Gratitude, Dua, Trust, Family & forgiveness, Parents & departed, Friday), chosen by day index (also in `data/reflections.json`; Faith (1 line) and Unity (3 lines) are used by Reels only and were given verbatim by the user on 2026-10-04). It lives in the `Build Caption` code of both workflows (keep them in sync). They were written once by Claude and approved once by the user; nothing is generated at publish time.
- **CTA (changed by the user 2026-10-03; text in `data/cta.json`, verbatim from the user)**: TWO lines, one SAVE (3 variants) + one SHARE (5 variants), each Arabic in the Arabic block and English in the English block. Rotation by post number n (Daily Post: days since `CYCLE_START_DATE`; Reel: slot number): SAVE = n mod 3, SHARE = n mod 5, so two consecutive posts never repeat either line. Wording token `{THIS}`: Daily Post = "this ayah" / "هذه الآية", Reel = "this recitation" / "هذه التلاوة" (the same wording for one or several ayahs, because the Reel wording is already neutral; the Daily Post is always a single ayah). The old tag line is gone.
- **Length and visibility** (`node scripts/preview_caption.js audit`, 115 captions): longest possible caption 1,275 characters (limit 2,200). The reference line falls inside the first ~125 characters for only 35 of 115 captions because the Arabic ayah comes first; the beginning of the ayah is always visible.
- `scripts/preview_caption.js` mirrors the caption assembly for previews and audits and was cross-checked against the real n8n output (caption lengths 911 / 738 / 906 matched exactly).
- The credit line is fixed, appears ONCE after both language blocks, and is also written to `out/caption.txt` by the Reel pipeline.

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

**Audio**: lead-in logic — requests a 200 ms lead-in before the first word when the source has it; when the clip starts at the very beginning of the file it uses a 15 ms fade-in (it was 80 ms, which softened the first letter by up to ~19 dB). Since 2026-10-03 the cut points move to the **quietest 5 ms of the source** near each boundary (start: inside the lead-in; end: within the last 120 ms), everything outside is muted, with a 12 ms fade-in and a 30 ms fade-out, so recitations that run ayah into ayah (e.g. Hani Ar-Rifai) no longer start with the tail of the previous ayah or click. Muting never moves a word, so the highlight timings stay valid. Guards: the processed audio must not be silent (it was once, during development), and `render_stats.json` records a 20 ms peak-level envelope of the final file vs the source at both ends (`envelope`) plus `audioCut`.

**Test Reels from the approved list (2026-10-03, nothing published; `ENFORCE_START_DATE` was overridden only inside a temporary test node, the saved Config stayed `true`).** Render time = the GitHub Actions render step; n8n adds ~15-40 s of dispatch/upload. Stills: start, two middles (gold word), end.

| Test | Reel | Render | Size | Duration | Audio at the cut |
|---|---|---|---|---|---|
| 93:1-5, reciter 6 (Husary), gradient | run 37143647700 | 90.5 s | 1.16 MB | 33.1 s | Clip starts at the file start (silent until ~40 ms, then rises: final file equals the source from 40 ms on after the 15 ms fade); end cut at -80 dB (silence) |
| 3:200, reciter 5 (Hani Ar-Rifai), gradient | run 37143818959 | 37.5 s | 0.57 MB | 16.0 s | Continuous recitation (no pause in the source): previous ayah's tail muted up to 12 ms before the first word, word onset identical to the source (-17 dB); end 12 ms early at -29 dB with a 30 ms fade |
| 39:53, reciter 9 (Minshawi), stars (20 words, long ayah) | run 37144313857 | 76.2 s | 1.10 MB | 25.3 s | Both cuts in digital silence; speech starts ~620 ms (the API's first-word time is ~0.4 s early); end tail untouched |

Visual checks (stills downloaded and viewed): ق ل و bottoms intact, gold word on the right word in every still, reciter name Arabic + English visible, the 20-word ayah stays readable (3 Arabic lines + 4 English lines, nothing overlaps the reciter line or the handle). Reels draw **no end-of-ayah marker** (only the Daily Post slides do); the ayah reference is in the header.

**Bugs found and fixed this session** (chronological):
1. `generate_background.sh` using `geq` (per-pixel software filter) for gradient/rays — 4-5 minutes per 15s clip. Fixed: switched to pre-rendered SVG asset + FFmpeg crop-pan, same technique as the other styles. Render time dropped to 13-22s.
2. "stars" background rendering solid magenta instead of navy — `blend=all_mode=addition` pushing YUV chroma planes to extremes across the whole frame, not just at bright spots. First fix attempt (force `format=rgb24` around the blend) did NOT actually work — caught by downloading and viewing the re-rendered frame, still magenta. Real fix: dropped the blend filter entirely, switched to the same asset+pan technique as the other styles.
3. `generate_background.sh` losing its executable bit on a fresh checkout — fixed by invoking it via `bash script.sh` explicitly instead of relying on the execute permission.
4. Still-frame extraction loop silently losing data after the first iteration — ffmpeg reads stdin for keyboard control by default, stealing input from a `node ... | while read` pipe. Fixed with `-nostdin` on every ffmpeg invocation in CI.
5. A YAML indentation mistake (2 spaces instead of 12) inside a `run: |` block scalar silently broke parsing for an entire workflow file (GitHub showed the raw file path instead of the declared `name:`, and `workflow_dispatch` appeared unavailable). Fixed the indentation, then went further and extracted the fragile inline multi-line `node -e "..."` blocks into proper committed scripts (`pick_still_times.js`, `upload_cloudinary.js`) to remove the whole class of YAML/bash/JS nesting risk.
6. n8n GitHub node's `inputs` field (type `json`) needed a specific format: a JSON-looking string prefixed with `=` and containing embedded `{{ }}` expressions, not a whole-field `={{ object }}` expression. The validator's own error message gave the exact fix.
7. **The big one** — Arabic text rendering as broken/tofu glyphs on inconsistent words across different runs. Misdiagnosed twice as a font-loading timing issue (gating on `document.fonts.ready` + `--virtual-time-budget`, then fully self-hosting the fonts as embedded data) — both looked locally plausible but didn't fix it in the real pipeline, and self-hosting didn't fix it even in a from-scratch local test with zero network involved, which ruled out loading timing entirely. The actual cause: the auto-fit algorithm's ~70-step linear font-size-shrink loop was corrupting Arabic ligature shaping through rapid repeated DOM mutation. Fixed by switching to binary search (~8 mutations) with a forced reflow after each one. Verified with 5 identical local runs and a full pipeline run, byte-identical and correctly shaped every time.

8. **Reel text mismatch (2026-10-03)**: the API's per-word texts contain two small tajweed marks (U+06ED, U+06E2) that the verse-level text does not (63 of 148 planned ayahs). The integrity guard stopped the first test render ("word list does not reconstruct the verse text"). Now the Reel shows the verse-level form (identical to the Daily Post and captions): the two marks are removed from the display words and the guard compares in NFC. Verified on all 99 ayahs of the approved list; only 18:1 (a Friday Daily Post ayah, saktah mark U+06DC) would still differ and is not used in Reels.
9. **Silent Reel (found by the new audio guard)**: ffmpeg's output-side `-ss` leaves the filter clock at the absolute chapter position, so a time-based gain envelope muted everything. Fixed with input seeking (`-ss` before `-i`). The detector for the quiet cut point also had to ignore the MP3 decoder's seek warm-up (a few ms of false silence).
10. **Cover art in reciter MP3s** (e.g. reciter 97): ffmpeg tried to copy the attached picture into the audio file and failed with "Could not find tag for codec h264". Fixed with `-vn -map 0:a:0`; found by the extra picker test render with reciter 97.

The throughline worth remembering: **upload success and ffprobe/stats output are not sufficient verification for anything visual in this pipeline.** Every background style and every text-rendering fix in this list was confirmed only by actually downloading and looking at a rendered frame — several "fixes" that looked correct on paper (or even in an isolated local test) turned out not to be, and were only caught that way.

---

## Secrets

Nothing in this repo, nowhere in chat going forward, nowhere in any file Claude Code writes. All credentials live in n8n's credential store on the DigitalOcean droplet:

- `Basaer Media — Instagram Login token` (httpQueryAuth, id `qxx0V2sGYu8YXpZM`) — Instagram Login token (IGAA…), Name field `access_token`, works only on graph.instagram.com (not graph.facebook.com, and not with n8n's Facebook Graph API node). Expires Dec 1, 2026. Rotate before go-live.
- `Basaer Media — Telegram Bot (Basaermedia_bot)` (telegramApi, id `blya0LlxCW6TePBT`) — attached to every Basaer Telegram node. The credential was updated by the user at 14:50 UTC on 2026-10-03 (id unchanged), presumably with a fresh token entered directly in n8n — confirm the earlier chat-exposed bot token was revoked in @BotFather.
- `Basaer - GitHub (render dispatch)` (githubApi, id `ow7HoLJbFb5jaq19`) — fine-grained PAT, repo basaer-media-render only, Actions read/write, 90-day expiry from 2026-10-03. Attached to "Dispatch Reel Render & Wait"; verified working.
- The old `Basaer Media — Instagram Graph API` (facebookGraphApi, id `xbA6KXbSCE7hfo1C`) no longer exists.
