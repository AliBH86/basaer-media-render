// YouTube "Like · Share · Subscribe" call to action (owner, 2026-11-10), drawn in the Basaer navy/gold look.
// Used by yt_surah.js (the outro card of a full surah) and by render_reel.js when CTA=1 (YouTube Shorts: a small
// pill in the last seconds). Icons only: no faces, no logos. The labels are interface words, never Quran text.
// The YouTube API cannot add clickable end-screen elements, so this is drawn into the picture itself.
const GOLD = '#D9B45A', GOLD_HI = '#F0CB6E', CREAM = '#F7F1E6', NAVY = 'rgba(6,18,25,0.72)';

// Material Symbols paths (Apache 2.0), 24x24.
const ICONS = {
  like: '<path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>',
  share: '<path transform="translate(24,0) scale(-1,1)" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>',
  subscribe: '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>',
};
const ITEMS = [
  { key: 'like', ar: 'أعجبني', en: 'LIKE' },
  { key: 'share', ar: 'شارك', en: 'SHARE' },
  { key: 'subscribe', ar: 'اشترك', en: 'SUBSCRIBE' },
];
const icon = (key, px, fill) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="${fill}" style="flex:none;display:block;">${ICONS[key]}</svg>`;

// Big row for the 16:9 outro: three gold rings with an icon and a bilingual label under each.
// arFont / enFont = font-family names already defined by the page.
function ctaRowHtml({ arFont, enFont, ring = 150, gap = 120 }) {
  const cell = (it) => `<div style="display:flex;flex-direction:column;align-items:center;width:${ring + 90}px;">
    <div style="width:${ring}px;height:${ring}px;border-radius:50%;border:3px solid ${GOLD_HI};background:${NAVY};display:flex;align-items:center;justify-content:center;box-shadow:0 0 34px rgba(240,203,110,0.38), 0 6px 24px rgba(0,0,0,0.6);">${icon(it.key, Math.round(ring * 0.5), it.key === 'subscribe' ? GOLD_HI : CREAM)}</div>
    <div style="font-family:'${arFont}';font-size:40px;direction:rtl;color:${GOLD_HI};line-height:1.9;margin-top:6px;text-shadow:0 2px 12px rgba(0,0,0,0.8);">${it.ar}</div>
    <div style="font-family:'${enFont}';font-size:18px;letter-spacing:5px;font-weight:700;color:${CREAM};margin-top:12px;">${it.en}</div>
  </div>`;
  return `<div style="display:flex;direction:ltr;align-items:flex-start;justify-content:center;gap:${gap - 90}px;">${ITEMS.map(cell).join('')}</div>`;
}

// Small pill for a 1080x1920 Short. Sits under the audio wave (wave ends at y 1320) and above YouTube's own
// caption area, and stays left of the Shorts button column.
function ctaPillPageHtml({ W, H, fontCss, arFont, enFont, top = 1336, width = 700 }) {
  const cell = (it) => `<div style="display:flex;align-items:center;gap:12px;">${icon(it.key, 40, it.key === 'subscribe' ? GOLD_HI : CREAM)}<div style="text-align:center;"><div style="font-family:'${arFont}';font-size:30px;direction:rtl;color:${GOLD_HI};line-height:1.45;">${it.ar}</div><div style="font-family:'${enFont}';font-size:14px;letter-spacing:3px;font-weight:700;color:${CREAM};margin-top:16px;">${it.en}</div></div></div>`;
  const sep = `<span style="width:1px;height:46px;background:rgba(240,203,110,0.45);"></span>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${fontCss}
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${W}px; height:${H}px; overflow:hidden; background:transparent; position:relative; }
  .pill { position:absolute; top:${top}px; left:${Math.round((W - width) / 2)}px; width:${width}px; height:122px; border-radius:999px; border:2px solid rgba(240,203,110,0.85); background:${NAVY}; display:flex; direction:ltr; align-items:center; justify-content:space-evenly; box-shadow:0 0 26px rgba(240,203,110,0.28), 0 6px 22px rgba(0,0,0,0.55); }
  </style></head><body><div class="pill">${ITEMS.map(cell).join(sep)}</div></body></html>`;
}

module.exports = { ctaRowHtml, ctaPillPageHtml, GOLD, GOLD_HI, CREAM };
