// Daily Post QA (overnight 2026-10-04). Renders EVERY Daily Post ayah through the live slide code and reports
// fit, overflow and text integrity. Nothing is published, nothing touches n8n or the droplet.
//
// - The slide HTML comes from n8n/daily_build_html.js: a byte-exact copy of the live n8n 'Build HTML' node
//   (verified against the live node on 2026-10-04 by exact-match probes), run with the same inputs the
//   workflow gives it ('Pick Ayah', 'Get Verse', 'Get Chapter', 'Config').
// - Rendering: headless Chrome via puppeteer-core at 1080x1350, waiting for window.__fitDone like Gotenberg
//   does. (Production renders with Gotenberg's Chromium on the droplet; QA runs on GitHub so the shared
//   droplet's RAM is not touched.)
// - Integrity: the same checks as the slide part of the n8n 'Verify Text Integrity' node, against a SECOND,
//   independent API fetch: slide Arabic, end-of-ayah number, slide English, U+FFFD / mojibake / non-Arabic.
// - Output: out/qa/<n>-<key>.png per slide, contact sheets of 12 (qa-overnight on Cloudinary),
//   out/qa/daily_qa.json and out/qa/daily_qa.md.
//
// Usage: node scripts/qa_daily.js <outDir>
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const DRY = !!process.env.DRY; // DRY=1: build + integrity only, no browser (local check)
const puppeteer = DRY ? null : require('puppeteer-core');

const root = path.join(__dirname, '..');
const outDir = path.resolve(process.argv[2] || 'out/qa');
fs.mkdirSync(outDir, { recursive: true });
const API = 'https://api.quran.com/api/v4';
const TRANSLATION_ID = 20;
const NODE_CODE = fs.readFileSync(path.join(root, 'n8n/daily_build_html.js'), 'utf8');
const ROT = JSON.parse(fs.readFileSync(path.join(root, 'data/daily_rotation.json'), 'utf8'));

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

// Runs the live node code with the inputs the workflow would give it.
function runBuildHtml(pick, verse, chapter) {
  const nodes = {
    'Pick Ayah': { json: pick },
    'Get Verse': { json: { verse } },
    'Get Chapter': { json: { chapter } },
    'Config': { json: { TRANSLATION_NAME: 'Saheeh International' } },
  };
  const $ = (name) => ({ first: () => nodes[name] });
  return new Function('$', 'Buffer', NODE_CODE)($, Buffer);
}

// ---- integrity checks (same rules as the slide part of the n8n 'Verify Text Integrity' node) ----
const strip = (t) => String(t).replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
const HIZB = String.fromCharCode(0x06DE);
const hideHizb = (t) => String(t).split(HIZB).map((s, i) => (i ? s.replace(/^\s*/, '') : s)).join('').trim();
const unescapeHtml = (t) => String(t).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const EAST = [0x660, 0x661, 0x662, 0x663, 0x664, 0x665, 0x666, 0x667, 0x668, 0x669].map((c) => String.fromCharCode(c));
const toEastern = (n) => String(n).split('').map((d) => EAST[+d]).join('');
const NBSP = String.fromCharCode(0xA0);
const END = String.fromCharCode(0x06DD);
const cp = (c) => (c === undefined ? 'end-of-text' : 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
const BAD = new RegExp('[' + String.fromCharCode(0xFFFD, 0xC3, 0xC2) + ']|' + String.fromCharCode(0xE2, 0x20AC));
const ARABIC_OK = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿\s ]/;
function checkSlide(item, fresh, ayahNumber) {
  const issues = [];
  const same = (label, a, b) => {
    if (typeof b !== 'string' || !b.length) { issues.push(`${label}: missing`); return; }
    if (a === b) return;
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    issues.push(`${label}: differs at char ${i} (expected ${cp(a[i])}, found ${cp(b[i])})`);
  };
  const scan = (label, s, arabic) => {
    if (typeof s !== 'string') return;
    if (BAD.test(s)) issues.push(`${label}: corrupted/mojibake character`);
    if (arabic) { const bad = [...s].filter((c) => !ARABIC_OK.test(c)); if (bad.length) issues.push(`${label}: non-Arabic char ${cp(bad[0])}`); }
  };
  const wantAr = hideHizb(fresh.text_uthmani);
  const wantEn = strip(fresh.translations[0].text);
  const ar = String(item.rendered_arabic || '');
  const marker = NBSP + END;
  const at = ar.lastIndexOf(marker);
  if (at < 0) issues.push('Slide Arabic: end-of-ayah marker not found');
  else {
    same('Slide Arabic', wantAr, ar.slice(0, at).split(NBSP).join(' '));
    scan('Slide Arabic', ar.slice(0, at), true);
    const num = ar.slice(at + marker.length);
    if (num !== toEastern(ayahNumber)) issues.push(`Slide end-of-ayah number "${num}" (expected "${toEastern(ayahNumber)}")`);
  }
  same('Slide English', wantEn, unescapeHtml(item.rendered_english || ''));
  scan('Slide English', item.rendered_english, false);
  return issues;
}

