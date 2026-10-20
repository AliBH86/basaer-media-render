// Simulates the live Pick Reel with the go-live settings (daily Reels from 2026-10-05, Daily Post day 0 = 2026-10-04).
// Usage: node scripts/sim_reel_daily.js
const { DateTime } = require('../node_modules/luxon');
const { execSync } = require('child_process');
const code = execSync('node scripts/make_n8n_code.js pick_reel --raw', { cwd: __dirname + '/..', encoding: 'utf8' })
  .replace(/const result = pickReelForConfig[\s\S]*$/, 'return { simulate, reelDates, parseWeekdays, pickReelForConfig, LIST };');
const api = new Function('DateTime', '$input', code)(DateTime, null);
const Z = 'Asia/Bahrain';
const cfg = { CYCLE_START_DATE: '2026-10-04', REEL_START_DATE: '2026-10-05', REEL_WEEKDAYS: '1,2,3,4,5,6,7', USE_PICKER: 'true' };
const ds = DateTime.fromISO(cfg.CYCLE_START_DATE, { zone: Z }).startOf('day');
const rs = DateTime.fromISO(cfg.REEL_START_DATE, { zone: Z }).startOf('day');
const N = 200;
const picks = api.simulate(ds, api.reelDates(rs, api.parseWeekdays(cfg.REEL_WEEKDAYS), N));
const problems = [];
let forced = 0;
picks.forEach((p, i) => {
  if (p.entry.surah === p.dailyPostSurah) problems.push(`${p.date}: same surah as Daily Post ${p.dailyPostRef}`);
  if (i && p.entry.surah === picks[i - 1].entry.surah) problems.push(`${p.date}: same surah as previous Reel`);
  if (i && p.entry.reciterId === picks[i - 1].entry.reciterId) problems.push(`${p.date}: same reciter as previous Reel`);
  if (p.skippedForRule.length) forced++;
});
console.log(picks.slice(0, 10).map((p) => `${p.date} ${p.weekday}  Reel ${p.entry.ref.padEnd(9)} (Daily Post ${p.dailyPostRef})${p.skippedForRule.length ? '  skipped ' + p.skippedForRule.join(',') : ''}`).join('\n'));
console.log(`${N} daily Reels ${picks[0].date}..${picks[N - 1].date}: ${problems.length} problems, ${forced} forced skips, list ${api.LIST.length}`);
problems.slice(0, 8).forEach((x) => console.log('  ' + x));
const fri = picks.filter((p) => p.weekday === 'Fri').slice(0, 3).map((p) => `${p.date} Reel ${p.entry.ref} / Daily ${p.dailyPostRef}`);
console.log('Fridays:', fri.join(' | '));
// live entry point on real dates
const at = (d) => api.pickReelForConfig(cfg, DateTime.fromISO(d, { zone: Z }).startOf('day'));
console.log('pickReelForConfig 2026-10-05:', at('2026-10-05').reel_ref, '| 2026-10-09 (Fri):', at('2026-10-09').reel_ref);
