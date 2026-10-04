// Caption preview and length audit (read-only: calls the public Quran.com API, publishes nothing).
//
// This mirrors the caption assembly of the n8n 'Build Caption' nodes (Daily Post + Reel). It exists so captions can be
// shown for approval and checked in bulk; the n8n nodes stay the single source of truth, and this file is cross-checked
// against the real n8n output (the Reel test captions) whenever the caption layout changes.
//
// Usage:
//   node scripts/preview_caption.js daily 94:6          caption of the Daily Post that carries that ayah (first occurrence)
//   node scripts/preview_caption.js reel 112:1-4        caption of that Reel (first slot of the cycle in which it appears)
//   node scripts/preview_caption.js reel 93:1-5 --day 24 --theme Mercy     explicit slot / theme (as in a manual test)
//   node scripts/preview_caption.js audit               length + visible-head audit for every Daily Post and Reel
const https = require('https');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const root = path.join(__dirname, '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const mod = (n, m) => ((n % m) + m) % m;

const CTA = readJson('data/cta.json');
const REFL = readJson('data/reflections.json');
const ROT = readJson('data/daily_rotation.json');
const REEL = readJson('data/reel_list.json').list;
const REFLECTIONS = { ...REFL.approved, ...(REFL.draft || {}) };
const SURAH_NAMES = readJson('data/surah_names.json').approved;
const arName = (n, api) => (SURAH_NAMES[String(n)] || {}).ar || api;
const enName = (n, api) => (SURAH_NAMES[String(n)] || {}).en || api;
// Same as the Reel Build Caption node. 'Reminder' uses the approved Gratitude set until Reminder lines are approved.
const THEME_ALIAS = { 'Family & parents': 'Parents & departed', 'Friday (Al-Kahf)': 'Friday', 'Reminder': 'Gratitude' };
const TRANSLATION_ID = 20; // = n8n Config.TRANSLATION_ID
const CREDIT = 'Text and recitation: Quran.com / Quran Foundation. Translation: Saheeh International.';
const HASHTAGS = '#القرآن_الكريم #آية_اليوم #تدبر #صدقة_جارية #Quran #QuranVerses #QuranReflection';
const EASTERN = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toEastern = (n) => String(n).split('').map((d) => (/[0-9]/.test(d) ? EASTERN[+d] : d)).join('');
const clean = (t) => t.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
const strip = (t, chars) => [...t].filter((c) => !chars.includes(c)).join('');
const HIZB = String.fromCharCode(0x06DE);
const ANNOT = String.fromCharCode(0x06ED, 0x06E2);

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const chapterCache = {};
async function chapter(n) {
  if (!chapterCache[n]) chapterCache[n] = (await getJson(`https://api.quran.com/api/v4/chapters/${n}?language=en`)).chapter;
  return chapterCache[n];
}
const verseCache = {};
async function verse(key) {
  if (!verseCache[key]) verseCache[key] = (await getJson(`https://api.quran.com/api/v4/verses/by_key/${key}?words=true&word_fields=text_uthmani&fields=text_uthmani&translations=${TRANSLATION_ID}`)).verse;
  return verseCache[key];
}

// ---- Daily Post rotation, same arithmetic as 'Pick Ayah' ----
function pickAyahFor(date, start) {
  const span = Math.round(date.diff(start, 'days').days);
  let fridays = 0, others = 0;
  for (let i = 0; i < span; i++) { if (start.plus({ days: i }).weekday === 5) fridays++; else others++; }
  if (date.weekday === 5) return { key: ROT.friday[mod(fridays, ROT.friday.length)], theme: 'Friday', dayIndex: fridays, postNumber: span };
  const e = ROT.daily[mod(others, ROT.daily.length)];
  return { key: e[0], theme: e[1], dayIndex: others, postNumber: span };
}
const START = DateTime.fromISO('2026-10-10', { zone: 'Asia/Bahrain' }).startOf('day');
function firstDailySlot(key) {
  for (let i = 0; i < 400; i++) { const p = pickAyahFor(START.plus({ days: i }), START); if (p.key === key) return p; }
  throw new Error(`${key} is not in the Daily Post rotation`);
}

// ---- Reel schedule, straight from n8n/pick_reel.js (so the preview uses the very same picker) ----
function loadPicker() {
  const reel = REEL.map((e) => ({ ref: e.ref, surah: e.surah, ayahStart: e.ayahStart, ayahEnd: e.ayahEnd, theme: e.theme, reciterId: e.reciterId, style: e.style }));
  const src = fs.readFileSync(path.join(root, 'n8n/pick_reel.js'), 'utf8')
    .replace('__REEL_LIST__', JSON.stringify(reel)).replace('__DAILY__', JSON.stringify(ROT.daily)).replace('__FRIDAY__', JSON.stringify(ROT.friday))
    + '\nreturn { simulate, reelDates, parseWeekdays, LIST };';
  return new Function('DateTime', src)(DateTime);
}

function ctaFor(n, thisWording) {
  const save = CTA.save[mod(n, CTA.save.length)];
  const raw = CTA.share[mod(n, CTA.share.length)];
  return { save, share: { ar: raw.ar.replace('{THIS}', thisWording.ar), en: raw.en.replace('{THIS}', thisWording.en) } };
}

// Layout approved 2026-10-04: line 1 = bilingual reference; Arabic ayah; Arabic reflection; Arabic SAVE + SHARE;
// divider; English ayah; English reflection; English SAVE + SHARE; credit; hashtags. No reference lines inside the blocks.
function assemble({ arabic, refAr, english, refEn, reflection, save, share }) {
  const head = `${refAr} | ${refEn}`;
  const ar = [head, `﴿${arabic}﴾`, '', reflection.ar, '', save.ar, share.ar].join('\n');
  const en = [english, '', reflection.en, '', save.en, share.en].join('\n');
  const caption = `${ar}\n\n━━━━━━━━━━\n\n${en}\n\n${CREDIT}\n\n${HASHTAGS}`;
  // Instagram shows roughly the first 125 characters before '... more'.
  const headLen = head.length;
  return { caption, length: caption.length, headLen, referenceVisible: headLen <= 125 };
}

async function dailyCaption(key, opts = {}) {
  const slot = opts.slot || firstDailySlot(key);
  const v = await verse(key);
  const [s, a] = key.split(':').map(Number);
  const ch = await chapter(s);
  const lines = REFLECTIONS[slot.theme];
  const reflection = opts.reflection || lines[mod(slot.dayIndex, lines.length)];
  const { save, share } = ctaFor(slot.postNumber, CTA.wording.dailyPost);
  return { slot, ...assemble({
    arabic: strip(v.text_uthmani, HIZB).replace(/\s+/g, ' ').trim(),
    refAr: `سورة ${arName(s, ch.name_arabic)} · ${toEastern(s)}:${toEastern(a)}`,
    english: clean(v.translations[0].text), refEn: `Surah ${enName(s, ch.name_simple)} ${s}:${a}`, reflection, save, share,
  }) };
}

async function reelCaption(entry, opts = {}) {
  const s = entry.surah;
  let slot = opts.day, theme = opts.theme || entry.theme;
  if (slot === undefined) {
    const pk = loadPicker();
    const reelStart = DateTime.fromISO('2026-10-11', { zone: 'Asia/Bahrain' }).startOf('day');
    const sim = pk.simulate(START, pk.reelDates(reelStart, pk.parseWeekdays('7,2,4,6'), 400)).find((p) => p.entry.ref === entry.ref);
    slot = sim.slot;
  }
  const ch = await chapter(entry.surah);
  const words = []; const tr = [];
  for (let n = entry.ayahStart; n <= entry.ayahEnd; n++) {
    const v = await verse(`${entry.surah}:${n}`);
    words.push(v.words.filter((w) => w.char_type_name === 'word').map((w) => strip(w.text_uthmani, HIZB + ANNOT).replace(/\s+/g, ' ').trim()).filter(Boolean).join(' '));
    tr.push(clean(v.translations[0].text));
  }
  const lines = REFLECTIONS[THEME_ALIAS[theme] || theme];
  const reflection = lines[mod(slot, lines.length)];
  const { save, share } = ctaFor(slot, CTA.wording.reel);
  const multi = entry.ayahEnd > entry.ayahStart;
  return { slot, theme, ...assemble({
    arabic: strip(words.join(' ۝ '), HIZB).trim(),
    refAr: `سورة ${arName(s, ch.name_arabic)} · ${multi ? `${toEastern(entry.surah)}:${toEastern(entry.ayahStart)}-${toEastern(entry.ayahEnd)}` : `${toEastern(entry.surah)}:${toEastern(entry.ayahStart)}`}`,
    english: tr.join(' '), refEn: `Surah ${enName(s, ch.name_simple)} ${entry.surah}:${entry.ayahStart}${multi ? '-' + entry.ayahEnd : ''}`, reflection, save, share,
  }) };
}

function parseRef(ref) {
  const m = ref.match(/^(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`bad reference ${ref}`);
  return { surah: Number(m[1]), ayahStart: Number(m[2]), ayahEnd: Number(m[3] || m[2]) };
}

async function audit() {
  const rows = [];
  const keys = [...new Set([...ROT.daily.map((e) => e[0]), ...ROT.friday])];
  for (const key of keys) {
    const c = await dailyCaption(key);
    const lines = REFLECTIONS[c.slot.theme];
    const longR = lines.reduce((a, b) => (b.ar.length + b.en.length > a.ar.length + a.en.length ? b : a));
    const curR = lines[mod(c.slot.dayIndex, lines.length)];
    const sv = CTA.save.reduce((a, b) => (b.ar.length + b.en.length > a.ar.length + a.en.length ? b : a));
    const curSave = CTA.save[mod(c.slot.postNumber, 3)];
    const shares = CTA.share.map((x) => ({ ar: x.ar.replace('{THIS}', CTA.wording.dailyPost.ar), en: x.en.replace('{THIS}', CTA.wording.dailyPost.en) }));
    const sh = shares.reduce((a, b) => (b.ar.length + b.en.length > a.ar.length + a.en.length ? b : a));
    const curShare = shares[mod(c.slot.postNumber, 5)];
    const worst = c.length - (curR.ar.length + curR.en.length + curSave.ar.length + curSave.en.length + curShare.ar.length + curShare.en.length) + longR.ar.length + longR.en.length + sv.ar.length + sv.en.length + sh.ar.length + sh.en.length;
    rows.push({ kind: 'daily', ref: key, length: c.length, worst, headLen: c.headLen, refVisible: c.referenceVisible });
  }
  for (const e of REEL) {
    const c = await reelCaption(e);
    const lines = REFLECTIONS[THEME_ALIAS[e.theme] || e.theme];
    const longR = lines.reduce((a, b) => (b.ar.length + b.en.length > a.ar.length + a.en.length ? b : a));
    const curR = lines[mod(c.slot, lines.length)];
    const sv = CTA.save.reduce((a, b) => (b.ar.length + b.en.length > a.ar.length + a.en.length ? b : a));
    const curSave = CTA.save[mod(c.slot, 3)];
    const shares = CTA.share.map((x) => ({ ar: x.ar.replace('{THIS}', CTA.wording.reel.ar), en: x.en.replace('{THIS}', CTA.wording.reel.en) }));
    const sh = shares.reduce((a, b) => (b.ar.length + b.en.length > a.ar.length + a.en.length ? b : a));
    const curShare = shares[mod(c.slot, 5)];
    const worst = c.length - (curR.ar.length + curR.en.length + curSave.ar.length + curSave.en.length + curShare.ar.length + curShare.en.length) + longR.ar.length + longR.en.length + sv.ar.length + sv.en.length + sh.ar.length + sh.en.length;
    rows.push({ kind: 'reel', ref: e.ref, length: c.length, worst, headLen: c.headLen, refVisible: c.referenceVisible });
  }
  const maxWorst = rows.reduce((a, b) => (b.worst > a.worst ? b : a));
  const over = rows.filter((r) => r.worst >= 2200);
  const hidden = rows.filter((r) => !r.refVisible);
  console.log(`${rows.length} captions checked (${rows.filter((r) => r.kind === 'daily').length} Daily Post ayahs, ${rows.filter((r) => r.kind === 'reel').length} Reels).`);
  console.log(`Longest caption in the worst combination of reflection + SAVE + SHARE: ${maxWorst.worst} chars (${maxWorst.kind} ${maxWorst.ref}); limit 2200 -> ${over.length ? 'OVER: ' + over.map((r) => r.ref).join(', ') : 'all under the limit'}.`);
  console.log(`Longest as actually scheduled: ${Math.max(...rows.map((r) => r.length))} chars.`);
  console.log(`Reference line visible within the first 125 characters: ${rows.length - hidden.length} of ${rows.length}.`);
  console.log(`Reference line pushed below the fold (ayah text alone is longer than ~125 chars): ${hidden.length}`);
  hidden.sort((a, b) => a.headLen - b.headLen).forEach((r) => console.log(`  ${r.kind} ${r.ref}: ayah + reference = ${r.headLen} chars`));
}

(async () => {
  const [cmd, ref, ...rest] = process.argv.slice(2);
  const opt = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === 'audit') return audit();
  if (cmd === 'daily') { const c = await dailyCaption(ref); console.log(c.caption); console.log(`\n[${c.length} chars; reference line = ${c.headLen} chars, ${c.referenceVisible ? 'visible' : 'NOT visible'} before "more"; post number ${c.slot.postNumber}, theme ${c.slot.theme}]`); return; }
  if (cmd === 'reel') {
    const r = parseRef(ref);
    const entry = REEL.find((e) => e.surah === r.surah && e.ayahStart === r.ayahStart && e.ayahEnd === r.ayahEnd) || { ...r, ref, theme: opt('--theme') || 'Mercy' };
    const c = await reelCaption(entry, { day: opt('--day') !== undefined ? Number(opt('--day')) : undefined, theme: opt('--theme') });
    console.log(c.caption); console.log(`\n[${c.length} chars; reference line = ${c.headLen} chars, ${c.referenceVisible ? 'visible' : 'NOT visible'} before "more"; slot ${c.slot}, theme ${c.theme}]`); return;
  }
  console.error('usage: node scripts/preview_caption.js daily <s:a> | reel <s:a[-b]> [--day n --theme T] | audit');
  process.exit(2);
})().catch((e) => { console.error(e); process.exit(1); });
