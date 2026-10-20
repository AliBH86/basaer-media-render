// Picks one timestamp per ayah (the midpoint word, +50ms into it) for still-frame
// extraction. Reads <outDir>/timeline.json, prints "<ayahNumber> <seconds>" lines,
// one per ayah, for a bash loop to consume.
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2];
const timeline = JSON.parse(fs.readFileSync(path.join(outDir, 'timeline.json'), 'utf8'));

timeline.ayahs.forEach(ayah => {
  const mid = ayah.wordTimings[Math.floor(ayah.wordTimings.length / 2)];
  const seconds = ((mid.startMs + 50) / 1000).toFixed(3);
  console.log(`${ayah.number} ${seconds}`);
});
