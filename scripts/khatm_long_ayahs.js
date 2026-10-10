// Khatm re-plan helper: lists every ayah that is too long for one Reel (over the 90 s cap, the Bismillah included for
// ayah 1) for each candidate reciter, from coverage.json, so scripts/khatm_split_pauses.js can measure where each
// reciter really pauses inside it BEFORE reciters are assigned to surahs. Reciter 900 (al-Ajmi) is left out: his files
// have no word timings, so his long ayahs cannot be split (the plan builder then gives such surahs to another reciter).
// Usage: node scripts/khatm_long_ayahs.js <coverage.json> <rotation e.g. 1,8,3,5,900> <resume e.g. 2:20> <out.json>
const fs = require('fs');
const [, , covFile, rotation, resume, outFile] = process.argv;
const cov = JSON.parse(fs.readFileSync(covFile, 'utf8'));
const [rs, ra] = (resume || '1:1').split(':').map(Number);
const CAP = 90000, GAP = 450;
const list = [];
for (const rid of rotation.split(',').map(Number).filter((r) => r !== 900)) {
  const R = cov.reciters[rid];
  const bismMs = R.surahs[1].durations[0][1] + GAP;
  let n = 0;
  for (const ch of cov.chapters) {
    if (ch.id < rs) continue;
    const s = R.surahs[ch.id];
    if (!s || !s.durations) continue;
    for (const [key, d] of s.durations) {
      const a = Number(key.split(':')[1]);
      if (ch.id === rs && a < ra) continue;
      const t = d + (a === 1 && ![1, 9].includes(ch.id) ? bismMs : 0);
      if (t > CAP) { list.push({ key, reciterId: rid }); n++; }
    }
  }
  console.log(`reciter ${rid}: ${n} ayahs over ${CAP / 1000} s`);
}
fs.writeFileSync(outFile, JSON.stringify(list));
