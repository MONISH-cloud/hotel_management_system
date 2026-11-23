import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client, loginAs, db, EMAIL } from './helpers.mjs';

const who = {};
let conn;
before(async () => {
  conn = await db();
  who.anon = new Client();
  for (const [k, e] of Object.entries(EMAIL)) who[k] = await loginAs(e);
});
after(async () => { await conn.end(); });

// [role, method, path, body, expected HTTP status]
const MATRIX = [
  // not signed in
  ['anon', 'GET', '/api/reservations', undefined, 401], ['anon', 'GET', '/api/staff', undefined, 401], ['anon', 'POST', '/api/reservations', {}, 401], ['anon', 'GET', '/api/dashboard', undefined, 401],
  // guest: own stays only, nothing administrative
  ['guest', 'GET', '/api/reservations', undefined, 200], ['guest', 'GET', '/api/staff', undefined, 403], ['guest', 'GET', '/api/audit', undefined, 403], ['guest', 'GET', '/api/dashboard', undefined, 403],
  ['guest', 'GET', '/api/guests', undefined, 403], ['guest', 'GET', '/api/reports/r01', undefined, 403], ['guest', 'GET', '/api/settings', undefined, 403], ['guest', 'GET', '/api/rooms', undefined, 403],
  ['guest', 'GET', '/api/export/reservations', undefined, 403], ['guest', 'POST', '/api/room-types', {}, 403], ['guest', 'POST', '/api/users', {}, 403], ['guest', 'GET', '/api/housekeeping', undefined, 403],
  // receptionist: front desk only
  ['desk', 'GET', '/api/reservations', undefined, 200], ['desk', 'GET', '/api/guests', undefined, 200], ['desk', 'GET', '/api/rooms', undefined, 200], ['desk', 'GET', '/api/dashboard', undefined, 200],
  ['desk', 'GET', '/api/housekeeping', undefined, 200], ['desk', 'GET', '/api/export/reservations', undefined, 200],
  ['desk', 'GET', '/api/reports/r01', undefined, 403], ['desk', 'GET', '/api/staff', undefined, 403], ['desk', 'GET', '/api/audit', undefined, 403], ['desk', 'GET', '/api/settings', undefined, 403],
  ['desk', 'POST', '/api/room-types', {}, 403], ['desk', 'POST', '/api/services', {}, 403], ['desk', 'POST', '/api/users', {}, 403],
  // manager: operations, reports, inventory; not administration
  ['manager', 'GET', '/api/reports/r01', undefined, 200], ['manager', 'GET', '/api/room-types', undefined, 200], ['manager', 'GET', '/api/guests', undefined, 200],
  ['manager', 'GET', '/api/staff', undefined, 403], ['manager', 'GET', '/api/audit', undefined, 403], ['manager', 'GET', '/api/settings', undefined, 403], ['manager', 'POST', '/api/users', {}, 403],
  // admin: everything
  ['admin', 'GET', '/api/staff', undefined, 200], ['admin', 'GET', '/api/audit', undefined, 200], ['admin', 'GET', '/api/settings', undefined, 200], ['admin', 'GET', '/api/reports/r01', undefined, 200],
  ['admin', 'GET', '/api/export/audit', undefined, 200], ['admin', 'GET', '/api/export/guests', undefined, 200],
  // public
  ['anon', 'GET', '/api/services', undefined, 200], ['anon', 'GET', '/api/reviews', undefined, 200], ['anon', 'GET', '/api/health', undefined, 200],
];

for (const [role, method, path, body, expected] of MATRIX) {
  test(`${role.padEnd(7)} ${method.padEnd(5)} ${path} → ${expected}`, async () => {
    const r = await who[role].req(method, path, body === undefined ? {} : { json: body });
    assert.equal(r.status, expected, r.text.slice(0, 200));
  });
}

test('a guest only ever sees their own reservations and cannot open anyone else’s', async () => {
  const mine = await who.guest.get('/api/reservations?limit=200');
  assert.ok(mine.data.reservations.length > 0);
  assert.deepEqual([...new Set(mine.data.reservations.map((r) => r.guest_email))], [EMAIL.guest]);
  const [[other]] = await conn.query('SELECT reservation_id FROM reservations WHERE guest_id <> 1 LIMIT 1');
  assert.equal((await who.guest.get(`/api/reservations/${other.reservation_id}`)).status, 404);
  assert.equal((await who.guest.get(`/api/reservations/${other.reservation_id}/invoice`)).status, 404);
  assert.equal((await who.guest.patch(`/api/reservations/${other.reservation_id}`, { action: 'cancel' })).status, 404);
  assert.equal((await who.desk.get(`/api/reservations/${other.reservation_id}`)).status, 200); // staff can
});
