// Khatm research (runs on GitHub, needs ffmpeg): adds al-Ajmi (id 900, alquran.cloud, one file per ayah) to coverage.json
// in the same shape as scripts/khatm_coverage.js writes for Quran.com reciters. Duration per ayah = his speech span plus the
// short lead-in/tail the renderer keeps (scripts/fetch_timeline.js), so plan estimates match what is rendered.
// An ayah-1 file contains his Bismillah (scripts/ajmi_audio.js): it is not counted in the ayah (the plan adds the Bismillah
// separately, as for every reciter). Numbers only; no audio is kept.
// Usage: KHATM_COVERAGE_OUT=coverage.json node scripts/khatm_coverage_ajmi.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { AJMI_ID, surahAudio, measure } = require('./ajmi_audio');

const OUT = process.env.KHATM_COVERAGE_OUT || path.join(__dirname, 'coverage.json');
const LEAD = 0.15, TAIL = 0.45;
const cov = JSON.parse(fs.readFileSync(OUT, 'utf8'));
(async () => {
  const rec = { surahs: {}, gaps: [] };
  const tmp = '/tmp/ajmi_cov.mp3';
  const m11 = (() => { execSync(`curl -sSL --fail -o ${tmp} "${'https://cdn.islamic.network/quran/audio/128/ar.ahmedajamy/1.mp3'}"`); return measure(tmp); })();
  const bismSec = m11.speechEnd - m11.speechStart;
  for (const ch of cov.chapters) {
    const s = { ok: true, problems: [], durations: [] };
    try {
      const urls = await surahAudio(ch.id);
      for (let k = 1; k <= ch.verses; k++) {
        const key = `${ch.id}:${k}`;
        if (!urls[key]) { s.problems.push(`${key}: no audio`); continue; }
        execSync(`curl -sSL --fail -o ${tmp} "${urls[key]}"`);
        const m = measure(tmp);
        let from = m.speechStart;
        if (k === 1 && ![1, 9].includes(ch.id)) {
          // skip his Bismillah: the first pause after about the length of his 1:1
          const p = m.pauses.find(([a]) => a - m.speechStart > bismSec * 0.6 && a - m.speechStart < bismSec * 1.6);
          if (p) from = p[1]; else s.problems.push(`${key}: Bismillah not separable (no pause)`);
        }
        s.durations.push([key, Math.round((m.speechEnd - from + LEAD + TAIL) * 1000)]);
      }
    } catch (e) { s.problems.push(e.message); }
    // "Bismillah not separable" is a note, not a gap: the renderer then keeps the file whole.
    s.ok = s.problems.filter((p) => !/not separable/.test(p)).length === 0 && s.durations.length === ch.verses;
    if (!s.ok) rec.gaps.push(ch.id);
    rec.surahs[ch.id] = s;
    process.stdout.write(`${ch.id}${s.ok ? '' : '!'} `);
  }
  cov.reciters[AJMI_ID] = rec;
  fs.writeFileSync(OUT, JSON.stringify(cov));
  const notes = Object.entries(rec.surahs).flatMap(([id, x]) => x.problems.map((p) => `${id}: ${p}`));
  console.log(`\nreciter ${AJMI_ID}: gaps ${rec.gaps.length ? rec.gaps.join(',') : 'none'}; Bismillah ${bismSec.toFixed(2)} s; notes ${notes.length}: ${notes.slice(0, 20).join(' | ')}`);
})().catch((e) => { console.error(e); process.exit(1); });
