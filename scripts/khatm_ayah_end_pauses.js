// Khatm research (runs on GitHub, needs ffmpeg): for the reciter assigned to each surah in data/khatm_plan.json,
// measures how quiet the recording gets at every ayah END (between ayah k and k+1). A Reel should end where the
// reciter really pauses; some reciters run ayahs together (e.g. Al-Dosari 9:3 -> 9:4), and a Reel ending there
// stops mid-sound.
// Output (numbers only): out/ayah_end_pauses.json  { "<surah>": { reciterId, ends: { "<k>": [depthDb, quietMs] } } }
//   depthDb = quietest 60 ms in the boundary window, relative to the speech level just before (negative = quieter)
//   quietMs = longest run of 20 ms steps at least 24 dB under that speech level
// Usage: node scripts/khatm_ayah_end_pauses.js [fromSurah] [toSurah]
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const plan = JSON.parse(fs.readFileSync(process.env.KHATM_PLAN_FILE || path.join(__dirname, '..', 'data', 'khatm_plan.json'), 'utf8'));
const from = Number(process.argv[2] || 1), to = Number(process.argv[3] || 114);
function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
function envelope(file, fromSec, durSec) {
  const PRE = Math.min(0.15, fromSec);
  const buf = execSync(`ffmpeg -v error -nostdin -ss ${(fromSec - PRE).toFixed(3)} -t ${(durSec + PRE).toFixed(3)} -i "${file}" -vn -ac 1 -ar 16000 -f s16le -`, { shell: '/bin/bash', maxBuffer: 64 * 1024 * 1024 });
  const STEP = 320; const out = [];
  for (let i = Math.round(PRE * 16000 / STEP) * STEP; i + STEP <= buf.length / 2; i += STEP) {
    let peak = 0;
    for (let j = 0; j < STEP; j++) peak = Math.max(peak, Math.abs(buf.readInt16LE((i + j) * 2)));
    out.push(20 * Math.log10(Math.max(peak, 1) / 32768));
  }
  return out;
}
(async () => {
  fs.mkdirSync('out', { recursive: true });
  const result = {};
  for (let s = from; s <= to; s++) {
    const rid = plan.reciterBySurah[s];
    if (Number(rid) === 900) continue; // al-Ajmi: one file per ayah, so every ayah end is a pause (not measured)
    const af = (await getJson(`https://api.qurancdn.com/api/qdc/audio/reciters/${rid}/audio_files?chapter=${s}&segments=true`)).audio_files[0];
    const file = `/tmp/ae_${rid}_${s}.mp3`;
    execSync(`curl -sS -L "${af.audio_url}" -o "${file}"`);
    const vt = af.verse_timings;
    const ends = {};
    for (let k = 0; k < vt.length; k++) {
      const endSec = vt[k].timestamp_to / 1000;
      const nextSec = k + 1 < vt.length ? vt[k + 1].timestamp_from / 1000 : endSec + 0.6;
      const w0 = Math.max(0, endSec - 1.0), w1 = Math.max(nextSec, endSec) + 0.3;
      let env;
      try { env = envelope(file, w0, w1 - w0); } catch (e) { continue; }
      const iEnd = Math.round((endSec - w0) / 0.02);
      const speech = Math.max(...env.slice(0, Math.max(1, iEnd)));
      const lo = Math.max(0, iEnd - 8), hi = Math.min(env.length - 1, iEnd + Math.round((w1 - endSec) / 0.02));
      let minRel = 0, run = 0, best = 0;
      for (let i = lo; i <= hi; i++) {
        if (i + 2 <= hi) minRel = Math.min(minRel, Math.max(env[i], env[i + 1], env[i + 2]) - speech);
        if (env[i] <= speech - 24) { run++; best = Math.max(best, run); } else run = 0;
      }
      ends[k + 1] = [Math.round(minRel), best * 20];
    }
    fs.unlinkSync(file);
    result[s] = { reciterId: rid, ends };
    const cont = Object.entries(ends).filter(([, v]) => v[0] > -24).length;
    console.log(`surah ${s} (reciter ${rid}): ${vt.length} ayah ends, ${cont} without a real pause`);
  }
  fs.writeFileSync(`out/ayah_end_pauses_${from}_${to}.json`, JSON.stringify(result));
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
