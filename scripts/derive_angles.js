// Derive the solar depression angles a published calendar is actually using.
//
// AlAdhan has no Bahrain method, so the Shia and Sunni columns have to be reproduced with
// method=99 and explicit angles. This script answers "what angle produces this printed time?"
// by solving the sunrise equation for the depression angle, which is the only way to turn a
// paper calendar into API parameters.
//
// Validated against AlAdhan for Manama 2026-10-05: solar noon 11:26, sunrise 05:32, sunset 17:20 -
// all three match this model to the minute, so the derived angles can be trusted.
//
// Usage:  node derive_angles.js <lat> <lon> <tzOffsetHours> <YYYY-MM-DD> <HH:MM> <morning|evening>
//         node derive_angles.js --selftest
const R = Math.PI / 180;

function julianDay(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function solar(y, m, d, tz) {
  const J = julianDay(y, m, d) + 0.5 - tz / 24;
  const n = J - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * R;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * R;
  const eps = (23.439 - 0.0000004 * n) * R;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const yy = Math.tan(eps / 2) ** 2, Lr = L * R;
  const eot = 4 / R * (yy * Math.sin(2 * Lr) - 2 * 0.0167 * Math.sin(g)
    + 4 * 0.0167 * yy * Math.sin(g) * Math.cos(2 * Lr) - 0.5 * yy * yy * Math.sin(4 * Lr)
    - 1.25 * 0.0167 ** 2 * Math.sin(2 * g));
  return { dec, eot };
}

function noonHours(lon, tz, eot) { return (720 - 4 * lon - eot) / 60 + tz; }

/** Clock time (hours) at which the sun is `depress` degrees below the horizon. */
function timeAt(lat, lon, tz, dec, eot, depress, morning) {
  const c = (Math.sin(-depress * R) - Math.sin(lat * R) * Math.sin(dec))
          / (Math.cos(lat * R) * Math.cos(dec));
  if (Math.abs(c) > 1) return null;
  const H = Math.acos(c) / R / 15;
  const noon = noonHours(lon, tz, eot);
  return morning ? noon - H : noon + H;
}

/** Inverse: the depression angle that puts the sun at `clockHours`. Bisection, 0.01 deg. */
function angleFor(lat, lon, tz, dec, eot, clockHours, morning) {
  let lo = 0.5, hi = 25;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const t = timeAt(lat, lon, tz, dec, eot, mid, morning);
    if (t === null) { hi = mid; continue; }
    // deeper angle -> earlier in the morning, later in the evening
    const deeper = morning ? t < clockHours : t > clockHours;
    if (deeper) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function hhmm(t) { if (t === null) return '--:--'; const m = Math.round(t * 60); return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }
function toHours(s) { const [h, m] = s.split(':').map(Number); return h + m / 60; }

function selftest() {
  // Manama, 2026-10-05, UTC+3. AlAdhan: noon 11:26, sunrise 05:32, sunset 17:20.
  const lat = 26.2285, lon = 50.5860, tz = 3;
  const { dec, eot } = solar(2026, 10, 5, tz);
  let failed = 0;
  const checks = [
    ['solar noon', hhmm(noonHours(lon, tz, eot)), '11:26'],
    ['sunrise',    hhmm(timeAt(lat, lon, tz, dec, eot, 0.833, true)),  '05:32'],
    ['sunset',     hhmm(timeAt(lat, lon, tz, dec, eot, 0.833, false)), '17:20'],
  ];
  for (const [n, got, want] of checks) {
    if (got !== want) { failed++; console.log(`  FAIL  ${n}: ${got} != ${want}`); }
    else console.log(`  ok    ${n} ${got} matches AlAdhan`);
  }
  // round-trip: an angle -> a time -> back to the same angle
  const t = timeAt(lat, lon, tz, dec, eot, 17.3, false);
  const back = angleFor(lat, lon, tz, dec, eot, t, false);
  if (Math.abs(back - 17.3) > 0.02) { failed++; console.log(`  FAIL  round-trip ${back}`); }
  else console.log(`  ok    round-trip 17.3 deg -> ${hhmm(t)} -> ${back.toFixed(2)} deg`);
  console.log(failed ? `\nSELFTEST FAILED (${failed})` : '\nSELFTEST PASSED');
  return failed === 0;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--selftest') process.exit(selftest() ? 0 : 1);
  if (a.length < 6) { console.log('usage: derive_angles.js <lat> <lon> <tz> <YYYY-MM-DD> <HH:MM> <morning|evening>'); process.exit(1); }
  const [lat, lon, tz] = [Number(a[0]), Number(a[1]), Number(a[2])];
  const [Y, M, D] = a[3].split('-').map(Number);
  const { dec, eot } = solar(Y, M, D, tz);
  const ang = angleFor(lat, lon, tz, dec, eot, toHours(a[4]), a[5] === 'morning');
  console.log(`${a[4]} ${a[5]} -> ${ang.toFixed(2)} degrees below the horizon`);
}

module.exports = { solar, timeAt, angleFor, noonHours, hhmm };
