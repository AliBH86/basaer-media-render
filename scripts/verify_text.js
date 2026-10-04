// ARABIC / ENGLISH INTEGRITY GUARD for the Reel renderer.
//
// Compares, character by character, the text that is about to be DRAWN into every Reel overlay (read back from
// the generated overlay HTML files) with a FRESH, independent copy of the same ayahs from the Quran.com API,
// and scans for corrupted characters (U+FFFD, mojibake, non-Arabic characters inside the Arabic).
// It also checks ALIGNMENT: the drawn words must be exactly the API's words (same count), and every word must
// have a highlight timing, otherwise the gold highlight would land on the wrong word.
// Any difference fails the render BEFORE any frame is drawn or encoded.
//
// Usage:  node verify_text.js <timeline.json> <workDir> <outDir>     verify a render
//         node verify_text.js --selftest                              offline test of the checker itself
const https = require('https');
const fs = require('fs');
const path = require('path');

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8'); // decode once: never per chunk
        if (res.statusCode !== 200) return reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const HIZB = /\u06DE/g;
const strip = (t) => String(t).replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
const cp = (c) => (c === undefined ? 'end-of-text' : 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
const BAD = /\uFFFD|\u00C3|\u00C2|\u00D8|\u00D9|\u00DA|\u00DB|\u00E2\u20AC|\u00EF\u00BF\u00BD/;
const ARABIC_OK = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/;
// Display-only normalisation applied to BOTH sides: the hizb marker and the two per-word tajweed marks (U+06ED,
// U+06E2) that the API's verse-level text does not contain are hidden, spaces collapsed, canonical (NFC) mark order.
const ANNOTATIONS = new RegExp('[' + String.fromCharCode(0x06ED, 0x06E2) + ']', 'g');
const norm = (t) => String(t).replace(HIZB, '').replace(ANNOTATIONS, '').replace(/\s+/g, ' ').trim().normalize('NFC');

function same(issues, label, expected, actual) {
  if (typeof actual !== 'string' || actual.length === 0) { issues.push(`${label}: text is missing`); return; }
  if (expected === actual) return;
  let i = 0;
  const n = Math.max(expected.length, actual.length);
  while (i < n && expected[i] === actual[i]) i++;
  issues.push(`${label}: differs from the API at character ${i} (expected ${cp(expected[i])}, found ${cp(actual[i])}; length ${expected.length} vs ${actual.length})`);
}

function scan(issues, label, s, arabic) {
  if (typeof s !== 'string') return;
  if (s.includes('\uFFFD')) issues.push(`${label}: contains U+FFFD (corrupted character)`);
  else if (BAD.test(s)) issues.push(`${label}: looks like mojibake (wrongly decoded UTF-8)`);
  if (arabic) {
    const bad = [...s].filter((c) => !ARABIC_OK.test(c));
    if (bad.length) issues.push(`${label}: ${bad.length} non-Arabic character(s) inside the Arabic text (first: ${cp(bad[0])})`);
  }
}

// Reads the drawn text back out of an overlay HTML file (see buildOverlayHtml in render_reel.js).
function readOverlay(html) {
  const a = html.match(/<div class="arabic" id="arabic">([\s\S]*?)<\/div>/);
  const t = html.match(/<div class="translation"[^>]*>([\s\S]*?)<\/div>/);
  const words = a ? [...a[1].matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]) : [];
  return { words, translation: t ? t[1] : '' };
}

// Pure check of one overlay against the fresh API copy. fresh = { arabic, words, english }.
function checkOverlay(label, drawn, fresh, opts = {}) {
  const issues = [];
  const allWords = (fresh.words || fresh.arabic.trim().split(/\s+/)).map(norm);
  const wantWords = opts.from !== undefined ? allWords.slice(opts.from, opts.to + 1) : allWords;
  const drawnWords = drawn.words.map(norm);
  same(issues, `${label} Arabic`, wantWords.join(' '), drawnWords.join(' '));
  if (drawnWords.length !== wantWords.length) {
    issues.push(`${label} Arabic: ${drawn.words.length} drawn words but the API has ${wantWords.length} words (highlight would be misaligned)`);
  } else {
    const k = wantWords.findIndex((w, i) => w !== drawnWords[i]);
    if (k >= 0 && wantWords.join(' ') === drawnWords.join(' ')) issues.push(`${label} Arabic: word ${k + 1} is split differently from the API`);
  }
  scan(issues, `${label} Arabic`, drawn.words.join(' '), true);
  if (opts.hideEnglish) {
    // Khatm Arabic-only screen: the English must be absent (it is in the caption), never a shortened or altered copy.
    if (String(drawn.translation || '').trim() !== '') issues.push(`${label} English: expected no English on this screen, found text`);
  } else {
    same(issues, `${label} English`, fresh.english, drawn.translation);
    scan(issues, `${label} English`, drawn.translation, false);
  }
  return issues;
}

