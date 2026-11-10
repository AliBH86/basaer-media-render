#!/usr/bin/env node
// YouTube LIVE (owner, 2026-11-10: "start with Al-Minshawi, full Quran"): one transparent 1280x720 title card per surah.
// The live stream shows NO ayah text: only the surah name (from the Quran.com chapters API, never typed), the reciter with
// his owner-approved photo (YouTube-only exception) and the brand. The cards are laid over a looping nature shot on the
// streaming server (live/build_loops.sh), so the picture is encoded once and the stream itself only copies it.
// Usage: CHROME_BIN=... node scripts/live_cards.js out/live-cards [reciterKey=8]
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { amiriQuranBase64, montserratBase64 } = require('./font_data');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || 'out/live-cards');
const RECITER = Number(process.argv[3] || 8);
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const W = 1280, H = 720;
const RECITERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'reciters.json'), 'utf8'));
const NAME_KEY = { 8: '9' }[RECITER] || String(RECITER);
const RECITER_AR = RECITERS[NAME_KEY].ar, RECITER_EN = RECITERS[NAME_KEY].en;
const PHOTO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'reciter_photos.json'), 'utf8'))[RECITER];
if (!PHOTO || !PHOTO.approvedByOwner) throw new Error('no owner-approved photo for this reciter');
const b64 = (p) => fs.readFileSync(path.join(ROOT, p)).toString('base64');
const photoUri = `data:image/${/.png$/i.test(PHOTO.file) ? 'png' : 'jpeg'};base64,${b64(PHOTO.file)}`;
const GOLD = '#D9B45A', GOLD_HI = '#F0CB6E', CREAM = '#F7F1E6';
const arNum = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });
const enName = (c) => c.name_simple;

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
  @font-face { font-family:'RQ'; src:url(data:font/ttf;base64,${b64('assets/fonts/ArefRuqaa-Bold.ttf')}) format('truetype'); font-weight:700; }
  @font-face { font-family:'CZ'; src:url(data:font/ttf;base64,${b64('assets/fonts/Cinzel.ttf')}) format('truetype'); font-weight:400 900; }
  * { margin:0; padding:0; box-sizing:border-box; }`;
const glow = `text-shadow:0 0 14px rgba(240,203,110,0.45), 0 3px 14px rgba(0,0,0,0.8);`;
const divider = (w) => `<div style="display:flex;align-items:center;justify-content:center;gap:10px;"><span style="width:${w}px;height:1px;background:linear-gradient(90deg, transparent, ${GOLD});"></span><span style="width:7px;height:7px;transform:rotate(45deg);border:1.5px solid ${GOLD};"></span><span style="width:${w}px;height:1px;background:linear-gradient(90deg, ${GOLD}, transparent);"></span></div>`;
const portrait = (size) => `<div style="width:${size}px;height:${size}px;border-radius:50%;padding:3px;background:linear-gradient(145deg, ${GOLD_HI}, #8C6A22 55%, ${GOLD_HI});box-shadow:0 0 ${size / 5}px rgba(240,203,110,0.35), 0 6px 20px rgba(0,0,0,0.6);flex:none;"><div style="width:100%;height:100%;border-radius:50%;background:url(${photoUri}) center 30%/cover;filter:sepia(0.25) contrast(1.05);"></div></div>`;
const bell = `<svg width="22" height="22" viewBox="0 0 24 24" fill="${GOLD_HI}" style="flex:none;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;

