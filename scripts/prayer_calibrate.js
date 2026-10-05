// PRAYER TIMES CALIBRATION.
//
// AlAdhan has no Bahrain method (the API accepts 0-23 and 99; Bahrain is not among them), and AlAdhan itself
// warns that its timings "might not always match your local mosque or government authority". So to publish
// times people actually pray by, we calibrate a base method against the official published calendar.
//
// Give it the API's times and the official times for the SAME days and it reports, per prayer:
//   - the median offset in minutes (what to put in `tune`)
//   - the spread (min..max)
// A tight spread means a fixed offset works and `tune` is the right fix. A wide spread means the underlying
// SOLAR ANGLE differs, the gap changes with the seasons, and no fixed offset can ever be right - then use
// method=99 with explicit angles instead. This distinction is the whole point of the script.
//
// TRAP: AlAdhan's `tune` order is Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight.
// Maghrib comes BEFORE Sunset, which is the reverse of the order the day actually runs in.
//
// Input: two JSON files, each { "DD-MM-YYYY": { "Fajr": "04:22", ... }, ... }
//
// Usage:  node prayer_calibrate.js <api.json> <official.json>
//         node prayer_calibrate.js --selftest
const fs = require('fs');
const { toMinutes } = require('./prayer_guard.js');

const TUNE_ORDER = ['Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Sunset', 'Isha', 'Midnight'];
const PRAYERS = ['Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Sunset', 'Isha'];
const STABLE_SPREAD = 2; // minutes; above this a fixed offset cannot track the official calendar

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function calibrate(api, official) {
  const days = Object.keys(official).filter(d => api[d]);
  if (!days.length) throw new Error('no overlapping dates between the two files');
  const report = {};
  for (const p of PRAYERS) {
    const deltas = [];
    for (const d of days) {
      if (api[d][p] == null || official[d][p] == null) continue;
      deltas.push(toMinutes(official[d][p], p) - toMinutes(api[d][p], p));
    }
    if (!deltas.length) continue;
    const lo = Math.min(...deltas), hi = Math.max(...deltas);
    report[p] = { offset: median(deltas), min: lo, max: hi, spread: hi - lo, days: deltas.length };
  }
  return { days: days.length, report };
}

function tuneString(report) {
  return TUNE_ORDER.map(p => (report[p] ? report[p].offset : 0)).join(',');
}

function print(result) {
  console.log(`compared ${result.days} day(s)\n`);
  console.log('prayer    offset   spread   verdict');
  let drifting = [];
  for (const p of PRAYERS) {
    const r = result.report[p];
    if (!r) { console.log(`${p.padEnd(9)} (no data)`); continue; }
    const stable = r.spread <= STABLE_SPREAD;
    if (!stable) drifting.push(p);
    console.log(`${p.padEnd(9)} ${String(r.offset).padStart(5)}m  ${String(r.spread).padStart(5)}m   ` +
                (stable ? 'stable -> tune works' : 'DRIFTS -> angle differs, tune cannot fix this'));
  }
  console.log(`\ntune=${tuneString(result.report)}`);
  console.log('      (order: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight - Maghrib before Sunset)');
  if (drifting.length) {
    console.log(`\nVERDICT: ${drifting.join(', ')} drift across the sample. A fixed offset will be wrong at`);
    console.log('other times of year. Use method=99 with explicit Fajr/Isha angles instead of tune.');
  } else {
    console.log('\nVERDICT: every prayer is stable across the sample. tune is safe for this period.');
    console.log('Re-run against a month in the opposite season before trusting it year-round.');
  }
  return drifting.length === 0;
}

function selftest() {
  let failed = 0;
  // 1. a constant offset must be detected exactly and read as stable
  const api = {}, off = {};
  for (let d = 1; d <= 10; d++) {
    const k = `${String(d).padStart(2, '0')}-10-2026`;
    api[k] = { Fajr: '04:20', Dhuhr: '11:20', Asr: '14:38', Maghrib: '17:00', Sunset: '17:00', Isha: '18:15', Sunrise: '05:38', Imsak: '04:10' };
    off[k] = { Fajr: '04:22', Dhuhr: '11:21', Asr: '14:38', Maghrib: '17:03', Sunset: '17:00', Isha: '18:18', Sunrise: '05:38', Imsak: '04:12' };
  }
  const r1 = calibrate(api, off);
  if (r1.report.Fajr.offset !== 2 || r1.report.Fajr.spread !== 0) { failed++; console.log('  FAIL  constant offset'); }
  else console.log('  ok    constant offset detected exactly (+2m, spread 0)');
  if (r1.report.Maghrib.offset !== 3) { failed++; console.log('  FAIL  Maghrib offset'); }
  else console.log('  ok    Maghrib offset detected (+3m)');

  // 2. a seasonally drifting gap must be reported as drifting, not averaged away
  const api2 = {}, off2 = {};
  for (let d = 1; d <= 10; d++) {
    const k = `${String(d).padStart(2, '0')}-10-2026`;
    api2[k] = { Fajr: '04:20', Dhuhr: '11:20', Asr: '14:38', Maghrib: '17:00', Sunset: '17:00', Isha: '18:15', Sunrise: '05:38', Imsak: '04:10' };
    const drift = String(20 + d).padStart(2, '0');
    off2[k] = { ...api2[k], Fajr: `04:${drift}` }; // gap grows 1 min/day
  }
  const r2 = calibrate(api2, off2);
  if (r2.report.Fajr.spread <= STABLE_SPREAD) { failed++; console.log('  FAIL  drift not detected'); }
  else console.log(`  ok    drift detected (spread ${r2.report.Fajr.spread}m -> angle differs)`);

  // 3. tune string must place Maghrib before Sunset
  const t = tuneString({ Maghrib: { offset: 9 }, Sunset: { offset: 1 } }).split(',');
  if (t[5] !== '9' || t[6] !== '1') { failed++; console.log('  FAIL  tune order'); }
  else console.log('  ok    tune order puts Maghrib (slot 6) before Sunset (slot 7)');

  console.log(failed ? `\nSELFTEST FAILED (${failed})` : '\nSELFTEST PASSED');
  return failed === 0;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--selftest') process.exit(selftest() ? 0 : 1);
  if (a.length < 2) { console.log('usage: prayer_calibrate.js <api.json> <official.json> | --selftest'); process.exit(1); }
  const ok = print(calibrate(JSON.parse(fs.readFileSync(a[0], 'utf8')), JSON.parse(fs.readFileSync(a[1], 'utf8'))));
  process.exit(ok ? 0 : 2);
}

module.exports = { calibrate, tuneString, TUNE_ORDER };
