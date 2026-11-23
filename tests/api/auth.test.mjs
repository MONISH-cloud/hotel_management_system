import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client, loginAs, db, emailedToken, EMAIL, PASSWORD, unique } from './helpers.mjs';

let conn;
before(async () => { conn = await db(); });
after(async () => { await conn.end(); });

test('health: MySQL and Redis are up (graph is intentionally off in the isolated run)', async () => {
  const r = await new Client().get('/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual([r.data.status, r.data.mysql, r.data.redis, r.data.neo4j], ['ok', true, true, false]);
});

test('every demo role can sign in and is sent to the right area', async () => {
  for (const [role, email] of Object.entries(EMAIL)) {
    const c = new Client();
    const r = await c.post('/api/auth/login', { email, password: PASSWORD });
    assert.equal(r.status, 200, role);
    assert.equal(r.data.redirect, role === 'guest' ? '/account' : '/dashboard', role);
    const me = await c.get('/api/auth/me');
    assert.equal(me.data.user.email, email);
    assert.ok(me.data.permissions.length > 0);
  }
});

test('wrong password and unknown email give the same generic 401 (no account enumeration)', async () => {
  const a = await new Client().post('/api/auth/login', { email: EMAIL.guest, password: 'definitely-wrong' });
  const b = await new Client().post('/api/auth/login', { email: `nobody-${unique('x')}@example.com`, password: 'whatever1' });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.equal(a.data.error, b.data.error);
});

test('login is rate-limited after 8 failed attempts', async () => {
  const email = `${unique('ratelimit')}@example.com`;
  const codes = [];
  for (let i = 0; i < 9; i++) codes.push((await new Client().post('/api/auth/login', { email, password: 'bad-password' })).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 401, 401, 401, 429]);
});

test('anonymous /me is empty; logout revokes the session even for a copied cookie', async () => {
  assert.deepEqual((await new Client().get('/api/auth/me')).data, { user: null });
  const a = await loginAs(EMAIL.guest);
  const stolen = new Client(); stolen.cookie = a.cookie;
  assert.ok((await stolen.get('/api/auth/me')).data.user);
  await a.post('/api/auth/logout');
  assert.equal((await stolen.get('/api/auth/me')).data.user, null);
});

test('register → verification email → verify (single use) → forgot → reset (single use) revokes old sessions', async () => {
  const email = `${unique('newguest')}@example.com`;
  const c = new Client();
  const reg = await c.post('/api/auth/register', { fullName: 'Test Person', email, password: 'Secret123', phone: '', country: 'India' });
  assert.equal(reg.status, 200);
  assert.equal((await c.get('/api/auth/me')).data.user.emailVerified, false);
  assert.equal((await new Client().post('/api/auth/register', { fullName: 'Dup', email, password: 'Secret123' })).status, 409);

  const vtoken = await emailedToken(conn, email, 'Confirm your email');
  assert.equal((await new Client().post('/api/auth/verify', { token: 'f'.repeat(64) })).status, 400);
  assert.equal((await new Client().post('/api/auth/verify', { token: vtoken })).status, 200);
  assert.equal((await new Client().post('/api/auth/verify', { token: vtoken })).status, 400); // single use
  assert.equal((await c.get('/api/auth/me')).data.user.emailVerified, true);

  const known = await new Client().post('/api/auth/forgot', { email });
  const unknown = await new Client().post('/api/auth/forgot', { email: `${unique('ghost')}@example.com` });
  assert.equal(known.status, 200); assert.deepEqual(known.data, unknown.data); // identical answer
  const rtoken = await emailedToken(conn, email, 'Reset your password');
  assert.equal((await new Client().post('/api/auth/reset', { token: rtoken, password: 'abc' })).status, 422); // weak
  assert.equal((await new Client().post('/api/auth/reset', { token: rtoken, password: 'BrandNew456' })).status, 200);
  assert.equal((await c.get('/api/auth/me')).data.user, null);                                                 // old session revoked
  assert.equal((await new Client().post('/api/auth/login', { email, password: 'Secret123' })).status, 401);   // old password dead
  assert.equal((await new Client().post('/api/auth/login', { email, password: 'BrandNew456' })).status, 200);
  assert.equal((await new Client().post('/api/auth/reset', { token: rtoken, password: 'Another789' })).status, 400); // single use
});

test('admin changing a role or disabling an account ends that user’s session immediately', async () => {
  const admin = await loginAs(EMAIL.admin);
  const email = `${unique('victim')}@example.com`;
  const v = new Client();
  await v.post('/api/auth/register', { fullName: 'Victim User', email, password: 'Secret123' });
  const [[{ user_id }]] = await conn.query('SELECT user_id FROM users WHERE email = ?', [email]);

  assert.equal((await v.get('/api/auth/me')).data.user.role, 'guest');
  assert.equal((await admin.patch(`/api/users/${user_id}`, { role: 'receptionist' })).status, 200);
  assert.equal((await v.get('/api/auth/me')).data.user, null);

  assert.equal((await admin.patch(`/api/users/${user_id}`, { isActive: false })).status, 200);
  const blocked = await new Client().post('/api/auth/login', { email, password: 'Secret123' });
  assert.equal(blocked.status, 403);
  const own = await admin.patch("/api/users/1", { role: 'guest' });
  assert.equal(own.status, 400); // admins cannot demote themselves
});
