// YOUTUBE DESIGN SAMPLE (test/youtube branch only, 2026-10-13): one 16:9 sample of the full-surah layout for the owner's
// review, nothing here is wired into n8n or publishes anything. Renders: an intro card, the first SAMPLE_AYAHS ayahs with
// the word-by-word gold highlight, a short outro (end-screen layout), plus the thumbnail and stills.
// Text: Quran.com API only (words + Saheeh International), checked against a second fresh API copy before rendering.
// Audio: Quran.com recitation 8 (Mohamed Siddiq al-Minshawi, Mujawwad), one file per ayah from verses.quran.com, joined.
// Reciter photo: NOT used. The portrait ring is an empty placeholder until the owner approves a photo and its licence.
//
// Usage: CHROME_BIN=... SURAH=1 SAMPLE_AYAHS=2 node scripts/yt_sample.js <outDir>
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const { amiriQuranBase64, montserratBase64 } = require('./font_data');
const { checkOverlay, readOverlay } = require('./verify_text');

const OUT = path.resolve(process.argv[2] || 'out');
const SURAH = Number(process.env.SURAH || 1);
const SAMPLE_AYAHS = Number(process.env.SAMPLE_AYAHS || 2);
const RECITER = 8; // Quran.com: Mohamed Siddiq al-Minshawi, Mujawwad
const TRANSLATION_ID = 20; // Saheeh International
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const W = 1920, H = 1080, FPS = 30;
const OUTRO_SEC = 7;
const HANDLE = '@Basaermedia_bh';
const RECITER_AR = 'محمد صديق المنشاوي'; // data/reciters.json (approved display name)
const RECITER_EN = 'Mohamed Siddiq Al-Minshawi';
const STYLE_AR = 'مجوَّد', STYLE_EN = 'Mujawwad';
const GOLD = '#C9A24B', CREAM = '#F2ECE1';
const HIZB = String.fromCharCode(0x06DE), ANNOT = String.fromCharCode(0x06ED, 0x06E2);

fs.mkdirSync(OUT, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-sample-'));
const sh = (cmd) => { console.log('+ ' + cmd.slice(0, 300)); return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash' }).toString(); };
const arNum = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        if (data.includes('�')) return reject(new Error(`${url} -> contains U+FFFD, refusing to render`));
        resolve(JSON.parse(data));
      });
    }).on('error', reject);
  });
}

const fontCss = `
  @font-face { font-family:'AQ'; src:url(data:font/woff2;base64,${amiriQuranBase64}) format('woff2'); font-weight:400 700; }
  @font-face { font-family:'MS'; src:url(data:font/woff2;base64,${montserratBase64}) format('woff2'); font-weight:100 900; }
  * { margin:0; padding:0; box-sizing:border-box; }`;

function shot(html, outPng, w = W, h = H, transparent = true) {
  const p = outPng.replace(/\.png$/, '.html');
  fs.writeFileSync(p, html);
  const prof = path.join(work, 'chrome');
  sh(`"${CHROME}" --headless --disable-gpu --disable-software-rasterizer --hide-scrollbars ${transparent ? '--default-background-color=00000000' : ''} --window-size=${w},${h} --user-data-dir="${prof}" --virtual-time-budget=1500 --screenshot="${outPng}" "file://${p}" 2>&1 | tail -2`);
}

// Empty portrait slot: a gold ring only. A real photo goes here only after the owner approves it (source + licence).
const portrait = (size) => `<div style="width:${size}px;height:${size}px;border-radius:50%;border:${Math.max(2, size / 40)}px solid ${GOLD};background:radial-gradient(circle at 50% 40%, rgba(242,236,225,0.10), rgba(11,31,42,0.65));display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 ${size / 18}px rgba(201,162,75,0.12);"><span style="font-family:'MS';font-size:${Math.round(size / 9)}px;color:${CREAM};opacity:0.45;letter-spacing:1px;text-align:center;line-height:1.3;">reciter<br>photo</span></div>`;

