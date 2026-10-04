// Khatm research: audio + word-timing coverage for every approved reciter over all 114 surahs.
// Stores only references, counts and durations (no text, no audio) in coverage.json.
const https = require('https');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'coverage.json');
const RECITERS = [7, 2, 6, 9, 3, 97, 5, 4, 10];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(url, tries = 4) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'basaer-khatm-research' } }, (res) => {
      const c = []; res.on('data', (d) => c.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { reject(new Error(url + ' -> ' + res.statusCode)); } });
    }).on('error', reject);
  }).catch(async (e) => { if (tries > 1) { await sleep(3000); return getJson(url, tries - 1); } throw e; });
}
(async () => {
  const chapters = (await getJson('https://api.quran.com/api/v4/chapters?language=en')).chapters;
  // Word counts from the API's word lists (one call per chapter, words only, no text kept).
  const words = {};
  for (const ch of chapters) {
    let page = 1;
    for (;;) {
      const r = await getJson(`https://api.quran.com/api/v4/verses/by_chapter/${ch.id}?words=true&word_fields=char_type_name&per_page=50&page=${page}`);
      for (const v of r.verses) words[v.verse_key] = v.words.filter((w) => w.char_type_name === 'word').length;
      if (!r.pagination.next_page) break; page = r.pagination.next_page;
    }
    process.stdout.write(`w${ch.id} `);
  }
  console.log('\nword counts', Object.keys(words).length);
  const out = { chapters: chapters.map((c) => ({ id: c.id, verses: c.verses_count, bismillah_pre: c.bismillah_pre })), reciters: {} };
  for (const rid of RECITERS) {
    const rec = { surahs: {}, gaps: [] };
    for (const ch of chapters) {
      const r = await getJson(`https://api.qurancdn.com/api/qdc/audio/reciters/${rid}/audio_files?chapter=${ch.id}&segments=true`);
      const f = r.audio_files && r.audio_files[0];
      const s = { ok: true, problems: [] };
      if (!f || !f.audio_url) { s.ok = false; s.problems.push('no chapter audio'); rec.surahs[ch.id] = s; rec.gaps.push(ch.id); continue; }
      const vt = f.verse_timings || [];
      if (vt.length !== ch.verses_count) s.problems.push(`verse timings ${vt.length}/${ch.verses_count}`);
      s.durations = [];
      for (const t of vt) {
        const segs = (t.segments || []).filter((x) => Array.isArray(x) && x.length >= 3);
        const want = words[t.verse_key];
        if (!segs.length) s.problems.push(`${t.verse_key}: no word timings`);
        else if (want && segs.length < want) s.problems.push(`${t.verse_key}: ${segs.length}/${want} words timed`);
        s.durations.push([t.verse_key, t.timestamp_to - t.timestamp_from]);
      }
      s.first_from_ms = vt[0] ? vt[0].timestamp_from : null; // audio before ayah 1 (Bismillah / isti'adha / silence)
      s.first_word_ms = vt[0] && vt[0].segments && vt[0].segments[0] ? vt[0].segments[0][1] : null;
      s.file_ms = f.duration ? f.duration * (f.duration < 100000 ? 1000 : 1) : null;
      s.ok = s.problems.length === 0;
      if (!s.ok) rec.gaps.push(ch.id);
      rec.surahs[ch.id] = s;
      await sleep(120);
    }
    out.reciters[rid] = rec;
    console.log(`reciter ${rid}: gaps ${rec.gaps.length ? rec.gaps.join(',') : 'none'}`);
    fs.writeFileSync(OUT, JSON.stringify(out));
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log('DONE');
})().catch((e) => { console.error(e); process.exit(1); });
