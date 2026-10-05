# Content plan — extending Basaer beyond the daily ayah

Status: PROPOSED, 2026-10-05. Nothing here is wired to a workflow. The owner asked
for content in the spirit of @masjidamna (short verses, adhkar, reminders, tadabbur,
educational posts) carried entirely in Basaer's own identity.

## The concept

Basaer is a daily, calm, verifiable reminder: one idea per post, every word traceable
to a source, nothing invented. Today one format does all the work — an ayah a day.
This plan widens the *kinds* of reminder without becoming a different account.

Governing rule: **if you removed the text, every post should be indistinguishable from
every other post.** New formats inherit the plate; only the header label and the middle
slot change.

## The identity they inherit (read from n8n/daily_build_html.js, not invented)

| | |
| --- | --- |
| Canvas | 1080x1350, ground `#0F2A3D` |
| Frame | 984x1254, inset 48px, 2px solid `#C9A24B`, square corners, padding 60/110 |
| Type | Scheherazade (Arabic) + Inter (Latin). Amiri Quran/Montserrat are Reels only |
| Ink | `#F5EDDC` primary, `#D9CFB8` secondary, `#8a9bab` tertiary, `#C9A24B` accent |
| Anatomy | gold ar label -> gold uppercase en label (2px tracking) -> centred Arabic -> 90x3 gold divider -> translation -> translator -> progress -> gold handle |
| Fit | binary-search auto-fit, 56px reserve, red OVERFLOW bar on failure |

**Document direction:** the root stays LTR; `direction:rtl` is set only on Arabic
elements. Setting `dir="rtl"` on `<html>` moves the English full stop and the `@` in
the handle to the wrong end. This was hit and fixed while drafting the template.

## Formats

### Live
| Format | Source |
| --- | --- |
| آية اليوم (daily 17:00) | Quran API |
| الجمعة — الكهف | Quran API |
| ختمة بصائر (Reel, daily 06:30) | Quran API + audio |

### Proposed — no new sourcing needed
| Format | Middle slot | Why it is safe |
| --- | --- | --- |
| **من أسماء الله الحسنى** | name at display size -> divider -> the ayah it occurs in -> meaning -> reference | Names appear verbatim in the Qur'an, so they verify against the API exactly like an ayah |
| **دعاء من القرآن** | a رَبَّنَا… dua -> divider -> translation | Qur'anic duas *are* ayahs; delivers the "dua" pillar with no new source |
| **تدبّر** | one short ayah, enlarged -> divider -> one reflection line | Same parts as the Daily Post, reweighted so the reflection carries the post |
| **ذكر / تسبيح** | the formula at display size -> divider -> English meaning | Short, invariant. No invented Arabic line underneath |

### Gated
| Format | Blocker |
| --- | --- |
| **حديث** | No verified source in the stack. Unblocked by either sunnah.com API access or a curated list carrying book + number on every entry. Long lead time — worth starting the application early even if the format ships later. |

## Decisions taken

1. **Start with أسماء الله الحسنى.** Zero sourcing risk, 99 entries is about two years of
   weekly content, it is naturally serialised (the existing `.progress` element becomes
   "٤٧ من ٩٩"), and it is visually distinctive while using the identical plate.
2. **Do not add a second daily post.** The account already publishes twice a day
   (Daily Post 17:00 + Khatm Reel 06:30). Every post needs the owner's approval, so
   volume costs review time. One strong weekly format beats three weak ones.
3. **Do not touch the approved daily rotation.** It is simulated over 400 days and
   carries hard rules (no surah twice running, Fridays always Al-Kahf). A new format
   gets its own slot and its own workflow instead.
4. **Hadith stays gated** until a verified source exists.

Proposed slot: one post per week, well separated from both existing slots. Evening
suits the audience and 17:00 is taken, so ~20:30 Asia/Bahrain. Owner to confirm the day.

## Guardrails that keep it off the Canva path

- One accent colour. Gold does the frame, label, divider and handle; nothing else.
- One rule per post. The 90x3 divider is the only ornament.
- No mosque silhouettes, lanterns or crescents. The identity is typographic; the frame
  is the motif.
- No glow, gradient bloom or centred radial light — the tell of an AI-generated look.
- No illustration unless original and geometric. The "no faces" rule already blocks the
  usual stock route.
