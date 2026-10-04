// Khatm research (runs on GitHub, needs ffmpeg): for every split ayah in data/khatm_plan.json, measures in the assigned
// reciter's chapter audio how long the voice really stops at each word boundary. A split should fall where the reciter
// pauses; a stop sign alone is not enough (As-Sudais reads 2:282 straight through its waqf signs).
// Output: out/split_pauses.json  { "2:282": { reciterId, boundaries: { "<word q>": pauseMs, ... } } }  (numbers only).
// Usage: node scripts/khatm_split_pauses.js
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'khatm_plan.json'), 'utf8'));
function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
// 20 ms peak envelope (dBFS) of [fromSec, fromSec+durSec].
function envelope(file, fromSec, durSec) {
  const buf = execSync(`ffmpeg -v error -nostdin -ss ${fromSec.toFixed(3)} -t ${durSec.toFixed(3)} -i "${file}" -vn -ac 1 -ar 16000 -f s16le -`, { shell: '/bin/bash', maxBuffer: 512 * 1024 * 1024 });
  const STEP = 320; const out = [];
  for (let i = 0; i + STEP <= buf.length / 2; i += STEP) {
    let peak = 0;
    for (let j = 0; j < STEP; j++) peak = Math.max(peak, Math.abs(buf.readInt16LE((i + j) * 2)));
    out.push(20 * Math.log10(Math.max(peak, 1) / 32768));
  }
  return out;
}
(async () => {
  fs.mkdirSync('out', { recursive: true });
  const result = {};
  const extra = (process.env.EXTRA_AYAHS || '').split(',').filter(Boolean).map((x) => { const [key, rid] = x.split('@'); return { key, reciterId: Number(rid) }; });
  for (const sp of [...plan.splitAyahs, ...extra]) {
    const [surah] = sp.key.split(':').map(Number);
    const af = (await getJson(`https://api.qurancdn.com/api/qdc/audio/reciters/${sp.reciterId}/audio_files?chapter=${surah}&segments=true`)).audio_files[0];
    const t = af.verse_timings.find((v) => v.verse_key === sp.key);
    const file = `/tmp/ch_${sp.reciterId}_${surah}.mp3`;
    if (!fs.existsSync(file)) execSync(`curl -sS -L "${af.audio_url}" -o "${file}"`);
    const from = t.timestamp_from / 1000;
    const env = envelope(file, from, (t.timestamp_to - t.timestamp_from) / 1000);
    const peak = Math.max(...env);
    const quiet = peak - 30; // "voice stopped" = 30 dB under the ayah's loudest moment
    const segs = t.segments.filter((s) => Array.isArray(s) && s.length >= 3).sort((a, b) => a[0] - b[0]);
    const boundaries = {};
    for (let k = 0; k + 1 < segs.length; k++) {
      const q = segs[k][0];
      const a = (segs[k][2] - t.timestamp_from) / 1000 - 0.15, b = (segs[k + 1][1] - t.timestamp_from) / 1000 + 0.15;
      let best = 0, run = 0;
      for (let i = Math.max(0, Math.floor(a / 0.02)); i <= Math.min(env.length - 1, Math.ceil(b / 0.02)); i++) {
        if (env[i] <= quiet) { run++; best = Math.max(best, run); } else run = 0;
      }
      // also the quietest 60 ms (3 steps) in the window, relative to the ayah peak (dB, negative = quieter)
      let minRel = 0;
      for (let i = Math.max(0, Math.floor(a / 0.02)); i + 2 <= Math.min(env.length - 1, Math.ceil(b / 0.02)); i++) minRel = Math.min(minRel, Math.max(env[i], env[i + 1], env[i + 2]) - peak);
      boundaries[q] = [best * 20, Math.round(minRel)];
    }
    result[`${sp.key}@${sp.reciterId}`] = { reciterId: sp.reciterId, peakDb: Math.round(peak), boundaries };
    const pauses = Object.entries(boundaries).filter(([, v]) => v[1] <= -24).map(([q, v]) => `${q}:${v[1]}dB/${v[0]}ms`);
    console.log(`${sp.key} (reciter ${sp.reciterId}): boundaries at least 24 dB quieter than the peak (60 ms): ${pauses.join(' ') || 'none'}`);
  }
  fs.writeFileSync('out/split_pauses.json', JSON.stringify(result, null, 1));
  console.log('SPLIT_PAUSES_JSON ' + JSON.stringify(result));
})().catch((e) => { console.error(e); process.exit(1); });
