// Builds the JavaScript for n8n Code nodes from the templates in n8n/ and the data in data/, so that the repo is
// the single source of truth and the live node and its test harness run the very same code.
//
// Usage: node scripts/make_n8n_code.js <pick_reel|pick_reel_test> [--raw]
// Prints the code as one JSON string (ASCII only, ready to paste into an n8n node's jsCode); --raw prints plain code.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const json = (p) => JSON.parse(read(p));

const which = process.argv[2];
const raw = process.argv.includes('--raw');

function pickReelBase() {
  const reel = json('data/reel_list.json').list.map((e) => ({
    ref: e.ref, surah: e.surah, ayahStart: e.ayahStart, ayahEnd: e.ayahEnd, theme: e.theme, reciterId: e.reciterId, style: e.style,
  }));
  const rot = json('data/daily_rotation.json');
  return read('n8n/pick_reel.js')
    .replace('__REEL_LIST__', JSON.stringify(reel))
    .replace('__DAILY__', JSON.stringify(rot.daily))
    .replace('__FRIDAY__', JSON.stringify(rot.friday));
}

let code;
if (which === 'pick_reel') {
  code = pickReelBase() + `
const result = pickReelForConfig($input.first().json, DateTime.now().setZone(Z).startOf('day'));
return result ? [{ json: result }] : [];
`;
} else if (which === 'pick_reel_test') {
  code = pickReelBase() + `
// ===== TEST HARNESS (not part of the live node) =====
const dailyStart = DateTime.fromISO('2026-10-10', { zone: Z }).startOf('day');
const reelStart = DateTime.fromISO('2026-10-11', { zone: Z }).startOf('day');
const weekdays = parseWeekdays('7,2,4,6');
const picks = simulate(dailyStart, reelDates(reelStart, weekdays, 160));
const problems = [];
const examples = [];
let forced = 0;
picks.forEach((p, i) => {
  if (p.weekday === 'Fri') problems.push(p.date + ': a Reel on a Friday');
  if (!['Sun', 'Tue', 'Thu', 'Sat'].includes(p.weekday)) problems.push(p.date + ': not a Reel weekday (' + p.weekday + ')');
  if (p.entry.surah === p.dailyPostSurah) problems.push(p.date + ': Reel ' + p.entry.ref + ' has the same surah as the Daily Post ' + p.dailyPostRef);
  if (i && p.entry.surah === picks[i - 1].entry.surah) problems.push(p.date + ': same surah as the previous Reel');
  if (i && p.entry.reciterId === picks[i - 1].entry.reciterId) problems.push(p.date + ': same reciter as the previous Reel');
  if (p.skippedForRule.length) { forced++; if (examples.length < 8) examples.push(p.date + ' ' + p.weekday + ' (Daily Post ' + p.dailyPostRef + '): skipped ' + p.skippedForRule.join(', ') + ' -> used ' + p.entry.ref); }
});
// pickReelForConfig on real dates: a Friday and a Monday give no Reel; the first Sunday is slot 0.
const cfg = { CYCLE_START_DATE: '2026-10-10', REEL_START_DATE: '2026-10-11', REEL_WEEKDAYS: '7,2,4,6' };
const at = (d) => pickReelForConfig(cfg, DateTime.fromISO(d, { zone: Z }).startOf('day'));
const dayChecks = {
  '2026-10-11 Sun (first Reel)': (at('2026-10-11') || {}).reel_ref || 'none',
  '2026-10-12 Mon': (at('2026-10-12') || {}).reel_ref || 'none',
  '2026-10-13 Tue': (at('2026-10-13') || {}).reel_ref || 'none',
  '2026-10-16 Fri': (at('2026-10-16') || {}).reel_ref || 'none',
  '2026-10-17 Sat': (at('2026-10-17') || {}).reel_ref || 'none',
};
let beforeStart = '';
try { at('2026-10-10'); beforeStart = 'NOT BLOCKED'; } catch (e) { beforeStart = 'blocked: ' + e.message; }
const synth = [
  { ref: '70:5-6', surah: 70, ayahStart: 5, ayahEnd: 6, theme: 'T', reciterId: 1, style: 'a' },
  { ref: '94:1-8', surah: 94, ayahStart: 1, ayahEnd: 8, theme: 'T', reciterId: 2, style: 'b' },
  { ref: '2:1-2', surah: 2, ayahStart: 1, ayahEnd: 2, theme: 'T', reciterId: 3, style: 'c' },
];
// Synthetic: the Daily Post on the first Reel day (Sun 2026-10-11) is 28:24, so a list that starts with surah 28 must skip it.
synth[0] = { ...synth[0], ref: '28:24-25', surah: 28 };
const sp = simulate(dailyStart, reelDates(reelStart, weekdays, 3), synth);
const synthetic = sp.map((p) => p.date + ' (Daily Post ' + p.dailyPostRef + ') -> ' + p.entry.ref + (p.skippedForRule.length ? '  [skipped ' + p.skippedForRule.join(',') + ' by the rule]' : ''));
const syntheticOk = sp[0].entry.ref === '94:1-8' && sp[0].skippedForRule.join() === '28:24-25' && sp[1].entry.ref === '28:24-25';
return [{ json: {
  reelsSimulated: picks.length, from: picks[0].date, to: picks[picks.length - 1].date, listSize: LIST.length,
  problems, rulePassed: problems.length === 0,
  syntheticRuleTest: syntheticOk, synthetic,
  daysWhereRuleForcedASkip: forced, examples, dayChecks, beforeStart,
  distinctInFirstCycle: new Set(picks.slice(0, LIST.length).map((p) => p.entry.ref)).size,
  first12: picks.slice(0, 12).map((p) => p.date + ' ' + p.weekday + '  Reel ' + p.entry.ref + '  (Daily Post ' + p.dailyPostRef + ')'),
} }];
`;
} else {
  console.error('usage: node scripts/make_n8n_code.js <pick_reel|pick_reel_test> [--raw]');
  process.exit(2);
}

if (/[^\x00-\x7F]/.test(code)) { console.error('generated code contains non-ASCII characters'); process.exit(3); }
process.stdout.write(raw ? code : JSON.stringify(code));
