// Studio clip (2026-10-12): turn the spec n8n sends into the item folder render_series.js reads.
//   phrases.json: header lines, save/share text, the on-screen lines (one phrase each), pageStarts
//   plan.json:    one part covering every line, footage arc (library pools only) and shot length
// aligned.json is written next by series_align.py (the lines timed on the voice-only track).
//
// Usage: node scripts/studio_clip_files.js '<spec json>' <outDir>
const fs = require('fs');
const path = require('path');

const [specArg, outDir] = process.argv.slice(2);
const spec = JSON.parse(specArg);
const lines = (spec.lines || []).map((l) => String(l).replace(/\s+/g, ' ').trim()).filter(Boolean);
if (!lines.length) throw new Error('spec has no lines');
if (lines.some((l) => /[﴾﴿]/.test(l))) throw new Error('Quran brackets in the text: Quran is only shown from the API');

// footage: only pools that exist in the approved library
const lib = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'footage_library.json'), 'utf8'));
const pools = new Set(lib.clips.map((c) => c.pool));
const arc = String(spec.arc || '').split(',').map((p) => p.trim()).filter((p) => pools.has(p));
const fallback = ['cNight', 'cDusk', 'cDawn', 'cSun', 'cLight', 'cClouds', 'cSea', 'cGold'].filter((p) => pools.has(p));

const starts = Array.isArray(spec.pageStarts) && spec.pageStarts.length
  ? [...new Set(spec.pageStarts.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < lines.length))].sort((a, b) => a - b)
  : lines.map((_, i) => i);
if (starts[0] !== 0) starts.unshift(0);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'phrases.json'), JSON.stringify({
  title: spec.title || 'تذكير', titleEn: spec.titleEn || 'REMINDER', sub: spec.sub || '',
  reciter: spec.reciter || '', reciterEn: spec.reciterEn || '',
  cta: Array.isArray(spec.cta) && spec.cta.length === 2 ? spec.cta : ['احفظه', 'أرسله لمن تحب'],
  pageStarts: starts,
  quranLines: Array.isArray(spec.quranLines) ? spec.quranLines : [],
  style: spec.style === 'energetic' ? 'energetic' : '',
  bgUrl: spec.bgUrl || '', fullAudio: !!spec.fullAudio || !!spec.poem, lineBreaks: !!spec.lineBreaks || !!spec.poem, layout: spec.layout || (spec.bgUrl ? 'scene' : 'default'),
  seed: 1 + [...lines.join('|')].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) % 99991, 7),
  phrases: lines.map((text, i) => ({ i, text })),
}, null, 1));
fs.writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify({
  series: spec.title || 'studio', parts: [{ from: 0, to: lines.length - 1, part: 1, arc: (arc.length ? arc : fallback).join(','), maxShot: Number(spec.maxShot) || (spec.style === 'energetic' ? 3.4 : 8) }],
}, null, 1));
console.log(`${lines.length} lines, screens start at ${starts.join(',')}, arc ${(arc.length ? arc : fallback).join(',')}`);
