#!/usr/bin/env node
// tools/qa.js - play-test the game headless in Chrome, from the command line.
//
//   node tools/qa.js run  <scenario.js> [budgetMs]                -> builds index.html, runs the scenario, prints its JSON result
//   node tools/qa.js shot <scenario.js> <out.png> [budgetMs] [W H] -> builds, runs the scenario, saves a screenshot (default 1280x720)
//
// A scenario is plain browser JS that runs right after the game boots (localStorage is cleared first).
// The game's test API is window.__sr (see tools/README.md). In "run" mode the scenario must call
// QA_DONE(anyJsonValue). In "shot" mode the scenario sets up a state; Chrome then renders live frames for
// budgetMs of virtual time (default 3000) and saves the picture. Freeze a moment with __sr.hold(true).
// Console errors from the page come back as qaErrors (run mode). Outputs go to tools/out/.
// Chrome: set $CHROME if it is not in the default Windows place. It tests the repo this file lives in,
// or $QA_REPO (e.g. a git worktree).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const REPO = (process.env.QA_REPO || path.resolve(__dirname, '..')).split(path.sep).join('/');
const QA = path.join(__dirname, 'out').split(path.sep).join('/');
const TAG = '_' + require('crypto').createHash('md5').update(REPO.toLowerCase()).digest('hex').slice(0, 8);
fs.mkdirSync(QA, { recursive: true });
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function build() {
  const r = cp.spawnSync('python', ['build.py'], { cwd: REPO, encoding: 'utf8' });
  if (r.status !== 0) { console.error('BUILD FAILED\n' + r.stdout + r.stderr); process.exit(2); }
}
function page(scenarioFile, mode) {
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const scen = fs.readFileSync(scenarioFile, 'utf8');
  const pre = `<script>
window.qaErrors = [];
window.addEventListener('error', (e) => { window.qaErrors.push(String(e.message) + ' @' + e.lineno); });
const _ce = console.error; console.error = function () { window.qaErrors.push([].map.call(arguments, String).join(' ')); _ce.apply(console, arguments); };
try { localStorage.clear(); } catch (e) {}
</script>`;
  const post = `<script>
window.QA_DONE = function (v) {
  const pre = document.createElement('pre'); pre.id = 'qa-out';
  pre.textContent = JSON.stringify({ result: v, qaErrors: window.qaErrors });
  document.documentElement.appendChild(pre);
};
try {
${scen}
} catch (e) { window.qaErrors.push('SCENARIO: ' + e.message + '\\n' + e.stack); if (${mode === 'run'}) QA_DONE(null); }
</script>`;
  // errors raised before the scenario runs (boot) are caught by the pre script
  const out = pre + html + post;
  const f = path.join(QA, '_page' + TAG + '_' + process.pid + '.html');
  fs.writeFileSync(f, out);
  return 'file:///' + f.replace(/\\/g, '/');
}
const args = process.argv.slice(2);
const mode = args[0];
if (mode !== 'run' && mode !== 'shot') { console.log('usage: node qa.js run <scenario.js> [budgetMs] | shot <scenario.js> <out.png> [budgetMs] [W H]'); process.exit(1); }
build();
const url = page(args[1], mode);
const common = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
  '--user-data-dir=' + path.join(QA, 'chr' + TAG), '--autoplay-policy=no-user-gesture-required'];
if (process.env.QA_REDUCED === '1') common.push('--force-prefers-reduced-motion');
process.on('exit', () => { try { fs.unlinkSync(url.replace('file:///', '')); } catch (e) {} });
if (mode === 'run') {
  const budget = args[2] || '5000';
  const r = cp.spawnSync(CHROME, [...common, '--window-size=1280,720', '--virtual-time-budget=' + budget, '--dump-dom', url],
    { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 590000 });
  const m = /<pre id="qa-out">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
  if (!m) { console.log(JSON.stringify({ error: 'no QA_DONE output (scenario did not finish or page crashed)', stderr: (r.stderr || '').slice(-1500) })); process.exit(3); }
  const txt = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  console.log(txt);
} else {
  const outPng = path.resolve(args[2]);
  const budget = args[3] || '3000';
  const W = args[4] || '1280', H = args[5] || '720';
  const r = cp.spawnSync(CHROME, [...common, `--window-size=${W},${H}`, '--virtual-time-budget=' + budget, '--screenshot=' + outPng, url],
    { encoding: 'utf8', timeout: 300000 });
  if (!fs.existsSync(outPng)) { console.log('SCREENSHOT FAILED', (r.stderr || '').slice(-1500)); process.exit(3); }
  console.log('saved ' + outPng);
}
