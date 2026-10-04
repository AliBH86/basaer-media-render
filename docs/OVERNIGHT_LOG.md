# Overnight log (2026-10-04)

Rules (message 1): never publish / enable a publish node; do not activate Daily Post or Reel or any schedule; no tokens or credentials; nothing AH Brands; renders one at a time; GitHub Actions max 200 min; QA media only in Cloudinary folder `qa-overnight`; no Telegram until ONE silent summary at the end; STOP and write to the top of docs/MORNING_REPORT.md if anything unexpected happens; nothing on the C: drive.

Working copy: the private repo `AliBH86/basaer-media-render` (a clone in the session's temp folder). The folder on C: (`Basaer Media`, repo `AliBH86/Basaer-Media`, no commits) is not touched; run `git pull` on a clone of basaer-media-render to read these files.

Resume line: "Resume overnight tasks: read CLAUDE.md, docs/HANDOFF.md and docs/OVERNIGHT_LOG.md and continue from the first item not marked done."

| # | Item | Status | Notes / run IDs |
|---|---|---|---|
| 1 | List every Instagram publish/container call; confirm no other post/Reel/story | done | Account has exactly 2 media, 0 stories: Reel Dd__1FiCdrE (2026-10-02 17:16 UTC, made by the user, confirmed 2026-10-04) and image post DeDusHzFoRe (2026-10-04 04:02:47 UTC, media 18391121536165913, the one post the user asked for; 1 container create + 1 status check + 1 media_publish through a temporary workflow, deleted). No other container/publish call in this project; disabled IG nodes only pass data through (checked on Draft Approval runs 40426/40428). |
| 2 | PUBLISH_ENABLED=false IF gate before every IG publish step; CLAUDE.md "PUBLISH NOW" rule | done | Reel: Config.PUBLISH_ENABLED=false + gates before container and publish. Draft Approval (active): Set node Publish Switch + same two gates; false branch -> NoOp. All 9 IG nodes still disabled. Wiring verified. CLAUDE.md rule added. |
| 3 | English surah spellings (Ad-Duha, Al-Anbiya, Ash-Shura, Aal 'Imran) | done | data/surah_names.json approved; Daily Post Build HTML + Build Caption SURAH_NAMES maps updated; Reels read the data file. Checked with the caption preview. |
| 4 | Keep 20:114, 25:74, 9:129 | done | No change needed (they stay in the rotation). |
| 5 | Re-tag 18:10-12 / 18:46 / 18:23-24 to Dua / Reminder / Trust; re-run 160-day simulation | done | data/reel_list.json + docs/REEL_CONTENT_LIST.md + live Pick Reel list updated; no Friday theme left; no theme 3x in a row. Simulation: 160 Reels 2026-10-11..2027-07-17, 0 problems (no Friday Reel, no shared surah with the Daily Post, 4 forced skips). Reminder has no approved lines: uses the Gratitude set; 3 draft Reminder lines parked in data/reflections.json (proposed). |
| 6 | Token work | skipped (user rotates it) | |
| 7 | Daily Post QA: all 76 ayahs, contact sheets | done | Runs 37178063015 + 37178258693 (~5 min). 76/76 integrity ok, 0 OVERFLOW, Arabic 62-100 px, English 27-30 px. Bug found+fixed: salawat sign ﷺ rendered as a box (57:9, 18:1) -> English font fallback to Scheherazade (live node + repo copy). 9 borderline (tight but inside the frame; 59:10 has 0 px spare and the first Arabic line sits close to the header). Table: docs/QA_DAILY_2026-10-04.md. Cloudinary qa-overnight: 4.47 MB + 4.62 MB. |
| 8 | Reel QA: 10 Reels | done | 10 Reels + 2 re-tests, all integrity OK, first gold word never before the voice. Bug found+fixed: first Arabic line marks touched the reciter line (40:9, 21:88) -> text area 36 px lower; re-tests clean. docs/QA_REELS_2026-10-04.md. |
| 9 | Prayer times research + SAMPLE cards | done | docs/RESEARCH_2026-10-04.md; SAMPLE-prayer-daily / -weekly-sunni / -weekly-jafari in qa-overnight (run 37180085636; first try 37180027496 hit Aladhan rate limit -> monthly calendar endpoint). |
| 10 | Hadith (Thaqalayn) evaluation | done | docs/RESEARCH_2026-10-04.md: 39 books, fields, grading, terms (no licence published), 15 candidates, Sunni balance check (fawazahmed0/hadith-api). |
| 11 | docs/QF_APPLICATION.md | done | Ready to paste; [YOUR CONTACT EMAIL] placeholder. |
| 12 | Go-live readiness checklist in HANDOFF | done | New "GO-LIVE READINESS" table at the top of docs/HANDOFF.md (16 items, done/blocked), activation order, first-week routine, rollback. Privacy policy: not built (needs email). |
| 13 | docs/MORNING_REPORT.md + one silent Telegram message | todo | |

GitHub Actions minutes used tonight: ~44 (16 runs; budget 200). Cloudinary qa-overnight: ~74 MB (Reels 64.7 MB, Daily sheets/slides 9.1 MB, samples 0.4 MB).

Next step: item 13 (morning report + one silent Telegram message).
