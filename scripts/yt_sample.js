// YOUTUBE DESIGN SAMPLE v2 (test/youtube branch only, 2026-10-13): the owner asked for a look closer to the top trending
// Quran channels. v2 = cinematic slow footage behind the text (owner-approved Coverr clips, landscape originals through the
// official Coverr API), calligraphic surah titles (Aref Ruqaa, OFL), classical Latin titles (Cinzel, OFL), an ornamental
// end-of-ayah medallion, the reciter's approved photo (data/reciter_photos.json) and a cinematic thumbnail.
// Nothing here is wired into n8n or publishes anything.
// Text: Quran.com API only (words + Saheeh International), checked against a second fresh API copy before rendering.
// Audio: Quran.com recitation 8 (Mohamed Siddiq al-Minshawi, Mujawwad), one file per ayah from verses.quran.com, joined.
//
// Usage: CHROME_BIN=... COVERR_API_KEY=... SURAH=1 SAMPLE_AYAHS=2 node scripts/yt_sample.js <outDir>
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const { amiriQuranBase64, montserratBase64 } = require('./font_data');
const { checkOverlay, readOverlay } = require('./verify_text');

const ROOT = path.join(__dirname, '..');
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
// Owner, 2026-10-21: the reciter is shown with his title on YouTube, and the brand reads Basaer Media / بصائر ميديا.
const TITLE_AR = 'الشيخ', TITLE_EN = 'Sheikh';
const BRAND_AR = 'بصائر ميديا', BRAND_EN = 'BASAER MEDIA';
const GOLD = '#D9B45A', GOLD_HI = '#F0CB6E', CREAM = '#F7F1E6';
const HIZB = String.fromCharCode(0x06DE), ANNOT = String.fromCharCode(0x06ED, 0x06E2);
// Owner-approved Coverr clips (data/footage_library.json), used here as their landscape originals. Order = the mood arc.
const CLIPS = (process.env.YT_CLIPS || 'coverr-CLew6kVZWU,coverr-ncFMIJ5yHJ,coverr-HM7pVL1BAT').split(',');
const SHOT_SEC = Number(process.env.YT_SHOT_SEC || 14), XF = 1.6, SLOW = 1.6;

fs.mkdirSync(OUT, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-sample-'));
const sh = (cmd) => { console.log('+ ' + cmd.slice(0, 300)); return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'], shell: '/bin/bash', maxBuffer: 1 << 26 }).toString(); };
const arNum = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });
const b64 = (p) => fs.readFileSync(path.join(ROOT, p)).toString('base64');

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json', ...headers } }, (res) => {
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

const PHOTO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'reciter_photos.json'), 'utf8'))[RECITER];
if (!PHOTO || !PHOTO.approvedByOwner) throw new Error('no owner-approved photo for this reciter');
const photoUri = `data:image/jpeg;base64,${b64(PHOTO.file)}`;

const fontCss = `
  @font-face { font-family:'AQ'; src:url(data:font/woff2;base64,${amiriQuranBase64}) format('woff2'); font-weight:400 700; }
  @font-face { font-family:'MS'; src:url(data:font/woff2;base64,${montserratBase64}) format('woff2'); font-weight:100 900; }
  @font-face { font-family:'RQ'; src:url(data:font/ttf;base64,${b64('assets/fonts/ArefRuqaa-Bold.ttf')}) format('truetype'); font-weight:700; }
  @font-face { font-family:'CZ'; src:url(data:font/ttf;base64,${b64('assets/fonts/Cinzel.ttf')}) format('truetype'); font-weight:400 900; }
  * { margin:0; padding:0; box-sizing:border-box; }`;
const glow = `text-shadow:0 0 18px rgba(240,203,110,0.45), 0 3px 18px rgba(0,0,0,0.75);`;

