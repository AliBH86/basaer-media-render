// SERIES REEL (owner, 2026-10-11): one part of a long, owner-permitted recitation cut into daily Reels.
// First series: دعاء الصباح by علي حمادي (القرمزي للإنتاج الفني @qarmaziofc, permission 2026-10-11).
// Same look as the Khatm Reels (fonts, sizes, safe zones, gold word highlight, approved footage, rest screens so the
// screen is never empty in a pause); the header shows the series title and the part instead of a surah.
// Text: the owner's text, timed word by word by scripts/series_align.py (forced alignment). Exception: a passage that
// quotes the Quran (here Al Imran 3:26-27) is shown with the Quran.com API text (text_uthmani), inside ﴿ ﴾ with its
// reference, word for word against the recitation; the run fails if the API words do not line up 1:1.
// No music is added: the audio is the recording only.
//
// Usage: AUDIO_URL=... CHROME_BIN=... node scripts/render_series.js <series dir> <part> <outDir>
//   <series dir>/phrases.json (owner text), aligned.json (timings), plan.json (parts: phrase ranges)
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { amiriQuranBase64, montserratBase64 } = require('./font_data');

const REPO_ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const W = 1080, H = 1920, FPS = 30;
const SAFE_X = 65, SAFE_W = W - 2 * SAFE_X;
const ARABIC_MAX_WIDTH = Math.round(W * 0.8);
const PAGE_MAX_WORDS = 12;
const REST_HOLD_SEC = 0.6;
const LEAD_SEC = 0.35, TAIL_MAX_SEC = 1.2;
const handle = '@basaer.media.bh';
const EAST = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toEastern = (n) => String(n).split('').map((d) => (/[0-9]/.test(d) ? EAST[+d] : d)).join('');
const sh = (cmd) => { console.log('+ ' + cmd.slice(0, 260)); return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash', maxBuffer: 256 * 1024 * 1024 }).toString(); };
const getJson = (url) => new Promise((resolve, reject) => https.get(url, { headers: { 'User-Agent': 'basaer-media-render' } }, (res) => {
  const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(new Error(`${url} -> HTTP ${res.statusCode}`)); } });
}).on('error', reject));

