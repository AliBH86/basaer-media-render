// Downloads one object from the Basaer R2 bucket using the bucket-scoped key, given its public URL.
// Why: the public media host answers 403 to GitHub's runners (Cloudflare zone security), so renders read through the S3 endpoint.
// The request is signed in headers, never in a URL, so no signature can reach the public run log.
// Usage: node r2_download.js <outFile> <publicUrl>
// Env: R2_BASAER_ENDPOINT, R2_BASAER_ACCESS_KEY_ID, R2_BASAER_SECRET_ACCESS_KEY
const crypto = require('crypto');
const fs = require('fs');

const BUCKET = 'basaer-media';
const sha = (d) => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();

async function getObject(objectKey) {
  const { R2_BASAER_ENDPOINT: ep, R2_BASAER_ACCESS_KEY_ID: ak, R2_BASAER_SECRET_ACCESS_KEY: sk } = process.env;
  if (!ep || !ak || !sk) throw new Error('R2 environment is not set');
  const url = new URL(`${ep.replace(/\/$/, '')}/${BUCKET}/${objectKey}`);
  const payload = sha('');
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const amz = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const date = amz.slice(0, 8);
    const headers = { host: url.host, 'x-amz-content-sha256': payload, 'x-amz-date': amz };
    const names = Object.keys(headers).sort();
    const canonical = ['GET', url.pathname, '', names.map((n) => `${n}:${headers[n]}\n`).join(''), names.join(';'), payload].join('\n');
    const scope = `${date}/auto/s3/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', amz, scope, sha(canonical)].join('\n');
    const key = hmac(hmac(hmac(hmac(`AWS4${sk}`, date), 'auto'), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', key).update(toSign).digest('hex');
    const { host, ...send } = headers;
    try {
      const res = await fetch(url, { headers: { ...send, authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` } });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      lastError = `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403 || res.status === 404) break;
    } catch (e) { lastError = e.message; }
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error(`${objectKey}: download failed (${lastError})`);
}

module.exports = { getObject };

if (require.main === module) {
  const [, , outFile, publicUrl] = process.argv;
  getObject(new URL(publicUrl).pathname.replace(/^\//, '')).then((body) => {
    fs.writeFileSync(outFile, body);
    console.log(`${publicUrl} -> ${body.length} bytes`);
  }).catch((e) => { console.error(`ERROR: ${e.message}`); process.exitCode = 1; });
}
