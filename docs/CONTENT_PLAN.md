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