function shot(html, outPng, w = W, h = H, transparent = true) {
  const p = outPng.replace(/\.png$/, '.html');
  fs.writeFileSync(p, html);
  const prof = path.join(work, 'chrome');
  sh(`"${CHROME}" --headless --disable-gpu --disable-software-rasterizer --hide-scrollbars --allow-file-access-from-files ${transparent ? '--default-background-color=00000000' : ''} --window-size=${w},${h} --user-data-dir="${prof}" --virtual-time-budget=1500 --screenshot="${outPng}" "file://${p}" 2>&1 | tail -2`);
}

// The reciter's approved photo in a gold ring.
const portrait = (size) => `<div style="width:${size}px;height:${size}px;border-radius:50%;padding:${Math.max(3, size / 34)}px;background:linear-gradient(145deg, ${GOLD_HI}, #8C6A22 55%, ${GOLD_HI});box-shadow:0 0 ${size / 5}px rgba(240,203,110,0.35), 0 6px 24px rgba(0,0,0,0.6);flex:none;"><div style="width:100%;height:100%;border-radius:50%;background:url(${photoUri}) center 30%/cover;filter:sepia(0.25) contrast(1.05);"></div></div>`;
// Thin gold divider with a diamond in the middle.
const divider = (w) => `<div style="display:flex;align-items:center;justify-content:center;gap:12px;"><span style="width:${w}px;height:1px;background:linear-gradient(90deg, transparent, ${GOLD});"></span><span style="width:9px;height:9px;transform:rotate(45deg);border:1.5px solid ${GOLD};"></span><span style="width:${w}px;height:1px;background:linear-gradient(90deg, ${GOLD}, transparent);"></span></div>`;
// Ornamental end-of-ayah medallion (drawn ornament + the ayah number; not part of the ayah text).
const medallion = (n, size) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="flex:none;filter:drop-shadow(0 0 10px rgba(240,203,110,0.45));">
  <g fill="none" stroke="${GOLD_HI}" stroke-width="2.2">${Array.from({ length: 12 }, (_, k) => `<ellipse cx="50" cy="20" rx="7" ry="13" transform="rotate(${k * 30} 50 50)"/>`).join('')}</g>
  <circle cx="50" cy="50" r="27" fill="rgba(6,18,25,0.75)" stroke="${GOLD_HI}" stroke-width="2.5"/><circle cx="50" cy="50" r="22" fill="none" stroke="${GOLD}" stroke-width="1"/>
  <text x="50" y="${n > 99 ? 60 : 62}" text-anchor="middle" font-family="AQ" font-size="${n > 99 ? 24 : 30}" fill="${GOLD_HI}">${arNum(n)}</text></svg>`;

// ---------- scrim over the footage: readable text everywhere, footage alive at the edges ----------
function scrimHtml() {
  return `<!DOCTYPE html><html><head><style>* {margin:0;} body { width:${W}px; height:${H}px; background:
    radial-gradient(ellipse 62% 48% at 50% 50%, rgba(6,18,25,0.62) 0%, rgba(6,18,25,0.42) 60%, rgba(6,18,25,0) 100%),
    linear-gradient(180deg, rgba(6,18,25,0.70) 0%, rgba(6,18,25,0) 22%, rgba(6,18,25,0) 74%, rgba(6,18,25,0.85) 100%); }</style></head><body></body></html>`;
}

// ---------- ayah screen overlay (transparent) ----------
function ayahHtml({ words, hi, english, surahAr, surahEn, ayahNo, total }) {
  const spans = words.map((w, i) => `<span style="color:${i === hi ? GOLD_HI : CREAM};${i === hi ? 'text-shadow:0 0 26px rgba(240,203,110,0.75), 0 3px 18px rgba(0,0,0,0.8);' : ''}">${w.replace(/ /g, ' ')}</span>`).join(' ');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${W}px; height:${H}px; overflow:hidden; background:transparent; position:relative; color:${CREAM}; }
  .brand { position:absolute; top:44px; left:64px; display:flex; align-items:center; gap:14px; }
  .brand-ar { font-family:'RQ'; font-size:46px; color:${GOLD_HI}; line-height:1.3; ${glow} }
  .brand-en { font-family:'CZ'; font-size:18px; letter-spacing:6px; font-weight:700; color:${CREAM}; opacity:0.85; }
  .title { position:absolute; top:26px; left:0; width:100%; text-align:center; }
  .title-ar { font-family:'RQ'; font-size:62px; color:${GOLD_HI}; line-height:1.45; direction:rtl; ${glow} }
  .title-en { font-family:'CZ'; font-size:17px; letter-spacing:7px; font-weight:700; margin:0 0 10px; opacity:0.9; }
  .count { position:absolute; top:46px; right:64px; text-align:center; border:1.5px solid rgba(240,203,110,0.7); border-radius:999px; padding:2px 28px 12px; background:rgba(6,18,25,0.45); }
  .count-ar { font-family:'AQ'; font-size:26px; color:${GOLD_HI}; line-height:1.7; direction:rtl; }
  .count-en { font-family:'CZ'; font-size:13px; letter-spacing:4px; font-weight:700; opacity:0.85; margin-top:2px; }
  .content { position:absolute; top:210px; height:640px; left:0; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .row { display:flex; direction:rtl; align-items:center; justify-content:center; gap:26px; max-width:1640px; }
  .arabic { font-family:'AQ'; direction:rtl; text-align:center; max-width:1520px; line-height:1.75; text-shadow:0 3px 22px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.6); }
  .translation { font-family:'MS'; font-weight:500; color:${CREAM}; text-align:center; max-width:1380px; line-height:1.45; margin-top:76px; text-shadow:0 2px 14px rgba(0,0,0,0.9); }
  .rec { position:absolute; left:64px; bottom:46px; display:flex; align-items:center; gap:20px; }
  .rec-ar { font-family:'AQ'; font-size:31px; line-height:1.9; direction:rtl; margin-top:-12px; text-shadow:0 2px 12px rgba(0,0,0,0.8); }
  .rec-en { font-family:'CZ'; font-size:15px; letter-spacing:2px; font-weight:700; opacity:0.85; color:${GOLD_HI}; }
  .handle { position:absolute; right:64px; bottom:66px; font-family:'CZ'; font-size:19px; color:${GOLD_HI}; font-weight:700; letter-spacing:2px; }
  .track { position:absolute; left:0; right:0; top:1066px; height:3px; background:rgba(247,241,230,0.16); }
  </style></head><body>
  <div class="brand"><span class="brand-ar">${BRAND_AR}</span><span class="brand-en">${BRAND_EN}</span></div>
  <div class="title"><div class="title-ar">سورة ${surahAr}</div><div class="title-en">SURAH ${surahEn.toUpperCase()}</div>${divider(110)}</div>
  <div class="count"><div class="count-ar">الآية ${arNum(ayahNo)} من ${arNum(total)}</div><div class="count-en">AYAH ${ayahNo} / ${total}</div></div>
  <div class="content">
    <div class="row"><div class="arabic" id="arabic">${spans}</div><div style="margin-top:48px;">${medallion(ayahNo, 92)}</div></div>
    <div class="translation" id="translation">${english}</div>
  </div>
  <div class="rec">${portrait(100)}<div><div class="rec-ar">${TITLE_AR} ${RECITER_AR}</div><div class="rec-en">${TITLE_EN.toUpperCase()} ${RECITER_EN.toUpperCase()} · ${STYLE_EN.toUpperCase()}</div></div></div>
  <div class="handle">${HANDLE}</div>
  <div class="track"></div>
  <script>
    document.fonts.ready.then(() => {
      const ar = document.getElementById('arabic'), tr = document.getElementById('translation');
      const total = () => ar.offsetHeight + 76 + tr.offsetHeight;
      const search = (el, lo, hi, ok) => { let best = lo; while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); el.style.fontSize = mid + 'px'; void el.offsetHeight; if (ok()) { best = mid; lo = mid + 1; } else hi = mid - 1; } el.style.fontSize = best + 'px'; void el.offsetHeight; };
      search(ar, 54, 116, () => ar.scrollWidth <= 1520 && ar.scrollHeight <= 420);
      tr.style.fontSize = '34px'; void tr.offsetHeight;
      if (total() > 640) { search(tr, 24, 34, () => total() <= 640); if (total() > 640) search(ar, 54, parseInt(ar.style.fontSize, 10), () => total() <= 640); }
      requestAnimationFrame(() => requestAnimationFrame(() => document.body.setAttribute('data-ready', '1')));
    });
  </script></body></html>`;
}

