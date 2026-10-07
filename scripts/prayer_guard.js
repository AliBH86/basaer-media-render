// PRAYER TIMES INTEGRITY GUARD.
//
// An ayah is protected by verify_text.js: a corrupted character fails the render. A prayer time has no such
// protection and a worse failure mode - a wrong Maghrib looks completely plausible and people pray by it.
// This guard checks a timings payload from the AlAdhan API before anything is drawn.
//
// It checks:
//   1. every prayer is present and parses as HH:MM
//   2. the day runs in order: Imsak < Fajr < Sunrise < Dhuhr < Asr < Sunset <= Maghrib < Isha
//   3. the returned date is the date that was asked for (the API silently returns "today" for a bad date)
//   4. each prayer falls inside a plausible window for this latitude, so a method mix-up is caught
//   5. no two prayers collide
//   6. across methods: the Jafari Maghrib must be LATER than the Sunni one (Jafari waits for the redness to
//      go). If they are equal, the Jafari call silently fell back to a sunset-Maghrib method.
//
// Usage:  node prayer_guard.js <timings.json> [--date DD-MM-YYYY]
//         node prayer_guard.js --compare <sunni.json> <jafari.json>
//         node prayer_guard.js --selftest
const fs = require('fs');

const ORDER = ['Imsak', 'Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'];

// Plausible windows for Bahrain (26.2N). Deliberately wide: this catches a method or timezone mix-up,
// not a few minutes of drift. Minutes from local midnight.
const WINDOW = {
  Imsak:   [230, 350],
  Fajr:    [240, 360],
  Sunrise: [290, 400],
  Dhuhr:   [660, 760],
  Asr:     [870, 1010],
  Sunset:  [980, 1140],
  Maghrib: [980, 1160],
  Isha:    [1050, 1260],
};

function toMinutes(value, prayer) {
  if (typeof value !== 'string') throw new Error(`${prayer}: missing`);
  // Accepts "17:04", "17:04 (+03)" and ISO 8601 "2026-10-05T17:04:00+03:00".
  const iso = value.match(/T(\d{2}):(\d{2})/);
  const hm = iso || value.match(/^\s*(\d{1,2}):(\d{2})/);
  if (!hm) throw new Error(`${prayer}: unparseable time ${JSON.stringify(value)}`);
  const h = Number(hm[1]), m = Number(hm[2]);
  if (h > 23 || m > 59) throw new Error(`${prayer}: impossible time ${value}`);
  return h * 60 + m;
}

function checkTimings(timings, opts = {}) {
  const issues = [];
  const mins = {};

  for (const p of ORDER) {
    try { mins[p] = toMinutes(timings[p], p); } catch (e) { issues.push(e.message); }
  }
  if (issues.length) return issues;

  for (let i = 0; i < ORDER.length - 1; i++) {
    const a = ORDER[i], b = ORDER[i + 1];
    // Sunset and Maghrib coincide in every Sunni method, so that one pair may be equal.
    const ok = (a === 'Sunset' && b === 'Maghrib') ? mins[b] >= mins[a] : mins[b] > mins[a];
    if (!ok) issues.push(`out of order: ${a} ${timings[a]} then ${b} ${timings[b]}`);
  }

  for (const p of ORDER) {
    const [lo, hi] = WINDOW[p];
    if (mins[p] < lo || mins[p] > hi) {
      issues.push(`${p} ${timings[p]} is outside the plausible window for Bahrain ` +
                  `(${String(Math.floor(lo/60)).padStart(2,'0')}:${String(lo%60).padStart(2,'0')}-` +
                  `${String(Math.floor(hi/60)).padStart(2,'0')}:${String(hi%60).padStart(2,'0')}) ` +
                  `- wrong method, wrong coordinates or wrong timezone`);
    }
  }

  const seen = new Map();
  for (const p of ORDER) {
    if (p === 'Maghrib' && mins.Maghrib === mins.Sunset) continue;
    if (seen.has(mins[p])) issues.push(`${seen.get(mins[p])} and ${p} are both ${timings[p]}`);
    seen.set(mins[p], p);
  }

  if (opts.expectDate) {
    const got = opts.gregorianDate;
    if (got && got !== opts.expectDate) {
      issues.push(`asked for ${opts.expectDate} but the API answered for ${got}`);
    }
  }
  // The API echoes the coordinates it used; a calendar export once carried junk meta (8.88, 7.77).
  if (opts.meta && opts.meta.latitude !== undefined) {
    const lat = Number(opts.meta.latitude), lon = Number(opts.meta.longitude);
    if (!(Math.abs(lat - 26.2285) <= 1 && Math.abs(lon - 50.586) <= 1)) {
      issues.push(`meta coordinates ${opts.meta.latitude},${opts.meta.longitude} are not Manama (26.23,50.59)`);
    }
  }
  return issues;
}