// Every word must have a highlight timing, and timings must point at real words.
function checkTimings(label, wordCount, wordTimings, from = 0, to = wordCount - 1) {
  const issues = [];
  const seen = new Set();
  for (const wt of wordTimings) {
    if (!(wt.wordIndex >= from && wt.wordIndex <= to && wt.wordIndex < wordCount)) issues.push(`${label}: a timing points at word ${wt.wordIndex + 1}, but there are only ${wordCount} words`);
    seen.add(wt.wordIndex);
  }
  for (let i = from; i <= to; i++) if (!seen.has(i)) { issues.push(`${label}: word ${i + 1} of ${wordCount} has no highlight timing`); break; }
  return issues;
}

async function freshAyah(surah, number, translationId = 20) {
  const r = await getJson(`https://api.quran.com/api/v4/verses/by_key/${surah}:${number}?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani&translations=${translationId}`);
  const v = r.verse;
  if (v.text_uthmani.includes('\uFFFD')) throw new Error(`API response for ${surah}:${number} itself contains U+FFFD`);
  const words = v.words.filter((w) => w.char_type_name === 'word').map((w) => norm(w.text_uthmani)).filter(Boolean);
  const issues = [];
  if (words.join(' ') !== norm(v.text_uthmani)) issues.push(`${surah}:${number}: the API's word list does not reconstruct the API's verse text`);
  return { arabic: v.text_uthmani, words, english: strip(v.translations[0].text), apiIssues: issues };
}

async function verifyRender(timelinePath, workDir, outDir) {
  const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
  const issues = [];
  const refs = [];
  let overlayIndex = 0;
  if (timeline.bismillah && timeline.bismillah.wordTimings) {
    // Bismillah screens (Khatm surah start): the API's 1:1 text, Arabic only, every word timed.
    const fresh = await freshAyah(1, 1, timeline.translationId || 20);
    issues.push(...fresh.apiIssues);
    issues.push(...checkOverlay('Bismillah (1:1) timeline', { words: timeline.bismillah.words, translation: '' }, fresh, { hideEnglish: true }));
    issues.push(...checkTimings('Bismillah (1:1)', fresh.words.length, timeline.bismillah.wordTimings));
    refs.push('Bismillah (1:1)');
    for (let w = 0; w < timeline.bismillah.wordTimings.length; w++) {
      const file = path.join(workDir, `overlay_${overlayIndex}.html`);
      overlayIndex++;
      if (!fs.existsSync(file)) { issues.push(`Bismillah: overlay file ${path.basename(file)} is missing`); continue; }
      issues.push(...checkOverlay(`Bismillah overlay ${overlayIndex - 1}`, readOverlay(fs.readFileSync(file, 'utf8')), fresh, { hideEnglish: true }));
    }
  }
  for (const ayah of timeline.ayahs) {
    const ref = `${timeline.surah}:${ayah.number}`;
    refs.push(ref);
    const fresh = await freshAyah(timeline.surah, ayah.number, timeline.translationId || 20);
    issues.push(...fresh.apiIssues);
    // The timeline data itself must equal the fresh copy too, and every word must have a highlight timing.
    issues.push(...checkOverlay(`${ref} timeline`, { words: ayah.arabicWords, translation: ayah.translation }, fresh));
    const [rFrom, rTo] = ayah.wordRange || [0, fresh.words.length - 1];
    issues.push(...checkTimings(ref, fresh.words.length, ayah.wordTimings, rFrom, rTo));
    const pages = ayah.pages || [[rFrom, rTo]];
    const hideEnglish = ayah.showTranslation === false;
    for (let w = 0; w < ayah.wordTimings.length; w++) {
      const file = path.join(workDir, `overlay_${overlayIndex}.html`);
      overlayIndex++;
      if (!fs.existsSync(file)) { issues.push(`${ref}: overlay file ${path.basename(file)} is missing`); continue; }
      const wi = ayah.wordTimings[w].wordIndex;
      const pg = pages.find(([a, b]) => wi >= a && wi <= b) || [rFrom, rTo];
      const found = checkOverlay(`${ref} overlay ${overlayIndex - 1}`, readOverlay(fs.readFileSync(file, 'utf8')), fresh, { from: pg[0], to: pg[1], hideEnglish });
      issues.push(...found);
      if (found.length) { // one broken overlay per ayah is enough; keep the running index in step with the files
        overlayIndex += ayah.wordTimings.length - w - 1;
        break;
      }
    }
  }
  const report = { ok: issues.length === 0, ayahs: refs, checkedOverlays: overlayIndex, issues, at: new Date().toISOString() };
  if (outDir) { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(path.join(outDir, 'integrity_report.json'), JSON.stringify(report, null, 2)); }
  return report;
}

// Offline self-test: every kind of corruption we care about must be reported, the clean case must not.
function selftest() {
  // Quran 112:1 as the API returns it, written as code points so this file stays pure ASCII.
  const w = ['\u0642\u064F\u0644\u0652', '\u0647\u064F\u0648\u064E', '\u0671\u0644\u0644\u0651\u064E\u0647\u064F', '\u0623\u064E\u062D\u064E\u062F\u064C'];
  const ar = w.join(' ');
  const fresh = { arabic: ar, words: w, english: 'Say, "He is All\u0101h, [who is] One,' };
  const drawn = (words, translation) => ({ words, translation });
  const clean = drawn(w.slice(), fresh.english);
  const cases = [
    ['clean text passes', clean, false],
    ['one dropped diacritic', drawn(ar.replace('\u064E', '').split(' '), fresh.english), true],
    ['U+FFFD inside the Arabic', drawn(ar.replace('\u0644\u0651\u064E', '\u0644\uFFFD\uFFFD').split(' '), fresh.english), true],
    ['U+FFFD inside the English', drawn(clean.words, fresh.english.replace('\u0101', '\uFFFD')), true],
    ['mojibake in the English', drawn(clean.words, fresh.english.replace('\u0101', '\u00C3\u00A4')), true],
    ['Latin letter inside the Arabic', drawn(ar.replace('\u0623', 'a').split(' '), fresh.english), true],
    ['a word missing', drawn(clean.words.slice(0, -1), fresh.english), true],
    ['English letter changed', drawn(clean.words, fresh.english.replace('One', 'Ond')), true],
    ['a word split in two (misaligned highlight)', drawn([w[0], w[1], '\u0671\u0644\u0644\u0651\u064E', '\u0647\u064F', w[3]], fresh.english), true],
  ];
  cases.push(['page of words 2-3 matches the slice', { ...drawn(w.slice(1, 3), fresh.english), opts: { from: 1, to: 2 } }, false]);
  cases.push(['page with a wrong word', { ...drawn([w[1], w[3]], fresh.english), opts: { from: 1, to: 2 } }, true]);
  cases.push(['Arabic-only screen without English', { ...drawn(w.slice(), ''), opts: { hideEnglish: true } }, false]);
  cases.push(['Arabic-only screen that still shows English', { ...drawn(w.slice(), fresh.english), opts: { hideEnglish: true } }, true]);
  let failed = 0;
  for (const [name, d, shouldFail] of cases) {
    const issues = checkOverlay('selftest', d, fresh, d.opts || {});
    const caught = issues.length > 0;
    const pass = caught === shouldFail;
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${caught ? '  -> ' + issues[0] : ''}`);
  }
  // timing coverage checks
  const t1 = checkTimings('selftest', 4, [0, 1, 2, 3].map((i) => ({ wordIndex: i })));
  const t2 = checkTimings('selftest', 4, [0, 1, 3].map((i) => ({ wordIndex: i })));
  const t3 = checkTimings('selftest', 4, [0, 1, 2, 3, 4].map((i) => ({ wordIndex: i })));
  for (const [name, issues, shouldFail] of [['all words timed', t1, false], ['a word without timing', t2, true], ['timing beyond the last word', t3, true]]) {
    const pass = (issues.length > 0) === shouldFail;
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${issues.length ? '  -> ' + issues[0] : ''}`);
  }
  if (failed) { console.error(`${failed} self-test case(s) failed`); process.exit(1); }
  console.log('integrity guard self-test: all cases behave correctly');
}

module.exports = { checkOverlay, checkTimings, readOverlay, verifyRender, selftest };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') selftest();
  else {
    verifyRender(args[0], args[1], args[2]).then((report) => {
      if (report.ok) { console.log(`Text integrity OK: ${report.ayahs.join(', ')} (${report.checkedOverlays} overlays checked against a fresh API copy)`); return; }
      console.error(`TEXT INTEGRITY CHECK FAILED for ${report.ayahs.join(', ')}:`);
      report.issues.forEach((i) => console.error(' - ' + i));
      process.exit(3);
    }).catch((e) => { console.error('Text integrity check could not run: ' + e.message); process.exit(4); });
  }
}
