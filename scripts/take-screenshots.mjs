// Captures the application screenshots used in docs/SCREENSHOTS.md using headless Chrome (DevTools protocol).
// Prerequisites: app running on http://localhost:3000, databases seeded, Google Chrome installed.
// Usage: npm run docs:screenshots
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from './env.mjs';

loadEnv();
const BASE = process.env.APP_URL ?? 'http://localhost:3000';
const OUT = 'docs/screenshots';
const CHROME = process.env.CHROME_PATH ?? ({
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux: '/usr/bin/google-chrome',
})[process.platform];
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password@123';
const VERBOSE = process.env.SHOTS_VERBOSE === '1';
const log = (...a) => VERBOSE && console.log('·', ...a);

// name | path | who (null = signed out) | WxH | optional text of a button to click first | optional full-page height cap
const SHOTS = [
  ['01-home', '/', null, '1440x900'],
  ['02-rooms', '/rooms', null, '1440x1500'],
  ['03-room-detail', '/rooms/royal-presidential-suite', null, '1440x1400'],
  ['04-login', '/login', null, '1440x900'],
  ['05-guest-account', '/account', 'guest@maisonaurelia.com', '1440x1500'],
  ['06-modify-booking', '/account', 'guest@maisonaurelia.com', '1440x1000', 'Change dates'],
  ['07-dashboard', '/dashboard', 'admin@maisonaurelia.com', '1440x2100'],
  ['08-reservations', '/dashboard/reservations', 'frontdesk@maisonaurelia.com', '1440x1500'],
  ['09-new-reservation', '/dashboard/reservations', 'frontdesk@maisonaurelia.com', '1440x1100', 'New reservation'],
  ['10-inventory', '/dashboard/inventory', 'manager@maisonaurelia.com', '1440x1300'],
  ['11-sql-reports', '/dashboard/reports', 'manager@maisonaurelia.com', '1440x1300'],
  ['12-staff-access', '/dashboard/staff', 'admin@maisonaurelia.com', '1440x1000'],
  ['13-settings', '/dashboard/settings', 'admin@maisonaurelia.com', '1440x1400'],
  ['14-activity-audit', '/dashboard/activity', 'admin@maisonaurelia.com', '1440x1500'],
  ['15-mobile-home', '/', null, '390x844'],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv.slice(2);
const todo = SHOTS.filter(([n]) => !only.length || only.some((o) => n.includes(o)));

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const m = /ma_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '');
  if (!m) throw new Error(`Login failed for ${email}: ${await res.text()}`);
  return m[1];
}

const port = 9500 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-shots-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const cleanup = () => {
  try { chrome.kill(); } catch { /* already gone */ }
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Chrome may still be flushing; the OS temp folder is cleaned later */ }
};
process.on('exit', cleanup);
const watchdog = setTimeout(() => { console.error('Timed out'); cleanup(); process.exit(2); }, 240000);

let tabs;
for (let i = 0; i < 40; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await wait(250); } }
if (!tabs) { console.error('Could not reach Chrome'); cleanup(); process.exit(1); }
log('chrome up on', port);
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m.error); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const tokens = {};
let current = 'unset';
fs.mkdirSync(OUT, { recursive: true });
for (const [name, route, who, size, click] of todo) {
  const [w, h] = size.split('x').map(Number);
  if (who !== current) {
    await send('Network.clearBrowserCookies');
    if (who) { tokens[who] ??= await login(who); await send('Network.setCookie', { name: 'ma_session', value: tokens[who], domain: new URL(BASE).hostname, path: '/' }); }
    current = who;
  }
  log(name);
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await send('Page.navigate', { url: BASE + route });
  await wait(4500);
  if (click) {
    await send('Runtime.evaluate', { expression: `(() => { const b = [...document.querySelectorAll('button,a')].find((x) => x.textContent.trim().includes(${JSON.stringify(click)})); if (b) { b.click(); return 'clicked'; } return 'not found'; })()` });
    await wait(2500);
  } else if (h > 1200) {
    // full-page capture: grow the viewport to the content height (capped)
    const m = await send('Page.getLayoutMetrics');
    const full = Math.min(Math.ceil(m.cssContentSize.height), h);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: full, deviceScaleFactor: 1, mobile: false });
    await wait(900);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
  console.log('saved', `${OUT}/${name}.png`);
}
clearTimeout(watchdog);
ws.close();
cleanup();
process.exit(0);
