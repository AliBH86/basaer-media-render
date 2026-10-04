# Khatm series (sequential Quran Reels): plan, checks and open questions

Prepared on 2026-10-04 from the owner's "KHATM SERIES" decisions. This covers planning and test renders only.

- **Nothing publishes:** Reel publishing is not enabled anywhere.
- **The series does not start until the owner approves the pilot.** Until then the curated 06:30 Reel continues, review only.
- **The 39 curated Reels** stay in `data/reel_list.json` as a reserve for special days.

## 0. Reel ✅/❌ flow (priority, done 2026-10-04)

**Reel workflow**
- Every rendered Reel is saved as a `pending` row in Basaer drafts. Its draft id always contains `_reel_`, and `image_url` holds the MP4 URL.
- The review message has ✅ Approve / ❌ Reject buttons.
- The old Reel publish path is removed: 4 Instagram nodes and 2 gates. They sat directly after the review message, so enabling them would have posted every Reel without a press. They are kept in n8n version history.

**Draft Approval**
- The node `Reel draft?` sends Reel drafts to `Reel approved - Reel publishing OFF`. ✅ marks them `approved` and nothing else happens.
- The toast and message say "Reel publishing is OFF".
- Daily Post drafts continue to the publish chain as before.
- A Reel can't enter that chain. Even if one did, `Check Draft (Daily Post, approved)` refuses an MP4: Daily Post images only.

**Tests (2026-10-04)**
- A real Reel run through n8n (exec 40647, 112:1-4) saved a pending draft and sent the review message with buttons.
- The press logic, run through a temporary copy with no send and no publish, gave:
  - ✅ on a Reel draft: `approved`, Reel branch;
  - a second ✅: "Already approved – ignored";
  - ❌: `rejected`;
  - a 3-day-old draft: "expired";
  - a press from another Telegram account: dropped.
- The test rows and the temporary workflow were deleted afterwards.

## 1. Instagram Reel limits (Meta docs, read 2026-10-04)

| Item | Limit |
|---|---|
| Container | MOV or MP4, moov atom at the front, no edit lists |
| Video | H.264 or HEVC, progressive, closed GOP, 4:2:0 |
| Frame rate | 23–60 fps |
| Width | at most 1920 px; 9:16 recommended |
| Bitrate | video up to 25 Mbps VBR; audio AAC, up to 48 kHz, 1–2 channels, 128 kbps |
| Duration | 3 s to 15 min |
| File size | up to 300 MB |

Our Reels are 1080×1920, H.264 at 30 fps, AAC 128k, 12–90 s and about 3–6 MB, all inside these limits.

## 2. Reciters: coverage over all 114 surahs

Checked through the Quran.com audio API (chapter audio + word timings), for the 9 approved reciters:
- Every reciter has chapter audio for all 114 surahs, with timings for every ayah.
- **Word timings** are complete everywhere except a few ayahs where one word has no timing:

| Reciter | Ayahs with an untimed word | Complete surahs |
|---|---|---|
| Yasser Al-Dosari | 0 | 114 |
| Abdur-Rahman As-Sudais | 9 (6 surahs) | 108 |
| Mahmoud Khalil Al-Husary | 12 (9 surahs) | 105 |
| Saud Ash-Shuraim | 12 (10 surahs) | 104 |
| Mohamed Siddiq Al-Minshawi | 26 (11 surahs) | 103 |
| Abdul Basit Abdus-Samad | 159 (12 surahs) | 102 |
| Hani Ar-Rifai | 19 (15 surahs) | 99 |
| Mishary Alafasy | 28 (25 surahs) | 89 |
| Abu Bakr Al-Shatri | 108 (46 surahs) | 68 |

**Assignment rule:**
- One reciter per surah, never mixed inside a surah.
- Rotation order: Alafasy, Abdul Basit, Al-Husary, Al-Minshawi, As-Sudais, Al-Dosari, Ar-Rifai, Al-Shatri, Ash-Shuraim.
- A reciter is skipped for any surah where they lack complete word timings.
- Every surah found a complete reciter.