// ---------- intro card (over the footage) ----------
function introHtml({ surahAr, surahEn, surahMeaning, number, count, place }) {
  const placeAr = place === 'makkah' ? 'مكية' : 'مدنية', placeEn = place === 'makkah' ? 'MECCAN' : 'MEDINAN';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${W}px; height:${H}px; overflow:hidden; background:radial-gradient(ellipse 60% 70% at 50% 50%, rgba(6,18,25,0.55), rgba(6,18,25,0.25)); color:${CREAM}; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .pill { border:1.5px solid rgba(240,203,110,0.85); border-radius:999px; padding:9px 30px; font-family:'CZ'; font-size:17px; letter-spacing:5px; font-weight:700; color:${GOLD_HI}; background:rgba(6,18,25,0.4); margin-bottom:26px; }
  .s { font-family:'RQ'; font-size:62px; color:${CREAM}; line-height:1.2; ${glow} }
  .ar { font-family:'RQ'; font-size:210px; color:${GOLD_HI}; line-height:1.25; direction:rtl; ${glow} }
  .en { font-family:'CZ'; font-size:56px; letter-spacing:14px; font-weight:800; margin-top:4px; text-shadow:0 3px 18px rgba(0,0,0,0.8); }
  .meta { font-family:'CZ'; font-size:19px; letter-spacing:5px; font-weight:700; opacity:0.85; margin:14px 0 26px; }
  .rec { display:flex; align-items:center; gap:24px; margin-top:30px; }
  .rec-ar { font-family:'AQ'; font-size:38px; direction:rtl; line-height:1.9; margin-top:-14px; text-shadow:0 2px 12px rgba(0,0,0,0.8); }
  .rec-en { font-family:'CZ'; font-size:17px; letter-spacing:2px; font-weight:700; color:${GOLD_HI}; }
  .brand { position:absolute; bottom:44px; font-family:'CZ'; font-size:16px; letter-spacing:6px; opacity:0.75; font-weight:700; }
  </style></head><body>
  <div class="pill">FULL SURAH · ${STYLE_EN.toUpperCase()}</div>
  <div class="s">سورة</div>
  <div class="ar">${surahAr}</div>
  <div class="en">${surahEn.toUpperCase()}</div>
  <div class="meta">${surahMeaning.toUpperCase()} · ${count} AYAHS · ${placeEn}</div>
  ${divider(160)}
  <div class="rec">${portrait(140)}<div><div class="rec-ar">${TITLE_AR} ${RECITER_AR} · ${STYLE_AR}</div><div class="rec-en">${TITLE_EN.toUpperCase()} ${RECITER_EN.toUpperCase()}</div></div></div>
  <div class="brand">${BRAND_EN} · ${BRAND_AR} · ${HANDLE}</div>
  </body></html>`;
}

// ---------- outro / end-screen layout (dashed boxes = where YouTube draws its end-screen elements; not drawn in production) ----------
function outroHtml({ surahAr, surahEn, nextAr, nextEn }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${W}px; height:${H}px; overflow:hidden; background:rgba(6,18,25,0.62); color:${CREAM}; position:relative; }
  .top { position:absolute; top:70px; width:100%; text-align:center; }
  .ar { font-family:'RQ'; font-size:76px; color:${GOLD_HI}; direction:rtl; line-height:1.4; ${glow} }
  .en { font-family:'CZ'; font-size:22px; letter-spacing:7px; font-weight:700; margin:2px 0 14px; }
  .box { position:absolute; border:2px dashed rgba(247,241,230,0.4); border-radius:12px; display:flex; align-items:center; justify-content:center; font-family:'MS'; font-size:16px; letter-spacing:2px; opacity:0.75; text-align:center; line-height:1.5; }
  .next { position:absolute; left:250px; top:660px; text-align:center; width:680px; }
  .next-ar { font-family:'RQ'; font-size:46px; direction:rtl; color:${GOLD_HI}; line-height:1.5; }
  .next-en { font-family:'CZ'; font-size:18px; letter-spacing:4px; font-weight:700; }
  .brand { position:absolute; bottom:52px; width:100%; text-align:center; font-family:'CZ'; font-size:18px; letter-spacing:6px; opacity:0.8; font-weight:700; }
  </style></head><body>
  <div class="top"><div class="ar">ختام سورة ${surahAr}</div><div class="en">END OF SURAH ${surahEn.toUpperCase()}</div>${divider(140)}</div>
  <div class="box" style="left:250px;top:390px;width:680px;height:240px;">YouTube end screen:<br>NEXT SURAH video</div>
  <div class="next"><div class="next-ar">التالية: سورة ${nextAr}</div><div class="next-en">NEXT · SURAH ${nextEn.toUpperCase()}</div></div>
  <div class="box" style="left:1090px;top:390px;width:240px;height:240px;border-radius:50%;">SUBSCRIBE</div>
  <div class="box" style="left:1390px;top:390px;width:280px;height:240px;">PLAYLIST:<br>FULL SURAHS</div>
  <div class="brand">${BRAND_EN} · ${BRAND_AR} · ${HANDLE}</div>
  </body></html>`;
}