// ---------- background: navy radial + a faint geometric lattice, rendered once, slowly drifted by ffmpeg ----------
function backgroundHtml(w, h) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${w}px; height:${h}px; overflow:hidden; background:radial-gradient(ellipse at 50% 42%, #16384D 0%, #0F2A3D 38%, #0A1C27 75%, #061219 100%); }
  svg { position:absolute; inset:0; }
  </style></head><body>
  <svg width="${w}" height="${h}"><defs>
    <pattern id="p" width="120" height="120" patternUnits="userSpaceOnUse">
      <path d="M60 0 L120 60 L60 120 L0 60 Z" fill="none" stroke="${GOLD}" stroke-width="1"/>
      <circle cx="60" cy="60" r="26" fill="none" stroke="${GOLD}" stroke-width="0.8"/>
      <circle cx="0" cy="0" r="3" fill="${GOLD}"/><circle cx="120" cy="0" r="3" fill="${GOLD}"/>
      <circle cx="0" cy="120" r="3" fill="${GOLD}"/><circle cx="120" cy="120" r="3" fill="${GOLD}"/>
    </pattern>
    <radialGradient id="fade" cx="50%" cy="45%" r="65%"><stop offset="0%" stop-color="#fff" stop-opacity="0.02"/><stop offset="100%" stop-color="#fff" stop-opacity="0.11"/></radialGradient>
    <mask id="m"><rect width="100%" height="100%" fill="url(#fade)"/></mask>
  </defs><rect width="100%" height="100%" fill="url(#p)" mask="url(#m)"/></svg>
  </body></html>`;
}

// ---------- ayah screen overlay (transparent) ----------
function ayahHtml({ words, hi, english, surahAr, surahEn, surahMeaning, ayahNo, total }) {
  const spans = words.map((w, i) => `<span style="color:${i === hi ? GOLD : CREAM};">${w.replace(/ /g, ' ')}</span>`).join(' ');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${W}px; height:${H}px; overflow:hidden; background:transparent; position:relative; color:${CREAM}; }
  .brand { position:absolute; top:52px; left:72px; display:flex; align-items:baseline; gap:16px; }
  .brand-ar { font-family:'AQ'; font-size:44px; color:${GOLD}; line-height:1; }
  .brand-en { font-family:'MS'; font-size:15px; letter-spacing:6px; opacity:0.6; font-weight:600; }
  .cart { position:absolute; top:40px; right:72px; border:1.5px solid rgba(201,162,75,0.75); border-radius:40px; padding:6px 34px 14px; text-align:center; background:rgba(6,18,25,0.35); }
  .cart-ar { font-family:'AQ'; font-size:36px; color:${GOLD}; line-height:1.9; direction:rtl; margin-top:-14px; }
  .cart-en { font-family:'MS'; font-size:14px; letter-spacing:3px; opacity:0.75; font-weight:600; margin-top:-2px; }
  .rule { position:absolute; top:150px; left:50%; transform:translateX(-50%); width:220px; height:1px; background:linear-gradient(90deg, transparent, ${GOLD}, transparent); opacity:0.7; }
  .content { position:absolute; top:190px; height:640px; left:0; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .arabic { font-family:'AQ'; direction:rtl; text-align:center; max-width:1560px; line-height:1.7; text-shadow:0 3px 22px rgba(0,0,0,0.55); }
  .translation { font-family:'MS'; font-weight:400; color:${CREAM}; opacity:0.86; text-align:center; max-width:1380px; line-height:1.45; margin-top:84px; }
  .bottom { position:absolute; left:72px; right:72px; top:900px; height:120px; display:flex; align-items:center; justify-content:space-between; }
  .rec { display:flex; align-items:center; gap:22px; }
  .rec-ar { font-family:'AQ'; font-size:32px; line-height:1.9; direction:rtl; margin-top:-12px; }
  .rec-en { font-family:'MS'; font-size:17px; opacity:0.72; letter-spacing:0.5px; margin-top:0; }
  .counter { position:absolute; left:50%; transform:translateX(-50%); top:902px; text-align:center; }
  .counter-ar { font-family:'AQ'; font-size:27px; color:${GOLD}; direction:rtl; line-height:1.9; }
  .counter-en { font-family:'MS'; font-size:13px; letter-spacing:4px; opacity:0.65; font-weight:600; margin-top:-4px; }
  .handle { font-family:'MS'; font-size:20px; color:${GOLD}; font-weight:600; letter-spacing:1px; }
  .track { position:absolute; left:0; right:0; top:1062px; height:4px; background:rgba(242,236,225,0.14); }
  </style></head><body>
  <div class="brand"><span class="brand-ar">بصائر</span><span class="brand-en">BASAER</span></div>
  <div class="cart"><div class="cart-ar">سورة ${surahAr}</div><div class="cart-en">${surahEn.toUpperCase()} · ${surahMeaning.toUpperCase()}</div></div>
  <div class="rule"></div>
  <div class="content">
    <div class="arabic" id="arabic">${spans}</div>
    <div class="translation" id="translation">${english}</div>
  </div>
  <div class="bottom">
    <div class="rec">${portrait(104)}<div><div class="rec-ar">${RECITER_AR} · ${STYLE_AR}</div><div class="rec-en">${RECITER_EN} · ${STYLE_EN}</div></div></div>
    <div class="handle">${HANDLE}</div>
  </div>
  <div class="counter"><div class="counter-ar">الآية ${arNum(ayahNo)} من ${arNum(total)}</div><div class="counter-en">AYAH ${ayahNo} / ${total}</div></div>
  <div class="track"></div>
  <script>
    document.fonts.ready.then(() => {
      const ar = document.getElementById('arabic'), tr = document.getElementById('translation');
      const total = () => ar.offsetHeight + 84 + tr.offsetHeight;
      const search = (el, lo, hi, ok) => { let best = lo; while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); el.style.fontSize = mid + 'px'; void el.offsetHeight; if (ok()) { best = mid; lo = mid + 1; } else hi = mid - 1; } el.style.fontSize = best + 'px'; void el.offsetHeight; };
      search(ar, 54, 118, () => ar.scrollWidth <= 1560 && ar.scrollHeight <= 430);
      tr.style.fontSize = '34px'; void tr.offsetHeight;
      if (total() > 640) { search(tr, 24, 34, () => total() <= 640); if (total() > 640) search(ar, 54, parseInt(ar.style.fontSize, 10), () => total() <= 640); }
      requestAnimationFrame(() => requestAnimationFrame(() => document.body.setAttribute('data-ready', '1')));
    });
  </script></body></html>`;
}

