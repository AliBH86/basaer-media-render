// SAMPLE prayer-time cards (research only, 2026-10-04). Nothing is scheduled or published.
// Fetches 7 days of calculated times for Manama from the Aladhan API (Gulf Region = method 8 for the Sunni column,
// Shia Ithna-Ashari / Leva Institute Qum = method 0 for the Ja'fari column; explicit coordinates, Asia/Bahrain),
// renders three 1080x1350 cards in the Basaer navy/gold design and uploads them to Cloudinary qa-overnight as
// SAMPLE-prayer-daily, SAMPLE-prayer-weekly-sunni, SAMPLE-prayer-weekly-jafari.
// Usage: node scripts/sample_prayer_cards.js <outDir> <startDate dd-mm-yyyy>
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const outDir = path.resolve(process.argv[2] || 'out/samples');
const start = process.argv[3] || '04-10-2026';
fs.mkdirSync(outDir, { recursive: true });
const LAT = 26.2235, LON = 50.5876, TZ = 'Asia/Bahrain';
const METHODS = { sunni: 8, jafari: 0 };
const PRAYERS = [
  ['Fajr', 'الفجر'], ['Sunrise', 'الشروق'], ['Dhuhr', 'الظهر'], ['Asr', 'العصر'], ['Maghrib', 'المغرب'], ['Isha', 'العشاء'],
];
const DAYS_AR = { Sun: 'الأحد', Mon: 'الاثنين', Tue: 'الثلاثاء', Wed: 'الأربعاء', Thu: 'الخميس', Fri: 'الجمعة', Sat: 'السبت' };
const SCH = 'https://res.cloudinary.com/b72gfdzx/raw/upload/v1790960346/fonts/scheherazade-regular.woff2';
const SCH_B = 'https://res.cloudinary.com/b72gfdzx/raw/upload/v1790960348/fonts/scheherazade-bold.woff2';
const INTER = 'https://res.cloudinary.com/b72gfdzx/raw/upload/v1790955379/fonts/inter-regular.woff2';

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
const dateAdd = (dmy, n) => { const [d, m, y] = dmy.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${String(t.getUTCDate()).padStart(2, '0')}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${t.getUTCFullYear()}`; };
const clean = (s) => String(s).replace(/\s*\(.*\)\s*/, '');

const STYLE = `
@font-face{font-family:'Scheherazade';font-weight:400;src:url(${SCH}) format('woff2')}
@font-face{font-family:'Scheherazade';font-weight:700;src:url(${SCH_B}) format('woff2')}
@font-face{font-family:'Inter';font-weight:400;src:url(${INTER}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;background:#0F2A3D;overflow:hidden}
.frame{width:984px;height:1254px;margin:48px;border:2px solid #C9A24B;display:flex;flex-direction:column;align-items:center;padding:56px 70px}
.t-ar{font-family:'Scheherazade',serif;font-weight:700;font-size:64px;color:#C9A24B;direction:rtl;line-height:1.3}
.t-en{font-family:'Inter',sans-serif;font-size:24px;letter-spacing:4px;color:#C9A24B;text-transform:uppercase;margin-top:6px}
.date{font-family:'Inter',sans-serif;font-size:24px;color:#D9CFB8;margin-top:22px;text-align:center;line-height:1.5}
.date .ar{font-family:'Scheherazade',serif;font-size:30px;direction:rtl}
.divider{width:90px;height:3px;background:#C9A24B;margin:28px 0}
table{border-collapse:collapse;width:100%}
th{font-family:'Inter',sans-serif;color:#C9A24B;font-weight:400;font-size:22px;letter-spacing:2px;padding:10px 6px;border-bottom:1px solid #C9A24B66}
th .ar{display:block;font-family:'Scheherazade',serif;font-size:30px;letter-spacing:0;direction:rtl}
td{font-family:'Inter',sans-serif;color:#F5EDDC;font-size:34px;text-align:center;padding:14px 6px;border-bottom:1px solid #ffffff14}
td.lbl{text-align:left;color:#D9CFB8;font-size:26px}
td.lbl .ar{font-family:'Scheherazade',serif;font-size:34px;color:#F5EDDC;float:right;direction:rtl}
.wk td{font-size:25px;padding:12px 2px}.wk td.lbl{font-size:20px}.wk td.lbl .ar{font-size:26px}.wk th{font-size:16px;letter-spacing:1px;padding:8px 2px}.wk th .ar{font-size:24px}
.note{margin-top:auto;text-align:center;font-family:'Inter',sans-serif;color:#8a9bab;font-size:19px;line-height:1.6}
.note .ar{font-family:'Scheherazade',serif;font-size:24px;direction:rtl}
.handle{font-family:'Inter',sans-serif;font-size:24px;color:#C9A24B;margin-top:14px}
.sample{position:absolute;top:18px;right:18px;font:bold 18px sans-serif;color:#0F2A3D;background:#C9A24B;padding:4px 10px;letter-spacing:2px}
`;
const page = (inner) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body><div class="sample">SAMPLE</div><div class="frame">${inner}</div><script>document.fonts.ready.then(()=>{window.__done=true})</script></body></html>`;

(async () => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = dateAdd(start, i);
    const row = { d };
    for (const [k, m] of Object.entries(METHODS)) {
      const j = await getJson(`https://api.aladhan.com/v1/timings/${d}?latitude=${LAT}&longitude=${LON}&method=${m}&timezonestring=${TZ}`);
      row[k] = j.data.timings;
      row.hijri = j.data.date.hijri;
      row.greg = j.data.date.gregorian;
    }
    days.push(row);
  }
  const t0 = days[0];
  const gregEn = `${t0.greg.weekday.en} ${Number(t0.greg.day)} ${t0.greg.month.en} ${t0.greg.year}`;
  const hijri = `${Number(t0.hijri.day)} ${t0.hijri.month.ar} ${t0.hijri.year} هـ`;
  const footer = (methods) => `<div class="note"><span class="ar">أوقات محسوبة · قد تختلف دقائق عن التقويم الرسمي</span><br>Calculated times · may differ by a few minutes from the official timetable<br>${methods} · AlAdhan.com</div><div class="handle">@basaer.media.bh</div>`;

  const daily = page(`<div class="t-ar">مواقيت الصلاة</div><div class="t-en">Prayer Times · Manama</div>
    <div class="date"><span class="ar">${DAYS_AR[t0.greg.weekday.en.slice(0, 3)]} · ${hijri}</span><br>${gregEn}</div><div class="divider"></div>
    <table><tr><th></th><th><span class="ar">أهل السنة</span>SUNNI</th><th><span class="ar">الجعفري</span>JA'FARI</th></tr>
    ${PRAYERS.map(([en, ar]) => `<tr><td class="lbl">${en}<span class="ar">${ar}</span></td><td>${clean(t0.sunni[en])}</td><td>${clean(t0.jafari[en])}</td></tr>`).join('')}</table>
    ${footer('Sunni: Gulf Region method · Ja\'fari: Leva Institute, Qum')}`);

  const weekly = (k, title, titleAr, method) => page(`<div class="t-ar">${titleAr}</div><div class="t-en">${title} · Manama · This Week</div><div class="divider"></div>
    <table class="wk"><tr><th></th>${PRAYERS.map(([en, ar]) => `<th><span class="ar">${ar}</span>${en.toUpperCase()}</th>`).join('')}</tr>
    ${days.map((r) => { const wd = r.greg.weekday.en.slice(0, 3); return `<tr><td class="lbl">${wd} ${Number(r.greg.day)}/${Number(r.greg.month.number)}<span class="ar">${DAYS_AR[wd]}</span></td>${PRAYERS.map(([en]) => `<td>${clean(r[k][en])}</td>`).join('')}</tr>`; }).join('')}</table>
    ${footer(method)}`);

  const cards = {
    'SAMPLE-prayer-daily': daily,
    'SAMPLE-prayer-weekly-sunni': weekly('sunni', 'Sunni', 'مواقيت الصلاة · أهل السنة', 'Gulf Region method'),
    'SAMPLE-prayer-weekly-jafari': weekly('jafari', "Ja'fari", 'مواقيت الصلاة · الجعفري', 'Leva Institute, Qum (Shia Ithna-Ashari)'),
  };
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN, args: ['--no-sandbox', '--disable-gpu'] });
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1080, height: 1350 });
  const urls = {};
  let bytes = 0;
  for (const [name, html] of Object.entries(cards)) {
    const hp = path.join(outDir, `${name}.html`);
    fs.writeFileSync(hp, html);
    await pg.goto('file://' + hp, { waitUntil: 'networkidle0' });
    await pg.waitForFunction('window.__done === true', { timeout: 30000 });
    const png = hp.replace(/\.html$/, '.png');
    await pg.screenshot({ path: png });
    const resp = JSON.parse(execSync(`curl -sS -X POST "https://api.cloudinary.com/v1_1/b72gfdzx/image/upload" -F "file=@${png}" -F "upload_preset=ml_default" -F "public_id=qa-overnight/${name}"`, { encoding: 'utf8' }));
    if (!resp.secure_url) throw new Error(`upload failed: ${JSON.stringify(resp.error)}`);
    urls[name] = resp.secure_url; bytes += resp.bytes;
    console.log(`${name} -> ${resp.secure_url}`);
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'samples.json'), JSON.stringify({ urls, bytes, days: days.map((r) => ({ d: r.d, sunni: r.sunni, jafari: r.jafari })) }, null, 2));
  console.log('uploaded bytes', bytes);
})().catch((e) => { console.error(e); process.exit(1); });
