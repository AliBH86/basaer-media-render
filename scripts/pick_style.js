// Picks a background style, seeded by surah:ayah for variety, never repeating the
// style used last time. Last-used style is tracked in state/last_style.txt (committed
// to the repo so rotation persists across separate render runs/workflow invocations).
const fs = require('fs');
const path = require('path');

const STYLES = ['gradient', 'stars', 'rays', 'mist', 'lattice'];
const STATE_FILE = path.join(__dirname, '..', 'state', 'last_style.txt');

function main() {
  const [surah, ayah] = process.argv.slice(2).map(Number);
  if (!surah || !ayah) {
    console.error('Usage: pick_style.js <surah> <ayah>');
    process.exit(1);
  }

  let lastStyle = null;
  try {
    lastStyle = fs.readFileSync(STATE_FILE, 'utf8').trim();
  } catch (e) { /* no prior state - fine */ }

  const candidates = STYLES.filter(s => s !== lastStyle);
  const seed = surah * 1000 + ayah;
  const idx = seed % candidates.length;
  const picked = candidates[idx];

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, picked);

  console.log(picked);
}

main();
