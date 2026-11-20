// BASAER LIVE: one production surah file for the 24/7 stream (design approved 2026-11-20: Concept B "Mushaf panel" with
// Concept C's night grade). Encoded ONCE here; the streaming server only copies it (ffmpeg -c copy).
//
// Text: Quran.com API only (text_uthmani words), every screen checked against a second fresh API copy (verify_text.js)
//       before anything is encoded. No typed, generated, recognised or OCR'd Quran text anywhere.
// Audio: Quran.com recitation 8 (Minshawi Mujawwad) per-ayah files joined, so every ayah screen starts exactly where its
//        own audio file starts. Loudness -16 LUFS integrated by LINEAR gain; a brief limiter only if that gain would
//        push the true peak over the ceiling. No compression, no music, no effects.
// Picture: a 3m45s cycle of 15 slow, eye-checked nature shots (data/live_footage.json) at half speed with 5 s
//          dissolves, night grade; one fixed panel; surah intro card (with the reciter) at the start; ayah changes
//          cross-fade in 0.4 s; a small subscribe line 2 min into the recitation and then every 20 min.
//
// Usage: CHROME_BIN=... SURAH=67 [AYAHS=255-257] [CODECS=h264,hevc] node scripts/live_surah.js <outDir>
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
const RANGE = process.env.AYAHS ? process.env.AYAHS.split('-').map(Number) : null; // test excerpt only
const CODECS = (process.env.CODECS || 'h264,hevc').split(',');
const RECITER = 8;
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const W = 1280, H = 720, FPS = 30;
const LEAD = 6.0, TAIL = 1.5;            // seconds: intro card before the recitation, quiet tail after it
const XF = 0.4, XF_CARD = 0.8, STEPS = 5; // cross-fade lengths
const LUFS = -16, TP_CEIL = -1.5;
const PROMPT_FIRST = 120, PROMPT_EVERY = 1200, PROMPT_LEN = 8;
const PROFILES = {
  h264: { ext: 'mp4', args: '-c:v libx264 -preset medium -profile:v high -level:v 3.1 -b:v 3500k -minrate 3500k -maxrate 3500k -bufsize 7000k -x264-params "nal-hrd=cbr:force-cfr=1:open-gop=0:repeat-headers=1" -g 60 -keyint_min 60 -sc_threshold 0 -bf 2' },
  hevc: { ext: 'mp4', args: '-c:v libx265 -preset medium -profile:v main -tag:v hvc1 -b:v 2500k -x265-params "vbv-maxrate=2500:vbv-bufsize=5000:strict-cbr=1:hrd=1:keyint=60:min-keyint=60:scenecut=0:open-gop=0:repeat-headers=1:colorprim=bt709:transfer=bt709:colormatrix=bt709:log-level=error"' },
};
const GOLD = '#D9B45A', GOLD_HI = '#EBCB7C', TEXT = '#EFE6D2';
const HIZB = String.fromCharCode(0x06DE), ANNOT = String.fromCharCode(0x06ED, 0x06E2);
const WAQF = /[\u06D6-\u06DC]$/;

fs.mkdirSync(OUT, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surah-'));
const sh = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], shell: '/bin/bash', maxBuffer: 1 << 28 }).toString();
const arNum = (n) => Number(n).toLocaleString('ar-EG', { useGrouping: false });
// Arabic counted noun: 3-10 take the plural (آيات), 11+ the singular (آية).
const ayahWord = (n) => (n % 100 >= 3 && n % 100 <= 10 ? 'آيات' : 'آية');
const b64 = (p) => fs.readFileSync(path.join(ROOT, p)).toString('base64');
const ffDur = (f) => Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).trim());
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function getJson(url) {
  return new Promise((resolve, reject) => {
    const go = (n) => https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return n > 0 ? setTimeout(() => go(n - 1), 2000) : reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        if (data.includes('\uFFFD')) return reject(new Error(`${url} -> contains U+FFFD, refusing to render`));
        resolve(JSON.parse(data));
      });
    }).on('error', (e) => (n > 0 ? setTimeout(() => go(n - 1), 2000) : reject(e)));
    go(3);
  });
}

const RECITERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'reciters.json'), 'utf8'));
const RECITER_AR = RECITERS['9'].ar, RECITER_EN = RECITERS['9'].en;
const PHOTO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'reciter_photos.json'), 'utf8'))[RECITER];
if (!PHOTO || !PHOTO.approvedByOwner) throw new Error('no owner-approved photo for this reciter');
const photoUri = `data:image/jpeg;base64,${b64(PHOTO.file)}`;
const fontCss = `
  @font-face { font-family:'AQ'; src:url(data:font/woff2;base64,${amiriQuranBase64}) format('woff2'); }
  @font-face { font-family:'MS'; src:url(data:font/woff2;base64,${montserratBase64}) format('woff2'); font-weight:100 900; }
  @font-face { font-family:'RQ'; src:url(data:font/ttf;base64,${b64('assets/fonts/ArefRuqaa-Bold.ttf')}) format('truetype'); font-weight:700; }
  @font-face { font-family:'CZ'; src:url(data:font/ttf;base64,${b64('assets/fonts/Cinzel.ttf')}) format('truetype'); font-weight:400 900; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; position:relative; background:transparent; color:${TEXT}; }`;
const portrait = (s) => `<div style="width:${s}px;height:${s}px;border-radius:50%;padding:2px;background:linear-gradient(145deg,${GOLD_HI},#7d5e1e,${GOLD_HI});flex:none"><div style="width:100%;height:100%;border-radius:50%;background:url(${photoUri}) center 28%/cover;filter:sepia(.2) contrast(1.05)"></div></div>`;

function shot(html, png) {
  const p = png.replace(/\.png$/, '.html');
  fs.writeFileSync(p, html);
  sh(`"${CHROME}" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=${W},${H} --user-data-dir="${path.join(work, 'chrome')}" --virtual-time-budget=2500 --screenshot="${png}" "file://${p}" 2>&1 | tail -1`);
}

// ---------- the layers drawn by Chrome (transparent PNGs) ----------
// Always: LIVE dot (top left), brand (top right). Panel: hairline gold frame, surah tab. Never moves.
const chrome = (meta) => `
  <div style="position:absolute;top:34px;left:64px;display:flex;align-items:center;gap:7px;font:600 11px MS;letter-spacing:2.5px;color:${TEXT};opacity:.7"><span style="width:7px;height:7px;border-radius:50%;background:#C8453B"></span>LIVE</div>
  <div style="position:absolute;top:28px;right:64px;font-family:RQ;font-size:19px;color:${GOLD_HI};opacity:.7">بصائر ميديا</div>`;
const panel = (meta, inner, extra = '') => `
  <div style="position:absolute;left:110px;right:110px;top:176px;height:368px;border-radius:18px;background:rgba(4,10,18,.64);border:1px solid rgba(235,203,124,.32);box-shadow:0 20px 60px rgba(0,0,0,.45)">
    <div style="position:absolute;inset:8px;border-radius:12px;border:1px solid rgba(235,203,124,.12)"></div>
    <div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);background:#08131c;border:1px solid rgba(235,203,124,.42);border-radius:999px;padding:2px 26px 6px;white-space:nowrap">
      <span dir="rtl" style="font-family:RQ;font-size:22px;color:${GOLD_HI};unicode-bidi:isolate">سورة ${meta.ar} · ${arNum(meta.id)}</span></div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 56px">${inner}</div>
    ${extra}
  </div>`;

