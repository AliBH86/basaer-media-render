const pick = $('Pick Ayah').first().json;
const verse = $('Get Verse').first().json.verse;
const chapter = $('Get Chapter').first().json.chapter;

const SCHEHERAZADE_REGULAR_URL = 'https://res.cloudinary.com/b72gfdzx/raw/upload/v1790960346/fonts/scheherazade-regular.woff2';
const SCHEHERAZADE_BOLD_URL = 'https://res.cloudinary.com/b72gfdzx/raw/upload/v1790960348/fonts/scheherazade-bold.woff2';
const INTER_REGULAR_URL = 'https://res.cloudinary.com/b72gfdzx/raw/upload/v1790955379/fonts/inter-regular.woff2';

const EASTERN = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
function toEastern(n) {
  return String(n).split('').map((d) => (/[0-9]/.test(d) ? EASTERN[+d] : d)).join('');
}
// Footnote markers removed only. The English is otherwise shown exactly as the API returns it
// (approved 2026-10-03): no quote stripping and no added quotes.
function cleanTranslation(text) {
  return text.replace(/<sup[^>]*>.*?<\/sup>/g, '').replace(/<[^>]+>/g, '').trim();
}
function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Display-only: hide the rub-el-hizb marker on slides. The stored/source text is never modified.
function hideHizb(t) {
  return t.replace(/۞\s*/g, '').trim();
}

const WAQF_CHARS = 'ۖۗۘۙۚۛۜ';
const WAQF_REGEX = new RegExp(`[${WAQF_CHARS}]`);
const WAQF_SPACE_REGEX = new RegExp(` ([${WAQF_CHARS}])`, 'g');
const END_OF_AYAH = '۝';
function glueWaqf(text) {
  return text.replace(WAQF_SPACE_REGEX, ' $1');
}

const INSTAGRAM_CAROUSEL_MAX = 10;
// Approved single-slide rule: <=24 Arabic words and <=240 English characters, or any ayah from the
// approved list (Pick Ayah sets single_slide). These render as ONE combined slide with fit-to-frame.
const SINGLE_SLIDE_MAX_WORDS = 24;
const SINGLE_SLIDE_MAX_EN = 240;
const AYAH_SEGMENT_BUDGET = 190;
const TRANSLATION_CHAR_BUDGET = 480;

function pickAyahFontSize(len) {
  if (len <= 35) return 100;
  if (len <= 70) return 86;
  if (len <= 110) return 76;
  return 70;
}

function splitIntoWaqfSegments(text) {
  const parts = text.split(new RegExp(`([${WAQF_CHARS}])`));
  const segments = [];
  let cur = '';
  for (let i = 0; i < parts.length; i++) {
    cur += parts[i];
    if (WAQF_REGEX.test(parts[i])) {
      segments.push(cur.trim());
      cur = '';
    }
  }
  if (cur.trim()) segments.push(cur.trim());
  return segments.filter(Boolean);
}

function groupIntoSlides(segments, budget) {
  const slides = [];
  let cur = [];
  let curLen = 0;
  for (const seg of segments) {
    if (cur.length && curLen + seg.length + 1 > budget) {
      slides.push(cur.join(' '));
      cur = [];
      curLen = 0;
    }
    cur.push(seg);
    curLen += seg.length + 1;
  }
  if (cur.length) slides.push(cur.join(' '));
  return slides;
}

function planAyahSlides(text) {
  if (text.length <= AYAH_SEGMENT_BUDGET) return [text];
  const segments = splitIntoWaqfSegments(text);
  if (segments.length <= 1) {
    const words = text.split(' ');
    const slides = [];
    let cur = [];
    let curLen = 0;
    for (const w of words) {
      if (cur.length && curLen + w.length + 1 > AYAH_SEGMENT_BUDGET) {
        slides.push(cur.join(' '));
        cur = [];
        curLen = 0;
      }
      cur.push(w);
      curLen += w.length + 1;
    }
    if (cur.length) slides.push(cur.join(' '));
    return slides;
  }
  return groupIntoSlides(segments, AYAH_SEGMENT_BUDGET);
}

