// PICK REEL - chooses the Reel for today from the approved list (data/reel_list.json).
//
// RULE (user, 2026-10-03): a Reel must NEVER use the same ayah or surah as that day's Daily Post. The Daily Post of
// any date is computed with the same rotation as 'Basaer - Daily Post' > 'Pick Ayah' (dailyPostFor below is a copy
// of that logic; data/daily_rotation.json holds the lists). Comparing surahs covers "same ayah" too.
//
// How it works: the Reel schedule is simulated slot by slot from CYCLE_START_DATE (slot 0 = start date; one slot
// every REEL_EVERY_N_DAYS days, default 1). For every slot the first not-yet-used list entry that
//   (hard) is not from the same surah as that day's Daily Post, and
//   (soft) is not from the same surah, the same reciter or the same background as the previous Reel
// is taken. If no entry satisfies the soft rules the first one that satisfies the hard rule is used. Entries
// skipped because of the hard rule stay in the list and are used on a later day. When every entry has been used
// the cycle starts again. No state is stored: the result for a date is always the same.
//
// Config.USE_PICKER = 'false' bypasses all of this and uses the Config values (manual test renders).
const Z = 'Asia/Bahrain';
const LIST = __REEL_LIST__;
const DAILY = __DAILY__;
const FRIDAY = __FRIDAY__;
const mod = (n, m) => ((n % m) + m) % m;

// ---- Daily Post rotation (same logic as 'Pick Ayah') ----
function dailyPostFor(day, start) {
  const span = Math.round(day.diff(start, 'days').days);
  const from = span >= 0 ? start : day;
  let fridays = 0;
  let others = 0;
  for (let i = 0; i < Math.abs(span); i++) {
    if (from.plus({ days: i }).weekday === 5) fridays++; else others++;
  }
  const sign = span >= 0 ? 1 : -1;
  if (day.weekday === 5) return { ayahKey: FRIDAY[mod(sign * fridays, FRIDAY.length)], theme: 'Friday' };
  const e = DAILY[mod(sign * others, DAILY.length)];
  return { ayahKey: e[0], theme: e[1] };
}

// ---- Reel schedule ----
function simulate(start, everyN, slots, list) {
  const L = list || LIST;
  const used = new Array(L.length).fill(false);
  const picks = [];
  let prev = null;
  for (let s = 0; s < slots; s++) {
    const day = start.plus({ days: s * everyN });
    const post = dailyPostFor(day, start);
    const postSurah = Number(post.ayahKey.split(':')[0]);
    const hardOk = (e) => e.surah !== postSurah;
    const softOk = (e) => !prev || (e.surah !== prev.surah && e.reciterId !== prev.reciterId && e.style !== prev.style);
    const firstUnused = (pred) => L.findIndex((e, i) => !used[i] && pred(e));
    let idx = firstUnused((e) => hardOk(e) && softOk(e));
    if (idx < 0) idx = firstUnused(hardOk);
    if (idx < 0) { used.fill(false); idx = firstUnused(hardOk); } // start a new cycle
    if (idx < 0) throw new Error('no Reel in the list avoids the Daily Post surah ' + postSurah);
    const skippedForRule = [];
    for (let i = 0; i < idx; i++) if (!used[i] && !hardOk(L[i])) skippedForRule.push(L[i].ref);
    used[idx] = true;
    prev = L[idx];
    picks.push({ slot: s, date: day.toFormat('yyyy-MM-dd'), entry: L[idx], dailyPostRef: post.ayahKey, dailyPostSurah: postSurah, skippedForRule });
    if (used.every(Boolean)) used.fill(false);
  }
  return picks;
}

function pickReelForConfig(cfg, todayDay) {
  const usePicker = String(cfg.USE_PICKER === undefined ? 'true' : cfg.USE_PICKER).toLowerCase() !== 'false';
  if (!usePicker) return { ...cfg, reel_source: 'manual override (Config values)', dayIndex: Number(cfg.dayIndex) || 0 };
  const start = DateTime.fromISO(String(cfg.CYCLE_START_DATE || ''), { zone: Z }).startOf('day');
  if (!start.isValid) throw new Error('Config.CYCLE_START_DATE is missing or not a valid yyyy-MM-dd date');
  const everyN = Math.max(1, Number(cfg.REEL_EVERY_N_DAYS) || 1);
  const d = Math.round(todayDay.diff(start, 'days').days);
  if (d < 0) throw new Error('Pick Reel ran before CYCLE_START_DATE (the before-start guard should have skipped this run)');
  if (d % everyN !== 0) return null; // not a Reel day
  const slot = d / everyN;
  const p = simulate(start, everyN, slot + 1)[slot];
  return {
    ...cfg,
    reel_source: 'picker',
    surah: p.entry.surah,
    ayahStart: p.entry.ayahStart,
    ayahEnd: p.entry.ayahEnd,
    reciterId: p.entry.reciterId,
    style: p.entry.style,
    theme: p.entry.theme,
    dayIndex: slot,
    reel_ref: p.entry.ref,
    daily_post_ref: p.dailyPostRef,
    skipped_for_daily_post_rule: p.skippedForRule,
  };
}
//--PICKER-END--
