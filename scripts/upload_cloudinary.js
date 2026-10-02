// Uploads one file to Cloudinary via an unsigned preset, prints "<publicId> -> <url>",
// and appends {key, publicId, url} to <outDir>/uploads.json so a later step (e.g. the
// n8n resumeUrl callback) can collect every upload's URL without re-parsing logs.
// Usage: node upload_cloudinary.js <filePath> <publicId> <resourceType: video|image> <outDir> <key>
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [, , filePath, publicId, resourceType, outDir, key] = process.argv;
const respPath = path.join(os.tmpdir(), `cloudinary_resp_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);

execSync(
  `curl -sS -X POST "https://api.cloudinary.com/v1_1/b72gfdzx/${resourceType}/upload" ` +
  `-F "file=@${filePath}" -F "upload_preset=ml_default" -F "public_id=${publicId}" -o "${respPath}"`,
  { shell: '/bin/bash' }
);

const resp = JSON.parse(fs.readFileSync(respPath, 'utf8'));
if (resp.secure_url) {
  console.log(`${publicId} -> ${resp.secure_url}`);
  if (outDir && key) {
    const uploadsPath = path.join(outDir, 'uploads.json');
    let uploads = {};
    try { uploads = JSON.parse(fs.readFileSync(uploadsPath, 'utf8')); } catch (e) { /* first write */ }
    uploads[key] = resp.secure_url;
    fs.writeFileSync(uploadsPath, JSON.stringify(uploads, null, 2));
  }
} else {
  console.error(`${publicId} -> ERROR: ${JSON.stringify(resp.error)}`);
  process.exitCode = 1;
}