function planTranslationSlides(translation) {
  if (translation.length <= TRANSLATION_CHAR_BUDGET) return [translation];
  const words = translation.split(' ');
  const slides = [];
  let cur = [];
  let curLen = 0;
  for (const w of words) {
    if (cur.length && curLen + w.length + 1 > TRANSLATION_CHAR_BUDGET) {
      const joined = cur.join(' ');
      const lastEnd = Math.max(joined.lastIndexOf('. '), joined.lastIndexOf('? '), joined.lastIndexOf('! '));
      if (lastEnd > joined.length * 0.5) {
        const cutAt = lastEnd + 1;
        slides.push(joined.slice(0, cutAt).trim());
        const remainder = joined.slice(cutAt).trim();
        cur = remainder ? remainder.split(' ') : [];
        curLen = cur.length ? cur.join(' ').length : 0;
      } else {
        slides.push(joined);
        cur = [];
        curLen = 0;
      }
    }
    cur.push(w);
    curLen += w.length + 1;
  }
  if (cur.length) slides.push(cur.join(' '));
  return slides;
}

const FONT_FACES = `
  @font-face { font-family:'Scheherazade'; font-weight:400; src: url(${SCHEHERAZADE_REGULAR_URL}) format('woff2'); }
  @font-face { font-family:'Scheherazade'; font-weight:700; src: url(${SCHEHERAZADE_BOLD_URL}) format('woff2'); }
  @font-face { font-family:'Inter'; font-weight:400; src: url(${INTER_REGULAR_URL}) format('woff2'); }
`;

const BASE_STYLE = `
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1080px; height:1350px; background:#0F2A3D; overflow:hidden; }
  .frame { box-sizing:border-box; width:984px; height:1254px; margin:48px; border:2px solid #C9A24B; display:flex; flex-direction:column; align-items:center; padding:60px 110px; overflow:hidden; }
  .header { flex:0 0 auto; text-align:center; }
  .surah-ar { font-family:'Scheherazade',serif; font-weight:700; font-size:40px; color:#C9A24B; direction:rtl; margin-top:20px; }
  .surah-en { font-family:'Inter',sans-serif; font-size:20px; letter-spacing:2px; color:#C9A24B; text-transform:uppercase; margin-top:10px; }
  .middle { flex:1 1 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; min-height:0; }
  .content { display:flex; flex-direction:column; align-items:center; width:100%; }
  .ayah { font-family:'Scheherazade',serif; line-height:1.9; color:#F5EDDC; direction:rtl; text-align:center; max-width:740px; }
  .divider { width:90px; height:3px; background:#C9A24B; margin-top:40px; }
  .translation { font-family:'Inter','Scheherazade',sans-serif; font-size:30px; line-height:1.6; color:#D9CFB8; text-align:center; max-width:720px; margin-top:32px; }
  .translator { font-family:'Inter',sans-serif; font-size:18px; color:#8a9bab; margin-top:16px; letter-spacing:1px; }
  .footer { flex:0 0 auto; text-align:center; padding-top:28px; } /* spacing guard: handle never touches the credit line */
  .progress { font-family:'Inter',sans-serif; font-size:20px; color:#8a9bab; margin-bottom:10px; }
  .handle { font-family:'Inter',sans-serif; font-size:24px; color:#C9A24B; margin-bottom:4px; }
  .overflow-flag { position:absolute; left:0; top:0; width:1080px; height:24px; background:#d00; color:#fff; font:18px sans-serif; text-align:center; }
`;