function checkAcrossMethods(sunni, jafari) {
  const issues = [];
  const s = toMinutes(sunni.Maghrib, 'Maghrib'), j = toMinutes(jafari.Maghrib, 'Maghrib');
  if (j <= s) {
    issues.push(`Jafari Maghrib ${jafari.Maghrib} is not later than the Sunni Maghrib ${sunni.Maghrib} ` +
                `- the Jafari request almost certainly did not use method 0`);
  }
  const sf = toMinutes(sunni.Fajr, 'Fajr'), jf = toMinutes(jafari.Fajr, 'Fajr');
  if (sf === jf && s === j) issues.push('both methods returned identical times - one call ignored its method');
  return issues;
}

// ---- self-test: the guard must pass clean data and catch each fault ----
function selftest() {
  const good = { Imsak: '04:12', Fajr: '04:22', Sunrise: '05:38', Dhuhr: '11:21',
                 Asr: '14:38', Sunset: '17:03', Maghrib: '17:03', Isha: '18:18' };
  const cases = [
    ['clean payload passes', good, 0],
    ['missing Isha', { ...good, Isha: undefined }, 1],
    ['Asr before Dhuhr', { ...good, Asr: '10:00' }, 2],
    ['Isha at noon', { ...good, Isha: '12:30' }, 2],
    ['unparseable Fajr', { ...good, Fajr: 'soon' }, 1],
    ['impossible hour', { ...good, Dhuhr: '34:00' }, 1],
    ['timezone shift (UTC not +03)', { Imsak: '01:12', Fajr: '01:22', Sunrise: '02:38',
      Dhuhr: '08:21', Asr: '11:38', Sunset: '14:03', Maghrib: '14:03', Isha: '15:18' }, 1],
    ['ISO 8601 input parses', { Imsak: '2026-10-05T04:12:00+03:00', Fajr: '2026-10-05T04:22:00+03:00',
      Sunrise: '2026-10-05T05:38:00+03:00', Dhuhr: '2026-10-05T11:21:00+03:00',
      Asr: '2026-10-05T14:38:00+03:00', Sunset: '2026-10-05T17:03:00+03:00',
      Maghrib: '2026-10-05T17:03:00+03:00', Isha: '2026-10-05T18:18:00+03:00' }, 0],
  ];
  let failed = 0;
  for (const [name, payload, minIssues] of cases) {
    const got = checkTimings(payload).length;
    const ok = minIssues === 0 ? got === 0 : got >= 1;
    if (!ok) { failed++; console.log(`  FAIL  ${name} (expected ${minIssues ? '>=1' : '0'} issues, got ${got})`); }
    else console.log(`  ok    ${name}`);
  }
  const sunni = good;
  const jafariGood = { ...good, Fajr: '04:08', Maghrib: '17:18', Isha: '18:32' };
  const crossGood = checkAcrossMethods(sunni, jafariGood);
  if (crossGood.length) { failed++; console.log('  FAIL  valid Jafari pair flagged'); }
  else console.log('  ok    valid Jafari pair passes');
  const crossBad = checkAcrossMethods(sunni, { ...good });
  if (!crossBad.length) { failed++; console.log('  FAIL  identical Maghrib not caught'); }
  else console.log('  ok    identical Maghrib caught (method 0 was ignored)');

  const dateIssue = checkTimings(good, { expectDate: '05-10-2026', gregorianDate: '04-10-2026' });
  if (!dateIssue.some(i => i.includes('answered for'))) { failed++; console.log('  FAIL  wrong date not caught'); }
  else console.log('  ok    wrong date caught');

  console.log(failed ? `\nSELFTEST FAILED (${failed})` : '\nSELFTEST PASSED');
  return failed === 0;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') process.exit(selftest() ? 0 : 1);
  if (args[0] === '--compare') {
    const a = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const b = JSON.parse(fs.readFileSync(args[2], 'utf8'));
    const ta = a.data ? a.data.timings : a, tb = b.data ? b.data.timings : b;
    const issues = [...checkTimings(ta), ...checkTimings(tb), ...checkAcrossMethods(ta, tb)];
    issues.forEach(i => console.log('ISSUE: ' + i));
    process.exit(issues.length ? 1 : 0);
  }
  if (!args[0]) { console.log('usage: prayer_guard.js <timings.json> | --compare a.json b.json | --selftest'); process.exit(1); }
  const payload = JSON.parse(fs.readFileSync(args[0], 'utf8'));
  const timings = payload.data ? payload.data.timings : payload;
  const gregorian = payload.data && payload.data.date && payload.data.date.gregorian
    ? payload.data.date.gregorian.date : undefined;
  const di = args.indexOf('--date');
  const issues = checkTimings(timings, di > -1 ? { expectDate: args[di + 1], gregorianDate: gregorian } : {});
  issues.forEach(i => console.log('ISSUE: ' + i));
  process.exit(issues.length ? 1 : 0);
}

module.exports = { checkTimings, checkAcrossMethods, toMinutes, ORDER, WINDOW };