function cardHtml(c) {
  const placeAr = c.revelation_place === 'makkah' ? 'مكية' : 'مدنية', placeEn = c.revelation_place === 'makkah' ? 'MECCAN' : 'MEDINAN';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  body { width:${W}px; height:${H}px; overflow:hidden; position:relative; color:${CREAM}; background:
    radial-gradient(ellipse 58% 46% at 50% 47%, rgba(6,18,25,0.60) 0%, rgba(6,18,25,0.36) 62%, rgba(6,18,25,0) 100%),
    linear-gradient(180deg, rgba(6,18,25,0.72) 0%, rgba(6,18,25,0) 24%, rgba(6,18,25,0) 70%, rgba(6,18,25,0.88) 100%); }
  .brand { position:absolute; top:28px; left:42px; display:flex; align-items:center; gap:10px; }
  .brand-ar { font-family:'RQ'; font-size:32px; color:${GOLD_HI}; line-height:1.3; ${glow} }
  .brand-en { font-family:'CZ'; font-size:13px; letter-spacing:4px; font-weight:700; opacity:0.85; }
  .live { position:absolute; top:30px; right:42px; display:flex; align-items:center; gap:10px; border:1.5px solid rgba(240,203,110,0.75); border-radius:999px; padding:4px 20px 6px; background:rgba(6,18,25,0.5); }
  .dot { width:10px; height:10px; border-radius:50%; background:#E0463C; box-shadow:0 0 10px rgba(224,70,60,0.9); }
  .live-ar { font-family:'AQ'; font-size:20px; direction:rtl; color:${GOLD_HI}; line-height:1.7; }
  .live-en { font-family:'CZ'; font-size:12px; letter-spacing:3px; font-weight:700; }
  .mid { position:absolute; top:150px; left:0; width:100%; text-align:center; }
  .s { font-family:'RQ'; font-size:40px; line-height:1.2; ${glow} }
  .ar { font-family:'RQ'; font-size:150px; color:${GOLD_HI}; line-height:1.25; direction:rtl; ${glow} }
  .en { font-family:'CZ'; font-size:36px; letter-spacing:9px; font-weight:800; margin-top:2px; text-shadow:0 3px 14px rgba(0,0,0,0.85); }
  .meta { font-family:'CZ'; font-size:14px; letter-spacing:4px; font-weight:700; opacity:0.9; margin:10px 0 12px; }
  .meta-ar { font-family:'AQ'; font-size:20px; direction:rtl; opacity:0.95; line-height:1.8; }
  .rec { position:absolute; left:42px; bottom:34px; display:flex; align-items:center; gap:16px; }
  .rec-ar { font-family:'AQ'; font-size:25px; line-height:1.9; direction:rtl; margin-top:-10px; text-shadow:0 2px 10px rgba(0,0,0,0.85); }
  .rec-en { font-family:'CZ'; font-size:12px; letter-spacing:2px; font-weight:700; color:${GOLD_HI}; }
  .right { position:absolute; right:42px; bottom:40px; text-align:right; }
  .sub { display:inline-flex; align-items:center; gap:10px; border:1.5px solid rgba(240,203,110,0.8); border-radius:999px; padding:3px 18px 5px; background:rgba(6,18,25,0.55); }
  .sub-ar { font-family:'AQ'; font-size:20px; direction:rtl; color:${GOLD_HI}; line-height:1.7; }
  .sub-en { font-family:'CZ'; font-size:12px; letter-spacing:3px; font-weight:700; }
  .handle { font-family:'CZ'; font-size:14px; color:${GOLD_HI}; font-weight:700; letter-spacing:2px; margin-top:8px; }
  </style></head><body>
  <div class="brand"><span class="brand-ar">بصائر ميديا</span><span class="brand-en">BASAER MEDIA</span></div>
  <div class="live"><span class="dot"></span><span class="live-ar">بث مباشر · المصحف المجوَّد</span><span class="live-en">LIVE</span></div>
  <div class="mid">
    <div class="s">سورة</div>
    <div class="ar">${c.name_arabic}</div>
    <div class="en">${enName(c).toUpperCase()}</div>
    <div class="meta">SURAH ${c.id} OF 114 · ${c.verses_count} AYAHS · ${placeEn}</div>
    ${divider(120)}
    <div class="meta-ar">السورة ${arNum(c.id)} من ${arNum(114)} · ${arNum(c.verses_count)} آية · ${placeAr}</div>
  </div>
  <div class="rec">${portrait(84)}<div><div class="rec-ar">الشيخ ${RECITER_AR} · مجوَّد</div><div class="rec-en">SHEIKH ${RECITER_EN.toUpperCase()} · MUJAWWAD</div></div></div>
  <div class="right"><div class="sub">${bell}<span class="sub-ar">اشترك</span><span class="sub-en">SUBSCRIBE</span></div><div class="handle">@Basaermedia_bh</div></div>
  </body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chapters } = await getJson('https://api.quran.com/api/v4/chapters?language=en');
  if (!Array.isArray(chapters) || chapters.length !== 114) throw new Error('chapters API did not return 114 surahs');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'live-cards-'));
  const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
  for (const c of chapters) {
    if (only && !only.includes(c.id)) continue;
    const id = String(c.id).padStart(3, '0');
    const html = path.join(OUT, `${id}.html`), png = path.join(OUT, `${id}.png`);
    fs.writeFileSync(html, cardHtml(c));
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--window-size=${W},${H}`, `--user-data-dir=${prof}`, '--virtual-time-budget=1500', `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/').replace(/^\//, '')], { stdio: 'ignore' });
    fs.unlinkSync(html);
  }
  fs.writeFileSync(path.join(OUT, 'chapters.json'), JSON.stringify(chapters.map((c) => ({ id: c.id, ar: c.name_arabic, en: c.name_simple, ayahs: c.verses_count })), null, 1));
  console.log('cards written to ' + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
