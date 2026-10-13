// Studio poem (owner, 2026-10-14): the owner types a poem in the bot, n8n voices it (ElevenLabs "EL4", the owner's pick)
// and this builds the Reel's two tracks from that raw voice, the same way as the approved door poem:
//   voice.mp3  the voice with a 2 s lead-in and a tail for the save/share end (the text is timed on this one)
//   audio.mp3  what is heard: the voice (light compression + room echo) over music E1 (soft piano, CC0 samples,
//              owner-approved) 32 dB under the voice and ducked by it (owner's level, 2026-10-14). With music off
//              (the owner's voice-only choice) it is the voice alone.
// Never used for Quran: Studio refuses Quran text, and no music ever goes with Quran.
//
// Usage: node scripts/poem_audio.js <raw voice> <outDir> <music: 1|0>
const { execSync } = require('child_process');
const path = require('path');

const [raw, outDir, musicArg] = process.argv.slice(2);
const music = musicArg !== '0';
const LEAD = 2.0, TAIL = 4.5, MUSIC_DB = -32;
const sh = (c) => execSync(c, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const voiceSec = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${raw}"`));
if (!(voiceSec > 0.5)) throw new Error('the voice file is empty');
const dur = +(LEAD + voiceSec + TAIL).toFixed(2);
const ms = Math.round(LEAD * 1000);
const voice = path.join(outDir, 'voice.mp3'), audio = path.join(outDir, 'audio.mp3');
const bed = path.join(__dirname, '..', 'data', 'music', 'e1_piano_long.mp3');

sh(`ffmpeg -nostdin -y -loglevel error -i "${raw}" -af "adelay=${ms}|${ms},apad=whole_dur=${dur}" -t ${dur} -b:a 192k "${voice}"`);
const v = `[0:a]aformat=sample_rates=44100:channel_layouts=stereo,acompressor=threshold=-20dB:ratio=3:attack=10:release=200,aecho=0.8:0.5:60:0.12,adelay=${ms}|${ms},apad=whole_dur=${dur}`;
const end = `afade=t=out:st=${(dur - 2).toFixed(2)}:d=2,loudnorm=I=-16:TP=-1.5`;
const graph = music
  ? `${v},asplit[v][sc];[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${MUSIC_DB}dB,atrim=0:${dur}[m];[m][sc]sidechaincompress=threshold=0.05:ratio=4:attack=20:release=400[md];[v][md]amix=inputs=2:normalize=0,${end}`
  : `${v},${end}`;
sh(`ffmpeg -nostdin -y -loglevel error -i "${raw}" ${music ? `-i "${bed}"` : ''} -filter_complex "${graph}" -t ${dur} -b:a 192k "${audio}"`);
console.log(`poem audio: voice ${voiceSec.toFixed(1)} s, Reel ${dur} s, music ${music ? MUSIC_DB + ' dB' : 'off'}`);
