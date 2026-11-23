// Minimal headless-Chrome driver over the DevTools protocol (same approach as scripts/take-screenshots.mjs).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BASE = process.env.APP_URL ?? 'http://localhost:3000';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const port = 9100 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-walk-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--force-color-profile=srgb', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await wait(250); } }
  if (!tabs) throw new Error('Chrome did not start');
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? { error: m.error }); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result?.value;
  };
  const close = () => { try { ws.close(); chrome.kill(); } catch { /* gone */ } try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* later */ } };
  return { send, evaluate, close };
}

const tokens = {};
export async function login(email) {
  if (tokens[email]) return tokens[email];
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD ?? 'Password@123' }) });
  const m = /ma_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '');
  if (!m) throw new Error(`Login failed for ${email}: ${await res.text()}`);
  return (tokens[email] = m[1]);
}

export async function signInAs(b, who) {
  await b.send('Network.enable');
  await b.send('Network.clearBrowserCookies');
  if (who) await b.send('Network.setCookie', { name: 'ma_session', value: await login(who), domain: new URL(BASE).hostname, path: '/' });
}
