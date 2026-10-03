// Builds the JSON that the workflow POSTs to n8n's resumeUrl when a render FAILS, so the waiting n8n execution
// continues (and alerts the owner) instead of hanging until it times out.
//
// Usage: node notify_failure.js <outDir> <runId> <surah> <ayahStart>
// Writes <outDir>/failure_payload.json
const fs = require('fs');
const path = require('path');

const [outDir, runId, surah, ayahStart] = process.argv.slice(2);
let report = null;
try { report = JSON.parse(fs.readFileSync(path.join(outDir, 'integrity_report.json'), 'utf8')); } catch (e) { /* no report = failure was not the integrity guard */ }

const repo = process.env.GITHUB_REPOSITORY || 'AliBH86/basaer-media-render';
const payload = {
  renderFailed: true,
  integrityFailed: !!(report && report.ok === false),
  ref: report && report.ayahs && report.ayahs.length ? report.ayahs.join(', ') : `${surah}:${ayahStart}`,
  issues: report && report.issues ? report.issues.slice(0, 6) : [],
  runId,
  runUrl: `https://github.com/${repo}/actions/runs/${runId}`,
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'failure_payload.json'), JSON.stringify(payload));
console.log('Failure payload written:', JSON.stringify({ ...payload, issues: payload.issues.length + ' issue(s)' }));