- Hierarchy comes from size and colour only. No weight tricks, no outlines.

## Open for the owner

1. Confirm the weekly day for the new slot.
2. Approve or cut `data/dhikr.json` (proposed, `approved` is empty).
3. Say whether to start the hadith sourcing application now or leave it gated.

---

# Prayer times (AlAdhan) — findings and status

Added 2026-10-05. Owner asked for prayer times for both Sunni and Shia: one weekly post and
one daily post, for **Manama, Bahrain**, using aladhan.com.

## There is no Bahrain calculation method

The `method` parameter accepts **0-23 and 99**. The full list contains no Bahrain:
0 Jafari/Shia Ithna-Ashari, 1 Karachi, 2 ISNA, 3 MWL, 4 Umm Al-Qura, 5 Egypt, 7 Tehran,
8 Gulf Region, 9 Kuwait, 10 Qatar, 11 Singapore, 12 France, 13 Turkey, 14 Russia,
15 Moonsighting, 16 Dubai, 17 JAKIM, 18 Tunisia, 19 Algeria, 20 Indonesia, 21 Morocco,
22 Lisboa, 23 Jordan, 99 Custom. Verified against the OpenAPI spec and the PDF; "Bahrain"
appears in neither.

AlAdhan's own API description says: *"prayer timings might not always match your local mosque
or government authority. Their timings are likely tuned or adjusted."*

**Do not ship a guessed method.** A wrong method produces times that look entirely plausible
and are 5-15 minutes out, and people pray by them.

### How to resolve it

1. **Ask the API which authority it picks.** The spec: if `method` is omitted it "defaults to
   the closest authority based on the location". So one call for Manama with no `method`, then
   read `meta.method.id` / `meta.method.name` back, tells us what AlAdhan itself considers
   authoritative for Bahrain. This is also what aladhan.com/calendar/Manama/Bahrain displays.
2. **Calibrate against the official calendar** with `scripts/prayer_calibrate.js` (below).
3. If the offsets are stable use `tune`; if they drift seasonally the underlying angle differs
   and no fixed offset can work - use `method=99` with explicit angles.

The Ja'fari side is directly supported: **method 0**, with `midnightMode=1` for Ja'fari midnight.
Still worth checking against the local Ja'fari Waqf calendar.

## Other findings worth keeping

- **Holidays are free.** Every timings response carries `date.hijri.holidays[]`
  (e.g. "Beginning of the holy months"). Ashura, Ramadan and Eid need no extra endpoint.
- **`calendarMethod` defaults to `HJCoSA`** (High Judicial Council of Saudi Arabia). Options:
  HJCoSA, UAQ, DIYANET, MATHEMATICAL. This decides the Hijri date printed on every post, so it
  deserves a deliberate choice rather than the default.
- **Use `iso8601=true`**: returns `2026-10-05T17:04:00+03:00` instead of `17:04`, removing a
  class of timezone parsing bugs.
- **Fetch monthly**, not daily (`/calendar/{year}/{month}` or `/calendarByCity`), so an AlAdhan
  outage can never break a day's post.
- **Use coordinates, not a city string.** Manama = `26.2285, 50.5860`, with
  `timezonestring=Asia/Bahrain` pinned rather than inferred.
- **TRAP:** `tune` order is `Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight` -
  Maghrib comes BEFORE Sunset, the reverse of the order the day runs in. Getting it wrong
  silently shifts two prayers.

## Asma Al-Husna endpoint — affects the slide design

`GET /asmaAlHusna` returns per name:
`{ "name": "الرَّحْمَنُ", "transliteration": "Ar Rahmaan", "number": 1, "en": { "meaning": "The Beneficent" } }`

**English meaning only; there is no Arabic gloss.** The draft slide in
`docs/templates/asma-al-husna.html` carries an Arabic explanatory line that Claude wrote, which
breaks the rule that the only AI-authored text is the one-line reflection. The format must be
**Arabic name (AlAdhan) + the ayah where it occurs (Quran API) + English meaning (AlAdhan)** -
every line sourced. The ayah does the work the invented gloss was doing.

## Built

- `scripts/prayer_guard.js` - integrity guard. Checks presence, ordering
  (Imsak<Fajr<Sunrise<Dhuhr<Asr<Sunset<=Maghrib<Isha), plausible windows for Bahrain, collisions,
  requested-vs-returned date, and across methods that the Ja'fari Maghrib is later than the Sunni
  one (equal means the method-0 call silently fell back). `--selftest` covers 11 cases including a
  timezone shift and ISO 8601 input. All pass.