// Fit-to-frame: shrinks Arabic (floor 56px) and English (floor 26px) by binary search (~8 steps, forced
// reflow each step - avoids the many-mutation shaping bug seen in the Reel renderer). If it still does not
// fit at the floors, a red OVERFLOW bar is drawn so the problem is visible in review. Gotenberg waits for
// window.__fitDone before taking the screenshot.
const FIT_SCRIPT = `<script>
(async()=>{
  try { await document.fonts.ready; } catch (e) {}
  const m=document.getElementById('m'), c=document.getElementById('c');
  const a=document.getElementById('a'), t=document.getElementById('t');
  if (m && c) {
    const els=[a&&{el:a,base:parseFloat(getComputedStyle(a).fontSize),min:56}, t&&{el:t,base:parseFloat(getComputedStyle(t).fontSize),min:26}].filter(Boolean);
    const apply=(s)=>{ els.forEach(e=>{ e.el.style.fontSize=Math.max(e.min,Math.round(e.base*s))+'px'; }); void c.offsetHeight; };
    const fits=()=>c.offsetHeight<=m.clientHeight-16;
    let ok=fits();
    if (!ok) { let lo=0.5, hi=1; for (let i=0;i<8;i++){ const mid=(lo+hi)/2; apply(mid); if (fits()) lo=mid; else hi=mid; } apply(lo); ok=fits(); }
    if (!ok) { const f=document.createElement('div'); f.className='overflow-flag'; f.textContent='OVERFLOW'; document.body.appendChild(f); }
  }
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  window.__fitDone=true;
})();
</script>`;

function header(d) {
  return `<div class="header"><div class="surah-ar">سورة ${d.surahArabic} &middot; ${d.refEastern}</div><div class="surah-en">SURAH ${d.surahEnglish.toUpperCase()} &middot; ${d.refLatin}</div></div>`;
}
function page(inner, extraStyle) {
  return `<!DOCTYPE html><html lang="ar"><head><meta charset="UTF-8"><style>${FONT_FACES}${BASE_STYLE}${extraStyle || ''}</style></head><body>${inner}${FIT_SCRIPT}</body></html>`;
}

function renderCombinedSlideHtml(d) {
  return page(`<div class="frame">${header(d)}
    <div class="middle" id="m"><div class="content" id="c">
      <div class="ayah" id="a" style="font-size:${pickAyahFontSize(d.ayahFull.length)}px">${d.ayahFull}</div>
      <div class="divider"></div>
      <div class="translation" id="t">${esc(d.translation)}</div>
      <div class="translator">— ${d.translatorName}</div>
    </div></div>
    <div class="footer"><div class="handle">@basaer.media.bh</div></div>
  </div>`);
}

function renderAyahSlideHtml(d) {
  const progress = `<div class="progress">${toEastern(d.slideIndex)}/${toEastern(d.slideTotal)}</div>`;
  return page(`<div class="frame">${header(d)}
    <div class="middle" id="m"><div class="content" id="c"><div class="ayah" id="a" style="font-size:${pickAyahFontSize(d.ayahChunk.length)}px">${d.ayahChunk}</div></div></div>
    <div class="footer">${progress}<div class="handle">@basaer.media.bh</div></div>
  </div>`);
}

function renderTranslationSlideHtml(d) {
  const progress = `<div class="progress">${toEastern(d.slideIndex)}/${toEastern(d.slideTotal)}</div>`;
  return page(`<div class="frame">${header(d)}
    <div class="middle" id="m"><div class="content" id="c">
      <div class="divider"></div>
      <div class="translation" id="t">${esc(d.translation)}</div>
      <div class="translator">— ${d.translatorName}</div>
    </div></div>
    <div class="footer">${progress}<div class="handle">@basaer.media.bh</div></div>
  </div>`);
}

