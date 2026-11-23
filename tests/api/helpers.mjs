import zlib from 'node:zlib';
import mysql from 'mysql2/promise';
import { loadEnv } from '../../scripts/env.mjs';

loadEnv();
export const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3100';
export const PASSWORD = 'Password@123'; // demo password of the seeded accounts
export const EMAIL = { admin: 'admin@maisonaurelia.com', manager: 'manager@maisonaurelia.com', desk: 'frontdesk@maisonaurelia.com', guest: 'guest@maisonaurelia.com' };

/** A tiny cookie-aware HTTP client: one instance = one browser session. */
export class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, { json, body, headers } = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    let payload = body;
    if (json !== undefined) { h['content-type'] = 'application/json'; payload = JSON.stringify(json); }
    const res = await fetch(BASE + path, { method, headers: h, body: payload, redirect: 'manual' });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      if (pair.slice(0, i) === 'ma_session') this.cookie = pair.slice(i + 1) ? pair : '';
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString('utf8'); // (res.text() would silently drop a UTF-8 BOM; Buffer keeps it)
    let data = null; try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, data, text, bytes, headers: res.headers };
  }
  get(p, o) { return this.req('GET', p, o); }
  post(p, json, o) { return this.req('POST', p, { json, ...o }); }
  patch(p, json, o) { return this.req('PATCH', p, { json, ...o }); }
  del(p, o) { return this.req('DELETE', p, o); }
}

export async function loginAs(email, password = PASSWORD) {
  const c = new Client();
  const r = await c.post('/api/auth/login', { email, password });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${r.text}`);
  c.me = r.data;
  return c;
}

/** Direct (root) access to the test database, for things the API deliberately hides (e.g. emailed tokens). */
export async function db() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_ROOT_USER ?? 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? '',
    database: 'maison_aurelia_test', dateStrings: true, decimalNumbers: true,
  });
}

/** Latest emailed link token for an address (the app records mail in email_outbox when SMTP is not configured). */
export async function emailedToken(conn, to, subjectStart) {
  const [rows] = await conn.query('SELECT body FROM email_outbox WHERE to_address = ? AND subject LIKE ? ORDER BY email_id DESC LIMIT 1', [to, `${subjectStart}%`]);
  const m = /token=([0-9a-f]{64})/.exec(rows[0]?.body ?? '');
  if (!m) throw new Error(`no ${subjectStart} email with a token for ${to}`);
  return m[1];
}

export const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const unique = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A valid 1x1 PNG, built in memory. */
export function tinyPng() {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 176, 141, 79]))), chunk('IEND', Buffer.alloc(0))]);
}
export function uploadForm(bytes, name = 'photo.png', type = 'image/png') {
  const fd = new FormData(); fd.append('file', new Blob([bytes], { type }), name); return fd;
}