**Exact recheck:** see section 2b. The count-based check above can miss a word hidden behind a duplicated timing; 2:282 with As-Sudais was one.

**Safety net:** for any untimed word the renderer fills the highlight time from the neighbouring words (text is never touched), and logs a note. The text guard still requires every word to have a timing.

**Reciter per surah** (plan v2; reciter IDs in brackets). The rotation skips a reciter if:
- they lack complete word timings for that surah; or
- a long ayah in that surah can't be cut at a real pause in their recording (see section 7).

- **Mishary Alafasy (7), 10:** 1, 3, 32, 53, 62, 78, 87, 95, 104, 113
- **Abdul Basit Abdus-Samad (2), 13:** 12, 18, 24, 39, 47, 54, 63, 70, 79, 88, 96, 105, 114
- **Mahmoud Khalil Al-Husary (6), 13:** 6, 13, 19, 25, 33, 40, 55, 64, 71, 80, 89, 97, 106
- **Mohamed Siddiq Al-Minshawi (9), 12:** 7, 20, 26, 34, 41, 48, 56, 72, 81, 90, 98, 107
- **Abdur-Rahman As-Sudais (3), 14:** 8, 14, 21, 27, 35, 42, 49, 57, 65, 73, 82, 91, 99, 108
- **Yasser Al-Dosari (97), 14:** 9, 15, 22, 28, 36, 43, 50, 58, 66, 74, 83, 92, 100, 109
- **Hani Ar-Rifai (5), 14:** 4, 10, 16, 29, 37, 44, 51, 59, 67, 75, 84, 93, 101, 110
- **Abu Bakr Al-Shatri (4), 9:** 2, 30, 45, 60, 68, 76, 85, 102, 111
- **Saud Ash-Shuraim (10), 15:** 5, 11, 17, 23, 31, 38, 46, 52, 61, 69, 77, 86, 94, 103, 112

## 2b. Exact word-timing recheck for the assigned reciters

Checking each word *number* (not just the count of timing entries) for the reciter assigned to each surah finds **42 untimed words in 17 surahs**, out of about 77,000 words:
- 2 (12)
- 30 (4)
- 22 (3)
- 3, 4, 12, 13, 18, 42, 44, 59 and 73 (2 each)
- 16, 32, 45, 53 and 60 (1 each)

No reciter is perfect by this stricter test; even Al-Dosari misses words in 3:135 and 22:63.

These words keep their text and position. Only their highlight time is filled from the neighbouring words, and the render log names each one. In the 2:282 test, word 56 was filled this way and the highlight stayed in order.

The alternative, rotating to a different reciter per affected surah, would not remove the issue, because every reciter has some. Recommendation: keep the rotation and the filling, and list filled words in each review message.

## 3. Bismillah

**Finding:**
- The chapter files of all 9 approved reciters do not contain the Bismillah.
- In every file, the first word of ayah 1 is timed from about 0 ms and has its normal length. For example, "قُلْ" in 112:1 lasts 0.3–1.4 s, and 112:1 is preceded by a Bismillah when recited in full.
- Yasser Al-Dosari's files start with 3–7 s before ayah 1. The same lead appears in At-Tawbah (3.7 s), which has no Bismillah, so it isn't one. The renderer cuts at the first word, so it is never played.

**Handling (built and tested):**
- For a surah's first passage (not Al-Fatiha, where the Bismillah is ayah 1, and not At-Tawbah), the renderer takes **the same reciter's Bismillah from his Al-Fatiha file (1:1)**.
- It plays first, followed by a 0.45 s pause, then ayah 1.
- On screen it shows the API's 1:1 text with its own word timings. Only the surah name is shown in the header (no ayah number). No English.
- Because the audio really contains the Bismillah, the text is shown only where it is recited.
- If a reciter has no fully timed 1:1, no Bismillah is shown or played. All 9 have one.
- **At-Tawbah** starts directly with 9:1: no Bismillah text, no audio.

## 4. Sajdah ayahs

The API marks 14 ayahs:

| Ayah | Plan entry | Ayah | Plan entry |
|---|---|---|---|
| 7:206 | 7:203-206 | 27:26 | 27:25-30 |
| 13:15 | 13:14-15 | 32:15 | 32:13-15 |
| 16:50 | 16:50-53 | 38:24 | 38:24-26 |
| 17:109 | 17:107-111 | 41:38 | 41:37-39 |
| 19:58 | 19:58 (alone) | 53:62 | 53:54-62 |
| 22:18 | 22:18 (alone) | 84:21 | 84:16-25 |
| 25:60 | 25:59-61 | 96:19 | 96:11-19 |

**Schools differ:**
- The API does not mark 22:77, a sajdah in the Shafi'i and Hanbali count.
- The Ja'fari school has 4 obligatory sajdahs: 32:15, 41:37, 53:62 and 96:19.
- The API marks 41:38 where the Ja'fari count uses 41:37; both fall in the same Reel (41:37-39).

**On screen:**
- The sign ۩ is part of the ayah's last word in the API text, so it always appears inside the word.
- While that ayah is on screen, a small gold label appears under the reciter line: "۩ آية سجدة · Ayah of prostration". It is a fixed UI label, like "SURAH".

**Open:** label only the 14 API sajdahs, or also 22:77? Mention the school difference in the caption?

## 5. Quran.Foundation terms: what we may store (Developer Terms, read 2026-10-04)

The terms say:
- "Cache or store QF Content longer than 1 week" is not allowed, unless it comes through the Content Sync APIs with a re-sync at least every 7 days.
- "Incorporating QF Content into a social-media video is an end-user use, not redistribution, provided that the Developer credits Quran Foundation in a reasonably accessible place."
- "The text of the Quran is not modified in any way."
- "You may not arrange or display snippets in a way that alters or misrepresents the intended message."

**Our design:**
- `data/khatm_plan.json` holds only our own planning decisions: surah/ayah references, word ranges for split parts, part numbers, the reciter id, estimated seconds, and flags (Bismillah, sajdah, background). It holds no Quran text, translation or audio.
- The estimated seconds are derived from the API timings. If you'd rather keep no API-derived numbers at all, `scripts/khatm_build_plan.js` can rebuild the plan at any time from a fresh scan (about 15 minutes), for example once a week.
- Every render fetches text, translation, word timings and audio fresh from the API and discards them when the job ends. GitHub artifacts are kept 7 days, which is inside the 1-week limit.
- The published video and caption are the allowed social-media use. The caption keeps the credit line.
- Split ayahs are labelled "part n of N", and each part's caption carries the full English of the whole ayah, so a part never misrepresents the message.
- Splits happen only after stop signs, never after "لا" (do not stop); see section 7.

## 6. Translation scan: Saheeh International over the whole Quran

Scanned through the API on 2026-10-04; only counts and examples were kept.

**Brackets:**
- 3,409 of 6,236 verses contain bracketed additions (5,665 brackets in all). Most are short grammatical help such as "[who is]" or "[i.e., self]".
- 33 brackets are long (6 or more words), for example 2:22 "[that there is nothing similar to Him]" and 2:178 "[i.e., the deceased's heir or legal representative]".
- 19 verses have brackets naming a group of people, for example 2:105 "[i.e., the Jews and Christians]", 2:113 "[i.e., the polytheists]", 3:181 "[Jews]", 6:91 "[Jews]" and 5:103 "[such innovations as]". Abdel Haleem's translation has no such notes in these verses.

**Contested wording** (counts are matching verses; some are about people, not Allah):

| Topic | Verses | Example: Saheeh vs Abdel Haleem |
|---|---|---|
| Throne | 27 | 7:54 "established Himself **above** the Throne" vs "established Himself **on** the throne" |
| established / rose over | 6 | 10:3, same pattern as 7:54 |
| Face / Countenance | 33 | 2:115 "there is the Face of Allāh" vs "there is His Face"; 2:112 "submits his face [i.e., self]" vs "direct themselves wholly to God" |
| Hand(s) (incl. human hands) | 34 | Saheeh keeps "Hand" literally; Abdel Haleem sometimes renders it as power |
| Eye(s) | 5 | mostly human eyes (12:84, 15:15) |
| above / over | 49 | mostly ordinary uses (2:212 "above them on the Day") |
| Shin | 1 | 68:42 "the Day the shin will be uncovered" vs "the Day when matters become dire" |
| Allah "comes" | 6 | 2:210 "that Allāh should come to them in covers of clouds", rendered literally by both |