function buildOverlayHtml({ titleAr, titleEn, sub, reciterAr, reciterEn, words, highlightIndex, progressFraction, quranRef }) {
  const spans = words.map((w, i) => {
    const color = i === highlightIndex ? '#C9A24B' : '#F2ECE1';
    const weight = i === highlightIndex ? '700' : '400';
    return `<span style="color:${color};font-weight:${weight};">${String(w).replace(/ /g, ' ')}</span>`;
  }).join(' ');
  const fillPct = Math.max(0, Math.min(1, progressFraction)) * 100;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @font-face { font-family:'Amiri Quran Local'; src:url(data:font/woff2;base64,${amiriQuranBase64}) format('woff2'); font-weight:400 700; }
  @font-face { font-family:'Montserrat Local'; src:url(data:font/woff2;base64,${montserratBase64}) format('woff2'); font-weight:100 900; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; background:transparent; font-family:'Amiri Quran Local', serif; position:relative; overflow:hidden; }
  .progress-track { position:absolute; top:290px; left:${SAFE_X}px; width:${SAFE_W}px; height:4px; background:rgba(242,236,225,0.18); border-radius:2px; }
  .progress-fill { position:absolute; top:290px; left:${SAFE_X}px; width:${fillPct * SAFE_W / 100}px; height:4px; background:#C9A24B; border-radius:2px; }
  .header { position:absolute; top:324px; width:100%; text-align:center; }
  .title-ar { font-family:'Amiri Quran Local',serif; font-size:38px; color:#C9A24B; }
  .title-en { font-family:'Montserrat Local',sans-serif; font-size:23px; color:#F2ECE1; opacity:0.8; margin-top:10px; letter-spacing:1px; }
  .reciter { display:flex; justify-content:center; align-items:baseline; gap:18px; direction:ltr; margin-top:14px; color:#F2ECE1; opacity:0.7; line-height:1.3; }
  .reciter-ar { font-family:'Amiri Quran Local',serif; font-size:34px; direction:rtl; }
  .reciter-sep { font-family:'Montserrat Local',sans-serif; font-size:26px; opacity:0.6; }
  .reciter-en { font-family:'Montserrat Local',sans-serif; font-size:28px; }
  .content { position:absolute; top:556px; height:604px; left:0; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .arabic { direction:rtl; text-align:center; max-width:${ARABIC_MAX_WIDTH}px; max-height:480px; overflow:visible; line-height:1.65; text-shadow:0 2px 18px rgba(0,0,0,0.55); }
  .qref { font-family:'Montserrat Local',sans-serif; font-size:24px; color:#C9A24B; margin-top:34px; letter-spacing:1px; }
  .qref-ar { font-family:'Amiri Quran Local',serif; font-size:30px; }
  .handle { position:absolute; top:1190px; width:100%; text-align:center; font-family:'Montserrat Local',sans-serif; font-size:28px; font-weight:600; color:#C9A24B; letter-spacing:1px; }
</style></head>
<body>
  <div class="progress-track"></div><div class="progress-fill"></div>
  <div class="header">
    <div class="title-ar">${titleAr}</div>
    <div class="title-en">${titleEn} &middot; ${sub}</div>
    <div class="reciter"><span class="reciter-ar">${reciterAr}</span><span class="reciter-sep">&middot;</span><span class="reciter-en">${reciterEn}</span></div>
  </div>
  <div class="content">
    <div class="arabic" id="arabic">${spans}</div>
    ${quranRef ? `<div class="qref"><span class="qref-ar">${quranRef.ar}</span> &middot; ${quranRef.en}</div>` : ''}
  </div>
  <div class="handle">${handle}</div>
  <script>
    function search(el, lo, hi, ok) { let best = lo; while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); el.style.fontSize = mid + 'px'; void el.offsetHeight; if (ok()) { best = mid; lo = mid + 1; } else { hi = mid - 1; } } el.style.fontSize = best + 'px'; void el.offsetHeight; }
    document.fonts.ready.then(() => {
      const ar = document.getElementById('arabic');
      search(ar, 46, 110, () => ar.scrollWidth <= ${ARABIC_MAX_WIDTH} && ar.scrollHeight <= ${quranRef ? 420 : 480});
      requestAnimationFrame(() => requestAnimationFrame(() => document.body.setAttribute('data-fonts-ready', '1')));
    });
  </script>
</body></html>`;
}

let chromeDir = null;
function renderPng(html, outPath) {
  const htmlPath = outPath.replace(/\.png$/, '.html');
  fs.writeFileSync(htmlPath, html);
  if (!chromeDir) chromeDir = fs.mkdtempSync('/tmp/chrome-profile-');
  sh(`"${CHROME}" --headless --disable-gpu --disable-software-rasterizer --hide-scrollbars --default-background-color=00000000 --window-size=${W},${H} --user-data-dir="${chromeDir}" --virtual-time-budget=1200 --screenshot="${outPath}" "file://${htmlPath}" 2>&1 | tail -1`);
}

async function main() {
  const [seriesDir, partArg, outDir] = process.argv.slice(2);
  const t0 = Date.now();
  const meta = JSON.parse(fs.readFileSync(path.join(seriesDir, 'phrases.json'), 'utf8'));
  const al = JSON.parse(fs.readFileSync(path.join(seriesDir, 'aligned.json'), 'utf8'));
  const plan = JSON.parse(fs.readFileSync(path.join(seriesDir, 'plan.json'), 'utf8'));
  const part = plan.parts.find((p) => p.part === Number(partArg));
  if (!part) throw new Error(`part ${partArg} is not in plan.json`);
  const parts = plan.parts.length;
  fs.mkdirSync(outDir, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'series-'));

  // 1. Words of this part (aligned timings), with the Quran passage replaced by the API words 1:1.
  const inPart = (w) => w.phrase >= part.from && w.phrase <= part.to;
  const words = al.words.map((w, k) => ({ ...w, k, show: w.w })).filter(inPart);
  const q = meta.quran;
  let quranWords = null;
  if (q && q.phrases && words.some((w) => w.phrase >= q.phrases[0] && w.phrase <= q.phrases[1])) {
    const api = [];
    for (const key of ['3:26', '3:27']) {
      const v = (await getJson(`https://api.quran.com/api/v4/verses/by_key/${key}?words=true&word_fields=text_uthmani`)).verse;
      api.push(...v.words.filter((x) => x.char_type_name === 'word').map((x) => ({ key, text: x.text_uthmani })));
    }
    const passage = al.words.filter((w) => w.phrase >= q.phrases[0] && w.phrase <= q.phrases[1]);
    const plain = (t) => t.replace(/[ً-ْٰـۖ-ۭ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, '');
    // The dua quotes 3:26 from "تُؤْتِى ٱلْمُلْكَ": find that word in the API list, then require a 1:1 match to the end of 3:27.
    const startIdx = api.findIndex((x, i) => plain(x.text) === plain(passage[0].w) && api[i + 1] && plain(api[i + 1].text) === plain(passage[1].w));
    const slice = startIdx >= 0 ? api.slice(startIdx) : [];
    if (slice.length !== passage.length) throw new Error(`Quran passage: ${passage.length} recited words, ${slice.length} API words from the start word (must match 1:1)`);
    const mism = passage.map((w, i) => [plain(w.w), plain(slice[i].text)]).filter(([a, b]) => a !== b && !(a.length > 2 && (a.includes(b) || b.includes(a))));
    if (mism.length > 2) throw new Error(`Quran passage: ${mism.length} words differ from the API (${mism.slice(0, 3).map((m) => m.join('≠')).join(', ')})`);
    quranWords = new Map(passage.map((w, i) => [w.phrase + ':' + al.words.indexOf(w), slice[i].text]));
    for (const w of words) {
      const t = quranWords.get(w.phrase + ':' + w.k);
      if (t) w.show = t, w.quran = true;
    }
    const qw = words.filter((w) => w.quran);
    if (qw.length) {
      const firstQ = al.words.findIndex((w) => w.phrase === q.phrases[0]);
      const lastQ = al.words.length - 1 - [...al.words].reverse().findIndex((w) => w.phrase === q.phrases[1]);
      if (qw[0].k === firstQ) qw[0].show = '﴿' + qw[0].show;
      if (qw[qw.length - 1].k === lastQ) qw[qw.length - 1].show = qw[qw.length - 1].show + '﴾';
    }
  }

  // 2. Clip window: a short lead-in before the first word, the reverb tail after the last (never into the next phrase).
  const first = words[0], last = words[words.length - 1];
  const prevEnd = al.words[first.k - 1] ? al.words[first.k - 1].end : 0;
  const nextStart = al.words[last.k + 1] ? al.words[last.k + 1].start : al.audioSec;
  const clipStart = Math.max(prevEnd + 0.05, first.start - LEAD_SEC, 0);
  const clipEnd = Math.min(nextStart - 0.08, last.end + TAIL_MAX_SEC, al.audioSec);
  const dur = +(clipEnd - clipStart).toFixed(3);
  const rel = (t) => +(t - clipStart).toFixed(3);
  const rec = path.join(work, 'rec.mp3');
  sh(`curl -sSL --fail -o "${rec}" "${process.env.AUDIO_URL}"`);
  const audio = path.join(work, 'clip.m4a');
  const fadeOut = Math.min(0.6, Math.max(0.15, clipEnd - last.end));
  sh(`ffmpeg -nostdin -loglevel error -y -ss ${clipStart.toFixed(3)} -t ${dur} -i "${rec}" -af "afade=t=in:d=0.08,afade=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}" -c:a aac -b:a 160k "${audio}"`);

  // 3. Pages: whole phrases, at most PAGE_MAX_WORDS words; the Quran passage never shares a page with dua text.
  const pages = [];
  let cur = null;
  for (let ph = part.from; ph <= part.to; ph++) {
    const pw = words.filter((w) => w.phrase === ph);
    const isQ = pw.some((w) => w.quran);
    if (!cur || cur.quran !== isQ || cur.words.length + pw.length > PAGE_MAX_WORDS) { cur = { quran: isQ, words: [] }; pages.push(cur); }
    cur.words.push(...pw);
  }
  const sub = `الجزء ${toEastern(part.part)} من ${toEastern(parts)} | PART ${part.part} OF ${parts}`;
  const specs = [];
  for (const pg of pages) {
    pg.words.forEach((w, i) => specs.push({ startSec: rel(w.start), endSec: rel(w.end), page: pg, highlightIndex: i }));
  }
  // Rest screens (never an empty screen, same rule as the Khatm Reels).
  const order = specs.map((s, i) => i).sort((a, b) => specs[a].startSec - specs[b].startSec);
  const rest = [];
  if (specs[order[0]].startSec > 0.001) rest.push({ ...specs[order[0]], startSec: 0, endSec: specs[order[0]].startSec, highlightIndex: -1 });
  for (let k = 0; k + 1 < order.length; k++) {
    const a = specs[order[k]], b = specs[order[k + 1]];
    if (b.startSec - a.endSec <= REST_HOLD_SEC) { a.endSec = Math.max(a.endSec, b.startSec); continue; }
    a.endSec += REST_HOLD_SEC;
    rest.push({ ...b, startSec: a.endSec, endSec: b.startSec, highlightIndex: -1 });
  }
  specs[order[order.length - 1]].persist = true;
  specs.push(...rest);

  // 4. Overlays.
  const qRef = { ar: 'آل عمران ٢٦–٢٧', en: "AAL 'IMRAN 3:26-27" };
  specs.forEach((s, i) => {
    s.png = path.join(work, `overlay_${i}.png`);
    renderPng(buildOverlayHtml({ titleAr: meta.title, titleEn: meta.titleEn || 'DUA AL-SABAH', sub, reciterAr: meta.reciter, reciterEn: meta.reciterEn || 'Ali Hamadi', words: s.page.words.map((w) => w.show), highlightIndex: s.highlightIndex, progressFraction: s.startSec / dur, quranRef: s.page.quran ? qRef : null }), s.png);
  });

  // 5. Footage background (approved library), shots cut on page starts.
  const bg = path.join(work, 'bg.mp4');
  const tlBg = path.join(work, 'timeline_bg.json');
  fs.writeFileSync(tlBg, JSON.stringify({ durationSec: dur, ayahs: pages.map((p) => ({ ayahStartMs: Math.max(0, rel(p.words[0].start)) * 1000 })) }));
  sh(`FOOTAGE_SEED=${7000 + part.part * 37} timeout 300 node "${path.join(REPO_ROOT, 'scripts', 'footage_background.js')}" "${tlBg}" "${bg}"`);

  // 6. Composite.
  const inputs = [`-i "${bg}"`, ...specs.map((s) => `-i "${s.png}"`), `-i "${audio}"`].join(' ');
  const lines = [];
  let prev = '0:v';
  specs.forEach((s, i) => {
    const out = i === specs.length - 1 ? 'vout' : `v${i}`;
    lines.push(`[${prev}][${i + 1}:v]overlay=enable='${s.persist ? `gte(t,${s.startSec})` : `between(t,${s.startSec},${s.endSec})`}'[${out}]`);
    prev = out;
  });
  const fscript = path.join(work, 'filter.txt');
  fs.writeFileSync(fscript, lines.join(';\n'));
  const outPath = path.join(outDir, `series_part_${part.part}.mp4`);
  sh(`ffmpeg -y -nostdin ${inputs} -filter_complex_script "${fscript}" -map "[vout]" -map ${specs.length + 1}:a -c:v libx264 -pix_fmt yuv420p -r ${FPS} -c:a aac -b:a 160k -shortest "${outPath}"`);

  const stats = { series: meta.title, part: part.part, parts, phrases: [part.from, part.to], clipStartSec: +clipStart.toFixed(3), clipEndSec: +clipEnd.toFixed(3), durationSec: dur, pages: pages.length, words: words.length, quranWords: words.filter((w) => w.quran).length, lowestWordScore: Math.min(...words.map((w) => w.score)), elapsedSec: (Date.now() - t0) / 1000 };
  fs.writeFileSync(path.join(outDir, 'render_stats.json'), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats));
}
main().catch((e) => { console.error(e); process.exit(1); });
