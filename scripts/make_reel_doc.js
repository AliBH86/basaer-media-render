// Regenerates docs/REEL_CONTENT_LIST.md from data/reel_list.json (the approved list) and data/reciters.json.
// Surah names and the first ayah (Arabic) come from the Quran.com API. Usage: node scripts/make_reel_doc.js
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/reel_list.json'), 'utf8'));
const reciters = JSON.parse(fs.readFileSync(path.join(root, 'data/reciters.json'), 'utf8'));

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

(async () => {
  const rows = [];
  for (const e of data.list) {
    const ch = (await getJson(`https://api.quran.com/api/v4/chapters/${e.surah}?language=en`)).chapter;
    const v = (await getJson(`https://api.quran.com/api/v4/verses/by_key/${e.surah}:${e.ayahStart}?fields=text_uthmani`)).verse;
    const r = reciters[String(e.reciterId)];
    const first = v.text_uthmani.replace(/\s+/g, ' ').trim();
    rows.push(`| ${e.n} | ${e.ref} | ${ch.name_simple} | ${e.theme} | ${e.ayahs} | ${first} | ${e.reciterId} ${r.en} (${r.ar}) | ${Number(e.audioSecIdAssigned).toFixed(1)} | ${e.style} |`);
  }
  const out = `# Reel content list — APPROVED 2026-10-03

Approved by the user on 2026-10-03 with these changes to the proposal: rows 19 (109:1-6) and 39 (9:128-129) were dropped, and row 17 became 25:58 only. Soft length cap 40 s, hard cap 45 s. The list below (39 Reels, in rotation order) is the single source of truth; the machine-readable copy is \`data/reel_list.json\`, and the Reel picker (\`n8n/pick_reel.js\`) walks it in this order.

Rules applied: texts, translations, surah names and audio timings come from the Quran.com API only. Each Reel is one complete short surah or a short run of consecutive ayahs from the approved themes. No sectarian or disputed content and nothing harsh in tone. The order has no surah twice in a row, no reciter or background twice in a row, and no theme three times in a row. Reciters are the approved display names from \`data/reciters.json\` (Arabic + English are shown on every Reel); backgrounds rotate through gradient / stars / rays / mist / lattice.

**Picker rule (approved 2026-10-03):** a Reel never uses the same ayah or surah as that day's Daily Post. If the next Reel in the list shares the surah of the day's Daily Post, it is skipped for that day and used on a later day (see \`n8n/pick_reel.js\`; tested over 160 days).

Themes "Faith" and "Unity" (96:1-5, 112:1-4, 49:13) have only DRAFT reflection lines so far (\`data/reflections.json\`, section "draft"), waiting for the user's approval.

| # | Ref | Surah | Theme | Ayahs | First ayah (Arabic) | Reciter (ID, English, Arabic) | Audio (s) | Background |
|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
  fs.writeFileSync(path.join(root, 'docs/REEL_CONTENT_LIST.md'), out);
  console.log(`wrote docs/REEL_CONTENT_LIST.md with ${rows.length} rows`);
})().catch((e) => { console.error(e); process.exit(1); });