function upload(file, publicId) {
  const resp = execSync(`curl -sS -X POST "https://api.cloudinary.com/v1_1/b72gfdzx/image/upload" -F "file=@${file}" -F "upload_preset=ml_default" -F "public_id=${publicId}"`, { shell: '/bin/bash', encoding: 'utf8' });
  const j = JSON.parse(resp);
  if (!j.secure_url) throw new Error(`upload failed for ${publicId}: ${JSON.stringify(j.error)}`);
  return { url: j.secure_url, bytes: j.bytes };
}

(async () => {
  const keys = [...ROT.daily.map((e) => ({ key: e[0], theme: e[1] })), ...ROT.friday.map((k) => ({ key: k, theme: 'Friday' }))];
  if (DRY) {
    let bad = 0, slides = 0;
    for (const { key, theme } of keys) {
      const [s, a] = key.split(':').map(Number);
      const verse = (await getJson(`${API}/verses/by_key/${key}?language=en&translations=${TRANSLATION_ID}&fields=text_uthmani`)).verse;
      const chapter = (await getJson(`${API}/chapters/${s}?language=en`)).chapter;
      const items = runBuildHtml({ ayah_key: key, surah_number: s, ayah_number: a, theme, single_slide: true }, verse, chapter);
      for (const it of items) { slides++; const iss = checkSlide(it.json, verse, a); if (iss.length) { bad++; console.log(key, iss); } }
    }
    console.log(`DRY: ${keys.length} ayahs, ${slides} slides, ${bad} integrity failures`);
    return;
  }
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350 });
  const rows = [];
  let n = 0;
  for (const { key, theme } of keys) {
    n++;
    const [s, a] = key.split(':').map(Number);
    const verse = (await getJson(`${API}/verses/by_key/${key}?language=en&translations=${TRANSLATION_ID}&fields=text_uthmani`)).verse;
    const chapter = (await getJson(`${API}/chapters/${s}?language=en`)).chapter;
    const fresh = (await getJson(`${API}/verses/by_key/${key}?language=en&translations=${TRANSLATION_ID}&fields=text_uthmani`)).verse;
    const pick = { ayah_key: key, surah_number: s, ayah_number: a, theme, single_slide: true };
    const items = runBuildHtml(pick, verse, chapter);
    if (items.length === 1 && items[0].json.tooLongForCarousel) { rows.push({ n, key, theme, error: items[0].json.reason }); continue; }
    items.forEach((it, idx) => {
      const html = Buffer.from(it.binary.data.data, 'base64').toString('utf8');
      fs.writeFileSync(path.join(outDir, `${String(n).padStart(2, '0')}-${key.replace(':', '_')}-${idx + 1}.html`), html);
    });
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const base = `${String(n).padStart(2, '0')}-${key.replace(':', '_')}-${idx + 1}`;
      const htmlPath = path.join(outDir, `${base}.html`);
      await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction('window.__fitDone === true', { timeout: 30000 });
      const m = await page.evaluate(() => {
        const g = (id) => document.getElementById(id);
        const a = g('a'), t = g('t'), mm = g('m'), c = g('c');
        const fs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
        const r = (el) => (el ? el.getBoundingClientRect() : null);
        const frame = document.querySelector('.frame').getBoundingClientRect();
        const ar = r(a);
        return {
          arabicPx: fs(a), englishPx: fs(t),
          arabicBasePx: a ? parseFloat((a.getAttribute('style') || '').replace(/[^0-9.]/g, '')) : null,
          spareFitPx: mm && c ? mm.clientHeight - 16 - c.offsetHeight : null,
          overflow: !!document.querySelector('.overflow-flag'),
          arabicInsideFrame: ar ? (ar.top >= frame.top && ar.bottom <= frame.bottom && ar.left >= frame.left && ar.right <= frame.right) : null,
          arabicLines: a ? Math.round(a.getBoundingClientRect().height / (parseFloat(getComputedStyle(a).fontSize) * 1.9)) : null,
          englishLines: t ? Math.round(t.getBoundingClientRect().height / (parseFloat(getComputedStyle(t).fontSize) * 1.6)) : null,
          fontsOk: document.fonts.check('40px Scheherazade') && document.fonts.check('30px Inter'),
        };
      });
      await page.screenshot({ path: path.join(outDir, `${base}.png`) });
      const issues = checkSlide(it.json, fresh, a);
      const borderline = [];
      if (m.overflow) borderline.push('OVERFLOW bar');
      if (m.arabicPx !== null && m.arabicPx <= 56) borderline.push('Arabic at floor 56px');
      if (m.englishPx !== null && m.englishPx <= 26) borderline.push('English at floor 26px');
      if (m.arabicPx !== null && m.arabicBasePx && m.arabicPx < m.arabicBasePx) borderline.push(`Arabic shrunk ${m.arabicBasePx}->${m.arabicPx}px`);
      if (m.englishPx !== null && m.englishPx < 30) borderline.push(`English shrunk 30->${m.englishPx}px`);
      if (m.spareFitPx !== null && m.spareFitPx < 40) borderline.push(`only ${m.spareFitPx}px spare`);
      if (!m.fontsOk) borderline.push('web fonts not loaded');
      rows.push({ n, key, theme, slide: idx + 1, slides: items.length, ...m, integrityOk: issues.length === 0, issues, borderline, png: `${base}.png` });
      console.log(`${String(n).padStart(2)} ${key.padEnd(7)} slide ${idx + 1}/${items.length} ar ${m.arabicPx}px en ${m.englishPx}px spare ${m.spareFitPx}px ${m.overflow ? 'OVERFLOW ' : ''}${issues.length ? 'INTEGRITY FAIL ' + issues[0] : 'integrity ok'}${borderline.length ? ' | ' + borderline.join(', ') : ''}`);
    }
  }

  // Contact sheets: 12 slides each (4 x 3), labelled, built in the same browser.
  const pngs = rows.filter((r) => r.png);
  const sheets = [];
  for (let i = 0; i < pngs.length; i += 12) {
    const group = pngs.slice(i, i + 12);
    const cells = group.map((r) => {
      const flag = !r.integrityOk ? '#ff4d4d' : (r.overflow ? '#ff4d4d' : (r.borderline.length ? '#ffb020' : '#4caf50'));
      const label = `${r.n}. ${r.key}${r.slides > 1 ? ` (${r.slide}/${r.slides})` : ''} · ar ${r.arabicPx}px · en ${r.englishPx}px · spare ${r.spareFitPx}px`;
      return `<div class="c"><img src="file://${path.join(outDir, r.png)}"><div class="l" style="border-color:${flag}">${label}${r.borderline.length ? '<br>' + r.borderline.join(', ') : ''}${r.integrityOk ? '' : '<br>INTEGRITY: ' + r.issues[0]}</div></div>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#1b1b1b;width:1600px;font:15px sans-serif;color:#eee}.g{display:grid;grid-template-columns:repeat(4,400px)}.c{padding:6px}img{width:388px;height:485px;display:block}.l{border-left:6px solid;padding:4px 6px;margin-top:4px;min-height:40px;background:#262626}h1{font-size:20px;margin:10px}</style></head><body><h1>Basaer Daily Post QA ${new Date().toISOString().slice(0, 10)} - sheet ${sheets.length + 1} (slides ${i + 1}-${i + group.length}) - green ok / amber borderline / red problem</h1><div class="g">${cells}</div></body></html>`;
    const sp = path.join(outDir, `sheet-${String(sheets.length + 1).padStart(2, '0')}.html`);
    fs.writeFileSync(sp, html);
    await page.setViewport({ width: 1600, height: 900 });
    await page.goto('file://' + sp, { waitUntil: 'load' });
    const png = sp.replace(/\.html$/, '.png');
    await page.screenshot({ path: png, fullPage: true });
    sheets.push(png);
  }
  await browser.close();

  // Upload contact sheets + every problem/borderline slide to qa-overnight.
  const run = process.env.GITHUB_RUN_ID || 'local';
  const uploads = { sheets: [], problemSlides: [], bytes: 0 };
  sheets.forEach((p, i) => { const u = upload(p, `qa-overnight/daily-sheet-${String(i + 1).padStart(2, '0')}-${run}`); uploads.sheets.push(u.url); uploads.bytes += u.bytes; });
  for (const r of rows.filter((x) => x.png && (!x.integrityOk || x.borderline.length))) {
    const u = upload(path.join(outDir, r.png), `qa-overnight/daily-${r.png.replace(/\.png$/, '')}-${run}`);
    r.url = u.url; uploads.problemSlides.push(u.url); uploads.bytes += u.bytes;
  }

  const fails = rows.filter((r) => r.error || !r.integrityOk || r.overflow);
  const border = rows.filter((r) => r.png && r.integrityOk && !r.overflow && r.borderline.length);
  const summary = {
    ayahs: keys.length, slides: rows.filter((r) => r.png).length,
    integrityFailures: rows.filter((r) => r.integrityOk === false).length,
    overflow: rows.filter((r) => r.overflow).length,
    borderline: border.length, errors: rows.filter((r) => r.error).length,
    arabicPxRange: [Math.min(...pngs.map((r) => r.arabicPx)), Math.max(...pngs.map((r) => r.arabicPx))],
    englishPxRange: [Math.min(...pngs.map((r) => r.englishPx)), Math.max(...pngs.map((r) => r.englishPx))],
    minSparePx: Math.min(...pngs.map((r) => r.spareFitPx)),
    uploadedBytes: uploads.bytes,
  };
  fs.writeFileSync(path.join(outDir, 'daily_qa.json'), JSON.stringify({ summary, uploads, rows }, null, 2));
  const md = [
    `# Daily Post QA ${new Date().toISOString()}`, '', '```', JSON.stringify(summary, null, 2), '```', '',
    'Contact sheets:', ...uploads.sheets.map((u) => `- ${u}`), '',
    '| # | Ayah | Slide | Arabic px | English px | Spare px | Problem / borderline | URL |', '|---|---|---|---|---|---|---|---|',
    ...[...fails, ...border].map((r) => `| ${r.n} | ${r.key} | ${r.slide || '-'} | ${r.arabicPx ?? '-'} | ${r.englishPx ?? '-'} | ${r.spareFitPx ?? '-'} | ${r.error || [...(r.issues || []), ...(r.borderline || [])].join('; ')} | ${r.url || ''} |`),
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'daily_qa.md'), md);
  console.log('\n' + md);
  if (summary.integrityFailures || summary.overflow || summary.errors) process.exitCode = 2;
})().catch((e) => { console.error(e); process.exit(1); });