// ---------- thumbnail 1280x720 over a still of the opening clip ----------
// Thumbnail v3 (owner, 2026-10-21; checked with the yt-package rules): no English surah name (the title carries it, the
// thumbnail must not repeat the title), the Arabic badge المصحف المجوّد, the reciter's full name under his photo.
// sheikh=true adds الشيخ above the name.
function thumbHtml({ surahAr, surahEn, number }, stillPath, sheikh = true) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:1280px; height:720px; overflow:hidden; color:${CREAM}; position:relative; background:#0B1F2A url(data:image/jpeg;base64,${fs.readFileSync(stillPath).toString('base64')}) center/cover; }
  .shade { position:absolute; inset:0; background:linear-gradient(90deg, rgba(6,18,25,0.86) 0%, rgba(6,18,25,0.62) 48%, rgba(6,18,25,0.15) 75%, rgba(6,18,25,0.35) 100%), linear-gradient(0deg, rgba(6,18,25,0.6), rgba(6,18,25,0) 30%); }
  .frame { position:absolute; inset:16px; border:2px solid rgba(240,203,110,0.6); border-radius:10px; }
  .text { position:absolute; left:40px; width:740px; top:18px; text-align:center; }
  .s { font-family:'RQ'; font-size:70px; color:${CREAM}; line-height:1.3; ${glow} }
  .name { font-family:'RQ'; font-size:224px; color:${GOLD_HI}; line-height:1.15; direction:rtl; text-shadow:0 0 30px rgba(240,203,110,0.55), 0 6px 26px rgba(0,0,0,0.85); }
  .en { font-family:'CZ'; font-weight:900; font-size:66px; letter-spacing:5px; margin-top:6px; text-shadow:0 4px 20px rgba(0,0,0,0.9); }
  .badge { display:inline-block; margin-top:26px; background:linear-gradient(180deg, ${GOLD_HI}, #B98E35); color:#0B1F2A; font-family:'RQ'; font-size:58px; line-height:1.5; padding:0 40px 8px; border-radius:10px; direction:rtl; box-shadow:0 6px 22px rgba(0,0,0,0.55); }
  .t-en { font-family:'CZ'; font-weight:900; font-size:46px; letter-spacing:5px; margin-top:-4px; text-shadow:0 4px 20px rgba(0,0,0,0.9); }
  .b-en { font-family:'CZ'; font-weight:900; font-size:21px; letter-spacing:5px; display:block; margin-top:-10px; }
  .r-en2 { font-family:'CZ'; font-weight:800; font-size:19px; letter-spacing:2px; color:${GOLD_HI}; text-align:center; text-shadow:0 2px 12px rgba(0,0,0,0.9); }
  .sh { font-family:'RQ'; font-size:34px; color:${GOLD_HI}; line-height:1.3; margin-top:14px; ${glow} }
  .right { position:absolute; right:48px; top:${sheikh ? 70 : 92}px; width:430px; display:flex; flex-direction:column; align-items:center; }
  .r-ar { font-family:'RQ'; font-size:48px; line-height:1.45; direction:rtl; margin-top:6px; white-space:nowrap; ${glow} }
  .r-en { font-family:'CZ'; font-weight:800; font-size:23px; letter-spacing:2px; color:${GOLD_HI}; text-shadow:0 2px 12px rgba(0,0,0,0.9); }
  .num { position:absolute; top:40px; left:46px; font-family:'CZ'; font-weight:900; font-size:22px; color:${GOLD_HI}; letter-spacing:2px; }
  .brand { position:absolute; bottom:34px; left:48px; font-family:'CZ'; font-weight:800; font-size:18px; letter-spacing:6px; color:${GOLD_HI}; }
  </style></head><body>
  <div class="shade"></div><div class="frame"></div>
  <div class="num">${String(number).padStart(3, '0')}</div>
  <div class="text"><div class="s">سورة</div><div class="name">${surahAr}</div><div class="t-en">SURAH ${surahEn.toUpperCase()}</div><div class="badge">المصحف المجوَّد<span class="b-en">THE MUJAWWAD MUSHAF</span></div></div>
  <div class="right">${portrait(300)}${sheikh ? '<div class="sh">الشيخ</div>' : ''}<div class="r-ar"${sheikh ? ' style="margin-top:-6px"' : ''}>${RECITER_AR}</div><div class="r-en2">${sheikh ? TITLE_EN.toUpperCase() + ' ' : ''}${RECITER_EN.toUpperCase()}</div></div>
  <div class="brand">${BRAND_EN} · ${BRAND_AR}</div>
  </body></html>`;
}

const ffDur = (f) => Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).trim());

// FOOTAGE: landscape originals via the official Coverr API (download reported back, as their terms ask), slowed, graded
// toward the brand (navy shadows, warm highlights) and joined with long crossfades. A contact sheet of every clip is saved
// so each landscape frame can be checked by eye (the clips were approved as vertical centre crops).
async function footage(total) {
  const key = process.env.COVERR_API_KEY;
  if (!key) throw new Error('COVERR_API_KEY missing');
  const shots = Math.max(1, Math.ceil((total - XF) / (SHOT_SEC - XF)));
  const files = [];
  // Each clip is fetched from Coverr ONCE and kept on Cloudinary as a 1920x1080 copy (youtube-test/footage/<id>); later
  // renders read that copy and never call the Coverr API (its key has a query limit).
  for (const id of CLIPS) {
    const cid = id.replace(/^coverr-/, '');
    const raw = path.join(work, `${id}.mp4`);
    const cached = `https://res.cloudinary.com/b72gfdzx/video/upload/youtube-test/footage/${id}.mp4`;
    let title = 'cached copy';
    if (sh(`curl -s -o /dev/null -w "%{http_code}" "${cached}"`).trim() === '200') sh(`curl -sSfL -o "${raw}" "${cached}"`);
    else {
      const res = await fetch(`https://api.coverr.co/videos/${cid}?urls=true`, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) throw new Error(`Coverr ${cid}: HTTP ${res.status} ${(await res.text()).slice(0, 200).replace(/s+/g, ' ')}`);
      const v = await res.json();
      const src = v.urls && (v.urls.mp4_download || v.urls.mp4);
      if (!src) throw new Error(`Coverr ${cid}: no file url`);
      const orig = path.join(work, `${id}-orig.mp4`);
      sh(`curl -sSL --fail -o "${orig}" "${src}"`);
      await fetch(`https://api.coverr.co/videos/${cid}/stats/downloads`, { method: 'PATCH', headers: { Authorization: `Bearer ${key}` } }).catch(() => {});
      sh(`ffmpeg -nostdin -loglevel error -y -i "${orig}" -an -vf "scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "${raw}"`);
      sh(`node "${path.join(__dirname, 'upload_cloudinary.js')}" "${raw}" "youtube-test/footage/${id}" video`);
      title = v.title;
    }
    const d = ffDur(raw);
    const sheet = path.join(OUT, `sheet-${id}.jpg`);
    sh(`ffmpeg -nostdin -loglevel error -y -i "${raw}" -vf "fps=6/${Math.max(1, d).toFixed(2)},scale=480:-2,tile=6x1" -frames:v 1 "${sheet}"`);
    files.push({ id, raw, d, title });
  }
  const pieces = [];
  for (let k = 0; k < shots; k++) {
    const f = files[k % files.length], len = SHOT_SEC;
    const p = path.join(work, `shot${k}.mp4`);
    // slow down, cover-crop to 16:9, brand grade; loop the source if it is shorter than the slowed shot needs
    sh(`ffmpeg -nostdin -loglevel error -y -stream_loop -1 -i "${f.raw}" -t ${(len / SLOW + 0.5).toFixed(2)} -an -vf "setpts=${SLOW}*PTS,fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},eq=saturation=0.88:brightness=-0.03:contrast=1.04,colorbalance=bs=0.08:bm=0.03:rh=0.05:gh=0.02,vignette=PI/4.5" -t ${len} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p "${p}"`);
    pieces.push(p);
  }
  const bg = path.join(work, 'footage.mp4');
  if (pieces.length === 1) fs.copyFileSync(pieces[0], bg);
  else {
    const L = []; let prev = '0:v', t = SHOT_SEC - XF;
    for (let k = 1; k < pieces.length; k++) { const o = `x${k}`; L.push(`[${prev}][${k}:v]xfade=transition=fade:duration=${XF}:offset=${t.toFixed(3)}[${o}]`); prev = o; t += SHOT_SEC - XF; }
    sh(`ffmpeg -nostdin -loglevel error -y ${pieces.map((p) => `-i "${p}"`).join(' ')} -filter_complex "${L.join(';')}" -map "[${prev}]" -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p "${bg}"`);
  }
  return { bg, files };
}

