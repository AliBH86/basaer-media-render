// Uploads one file to the Basaer R2 bucket and appends {key: url} to <outDir>/uploads.json, so the n8n resumeUrl callback does not change. A failure exits non-zero: there is no fallback.
// Usage: node upload_r2.js <filePath> <objectKey> <contentType> [outDir] [key]
// Env: R2_BASAER_ENDPOINT, R2_BASAER_ACCESS_KEY_ID, R2_BASAER_SECRET_ACCESS_KEY, R2_BASAER_PUBLIC_BASE
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BUCKET = 'basaer-media';
const sha = (d) => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();

async function putObject(filePath, objectKey, contentType) {
  const { R2_BASAER_ENDPOINT: ep, R2_BASAER_ACCESS_KEY_ID: ak, R2_BASAER_SECRET_ACCESS_KEY: sk, R2_BASAER_PUBLIC_BASE: pub } = process.env;
  if (!ep || !ak || !sk || !pub) throw new Error('R2 environment is not set');
  const body = fs.readFileSync(filePath);
  const url = new URL(`${ep.replace(/\/$/, '')}/${BUCKET}/${objectKey}`);
  const payload = sha(body);
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const amz = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const date = amz.slice(0, 8);
    const headers = { 'content-type': contentType, host: url.host, 'x-amz-content-sha256': payload, 'x-amz-date': amz };
    const names = Object.keys(headers).sort();
    const canonical = ['PUT', url.pathname, '', names.map((n) => `${n}:${headers[n]}\n`).join(''), names.join(';'), payload].join('\n');
    const scope = `${date}/auto/s3/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha(canonical)].join('\n');
    const key = hmac(hmac(hmac(hmac(`AWS4${sk}`, date), 'auto'), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
    const { host, ...send } = headers;
    try {
      const res = await fetch(url, { method: 'PUT', body, headers: { ...send, authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` } });
      if (res.ok) return `${pub.replace(/\/$/, '')}/${objectKey}`;
      lastError = `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) break;
    } catch (e) { lastError = e.message; }
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error(`${objectKey}: upload failed (${lastError})`);
}

module.exports = { putObject };

if (require.main === module) {
  const [, , filePath, objectKey, contentType, outDir, key] = process.argv;
  putObject(filePath, objectKey, contentType).then((publicUrl) => {
    console.log(`${objectKey} -> ${publicUrl}`);
    if (outDir && key) {
      const uploadsPath = path.join(outDir, 'uploads.json');
      let uploads = {};
      try { uploads = JSON.parse(fs.readFileSync(uploadsPath, 'utf8')); } catch (e) { /* first write */ }
      uploads[key] = publicUrl;
      fs.writeFileSync(uploadsPath, JSON.stringify(uploads, null, 2));
    }
  }).catch((e) => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
}
