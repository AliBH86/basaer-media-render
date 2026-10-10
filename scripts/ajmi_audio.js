// Ahmed bin Ali al-Ajmi (reciter id 900; owner's reciter list 2026-10-10). His recitation is not on Quran.com, so the
// audio comes from alquran.cloud (edition ar.ahmedajamy; the approved fallback source), ONE FILE PER AYAH, with no word
// timings: his Reels show the text per ayah, without the word-by-word highlight. The Quran text itself still comes from
// the Quran.com API like every other Reel.
// Facts checked 2026-10-10 (silencedetect): an ayah-1 file of a surah starts with his Bismillah (about the length of his
// own 1:1), then a short pause, then the ayah; the files carry up to ~2.4 s of silence at the end.
const { execSync } = require('child_process');
const https = require('https');

const AJMI_ID = 900;
const EDITION = 'ar.ahmedajamy';
const SILENCE_DB = -35, SILENCE_MIN = 0.25;

function getJson(url, tries = 4) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'basaer-media-render' } }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(new Error(`${url} -> HTTP ${res.statusCode}`)); } });
    }).on('error', reject);
  }).catch(async (e) => { if (tries > 1) { await new Promise((r) => setTimeout(r, 3000)); return getJson(url, tries - 1); } throw e; });
}

// Audio URL of every ayah of a surah (one call per surah).
async function surahAudio(surah) {
  const j = await getJson(`https://api.alquran.cloud/v1/surah/${surah}/${EDITION}`);
  if (!j.data || !Array.isArray(j.data.ayahs)) throw new Error(`alquran.cloud ${EDITION} surah ${surah}: no data`);
  return Object.fromEntries(j.data.ayahs.map((a) => [`${surah}:${a.numberInSurah}`, a.audio]));
}

// Speech span of one file: first and last moment above the silence floor, plus the internal pauses (seconds).
function measure(file) {
  const out = execSync(`ffmpeg -nostdin -hide_banner -i "${file}" -af silencedetect=noise=${SILENCE_DB}dB:d=${SILENCE_MIN} -f null - 2>&1`, { shell: '/bin/bash', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const dur = Number((out.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((t, x, i) => t + Number(x) * [3600, 60, 1][i], 0));
  const starts = [...out.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const sil = starts.map((s, i) => [s, ends[i] !== undefined ? ends[i] : dur]);
  let speechStart = 0, speechEnd = dur;
  if (sil.length && sil[0][0] <= 0.05) speechStart = sil[0][1];
  const last = sil[sil.length - 1];
  if (last && last[1] >= dur - 0.05) speechEnd = last[0];
  const pauses = sil.filter(([s, e]) => s > speechStart + 0.05 && e < speechEnd - 0.05);
  return { durationSec: dur, speechStart, speechEnd, pauses };
}

module.exports = { AJMI_ID, EDITION, getJson, surahAudio, measure };