- `scripts/prayer_calibrate.js` - compares API times against the official calendar and reports the
  median offset and spread per prayer, then emits a ready `tune` string. A tight spread means tune
  works; a wide spread means the angle differs and tune can never be right. `--selftest` proves it
  detects an exact constant offset, catches a 1 min/day drift rather than averaging it away, and
  orders the tune string correctly. All pass.

## Blocked on the owner

1. **The official Bahrain calendar, Sunni and Ja'fari** - a link, PDF, or one week of times each.
   This is the ground truth to calibrate against.
2. Open https://aladhan.com/calendar/Manama/Bahrain and report the calculation method shown, or
   allow `api.aladhan.com` through the environment's network policy so Claude can read
   `meta.method` directly.

## Typography trap: never put a separator dot next to Arabic-Indic digits

Found while rendering the daily prayer slide. The date line was written as
`١٤٤٨ هـ &middot; ٥ أكتوبر ٢٠٢٦`. Under RTL reordering the middot lands immediately to the left
of the `٥`, and **Arabic-Indic zero `٠` is itself a dot**, so the rendered line reads
«٥٠ أكتوبر» - *fiftieth* of October. Caught only by looking at the frame; no code check sees it.

Fix used: Hijri and Gregorian on separate lines, no separator at all.

**Worth auditing the existing caption format for the same hazard** - caption line 1 is
«سورة الشرح · ٩٤:٦ | Surah Ash-Sharh 94:6», which places a middot next to Arabic-Indic digits.

## What the real AlAdhan export told us (owner's calendar.csv, Oct 2026)

**The method AlAdhan uses for Bahrain is Qatar (id 10), not a Bahrain method.**
`meta.method.params` = Fajr 18 degrees, **Isha = "90 min"**, anchored at Doha (25.2854, 51.5310).
`school` STANDARD (Shafi'i), `midnightMode` STANDARD, hijri method HJCoSA, all tune offsets 0.

Structural facts confirmed over all 31 days:
- **Maghrib == Sunset on 31/31 days** - a sunset-Maghrib (Sunni-type) method, as expected. The Ja'fari
  column still needs a separate export with `method=0`, where Maghrib must come out later.
- **Isha - Maghrib is exactly 90 minutes on every day.** This is a FIXED INTERVAL, not a solar angle.
  It therefore cannot track an angle-based official calendar through the seasons, and **no single `tune`
  offset will ever reconcile the two**. If Bahrain's official Isha is angle-based, method 99 with
  explicit angles is the only correct route. `prayer_calibrate.js` is built to expose exactly this.
- **Imsak = Fajr - 10 minutes**, constant.

### The metadata coordinates in the export are wrong

`meta.latitude` / `meta.longitude` read **8.8888888, 7.7777777** - that is in Nigeria, not Manama
(26.2285, 50.5860). The repeating digits look like placeholder values.

**The timings themselves are genuinely Bahrain's.** Verified independently by solar noon: for Manama's
longitude the predicted Dhuhr is 11:27, which matches the CSV to the minute; for the metadata
coordinates it would be 14:18. So the times are right and the coordinate fields are junk.

Consequence: **never echo coordinates back from a response, and never trust this export's meta block.**
Send explicit coordinates (26.2285, 50.5860) with `timezonestring=Asia/Bahrain`, and have the guard
assert the returned latitude is within a degree of Manama before anything is drawn.

### Holidays must be allowlisted, not published

An earlier note in this document called `date.hijri.holidays[]` "free value". That was too optimistic.
The October export returns, on 03-10-2026:

> `Urs of Shaykh Muhiyuddīn Ibn al-'Arabi`

a Sufi commemoration. AlAdhan's holiday list is broad and includes sect-specific observances. Publishing
it unfiltered would put commemorations on the account that conflict with the neutral, inclusive framing
in CLAUDE.md. **Only an owner-approved allowlist of holidays may ever reach a post.**

### Guard validated on real data

`scripts/prayer_guard.js` passes all 31 days of the real export with no false positives. The month is
committed as `tests/fixtures/aladhan-manama-2026-10-method10.json` so this stays a regression test.