**Assessment:**
- Saheeh International leans to literal renderings of the divine attributes (Throne, Face, Hand, Shin) and adds interpretive brackets that name groups.
- Abdel Haleem is more neutral and readable, and adds no sectarian notes. He sometimes interprets as well ("matters become dire").
- **Your decision.** The translation is one config value (`TRANSLATION_ID`: 20 = Saheeh, 85 = Abdel Haleem), so switching means changing one value and re-running the guard.

## 7. The plan (`data/khatm_plan.json`)

**Summary**

| | |
|---|---|
| Reels | **1,718** (about 27.1 h of recitation) |
| Average length | **57 s** |
| 45–75 s | 1,611 |
| 25–45 s | 39 |
| 75–90 s | 63 |
| Under 25 s | 5 (below) |
| Shortest | 112:1-4 (12.5 s), 103:1-3 (15.5 s), 108:1-3 (16.8 s) |
| Longest | 6:93 (90 s), 22:5 (88.5 s), 6:151 (87.4 s) |
| Split ayahs | **7**, in 14 parts |
| At 1 Reel a day | about **4.7 years** |
| At 2 Reels a day | about **2.4 years** |

**Under 25 s:**
- 94, 103, 108 and 112: the whole surah is shorter than 25 s, and passages never cross surahs. These lengths include the Bismillah.
- 33:54 (17 s): it sits between the split ayah 33:53 and 33:55 (82 s); joining either would pass the 90 s cap.

All are above Instagram's 3 s minimum.

**Split ayahs: cut only where the reciter really pauses.**

The first test showed that a stop sign alone isn't enough. As-Sudais reads 2:282 straight through its waqf signs, so part 1 ended mid-sound and part 2 started mid-sound.

`scripts/khatm_split_pauses.js` (GitHub workflow `khatm-research.yml`) measures every word boundary of every long ayah in the reciter's own audio:
- A cut is allowed only where the voice drops at least 30 dB below the ayah's loudest moment for at least 60 ms. That is a real pause.
- Among those, a stop sign is preferred: ۘ / ۗ, then ۚ, then ۖ; never ۙ "do not stop" or ۜ.
- The reciter for a surah with a long ayah is the first one in the rotation whose recording allows this for every long ayah.

Measured for 2:282:
- Abdul Basit pauses deeply (down to −56 dB for 340 ms), and Al-Husary and Al-Shatri pause clearly.
- As-Sudais, Al-Dosari, Ar-Rifai and Ash-Shuraim read almost continuously (no boundary below −27 dB).
- Surah 2 therefore went to Al-Shatri.

Result: **all 7 split ayahs are cut at real pauses (0 cuts without a pause).**