const arabicBase = hideHizb(verse.text_uthmani);
const translation = cleanTranslation(verse.translations[0].text);
const refEastern = `${toEastern(pick.surah_number)}:${toEastern(pick.ayah_number)}`;
const refLatin = `${pick.surah_number}:${pick.ayah_number}`;
// Surah display names: approved overrides only (data/surah_names.json in the render repo); otherwise the API name.
const SURAH_NAMES = {"3":{"en":"Aal 'Imran"},"14":{"ar":"إبراهيم"},"21":{"en":"Al-Anbiya"},"42":{"en":"Ash-Shura"},"93":{"en":"Ad-Duha"}}; // approved 2026-10-04
const nameOverride = SURAH_NAMES[String(pick.surah_number)] || {};
const TRANSLATION_NAME = $('Config').first().json.TRANSLATION_NAME || 'Saheeh International';
const common = { surahArabic: nameOverride.ar || chapter.name_arabic, surahEnglish: nameOverride.en || chapter.name_simple, refEastern, refLatin };
const ayahMarker = `${END_OF_AYAH}${toEastern(pick.ayah_number)}`;
// Non-breaking space keeps the end-of-ayah marker on the same line as the last word.
const arabicFull = glueWaqf(`${arabicBase} ${ayahMarker}`);
const arabicWordCount = arabicBase.split(/\s+/).filter((w) => w && !/^[۞۩]$/.test(w)).length;

const singleSlide = pick.single_slide === true || (arabicWordCount <= SINGLE_SLIDE_MAX_WORDS && translation.length <= SINGLE_SLIDE_MAX_EN);

let htmls = [];
let tooLongForCarousel = false;
let slideCount = 0;
let reason = '';

if (singleSlide) {
  htmls = [renderCombinedSlideHtml({ ...common, ayahFull: arabicFull, translation, translatorName: TRANSLATION_NAME })];
  slideCount = 1;
} else {
  const ayahSlideTexts = planAyahSlides(arabicBase);
  ayahSlideTexts[ayahSlideTexts.length - 1] = glueWaqf(`${ayahSlideTexts[ayahSlideTexts.length - 1]} ${ayahMarker}`);
  for (let i = 0; i < ayahSlideTexts.length - 1; i++) ayahSlideTexts[i] = glueWaqf(ayahSlideTexts[i]);

  const translationSlideTexts = planTranslationSlides(translation);
  const totalSlides = ayahSlideTexts.length + translationSlideTexts.length;
  slideCount = totalSlides;

  if (totalSlides > INSTAGRAM_CAROUSEL_MAX) {
    tooLongForCarousel = true;
    reason = `${totalSlides} slides needed, exceeds Instagram's ${INSTAGRAM_CAROUSEL_MAX}-slide carousel limit - needs a Reel instead`;
  } else {
    let idx = 0;
    htmls = ayahSlideTexts.map((chunk) => {
      idx += 1;
      return renderAyahSlideHtml({ ...common, ayahChunk: chunk, slideIndex: idx, slideTotal: totalSlides });
    });
    translationSlideTexts.forEach((chunk) => {
      idx += 1;
      htmls.push(renderTranslationSlideHtml({ ...common, translation: chunk, translatorName: TRANSLATION_NAME, slideIndex: idx, slideTotal: totalSlides }));
    });
  }
}

if (tooLongForCarousel) {
  return [{
    json: { ...pick, tooLongForCarousel: true, slideCount, reason },
  }];
}

// Integrity guard input: the exact Arabic/English text that went INTO the rendered HTML (read back from
// the final HTML string, not from the variables), so 'Verify Text Integrity' can compare it with the API.
const pluck = (html, re) => { const m = html.match(re); return m ? m[1] : null; };
return htmls.map((html, i) => ({
  json: {
    ...pick, slideIndex: i + 1, slideCount: htmls.length, tooLongForCarousel: false,
    rendered_arabic: pluck(html, /<div class="ayah" id="a"[^>]*>([\s\S]*?)<\/div>/),
    rendered_english: pluck(html, /<div class="translation" id="t">([\s\S]*?)<\/div>/),
  },
  binary: {
    data: {
      data: Buffer.from(html, 'utf-8').toString('base64'),
      mimeType: 'text/html',
      fileName: 'index.html',
      fileExtension: 'html',
    },
  },
}));