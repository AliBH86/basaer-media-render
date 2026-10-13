// Audio bars for every Reel (owner, 2026-10-13: "a wave bar for the audio in all reels", placed UNDER @basaer.media.bh
// and kept on to the very end, also while the save/share prompt shows). One ffmpeg filter chain that turns the Reel's own
// audio into a gold visual, 800 x 64 px, overlaid at x=140, y=1256 (under the handle at 1190 and the save/share pill,
// which ends at 1244). The volume boosts are for the drawing only, never the sound.
//
// Styles (samples: Cloudinary studio-test/wave-style-1..4-a.mp4), chosen with BARS_STYLE; DEFAULT is the owner's pick.
//   1 mirrored bars   2 bars from a baseline   3 smooth wave   4 fine mirrored bars
const DEFAULT = '3'; // owner's pick, 2026-10-13: smooth wave
const X = 140, Y = 1256;
const GOLD = '0xF0CB6E';
const gaps = (period, gap) => `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(mod(X,${period}),${gap}),0,alpha(X,Y))'`;
const eq = (bins, h) => `aformat=channel_layouts=mono,aresample=8000,volume=9,showfreqs=s=${bins}x${h}:mode=bar:ascale=cbrt:fscale=log:win_size=1024:colors=${GOLD}:averaging=3,scale=800:${h}:flags=neighbor,format=rgba`;
const STYLES = {
  1: (o) => `${eq(40, 32)},${gaps(20, 7)},split[${o}u][${o}d];[${o}d]vflip[${o}f];[${o}u][${o}f]vstack,colorchannelmixer=aa=0.92`,
  2: () => `${eq(40, 64)},${gaps(20, 7)},colorchannelmixer=aa=0.92`,
  // 3: the drawing input is low-passed (280 Hz, twice) so the wave flows smoothly on recitation as on speech
  3: () => `aformat=channel_layouts=mono,lowpass=f=280,lowpass=f=280,volume=12,showwaves=s=800x64:mode=cline:rate=30:colors=${GOLD}:scale=sqrt:draw=full,format=rgba,colorchannelmixer=aa=0.9`,
  4: (o) => `${eq(80, 32)},${gaps(10, 5)},split[${o}u][${o}d];[${o}d]vflip[${o}f];[${o}u][${o}f]vstack,colorchannelmixer=aa=0.92`,
};

// Returns the two filter_complex lines: audio input -> [out] picture of the bars, then [prevLabel]+bars -> [outLabel].
function audioBarsLines(audioInputIdx, prevLabel, outLabel, y = Y) {
  const style = STYLES[process.env.BARS_STYLE || DEFAULT] || STYLES[DEFAULT];
  return [
    `[${audioInputIdx}:a]${style('ab')}[bars]`,
    `[${prevLabel}][bars]overlay=${X}:${y}[${outLabel}]`,
  ];
}

module.exports = { audioBarsLines };