async function main() {
  const t0 = Date.now();
  const chap = (await getJson(`https://api.quran.com/api/v4/chapters/${SURAH}?language=en`)).chapter;
  const next = SURAH < 114 ? (await getJson(`https://api.quran.com/api/v4/chapters/${SURAH + 1}?language=en`)).chapter : null;
  const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'surah_names.json'), 'utf8')).approved;
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

  // FOOTAGE + PNGs
  const { bg, files } = await footage(total);
  const still = path.join(work, 'thumb-bg.jpg');
  sh(`ffmpeg -nostdin -loglevel error -y -ss 3 -i "${files[0].raw}" -frames:v 1 -vf "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,eq=saturation=0.95:contrast=1.05" "${still}"`);
  shot(scrimHtml(), path.join(work, 'scrim.png'));
  shot(introHtml(meta), path.join(work, 'intro.png'));
  shot(outroHtml({ ...meta, nextAr: next ? next.name_arabic : '', nextEn: next ? enName(next) : '' }), path.join(work, 'outro.png'));
  shot(thumbHtml(meta, still), path.join(OUT, 'thumbnail.png'), 1280, 720, false);
  const cache = new Map();
  live.forEach((s) => {
    const key = `${s.a.no}_${s.hi}`;
    if (!cache.has(key)) { const p = path.join(work, `o_${key}.png`); shot(ayahHtml({ ...meta, words: s.a.words, hi: s.hi, english: s.a.english, ayahNo: s.a.no, total: meta.count }), p); cache.set(key, p); }
    s.png = cache.get(key);
  });

  // COMPOSITE: footage + scrim, screens, intro/outro cards with fades, smooth progress bar, gold audio wave.
  const pngs = [...cache.values()];
  const idx = new Map(pngs.map((p, i) => [p, i + 5]));
  const inputs = [`-i "${bg}"`, `-loop 1 -framerate ${FPS} -t ${total} -i "${path.join(work, 'intro.png')}"`, `-loop 1 -framerate ${FPS} -t ${total} -i "${path.join(work, 'outro.png')}"`, `-i "${audio}"`, `-loop 1 -framerate ${FPS} -t ${total} -i "${path.join(work, 'scrim.png')}"`, ...pngs.map((p) => `-i "${p}"`)];
  const L = [];
  L.push(`[0:v]fps=${FPS},format=yuv420p[f0]`);
  L.push(`[f0][4:v]overlay=enable='between(t,${introEnd.toFixed(3)},${recEnd.toFixed(3)})'[b0]`);
  let prev = 'b0';
  live.forEach((s, k) => { const o = `s${k}`; L.push(`[${prev}][${idx.get(s.png)}:v]overlay=enable='between(t,${s.from.toFixed(3)},${(s.to + 0.001).toFixed(3)})'[${o}]`); prev = o; });
  L.push(`[1:v]format=rgba,fade=t=in:st=0:d=1.0:alpha=1,fade=t=out:st=${(introEnd - 0.7).toFixed(3)}:d=0.7:alpha=1[ic]`);
  L.push(`[${prev}][ic]overlay=enable='lte(t,${introEnd.toFixed(3)})'[v1]`);
  L.push(`[2:v]format=rgba,fade=t=in:st=${recEnd.toFixed(3)}:d=0.9:alpha=1[oc]`);
  L.push(`[v1][oc]overlay=enable='gte(t,${recEnd.toFixed(3)})'[v2]`);
  L.push(`color=c=0xF0CB6E:s=${W}x3:r=${FPS},format=rgba[pb]`);
  L.push(`[v2][pb]overlay=x='-${W}+${W}*min(1,max(0,(t-${introEnd.toFixed(3)})/${(recEnd - introEnd).toFixed(3)}))':y=1066:enable='between(t,${introEnd.toFixed(3)},${recEnd.toFixed(3)})'[v3]`);
  L.push(`[3:a]aformat=channel_layouts=mono,lowpass=f=280,lowpass=f=280,volume=4,showwaves=s=320x24:mode=cline:rate=${FPS}:colors=0xF0CB6E:scale=sqrt:draw=full,format=rgba,colorchannelmixer=aa=0.7[w]`);
  L.push(`[v3][w]overlay=x=${(W - 320) / 2}:y=1022:enable='between(t,${introEnd.toFixed(3)},${recEnd.toFixed(3)})'[vout]`);
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
  fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify({ surah: SURAH, ayahs: n, reciter: RECITER, clips: files.map((f) => `${f.id} (${f.title})`), recitationSec: +offset.toFixed(2), videoSec: +total.toFixed(2), screens: live.length, renderSec: +renderSec.toFixed(1), realtimeFactor: +(renderSec / total).toFixed(2), stills: stills.map((s) => s[0]) }, null, 2));
  console.log(fs.readFileSync(path.join(OUT, 'stats.json'), 'utf8'));
}

main().catch((e) => { console.error(e); process.exit(1); });