// ---------- intro card ----------
function introHtml({ surahAr, surahEn, surahMeaning, number, count, place }) {
  const placeAr = place === 'makkah' ? 'مكية' : 'مدنية', placeEn = place === 'makkah' ? 'Meccan' : 'Medinan';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${W}px; height:${H}px; overflow:hidden; background:rgba(6,18,25,0.55); color:${CREAM}; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .num { width:84px; height:84px; border:2px solid ${GOLD}; transform:rotate(45deg); display:flex; align-items:center; justify-content:center; margin-bottom:34px; }
  .num span { transform:rotate(-45deg); font-family:'AQ'; font-size:40px; color:${GOLD}; }
  .ar { font-family:'AQ'; font-size:156px; color:${GOLD}; line-height:1.15; direction:rtl; text-shadow:0 4px 30px rgba(0,0,0,0.5); }
  .en { font-family:'MS'; font-size:40px; letter-spacing:12px; font-weight:600; margin-top:58px; }
  .meta { font-family:'MS'; font-size:20px; letter-spacing:3px; opacity:0.7; margin-top:16px; }
  .meta-ar { font-family:'AQ'; font-size:30px; opacity:0.8; direction:rtl; margin-top:6px; }
  .rule { width:320px; height:1px; background:linear-gradient(90deg, transparent, ${GOLD}, transparent); margin:34px 0; }
  .rec { display:flex; align-items:center; gap:24px; }
  .rec-ar { font-family:'AQ'; font-size:38px; direction:rtl; line-height:1.9; margin-top:-14px; }
  .rec-en { font-family:'MS'; font-size:19px; opacity:0.75; margin-top:0; }
  .pill { position:absolute; top:54px; left:50%; transform:translateX(-50%); border:1.5px solid rgba(201,162,75,0.8); border-radius:30px; padding:8px 26px; font-family:'MS'; font-size:15px; letter-spacing:4px; font-weight:600; color:${GOLD}; }
  .brand { position:absolute; bottom:52px; font-family:'MS'; font-size:16px; letter-spacing:6px; opacity:0.55; font-weight:600; }
  </style></head><body>
  <div class="pill">FULL SURAH · سورة كاملة</div>
  <div class="num"><span>${arNum(number)}</span></div>
  <div class="ar">سورة ${surahAr}</div>
  <div class="en">${surahEn.toUpperCase()}</div>
  <div class="meta">${surahMeaning.toUpperCase()} · ${count} AYAHS · ${placeEn.toUpperCase()}</div>
  <div class="meta-ar">${arNum(count)} آيات · ${placeAr}</div>
  <div class="rule"></div>
  <div class="rec">${portrait(132)}<div><div class="rec-ar">${RECITER_AR} · ${STYLE_AR}</div><div class="rec-en">${RECITER_EN} · ${STYLE_EN}</div></div></div>
  <div class="brand">بصائر · BASAER · ${HANDLE}</div>
  </body></html>`;
}

// ---------- outro / end-screen layout (dashed boxes = where YouTube draws its end-screen elements; not drawn in production) ----------
function outroHtml({ surahAr, surahEn, nextAr, nextEn }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${W}px; height:${H}px; overflow:hidden; background:rgba(6,18,25,0.6); color:${CREAM}; position:relative; }
  .top { position:absolute; top:90px; width:100%; text-align:center; }
  .ar { font-family:'AQ'; font-size:64px; color:${GOLD}; direction:rtl; }
  .en { font-family:'MS'; font-size:22px; letter-spacing:6px; font-weight:600; opacity:0.8; margin-top:6px; }
  .box { position:absolute; border:2px dashed rgba(242,236,225,0.35); border-radius:12px; display:flex; align-items:center; justify-content:center; font-family:'MS'; font-size:16px; letter-spacing:2px; opacity:0.75; text-align:center; line-height:1.5; }
  .next { position:absolute; left:250px; top:660px; text-align:center; width:680px; }
  .next-ar { font-family:'AQ'; font-size:40px; direction:rtl; color:${GOLD}; }
  .next-en { font-family:'MS'; font-size:18px; letter-spacing:3px; opacity:0.75; margin-top:4px; }
  .brand { position:absolute; bottom:56px; width:100%; text-align:center; font-family:'MS'; font-size:18px; letter-spacing:6px; opacity:0.6; font-weight:600; }
  </style></head><body>
  <div class="top"><div class="ar">ختام سورة ${surahAr}</div><div class="en">END OF SURAH ${surahEn.toUpperCase()}</div></div>
  <div class="box" style="left:250px;top:390px;width:680px;height:240px;">YouTube end screen:<br>NEXT SURAH video</div>
  <div class="next"><div class="next-ar">التالية: سورة ${nextAr}</div><div class="next-en">NEXT · SURAH ${nextEn.toUpperCase()}</div></div>
  <div class="box" style="left:1090px;top:390px;width:240px;height:240px;border-radius:50%;">SUBSCRIBE</div>
  <div class="box" style="left:1390px;top:390px;width:280px;height:240px;">PLAYLIST:<br>FULL SURAHS</div>
  <div class="brand">بصائر · BASAER · ${HANDLE}</div>
  </body></html>`;
}

