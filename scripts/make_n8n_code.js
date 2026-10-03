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
const start = DateTime.fromISO('2026-10-10', { zone: Z }).startOf('day');
const picks = simulate(start, 1, 160);
const problems = [];
const examples = [];
let forced = 0;
picks.forEach((p, i) => {
  if (p.entry.surah === p.dailyPostSurah) problems.push(p.date + ': Reel ' + p.entry.ref + ' has the same surah as the Daily Post ' + p.dailyPostRef);
  if (i && p.entry.surah === picks[i - 1].entry.surah) problems.push(p.date + ': same surah as the previous Reel');
  if (i && p.entry.reciterId === picks[i - 1].entry.reciterId) problems.push(p.date + ': same reciter as the previous Reel');
  if (p.skippedForRule.length) { forced++; if (examples.length < 8) examples.push(p.date + ' (Daily Post ' + p.dailyPostRef + '): skipped ' + p.skippedForRule.join(', ') + ' -> used ' + p.entry.ref); }
});
// The Daily Post lookup must reproduce the rotation approved for the first week.
const expectedDaily = ['70:5', '28:24', '25:58', '42:28', '2:152', '29:60', '18:1', '57:9'];
const gotDaily = expectedDaily.map((_, i) => dailyPostFor(start.plus({ days: i }), start).ayahKey);
// Synthetic case that MUST trigger the rule: day 1's Daily Post is 70:5, so a list that starts with surah 70
// has to skip it on day 1 and use it later.
const synth = [
  { ref: '70:5-6', surah: 70, ayahStart: 5, ayahEnd: 6, theme: 'T', reciterId: 1, style: 'a' },
  { ref: '94:1-8', surah: 94, ayahStart: 1, ayahEnd: 8, theme: 'T', reciterId: 2, style: 'b' },
  { ref: '2:1-2', surah: 2, ayahStart: 1, ayahEnd: 2, theme: 'T', reciterId: 3, style: 'c' },
];
const sp = simulate(start, 1, 3, synth);
const synthetic = sp.map((p) => p.date + ' (Daily Post ' + p.dailyPostRef + ') -> ' + p.entry.ref + (p.skippedForRule.length ? '  [skipped ' + p.skippedForRule.join(',') + ' by the rule]' : ''));
const syntheticOk = sp[0].entry.ref === '94:1-8' && sp[0].skippedForRule.join() === '70:5-6' && sp[1].entry.ref === '70:5-6';
return [{ json: {
  daysSimulated: picks.length, listSize: LIST.length,
  problems, rulePassed: problems.length === 0,
  dailyLookupMatchesApproved: JSON.stringify(gotDaily) === JSON.stringify(expectedDaily), gotDaily,
  syntheticRuleTest: syntheticOk, synthetic,
  daysWhereRuleForcedASkip: forced, examples,
  distinctInFirstCycle: new Set(picks.slice(0, LIST.length).map((p) => p.entry.ref)).size,
  first14: picks.slice(0, 14).map((p) => p.date + '  Reel ' + p.entry.ref + '  (Daily Post ' + p.dailyPostRef + ')'),
} }];
`;
} else {
  console.error('usage: node scripts/make_n8n_code.js <pick_reel|pick_reel_test> [--raw]');
  process.exit(2);
}

if (/[^\x00-\x7F]/.test(code)) { console.error('generated code contains non-ASCII characters'); process.exit(3); }
process.stdout.write(raw ? code : JSON.stringify(code));
