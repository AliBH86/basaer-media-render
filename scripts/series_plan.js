// SERIES PLAN: cut an aligned recitation (scripts/series_align.py output) into daily Reels.
// Rules: 45-75 s per Reel (target 60), cut only between phrases, prefer the reciter's longer breaths and the start of a
// new section ("إِلهِي", "يا مَنْ", "صَلِّ"), never split the Quran passage. Writes plan.json next to aligned.json.
// Usage: node scripts/series_plan.js <series dir>
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const al = JSON.parse(fs.readFileSync(path.join(dir, 'aligned.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'phrases.json'), 'utf8'));
const P = al.phrases;
const n = P.length;
const LO = 45, HI = 75, TARGET = 60;
const plain = (t) => t.replace(/[ً-ْٰـ]/g, '');
const sectionStart = (i) => /^(إلهي|إِلهِي|الهي|يا من|فيا من|صل|اللهم)/.test(plain(P[i].text).replace(/^[أإ]/, 'إ'));
const q = meta.quran && meta.quran.phrases;
const insideQuran = (cutAfter) => q && cutAfter >= q[0] && cutAfter < q[1];
const gapAfter = (i) => (i + 1 < n ? P[i + 1].start - P[i].end : 5);
const partDur = (a, b) => P[b].end - P[a].start + 0.35 + Math.min(1.2, gapAfter(b));
// DP over phrase boundaries
const best = new Array(n + 1).fill(Infinity), prev = new Array(n + 1).fill(-1);
best[0] = 0;
for (let b = 0; b < n; b++) {
  if (b < n - 1 && insideQuran(b)) continue;
  for (let a = b; a >= 0; a--) {
    const d = partDur(a, b);
    if (d > HI + 15) break;
    if (!(best[a] < Infinity)) continue;
    let c = Math.pow(d - TARGET, 2) / 10;
    if (d < LO) c += 400 + (LO - d) * 40;
    if (d > HI) c += 400 + (d - HI) * 40;
    if (b < n - 1) c -= Math.min(gapAfter(b), 2.5) * 30 + (sectionStart(b + 1) ? 60 : 0);
    if (best[a] + c < best[b + 1]) { best[b + 1] = best[a] + c; prev[b + 1] = a; }
  }
}
if (!(best[n] < Infinity)) throw new Error('no plan found');
const parts = [];
for (let b = n; b > 0; b = prev[b]) parts.unshift({ from: prev[b], to: b - 1 });
parts.forEach((p, i) => { p.part = i + 1; p.sec = +partDur(p.from, p.to).toFixed(1); p.starts = P[p.from].text.split(' ').slice(0, 4).join(' '); p.ends = P[p.to].text.split(' ').slice(-3).join(' '); p.gapAfter = +gapAfter(p.to).toFixed(2); });
fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ series: meta.title, parts }, null, 1));
console.log(`${parts.length} parts: ` + parts.map((p) => `${p.part}) ${p.sec}s [#${p.from}-${p.to}]`).join('  '));
parts.forEach((p) => console.log(`  ${p.part}: «${p.starts} …» → «… ${p.ends}» (${p.sec}s, breath after ${p.gapAfter}s)`));
