// Daily Post backgrounds: one 1080x1350 JPEG per entry of data/daily_nature_stills.json ("<clip>|<second>"), cut from the approved
// footage library on R2 and stored at basaer/footage/stills/<clip>-<second>.jpg. A still already on R2 is skipped.
// Usage: node scripts/footage_stills_r2.js <workDir>
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { putObject } = require('./upload_r2');
const { getObject, objectExists } = require('./r2_download');

const work = path.resolve(process.argv[2] || 'work');
fs.mkdirSync(work, { recursive: true });
const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'daily_nature_stills.json'), 'utf8'));
(async () => {
  const failed = []; let made = 0, kept = 0, bytes = 0;
  const cached = {};
  for (const entry of list) {
    const [clip, sec] = entry.split('|');
    const key = `basaer/footage/stills/${clip}-${sec}.jpg`;
    try {
      if (await objectExists(key)) { kept++; continue; }
      if (!cached[clip]) { cached[clip] = path.join(work, clip + '.mp4'); fs.writeFileSync(cached[clip], await getObject(`basaer/footage/${clip}-vertical.mp4`)); }
      const out = path.join(work, `${clip}-${sec}.jpg`);
      execSync(`ffmpeg -nostdin -loglevel error -y -ss ${sec} -i "${cached[clip]}" -frames:v 1 -vf "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350" -q:v 3 "${out}"`, { stdio: 'inherit', shell: '/bin/bash' });
      await putObject(out, key, 'image/jpeg');
      bytes += fs.statSync(out).size; made++;
    } catch (e) { failed.push(`${entry}: ${e.message.split('\n')[0]}`); console.log('FAILED ' + entry + ' ' + e.message.split('\n')[0]); }
  }
  console.log(JSON.stringify({ total: list.length, made, kept, mb: +(bytes / 1048576).toFixed(1), failed }, null, 1));
  if (failed.length) process.exitCode = 1;
})();