function ayahHtml(meta, scr, flags) {
  const spans = scr.words.map((w) => `<span>${w}</span>`).join(' ');
  const end = scr.last && scr.no > 0 ? `<span style="font-family:AQ;color:${GOLD_HI};margin-right:10px">\u06DD${arNum(scr.no)}</span>` : '';
  const page = scr.pages > 1 ? `<div style="position:absolute;bottom:14px;left:0;right:0;text-align:center;font:600 11px MS;letter-spacing:2px;color:${TEXT};opacity:.5">${scr.page} / ${scr.pages}</div>` : '';
  const label = scr.no === 0 ? `<div style="position:absolute;bottom:14px;left:0;right:0;text-align:center;font:600 11px MS;letter-spacing:2px;color:${TEXT};opacity:.45">BISMILLAH</div>` : '';
  const inner = `<div id="wrap" style="direction:rtl;text-align:center;font-family:AQ;line-height:2.0;max-width:1000px"><div class="arabic" id="arabic">${spans}</div>${end}</div>`;
  const reciter = flags.reciter ? `<div style="position:absolute;bottom:58px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:12px">${portrait(36)}<div dir="rtl" style="font-family:AQ;font-size:17px;line-height:1.6;opacity:.9">الشيخ ${RECITER_AR} <span style="opacity:.6">· المصحف المجوَّد</span></div></div>` : '';
  const prompt = flags.prompt ? `<div style="position:absolute;bottom:62px;left:0;right:0;text-align:center"><span dir="rtl" style="font-family:AQ;font-size:17px;color:${GOLD_HI};opacity:.85">اشترك في بصائر ميديا لتصلك التلاوات</span><span style="font:600 11px MS;letter-spacing:2px;opacity:.55;margin-left:12px">SUBSCRIBE</span></div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss} .arabic{display:inline}</style></head><body>${chrome(meta)}${panel(meta, inner, page + label)}${reciter}${prompt}
  <script>document.fonts.ready.then(()=>{const w=document.getElementById('wrap');let s=64;w.style.fontSize=s+'px';while(s>40&&(w.scrollHeight>300||w.scrollWidth>1000)){s-=2;w.style.fontSize=s+'px';}});</script></body></html>`;
}

function introHtml(meta) {
  const place = meta.place === 'makkah' ? ['مكية', 'MAKKI'] : ['مدنية', 'MADANI'];
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}</style></head><body>${chrome(meta)}
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse 55% 50% at 50% 50%,rgba(4,10,18,.55),rgba(4,10,18,0))">
    <div dir="rtl" style="font-family:RQ;font-size:92px;color:${GOLD_HI};line-height:1.45;text-shadow:0 0 18px rgba(235,203,124,.3)">سورة ${meta.ar}</div>
    <div style="font:700 21px CZ;letter-spacing:8px;margin-top:-4px">${meta.en.toUpperCase()}</div>
    <div dir="rtl" style="font-family:AQ;font-size:18px;opacity:.8;margin-top:10px;line-height:1.8">السورة ${arNum(meta.id)} · ${place[0]} · ${arNum(meta.count)} ${ayahWord(meta.count)}</div>
    <div style="font:600 11px MS;letter-spacing:3px;opacity:.6;margin-top:2px">SURAH ${meta.id} · ${place[1]} · ${meta.count} AYAHS</div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:38px">${portrait(54)}<div><div dir="rtl" style="font-family:AQ;font-size:21px;line-height:1.7">الشيخ ${RECITER_AR}</div><div style="font:600 11px MS;letter-spacing:2px;color:${GOLD_HI};opacity:.85">SHEIKH ${RECITER_EN.toUpperCase()} · MUJAWWAD</div></div></div>
  </div></body></html>`;
}
const chromeOnlyHtml = (meta) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}</style></head><body>${chrome(meta)}</body></html>`;

const displayWords = (v) => v.words.filter((w) => w.char_type_name === 'word')
  .map((w) => [...w.text_uthmani].filter((c) => c !== HIZB && !ANNOT.includes(c)).join('').replace(/\s+/g, ' ').trim()).filter(Boolean);

// Long ayahs are split into pages (at most ~150 characters each), preferring a waqf sign as the break.
function paginate(words) {
  const len = (ws) => ws.join(' ').length;
  if (len(words) <= 170) return [[0, words.length - 1]];
  const k = Math.ceil(len(words) / 150), per = words.length / k, pages = [];
  let start = 0;
  for (let p = 1; p < k; p++) {
    let cut = Math.round(per * p) - 1;
    for (let d = 0; d <= 4; d++) {
      if (cut - d > start && WAQF.test(words[cut - d])) { cut -= d; break; }
      if (cut + d < words.length - 1 && WAQF.test(words[cut + d])) { cut += d; break; }
    }
    pages.push([start, cut]); start = cut + 1;
  }
  pages.push([start, words.length - 1]);
  return pages;
}

