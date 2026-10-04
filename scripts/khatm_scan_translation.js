// Khatm research: whole-Quran scan of Saheeh International (resource 20) vs Abdel Haleem (resource 85), plus sajdah ayahs.
// Keeps counts + a few short examples only (scan_translation.json); the full text is not stored.
const https = require('https');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(url, tries = 4) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'basaer-khatm-research' } }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(new Error(url + ' -> ' + res.statusCode)); } });
    }).on('error', reject);
  }).catch(async (e) => { if (tries > 1) { await sleep(3000); return getJson(url, tries - 1); } throw e; });
}
const strip = (t) => String(t).replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
async function chapterTexts(rid, ch) {
  const out = {};
  let page = 1;
  for (;;) {
    const r = await getJson(`https://api.quran.com/api/v4/verses/by_chapter/${ch}?translations=${rid}&fields=sajdah_number&per_page=50&page=${page}`);
    for (const v of r.verses) out[v.verse_key] = { t: strip(v.translations[0].text), sajdah: v.sajdah_number || null };
    if (!r.pagination.next_page) break; page = r.pagination.next_page;
  }
  return out;
}
// Topics the user named (+ close relatives). Word-boundary, case-insensitive.
const TOPICS = {
  Throne: /\bThrone\b/i,
  'Face / Countenance': /\b(Face|Countenance)\b/i,
  'Hand(s)': /\bHands?\b(?=[^.]*\b(Allah|Allāh|His|Our|My|God)\b)|\b(His|Our|My) Hands?\b/i,
  'Eye(s)': /\b(Our|His|My) Eyes?\b|\bbefore Our eyes\b/i,
  'above / over (Allah)': /\b(above|over) (them|His servants|the heavens)\b/i,
  'established / rose over (istawa)': /\b(established Himself|rose over|ascended to|istawa)\b/i,
  'Shin': /\bshin\b/i,
  'comes / descends (Allah)': /\byour Lord (comes|has come)\b|\bAllāh should come\b|\bAllah should come\b/i,
};
// Bracket notes that read as interpretation about people/groups (possible sectarian or contested readings).
const SENSITIVE_BRACKET = /\[[^\]]*(Jews|Christians|polytheists|hypocrites|Companions|wives of the Prophet|Abū Bakr|Abu Bakr|ʿAlī|Ali\b|Aishah|ʿĀ'ishah|household|Ahl|imam|caliph|innovat|shirk|saints|intercession)[^\]]*\]/i;
(async () => {
  const res = { saheeh: { verses: 0, withBrackets: 0, bracketNotes: 0, longBrackets: 0 }, topics: {}, sensitiveBrackets: { count: 0, examples: [] }, longBracketExamples: [], sajdah: [] };
  for (const k of Object.keys(TOPICS)) res.topics[k] = { saheehVerses: 0, examples: [] };
  for (let ch = 1; ch <= 114; ch++) {
    const sah = await chapterTexts(20, ch);
    const hal = await chapterTexts(85, ch);
    for (const [key, v] of Object.entries(sah)) {
      res.saheeh.verses++;
      if (v.sajdah) res.sajdah.push({ key, sajdah_number: v.sajdah });
      const br = v.t.match(/\[[^\]]*\]/g) || [];
      if (br.length) { res.saheeh.withBrackets++; res.saheeh.bracketNotes += br.length; }
      const longB = br.filter((b) => b.split(/\s+/).length >= 6);
      if (longB.length) { res.saheeh.longBrackets += longB.length; if (res.longBracketExamples.length < 12) res.longBracketExamples.push({ key, bracket: longB[0].slice(0, 160), abdelHaleem: (hal[key] || {}).t ? hal[key].t.slice(0, 220) : '' }); }
      const sens = br.filter((b) => SENSITIVE_BRACKET.test(b));
      if (sens.length) { res.sensitiveBrackets.count++; if (res.sensitiveBrackets.examples.length < 15) res.sensitiveBrackets.examples.push({ key, bracket: sens[0].slice(0, 160), abdelHaleem: (hal[key] || {}).t ? hal[key].t.slice(0, 220) : '' }); }
      for (const [name, re] of Object.entries(TOPICS)) {
        if (re.test(v.t)) {
          const T = res.topics[name]; T.saheehVerses++;
          if (T.examples.length < 4) T.examples.push({ key, saheeh: v.t.slice(0, 200), abdelHaleem: (hal[key] || {}).t ? hal[key].t.slice(0, 200) : '' });
        }
      }
    }
    process.stdout.write(`${ch} `);
    await sleep(100);
  }
  fs.writeFileSync(path.join(__dirname, 'scan_translation.json'), JSON.stringify(res, null, 1));
  console.log('\nDONE', JSON.stringify(res.saheeh), 'sensitive', res.sensitiveBrackets.count, 'sajdah', res.sajdah.length);
})().catch((e) => { console.error(e); process.exit(1); });