// ---------- thumbnail 1280x720 ----------
function thumbHtml({ surahAr, surahEn, number }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:1280px; height:720px; overflow:hidden; color:${CREAM}; position:relative; background:radial-gradient(ellipse at 30% 45%, #1A4058 0%, #0F2A3D 45%, #061219 100%); }
  .frame { position:absolute; inset:18px; border:2px solid rgba(201,162,75,0.55); border-radius:10px; }
  .num { position:absolute; top:46px; left:52px; width:62px; height:62px; border:2px solid ${GOLD}; transform:rotate(45deg); display:flex; align-items:center; justify-content:center; }
  .num span { transform:rotate(-45deg); font-family:'MS'; font-weight:700; font-size:26px; color:${GOLD}; }
  .text { position:absolute; left:40px; width:740px; top:40px; text-align:center; }
  .s { font-family:'AQ'; font-size:72px; color:${CREAM}; opacity:0.9; line-height:1; direction:rtl; }
  .name { font-family:'AQ'; font-size:210px; color:${GOLD}; line-height:1.05; direction:rtl; text-shadow:0 6px 26px rgba(0,0,0,0.6); }
  .en { font-family:'MS'; font-weight:800; font-size:58px; letter-spacing:4px; margin-top:58px; }
  .badge { display:inline-block; margin-top:22px; background:${GOLD}; color:#0B1F2A; font-family:'MS'; font-weight:800; font-size:26px; letter-spacing:3px; padding:9px 24px; border-radius:8px; }
  .right { position:absolute; right:70px; top:70px; width:400px; text-align:center; }
  .r-ar { font-family:'AQ'; font-size:44px; margin-top:6px; line-height:1.9; direction:rtl; }
  .r-en { font-family:'MS'; font-weight:600; font-size:24px; opacity:0.85; margin-top:-6px; }
  .brand { position:absolute; bottom:40px; left:52px; font-family:'MS'; font-weight:700; font-size:18px; letter-spacing:6px; color:${GOLD}; opacity:0.85; }
  </style></head><body>
  <div class="frame"></div>
  <div class="num"><span>${number}</span></div>
  <div class="text"><div class="s">سورة</div><div class="name">${surahAr}</div><div class="en">${surahEn.toUpperCase()}</div><div class="badge">FULL SURAH · كاملة</div></div>
  <div class="right"><div style="display:flex;justify-content:center;">${portrait(330)}</div><div class="r-ar">المنشاوي · ${STYLE_AR}</div><div class="r-en">Al-Minshawi · ${STYLE_EN}</div></div>
  <div class="brand">بصائر · BASAER</div>
  </body></html>`;
}

const ffDur = (f) => Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).trim());

async function main() {
  const t0 = Date.now();
  const chap = (await getJson(`https://api.quran.com/api/v4/chapters/${SURAH}?language=en`)).chapter;
  const next = SURAH < 114 ? (await getJson(`https://api.quran.com/api/v4/chapters/${SURAH + 1}?language=en`)).chapter : null;
  const names = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'surah_names.json'), 'utf8')).approved;
  const enName = (c) => (names[c.id] && names[c.id].en) || c.name_simple;
  const meta = { surahAr: chap.name_arabic, surahEn: enName(chap), surahMeaning: chap.translated_name.name, number: chap.id, count: chap.verses_count, place: chap.revelation_place };
  const n = Math.min(SAMPLE_AYAHS, chap.verses_count);
  const vr = await getJson(`https://api.quran.com/api/v4/verses/by_chapter/${SURAH}?language=en&words=true&word_fields=text_uthmani&translations=${TRANSLATION_ID}&audio=${RECITER}&per_page=${n}&page=1`);
  const ayahs = vr.verses.slice(0, n).map((v) => ({
    no: v.verse_number,
    words: v.words.filter((w) => w.char_type_name === 'word').map((w) => [...w.text_uthmani].filter((c) => c !== HIZB && !ANNOT.includes(c)).join('').replace(/\s+/g, ' ').trim()).filter(Boolean),
    english: v.translations[0].text.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim(),
    audioUrl: 'https://verses.quran.com/' + v.audio.url,
    segs: (v.audio.segments || []).filter((s) => Array.isArray(s) && s.length >= 4).map((s) => [s[1], s[2], s[3]]),
  }));

  // INTEGRITY: every ayah screen's text vs a second, independent fresh API copy (by_key), character by character.
  const issues = [];
  for (const a of ayahs) {
    const f = (await getJson(`https://api.quran.com/api/v4/verses/by_key/${SURAH}:${a.no}?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani&translations=${TRANSLATION_ID}`)).verse;
    const fresh = { arabic: f.text_uthmani, words: f.words.filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani), english: f.translations[0].text.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim() };
    const html = ayahHtml({ ...meta, words: a.words, hi: -1, english: a.english, ayahNo: a.no, total: meta.count });
    issues.push(...checkOverlay(`${SURAH}:${a.no}`, readOverlay(html), fresh));
  }
  if (issues.length) { console.error('INTEGRITY FAILED:\n' + issues.join('\n')); process.exit(1); }
  console.log(`integrity: ${ayahs.length} ayah screens identical to a fresh API copy`);

  // AUDIO: per-ayah files joined; ayah offsets from real durations.
  let offset = 0;
  const parts = [];
  for (const a of ayahs) {
    const mp3 = path.join(work, `a${a.no}.mp3`), wav = path.join(work, `a${a.no}.wav`);
    sh(`curl -sSfL "${a.audioUrl}" -o "${mp3}"`);
    sh(`ffmpeg -nostdin -loglevel error -y -i "${mp3}" -ar 44100 -ac 2 "${wav}"`);
    a.offset = offset; a.dur = ffDur(wav); offset += a.dur; parts.push(wav);
  }
  const firstWord = ayahs[0].segs.length ? ayahs[0].segs[0][1] / 1000 : 0;
  const lead = Math.max(0, 4.5 - firstWord); // the intro card needs ~4.5 s before the first word
  const recEnd = lead + offset, total = recEnd + OUTRO_SEC;
  fs.writeFileSync(path.join(work, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  const audio = path.join(work, 'audio.wav');
  sh(`ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "${path.join(work, 'list.txt')}" -af "adelay=${Math.round(lead * 1000)}:all=1,apad=pad_dur=${OUTRO_SEC}" "${audio}"`);

  // TIMELINE of screens: unlit ayah, then each word lit until the next word starts (kept lit through pauses).
  const screens = [];
  const introEnd = lead + Math.max(0.5, firstWord - 0.5);
  for (const a of ayahs) {
    const start = lead + a.offset, end = lead + a.offset + a.dur;
    // Follow the voice through every segment in time order (Mujawwad goes back over words). Words the API leaves
    // untimed are spread evenly across the jump that skips them, so every word still lights up in order.
    const order = [...a.segs].sort((x, y) => x[1] - y[1]).map((g) => ({ i: g[0] - 1, t: g[1] / 1000 }));
    const filled = [];
    for (const e of order) {
      const last = filled[filled.length - 1];
      if (last && e.i > last.i + 1) {
        const gap = e.i - last.i - 1;
        for (let g = 1; g <= gap; g++) filled.push({ i: last.i + g, t: last.t + (e.t - last.t) * g / (gap + 1) });
      }
      filled.push(e);
    }
    const s0 = Math.max(start, a === ayahs[0] ? introEnd : start);
    screens.push({ a, hi: -1, from: s0, to: filled.length ? start + filled[0].t : end });
    filled.forEach((e, k) => screens.push({ a, hi: e.i, from: start + e.t, to: k + 1 < filled.length ? start + filled[k + 1].t : end }));
  }
  const live = screens.filter((s) => s.to - s.from > 0.02);
  console.log(`screens: ${live.length}, recitation ${offset.toFixed(1)} s, video ${total.toFixed(1)} s`);

  // PNGs
  const bgW = 2112, bgH = 1188;
  shot(backgroundHtml(bgW, bgH), path.join(work, 'bg.png'), bgW, bgH, false);
  shot(introHtml(meta), path.join(work, 'intro.png'));
  shot(outroHtml({ ...meta, nextAr: next ? next.name_arabic : '', nextEn: next ? enName(next) : '' }), path.join(work, 'outro.png'));
  shot(thumbHtml(meta), path.join(OUT, 'thumbnail.png'), 1280, 720, false);
  const cache = new Map();
  live.forEach((s, k) => {
    const key = `${s.a.no}_${s.hi}`;
    if (!cache.has(key)) { const p = path.join(work, `o_${key}.png`); shot(ayahHtml({ ...meta, words: s.a.words, hi: s.hi, english: s.a.english, ayahNo: s.a.no, total: meta.count }), p); cache.set(key, p); }
    s.png = cache.get(key);
  });

  // COMPOSITE: drifting background, screens, intro/outro cards with fades, smooth progress bar, gold audio wave.
  const pngs = [...cache.values()];
  const idx = new Map(pngs.map((p, i) => [p, i + 4]));
  const inputs = [`-loop 1 -framerate ${FPS} -t ${total} -i "${path.join(work, 'bg.png')}"`, `-loop 1 -framerate ${FPS} -t ${total} -i "${path.join(work, 'intro.png')}"`, `-loop 1 -framerate ${FPS} -t ${total} -i "${path.join(work, 'outro.png')}"`, `-i "${audio}"`, ...pngs.map((p) => `-i "${p}"`)];
  const L = [];
  L.push(`[0:v]crop=${W}:${H}:x='96+90*sin(t/37)':y='54+50*cos(t/51)',format=yuv420p[b0]`);
  let prev = 'b0';
  live.forEach((s, k) => { const o = `s${k}`; L.push(`[${prev}][${idx.get(s.png)}:v]overlay=enable='between(t,${s.from.toFixed(3)},${(s.to + 0.001).toFixed(3)})'[${o}]`); prev = o; });
  L.push(`[1:v]format=rgba,fade=t=in:st=0:d=0.8:alpha=1,fade=t=out:st=${(introEnd - 0.6).toFixed(3)}:d=0.6:alpha=1[ic]`);
  L.push(`[${prev}][ic]overlay=enable='lte(t,${introEnd.toFixed(3)})'[v1]`);
  L.push(`[2:v]format=rgba,fade=t=in:st=${recEnd.toFixed(3)}:d=0.8:alpha=1[oc]`);
  L.push(`[v1][oc]overlay=enable='gte(t,${recEnd.toFixed(3)})'[v2]`);
  L.push(`color=c=0xC9A24B:s=${W}x4:r=${FPS},format=rgba[pb]`);
  L.push(`[v2][pb]overlay=x='-${W}+${W}*min(1,max(0,(t-${introEnd.toFixed(3)})/${(recEnd - introEnd).toFixed(3)}))':y=1062:enable='between(t,${introEnd.toFixed(3)},${recEnd.toFixed(3)})'[v3]`);
  L.push(`[3:a]aformat=channel_layouts=mono,lowpass=f=280,lowpass=f=280,volume=4,showwaves=s=360x26:mode=cline:rate=${FPS}:colors=0xF0CB6E:scale=sqrt:draw=full,format=rgba,colorchannelmixer=aa=0.6[w]`);
  L.push(`[v3][w]overlay=x=${(W - 360) / 2}:y=1016:enable='between(t,${introEnd.toFixed(3)},${recEnd.toFixed(3)})'[vout]`);
  const fsPath = path.join(work, 'filter.txt');
  fs.writeFileSync(fsPath, L.join(';\n'));
  const mp4 = path.join(OUT, 'sample.mp4');
  sh(`ffmpeg -nostdin -loglevel error -y ${inputs.join(' ')} -filter_complex_script "${fsPath}" -map "[vout]" -map 3:a -c:v libx264 -preset veryfast -crf 19 -pix_fmt yuv420p -r ${FPS} -c:a aac -b:a 160k -t ${total.toFixed(3)} -movflags +faststart "${mp4}"`);

  // STILLS: intro, middle of each ayah (on a lit word), outro
  const stills = [['intro', Math.max(1, introEnd - 1.5)]];
  ayahs.forEach((a) => { const lit = live.filter((s) => s.a === a && s.hi >= 0); const s = lit[Math.floor(lit.length / 2)] || live.find((x) => x.a === a); stills.push([`ayah${a.no}`, (s.from + s.to) / 2]); });
  stills.push(['outro', recEnd + OUTRO_SEC - 2]);
  for (const [name, t] of stills) sh(`ffmpeg -nostdin -loglevel error -y -ss ${t.toFixed(3)} -i "${mp4}" -frames:v 1 "${path.join(OUT, `still-${name}.png`)}"`);
  const renderSec = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify({ surah: SURAH, ayahs: n, reciter: RECITER, recitationSec: +offset.toFixed(2), videoSec: +total.toFixed(2), screens: live.length, renderSec: +renderSec.toFixed(1), realtimeFactor: +(renderSec / total).toFixed(2), stills: stills.map((s) => s[0]) }, null, 2));
  console.log(fs.readFileSync(path.join(OUT, 'stats.json'), 'utf8'));
}

main().catch((e) => { console.error(e); process.exit(1); });
