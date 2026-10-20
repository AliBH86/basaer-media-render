# Morning report, Sunday 4 October 2026

**Safe:** nothing was published tonight. Daily Post and Reel are INACTIVE; active are only Draft Approval, Reel Error Alerts and Token Monitor; PUBLISH_ENABLED=false; no token or credential touched; nothing AH Brands; no files on your C: drive. (I stopped once at item 1 for the 2 Oct Reel; you confirmed it was yours.)

**Done (all 13 items; details in docs/OVERNIGHT_LOG.md):**
1. Instagram audit: the account has exactly 2 media (your Reel of 2 Oct, the 94:6 post of 4 Oct) and no stories.
2. PUBLISH_ENABLED=false gates before every container and publish step (Reel + Draft Approval; 9 Instagram nodes still disabled); "PUBLISH NOW" rule in CLAUDE.md.
3-5. Surah spellings Ad-Duha / Al-Anbiya / Ash-Shura / Aal 'Imran applied; 20:114, 25:74, 9:129 kept; Al-Kahf Reels re-tagged Dua / Reminder / Trust; 160-Reel simulation clean (no Friday Reel, no shared surah).
7. Daily Post QA, all 76 slides: integrity 76/76, no OVERFLOW (docs/QA_DAILY_2026-10-04.md).
8. Reel QA, 10 Reels + 2 re-tests: integrity 12/12, first gold word never before the voice (docs/QA_REELS_2026-10-04.md).
9-12. Prayer-time and hadith research (docs/RESEARCH_2026-10-04.md), docs/QF_APPLICATION.md, GO-LIVE READINESS table at the top of docs/HANDOFF.md.
Used: ~44 of 200 GitHub minutes; ~74 MB in Cloudinary qa-overnight.

**Bugs found and fixed:** (1) the sign ﷺ in the English of 57:9 and 18:1 showed as an empty box on the slide; the English now falls back to Scheherazade (verified). (2) Reels: a vowel mark of the first Arabic line touched the reciter line (40:9, 21:88); text area moved 36 px down (re-tested clean). (3) Sample cards: Aladhan rate-limited per-day calls; switched to the monthly endpoint.

**Problem / borderline slides** (all inside the frame, checked by eye):
| Slide | Arabic / English px | Spare | Note |
|---|---|---|---|
| 59:10 | 62 / 27 | 0 px | fits, but the first Arabic line sits close to the header |
| 39:10 | 65 / 28 | 8 px | tight |
| 57:9, 11:123, 20:114, 2:186, 31:12, 65:3, 40:8 | 70 / 30 | 33 px | fine, just under the 40 px "comfortable" mark |

**Links**
- Contact sheets: https://res.cloudinary.com/b72gfdzx/image/upload/qa-overnight/daily-sheet-01-37178258693.png (02 to 07: same address with the number changed)
- Samples: https://res.cloudinary.com/b72gfdzx/image/upload/qa-overnight/SAMPLE-prayer-daily.png · .../SAMPLE-prayer-weekly-sunni.png · .../SAMPLE-prayer-weekly-jafari.png (same folder)
- Reels: https://res.cloudinary.com/b72gfdzx/video/upload/qa-overnight/reel-37178412834.mp4 (18:10-12) · reel-37178567402 (113:1-5) · reel-37178701568 (97:1-5) · reel-37179768876 (40:8-9) · reel-37179905204 (21:87-88) · reel-37179078427 (49:13) · reel-37179227710 (18:46) · reel-37179332784 (42:25-26) · reel-37179454506 (14:7-8) · reel-37179609760 (18:23-24); all URLs and stills in docs/QA_REELS_2026-10-04.md

**Decisions needed (my recommended default in brackets):**
1. 59:10 slide spacing [keep; or I raise the fit reserve from 16 to 40 px, which shrinks the 2 tightest slides slightly].
2. Three draft "Reminder" lines for Reel 18:46 in data/reflections.json [approve them; until then it uses the Gratitude lines].
3. 42:26 ends with "severe punishment" [trim that Reel to 42:25 only].
4. Hadith series [only after written permission from Thaqalayn / the translators; pair Sunni + Shia narrations].
5. Prayer times [explicit coordinates, weekly fetch, "Calculated times"; compare one week with the official Bahrain tables first].

**Your morning to-do:** rotate the Instagram token, then set TOKEN_EXPIRY_DATE in the Token Monitor; delete `New folder/instagram App Graph Api token.txt`; listen to the first second of the 97:1-5 Reel; add your email to docs/QF_APPLICATION.md and send it; answer decisions 1-5; say when to activate Daily Post (before 10 Oct 19:00) and Reel (before 11 Oct 20:00).