async function main() {
  const t0 = Date.now();
  const chap = (await getJson(`https://api.quran.com/api/v4/chapters/${SURAH}?language=en`)).chapter;
  const meta = { id: chap.id, ar: chap.name_arabic, en: chap.name_simple, place: chap.revelation_place, count: chap.verses_count };
  log(`surah ${meta.id} ${meta.en}: ${meta.count} ayahs, ${meta.place}`);

  // 1. TEXT + AUDIO LIST
  const verses = [];
  for (let page = 1; verses.length < chap.verses_count; page++) {
    const r = await getJson(`https://api.quran.com/api/v4/verses/by_chapter/${SURAH}?words=true&word_fields=text_uthmani&audio=${RECITER}&per_page=50&page=${page}`);
    if (!r.verses.length) break;
    verses.push(...r.verses);
  }
  if (verses.length !== chap.verses_count) throw new Error(`API gave ${verses.length} ayahs, chapter has ${chap.verses_count}`);
  const pick = RANGE ? verses.filter((v) => v.verse_number >= RANGE[0] && v.verse_number <= (RANGE[1] || RANGE[0])) : verses;
  const unit = (v, no) => {
    if (!v.audio || !v.audio.url) throw new Error(`${v.verse_key}: no recitation-${RECITER} audio`);
    return { no, key: v.verse_key, words: displayWords(v), audioUrl: 'https://verses.quran.com/' + v.audio.url,
      segs: (v.audio.segments || []).filter((s) => Array.isArray(s) && s.length >= 4).map((s) => [s[1], s[2]]) };
  };
  const units = pick.map((v) => unit(v, v.verse_number));
  // Bismillah (the reciter's own 1:1) before every surah except Al-Fatiha (where it is ayah 1) and At-Tawbah.
  if (SURAH !== 1 && SURAH !== 9 && !RANGE) {
    const b = (await getJson(`https://api.quran.com/api/v4/verses/by_key/1:1?words=true&word_fields=text_uthmani&audio=${RECITER}`)).verse;
    units.unshift(unit(b, 0));
  }

  // 2. AUDIO: join per-ayah files, measure, linear gain to -16 LUFS, limiter only if the peak would pass the ceiling.
  const parts = [];
  let offset = 0;
  for (const u of units) {
    const mp3 = path.join(work, `a${u.key.replace(':', '_')}_${u.no}.mp3`), wav = mp3.replace(/\.mp3$/, '.wav');
    sh(`curl -sSfL --retry 4 "${u.audioUrl}" -o "${mp3}"`);
    sh(`ffmpeg -nostdin -loglevel error -y -i "${mp3}" -ar 48000 -ac 2 "${wav}"`);
    u.offset = offset; u.dur = ffDur(wav); offset += u.dur; parts.push(wav);
  }
  fs.writeFileSync(path.join(work, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  const raw = path.join(work, 'raw.wav');
  sh(`ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i "${path.join(work, 'list.txt')}" -c copy "${raw}"`);
  const measure = (f) => {
    const e = execSync(`ffmpeg -nostdin -hide_banner -nostats -i "${f}" -af ebur128=peak=true:framelog=quiet -f null - 2>&1`, { shell: '/bin/bash' }).toString();
    return { I: Number((e.match(/I:\s+(-?[\d.]+) LUFS/g) || ['']).pop().replace(/[^-\d.]/g, '')), TP: Number((e.match(/Peak:\s+(-?[\d.]+) dBFS/g) || ['']).pop().replace(/[^-\d.]/g, '')), LRA: Number((e.match(/LRA:\s+([\d.]+) LU/g) || ['']).pop().replace(/[^\d.]/g, '')) };
  };
  const before = measure(raw);
  const gain = +(LUFS - before.I).toFixed(2);
  const limiter = before.TP + gain > TP_CEIL;
  const audio = path.join(work, 'audio.wav');
  const recEnd = LEAD + offset, total = recEnd + TAIL;
  sh(`ffmpeg -nostdin -loglevel error -y -i "${raw}" -af "volume=${gain}dB${limiter ? `,alimiter=limit=${Math.pow(10, (TP_CEIL - 0.5) / 20).toFixed(4)}:attack=5:release=60:level=false` : ''},adelay=${Math.round(LEAD * 1000)}:all=1,apad=pad_dur=${TAIL},atrim=0:${total.toFixed(3)}" -ar 48000 -ac 2 "${audio}"`);
  const after = measure(audio);
  log(`audio ${offset.toFixed(1)} s: ${before.I} LUFS / ${before.TP} dBTP -> gain ${gain} dB${limiter ? ' + limiter' : ''} -> ${after.I} LUFS / ${after.TP} dBTP, LRA ${before.LRA} -> ${after.LRA}`);

  // 3. SCREENS: one per ayah page, timed from the ayah's own file start (and its word timings for later pages).
  const screens = [];
  for (const u of units) {
    const pages = paginate(u.words);
    const start = LEAD + u.offset, end = start + u.dur;
    let prevT = start;
    pages.forEach(([a, b], i) => {
      let t = start;
      if (i > 0) {
        const seg = u.segs.find((s) => s[0] === a + 1);
        t = seg ? start + seg[1] / 1000 : start + u.dur * (a / u.words.length);
        t = Math.max(t, prevT + 1.5);
      }
      screens.push({ key: u.key, no: u.no, words: u.words.slice(a, b + 1), from: a, to: b, page: i + 1, pages: pages.length, last: i === pages.length - 1, t });
      prevT = t;
    });
    screens[screens.length - 1].end = end;
  }
  screens.forEach((s, i) => { s.t1 = i + 1 < screens.length ? screens[i + 1].t : recEnd; });

  // 4. INTEGRITY: every screen vs a second, independent API copy, character by character.
  const issues = [];
  const fresh = new Map();
  for (const s of screens) {
    if (!fresh.has(s.key)) {
      const f = (await getJson(`https://api.quran.com/api/v4/verses/by_key/${s.key}?words=true&word_fields=text_uthmani&fields=text_uthmani`)).verse;
      fresh.set(s.key, { arabic: f.text_uthmani, words: f.words.filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani), english: '' });
    }
    s.html = ayahHtml(meta, s, {});
    issues.push(...checkOverlay(`${s.key} p${s.page}`, readOverlay(s.html), fresh.get(s.key), { from: s.from, to: s.to, hideEnglish: true }));
  }
  if (screens.filter((s) => s.no > 0 && s.last).length !== pick.length) issues.push(`screens cover ${screens.filter((s) => s.no > 0 && s.last).length} ayahs, expected ${pick.length}`);
  if (issues.length) { console.error('INTEGRITY FAILED:\n' + issues.join('\n')); process.exit(1); }
  log(`integrity: ${screens.length} screens identical to a fresh API copy`);

  // 5. TIMELINE OF STATES (what is on screen) -> one PNG per distinct state, cross-fades between them.
  const prompts = [];
  for (let t = LEAD + PROMPT_FIRST; t + PROMPT_LEN < recEnd - 10; t += PROMPT_EVERY) prompts.push([t, t + PROMPT_LEN]);
  const cuts = new Set([0, LEAD, recEnd, total, LEAD + 25, ...screens.map((s) => s.t), ...prompts.flat()]);
  const times = [...cuts].filter((t) => t >= 0 && t <= total).sort((a, b) => a - b);
  const states = [];
  for (let i = 0; i + 1 < times.length; i++) {
    const a = times[i], b = times[i + 1], mid = (a + b) / 2;
    if (b - a < 0.01) continue;
    let st;
    if (mid < LEAD) st = { kind: 'intro' };
    else if (mid >= recEnd) st = { kind: 'none' };
    else {
      const s = [...screens].reverse().find((x) => x.t <= mid + 1e-6) || screens[0];
      st = { kind: 'ayah', s, reciter: mid < LEAD + 25, prompt: prompts.some(([p, q]) => mid >= p && mid < q) && !(mid < LEAD + 25) };
    }
    st.id = st.kind === 'ayah' ? `${st.s.key}_${st.s.no}_${st.s.page}_${st.reciter ? 1 : 0}${st.prompt ? 1 : 0}` : st.kind;
    const last = states[states.length - 1];
    if (last && last.id === st.id) last.b = b; else states.push({ ...st, a, b });
  }
  const pngs = new Map();
  for (const st of states) {
    if (pngs.has(st.id)) continue;
    const png = path.join(work, `s_${pngs.size}.png`);
    if (st.kind === 'intro') shot(introHtml(meta), png);
    else if (st.kind === 'none') shot(chromeOnlyHtml(meta), png);
    else shot(ayahHtml(meta, st.s, { reciter: st.reciter, prompt: st.prompt }), png);
    pngs.set(st.id, png);
  }
  log(`states: ${states.length} (${pngs.size} distinct images)`);
  const blendCache = new Map();
  const blend = (p1, p2, k) => {
    const key = `${p1}|${p2}|${k}`;
    if (!blendCache.has(key)) {
      const out = path.join(work, `x_${blendCache.size}.png`);
      sh(`ffmpeg -nostdin -loglevel error -y -i "${p1}" -i "${p2}" -filter_complex "[0]format=rgba[a];[1]format=rgba[b];[a][b]blend=all_expr='A*(1-${k})+B*${k}'" "${out}"`);
      blendCache.set(key, out);
    }
    return blendCache.get(key);
  };
  // Each state shows solid for its span minus half of each neighbouring cross-fade; the fade frames sit on the boundary.
  const xfAt = (i) => (i < 0 || i + 1 >= states.length ? 0 : (states[i].kind !== 'ayah' || states[i + 1].kind !== 'ayah' ? XF_CARD : XF));
  const seq = [];
  states.forEach((st, i) => {
    const png = pngs.get(st.id);
    seq.push([png, Math.max(1 / FPS, st.b - st.a - xfAt(i - 1) / 2 - xfAt(i) / 2)]);
    const xf = xfAt(i);
    if (xf) for (let k = 1; k <= STEPS; k++) seq.push([blend(png, pngs.get(states[i + 1].id), (k / (STEPS + 1)).toFixed(3)), xf / STEPS]);
  });
  const ovList = path.join(work, 'overlays.txt');
  fs.writeFileSync(ovList, seq.map(([p, d]) => `file '${p}'\nduration ${d.toFixed(4)}`).join('\n') + `\nfile '${seq[seq.length - 1][0]}'\n`);

  // 6. BACKGROUND: 15 calm shots, middle 10 s of each at half speed (frame-blended), 5 s dissolves, night grade.
  //    Built as a seamless 225 s cycle (the last dissolve runs back into the first shot), started at a surah-dependent shot.
  const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'live_footage.json'), 'utf8')).clips;
  const order = lib.map((_, k) => lib[(k + SURAH * 4) % lib.length]);
  const clips = [...order, order[0]];
  const SEG = 20, XD = 5;
  const inputs = [], fl = [];
  for (const [k, id] of clips.entries()) {
    const f = path.join(work, `${id}.mp4`);
    if (!fs.existsSync(f)) sh(`node "${path.join(__dirname, 'r2_download.js')}" "${f}" "https://basaer-media.ahbrandsbh.com/basaer/youtube/footage-graded/${id}.mp4"`);
    inputs.push(`-i "${f}"`);
    fl.push(`[${k}:v]trim=2:12,setpts=2*(PTS-STARTPTS),minterpolate=fps=${FPS}:mi_mode=blend,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,format=yuv420p,trim=0:${SEG},setpts=PTS-STARTPTS[c${k}]`);
  }
  let prev = 'c0';
  for (let k = 1; k < clips.length; k++) { fl.push(`[${prev}][c${k}]xfade=transition=fade:duration=${XD}:offset=${k * (SEG - XD)}[x${k}]`); prev = `x${k}`; }
  const cycle = order.length * (SEG - XD);
  fl.push(`[${prev}]trim=${XD}:${XD + cycle},setpts=PTS-STARTPTS,eq=brightness=-0.06:saturation=0.62:contrast=0.96,gblur=sigma=0.6[bg]`);
  fs.writeFileSync(path.join(work, 'bg.txt'), fl.join(';\n'));
  const reel = path.join(work, 'reel.mp4');
  sh(`ffmpeg -nostdin -loglevel error -y ${inputs.join(' ')} -filter_complex_script "${path.join(work, 'bg.txt')}" -map "[bg]" -c:v libx264 -preset veryfast -crf 14 -pix_fmt yuv420p "${reel}"`);
  log(`background cycle ${cycle} s built`);

  // Night scrim: darker centre band behind the panel and dark edges (Concept C grade).
  const scrim = path.join(work, 'scrim.png');
  shot(`<!DOCTYPE html><html><head><style>*{margin:0}body{width:${W}px;height:${H}px;background:radial-gradient(ellipse 80% 70% at 50% 50%,rgba(3,8,16,.42),rgba(3,8,16,.82))}</style></head><body></body></html>`, scrim);

  // 7. COMPOSITE ONCE, ENCODE EACH CODEC (same picture, same audio, same timing).
  const fc = [`[0:v]fps=${FPS},format=yuv420p[b0]`, `[1:v]format=rgba[sc]`, `[b0][sc]overlay=0:0[b1]`, `[2:v]fps=${FPS},format=rgba[ov]`,
    `[b1][ov]overlay=0:0:eof_action=pass,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv,split=${CODECS.length}${CODECS.map((c) => `[v_${c}]`).join('')}`];
  fs.writeFileSync(path.join(work, 'fc.txt'), fc.join(';\n'));
  const outs = CODECS.map((c) => `-map "[v_${c}]" -map 3:a ${PROFILES[c].args} -r ${FPS} -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 128k -ar 48000 -ac 2 -t ${total.toFixed(3)} -movflags +faststart "${path.join(OUT, `${String(SURAH).padStart(3, '0')}${RANGE ? '_' + RANGE.join('-') : ''}.${c}.mp4`)}"`);
  const te = Date.now();
  sh(`ffmpeg -nostdin -loglevel error -y -stream_loop -1 -i "${reel}" -loop 1 -framerate ${FPS} -i "${scrim}" -f concat -safe 0 -i "${ovList}" -i "${audio}" -filter_complex_script "${path.join(work, 'fc.txt')}" ${outs.join(' ')}`);
  const encSec = (Date.now() - te) / 1000;

  // 8. CHECKS + EVIDENCE
  const report = { surah: SURAH, range: RANGE, en: meta.en, ayahs: pick.length, screens: screens.length, durationSec: +total.toFixed(2), recitationSec: +offset.toFixed(2),
    audio: { before, gain, limiter, after }, encodeWallSec: Math.round(encSec), files: {} };
  const name = (c) => path.join(OUT, `${String(SURAH).padStart(3, '0')}${RANGE ? '_' + RANGE.join('-') : ''}.${c}.mp4`);
  const stillAt = [3, LEAD + 2, ...(screens.find((s) => s.pages > 1) ? [screens.find((s) => s.pages > 1).t + 1] : []), ...(prompts[0] ? [prompts[0][0] + 3] : []), (LEAD + recEnd) / 2, recEnd - 1];
  for (const c of CODECS) {
    const f = name(c);
    const v = JSON.parse(sh(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,color_primaries,color_transfer,color_space,bit_rate -of json "${f}"`)).streams[0];
    const a = JSON.parse(sh(`ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,bit_rate -of json "${f}"`)).streams[0];
    const kf = sh(`ffprobe -v error -select_streams v:0 -skip_frame nokey -show_entries frame=pts_time -of csv=p=0 "${f}" | head -6`).trim().split('\n').map(Number);
    const bytes = fs.statSync(f).size, dur = ffDur(f);
    report.files[c] = { file: path.basename(f), bytes, durationSec: +dur.toFixed(2), totalKbps: Math.round(bytes * 8 / dur / 1000), video: v, audio: a, firstKeyframes: kf };
    for (const t of stillAt) sh(`ffmpeg -nostdin -loglevel error -y -ss ${t.toFixed(2)} -i "${f}" -frames:v 1 "${path.join(OUT, `still_${String(SURAH).padStart(3, '0')}_${c}_${t.toFixed(0)}s.png`)}"`);
  }
  report.timeline = screens.map((s) => ({ key: s.key, no: s.no, page: s.page, pages: s.pages, t: +s.t.toFixed(2), t1: +s.t1.toFixed(2), words: s.words.length }));
  report.prompts = prompts;
  report.wallSec = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(OUT, `report_${String(SURAH).padStart(3, '0')}${RANGE ? '_' + RANGE.join('-') : ''}.json`), JSON.stringify(report, null, 1));
  log(JSON.stringify({ ...report, timeline: undefined }));
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });
