// Picks the four review stills of a Reel: start, two middles (each with a gold highlighted word) and end.
// Reads <outDir>/timeline.json and prints one "name seconds" line per still (used by the workflow with ffmpeg).
//
// Usage: node pick_review_stills.js <outDir>
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];
const tl = JSON.parse(fs.readFileSync(path.join(outDir, 'timeline.json'), 'utf8'));

// Every highlighted word, in time order. The overlay for a word is on screen from its start to its end
// (the last word stays until the end of the Reel).
const spans = [];
if (tl.bismillah && tl.bismillah.wordTimings) tl.bismillah.wordTimings.forEach((wt) => spans.push({ s: wt.startMs / 1000, e: wt.endMs / 1000 }));
tl.ayahs.forEach((a) => a.wordTimings.forEach((wt) => spans.push({ s: wt.startMs / 1000, e: wt.endMs / 1000 })));
spans.sort((a, b) => a.s - b.s);
if (!spans.length) throw new Error('no word timings in timeline.json');

const dur = tl.durationSec;
const midOf = (sp) => sp.s + (sp.e - sp.s) / 2;
const indexAt = (t) => {
  let best = 0;
  spans.forEach((sp, i) => { if (Math.abs(midOf(sp) - t) < Math.abs(midOf(spans[best]) - t)) best = i; });
  return best;
};

const idx = [0, indexAt(dur * 0.33), indexAt(dur * 0.66), spans.length - 1];
// Keep the four stills on different words whenever the Reel has enough words.
for (let k = 1; k < 4; k++) {
  while (idx[k] <= idx[k - 1] && idx[k] < spans.length - 1) idx[k]++;
}
const times = idx.map((i) => midOf(spans[i]));
// "end": late in the last word, but safely inside the video.
times[3] = Math.min(Math.max(spans[spans.length - 1].s + 0.2, dur - 0.35), dur - 0.05);

const names = ['frame_start', 'frame_mid1', 'frame_mid2', 'frame_end'];
names.forEach((n, k) => console.log(`${n} ${Math.max(0.05, times[k]).toFixed(3)}`));
