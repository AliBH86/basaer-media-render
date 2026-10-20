// YouTube Shorts (owner, 2026-10-21): the Khatm parts in order (data/khatm_plan.json, "day" = part number), only those
// estimated at MAX_EST seconds or less, so the Short stays under 60 s (a Short over a minute with any Content ID claim is
// blocked). Longer parts are skipped for now. Prints the pick as GitHub step outputs and writes <outDir>/short_pick.json.
//
// Usage: node scripts/pick_short.js <startPart> <outDir>
const fs = require('fs');
const path = require('path');

const [, , startArg, outDir = 'out'] = process.argv;
const MAX_EST = Number(process.env.SHORT_MAX_EST || 55);
const start = Number(startArg || 1);
const { plan } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'khatm_plan.json'), 'utf8'));

const pick = plan.find((e) => e.day >= start && e.estSec <= MAX_EST);
if (!pick) throw new Error(`no Khatm part from ${start} on is estimated at ${MAX_EST} s or less`);

const out = {
  khatmPart: pick.day,
  nextPart: pick.day + 1,
  skippedParts: plan.filter((e) => e.day >= start && e.day < pick.day).map((e) => e.day),
  surah: pick.surah,
  ayahStart: pick.ayahStart,
  ayahEnd: pick.ayahEnd,
  reciterId: pick.reciterId,
  style: pick.style || 'footage',
  wordStart: pick.wordStart || '',
  wordEnd: pick.wordEnd || '',
  partLabel: pick.parts ? `${pick.part}/${pick.parts}` : '',
  estSec: pick.estSec,
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'short_pick.json'), JSON.stringify(out, null, 2));
const lines = Object.entries(out).filter(([, v]) => !Array.isArray(v)).map(([k, v]) => `${k}=${v}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
console.log(`Short: Khatm part ${out.khatmPart} (${out.surah}:${out.ayahStart}-${out.ayahEnd}, ~${out.estSec} s)` +
  (out.skippedParts.length ? `, skipped parts ${out.skippedParts.join(', ')} (too long)` : ''));