**Repeated words:** reciters sometimes go back a few words and recite them again (waqf and ibtida'). The API timings record those repeats, and the renderer keeps them, so the gold highlight follows the voice back. One API entry that jumps impossibly far ahead (a "word 118" among words 30–40 of 2:282, Al-Shatri) is a data error and is dropped. A split part runs from the first recitation of its first word until the reciter moves past its last word.

| Ayah | Reciter | Total | Parts (words, seconds) |
|---|---|---|---|
| 2:282 | Abu Bakr Al-Shatri | 142 s | 1–72 (77 s), 73–128 (65 s) |
| 3:154 | Mishary Alafasy | 95 s | 1–28 (42 s), 29–75 (53 s) |
| 6:99 | Mahmoud Khalil Al-Husary | 115 s | 1–26 (69 s), 27–44 (46 s) |
| 24:31 | Abdul Basit Abdus-Samad | 103 s | 1–55 (76 s), 56–78 (27 s) |
| 33:37 | Mahmoud Khalil Al-Husary | 93 s | 1–25 (50 s), 26–48 (44 s) |
| 33:50 | Mahmoud Khalil Al-Husary | 126 s | 1–34 (75 s), 35–61 (51 s) |
| 33:53 | Mahmoud Khalil Al-Husary | 144 s | 1–38 (76 s), 39–69 (69 s) |

**On screen** (Khatm mode):
- An ayah of up to 24 words with English up to 300 characters is shown with its English, as today.
- A longer ayah, and every split part, is shown in **pages of up to 18 words**, Arabic only. Pages end after a stop sign where possible. The full English is in the caption.
- A word and its waqf sign never separate across lines (fixed 2026-10-04; also improves the curated Reels).

## 8. Caption (proposal, no reflection line)

```
ختمة بصائر · اليوم ١٢ | Basaer Khatm · Day 12
سورة البقرة · ٢:٢٨٢ (الجزء ١ من ٢) | Surah Al-Baqarah 2:282 (part 1 of 2)
﴿Arabic of this Reel﴾

💾 احفظه لوقتٍ تحتاجه
📤 أرسله لمن تظنّ أنه يحتاج هذه التلاوة اليوم.

━━━━━━━━━━

English of the full ayah(s)

💾 Save it for a moment you need it.
📤 Send it to someone you think needs this recitation today.

Text and recitation: Quran.com / Quran Foundation. Translation: Saheeh International.

#القرآن_الكريم #آية_اليوم #تدبر #صدقة_جارية #Quran #QuranVerses #QuranReflection
```

- "(الجزء ١ من ٢) / (part 1 of 2)" appears only on split ayahs.
- The save and share lines rotate as today, by day number.
- Optional extra hashtags for you to approve: #ختمة_القرآن #QuranKhatm.

**Length:**
- 20 of the 1,718 Reels would exceed 2,200 characters with this template; the longest is 2:282 part 1, at about 2,624.
- **Rule:** first drop the save/share lines. If it is still over, leave the Arabic block out of the caption, since it is on screen in full and exact.
- With that rule all 20 fit (the worst case drops to about 1,670).
- The English always stays complete and exact, and is never shortened.

## 9. Reliability: pre-render queue (proposal)

1. **Render ahead.** A nightly job (for example 02:00 Bahrain) renders the next unrendered plan entries until 3–7 days are ready. Each one is review-only, uses its own GitHub run, and runs one at a time.
2. **Hold for review.** Each ready Reel becomes a `pending` draft with the Reel URL and stills, keyed by its day number. Telegram shows each in advance with ✅/❌.
3. **Schedule from approved ones.** At 06:30 the series takes the lowest-numbered approved Reel. It never skips ahead: if day N is not approved, nothing goes out and you get one alert.
4. **Re-render, never retry-publish.** A failed render is retried by the nightly job (at most twice) and alerts you. A rejected Reel is re-rendered for you to look at again. Day numbers never change, so the series stays in order.
5. **Freshness.** A Reel is rendered at most 7 days before its day, which keeps within the 1-week caching rule.
6. **Storage.** Once publishing exists, the Cloudinary MP4 is deleted after Instagram confirms the post. Until then, review Reels older than 14 days are deleted.

## 10. Test Reels (review only)

TESTS_PLACEHOLDER

## 11. Open questions for the owner

1. **Pilot approval** (watch the six tests in section 10). When you approve, the series replaces the curated 06:30 Reel. Which date is Day 1?
2. **Translation** (section 6): keep Saheeh International, or switch the series (or everything) to Abdel Haleem?
3. **Caption wording** (section 8), the over-limit rule, and the optional hashtags.
4. **Sajdah:** label only the API's 14, or also 22:77? Add a school note?
5. **Bismillah:** the reciter's own 1:1 is played before each surah (section 3). Confirm.
6. **The five short Reels** under 25 s (section 7): OK as they are?
7. **Reel publishing:** stays off. When you want it, it will be built like the Daily Post (✅ on that Reel publishes it once), only after a written PUBLISH NOW for Reels.
