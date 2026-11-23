import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client, loginAs, db, EMAIL, day, unique } from './helpers.mjs';

let guest, desk, admin, conn;
before(async () => { conn = await db(); guest = await loginAs(EMAIL.guest); desk = await loginAs(EMAIL.desk); admin = await loginAs(EMAIL.admin); });
after(async () => { await conn.end(); });

const book = (c, o) => c.post('/api/reservations', { adults: 2, children: 0, ...o });
const state = {};

test('availability lists every room type with free counts and tax-inclusive totals', async () => {
  const r = await new Client().get(`/api/rooms/availability?checkIn=${day(60)}&checkOut=${day(62)}&adults=2&children=0`);
  assert.equal(r.status, 200);
  assert.equal(r.data.nights, 2);
  assert.ok(r.data.rooms.length >= 5);
  for (const t of r.data.rooms) assert.equal(t.total, Math.round(t.base_price * 2 * 1.12), t.name);
  assert.equal((await new Client().get(`/api/rooms/availability?checkIn=${day(62)}&checkOut=${day(60)}`)).status, 422); // reversed
});

test('guest books a room: priced with tax, held as pending, confirmed by the 25% deposit', async () => {
  const r = await book(guest, { typeId: 2, checkIn: day(100), checkOut: day(102) });
  assert.equal(r.status, 201);
  const res = r.data.reservation; state.single = res;
  assert.equal(res.status, 'pending');
  assert.equal(res.total_amount, 25760);                       // 2 × ₹11,500 + 12%
  const deposit = Math.ceil(res.total_amount * 0.25);
  const low = await guest.post(`/api/reservations/${res.reservation_id}/payments`, { amount: deposit - 1000, method: 'upi' });
  assert.equal(low.data.reservation.status, 'pending');        // below 25%
  const ok = await guest.post(`/api/reservations/${res.reservation_id}/payments`, { amount: 1000, method: 'upi' });
  assert.equal(ok.data.reservation.status, 'confirmed');
  assert.equal(ok.data.reservation.balance_due, res.total_amount - deposit);
  assert.equal((await guest.post(`/api/reservations/${res.reservation_id}/payments`, { amount: 9_999_999, method: 'upi' })).status, 400); // over-payment
});

test('services can be ordered only on confirmed/in-house stays; staff work the queue; guests cannot', async () => {
  const id = state.single.reservation_id;
  const o = await guest.post(`/api/reservations/${id}/orders`, { serviceId: 1, quantity: 2 });
  assert.equal(o.status, 201);
  assert.equal(o.data.reservation.services_total, 2400);      // 2 × ₹1,200 (price frozen by trigger)
  const pending = await book(guest, { typeId: 1, checkIn: day(110), checkOut: day(111) });
  const refused = await guest.post(`/api/reservations/${pending.data.reservation.reservation_id}/orders`, { serviceId: 1, quantity: 1 });
  assert.equal(refused.status, 400); assert.match(refused.data.error, /confirmed or in-house/);
  const [[{ order_id }]] = await conn.query('SELECT MAX(order_id) AS order_id FROM service_orders');
  assert.equal((await guest.patch(`/api/orders/${order_id}`, { status: 'delivered' })).status, 403);
  assert.equal((await desk.patch(`/api/orders/${order_id}`, { status: 'confirmed' })).status, 200);
  assert.equal((await desk.patch(`/api/orders/${order_id}`, { status: 'delivered' })).status, 200);
});

test('modifying a booking re-prices it; guests cannot pick an exact room, staff can', async () => {
  const id = state.single.reservation_id;
  const m = await guest.patch(`/api/reservations/${id}`, { action: 'modify', checkIn: day(101), checkOut: day(104), typeId: 1 });
  assert.equal(m.status, 200, m.text);
  assert.equal(m.data.reservation.room_type, 'Deluxe Garden Room');
  assert.equal(m.data.reservation.total_amount, 28560);         // 3 × ₹8,500 + 12%
  assert.equal((await guest.patch(`/api/reservations/${id}`, { action: 'modify', checkIn: day(101), checkOut: day(104), roomId: 5 })).status, 403);
  const rooms = (await desk.get('/api/rooms')).data.rooms;
  const target = rooms.find((r) => r.room_type === 'Deluxe Garden Room' && r.room_number === '104');
  const s = await desk.patch(`/api/reservations/${id}`, { action: 'modify', checkIn: day(101), checkOut: day(104), roomId: target.room_id });
  assert.equal(s.status, 200, s.text); assert.equal(s.data.reservation.room_number, '104');
  assert.equal((await guest.patch(`/api/reservations/${id}`, { action: 'modify', checkIn: day(-3), checkOut: day(1) })).status, 400); // in the past
});

test('cancelling far ahead refunds what was paid; cancelling twice is refused', async () => {
  const id = state.single.reservation_id;
  const c = await guest.patch(`/api/reservations/${id}`, { action: 'cancel' });
  assert.equal(c.status, 200); assert.match(c.data.message, /refunded/);
  assert.equal(c.data.reservation.status, 'cancelled');
  assert.equal((await guest.patch(`/api/reservations/${id}`, { action: 'cancel' })).status, 400);
  assert.equal((await guest.patch(`/api/reservations/${id}`, { action: 'check_in' })).status, 403); // guests cannot run staff actions
});

test('multi-room booking is atomic: 3 rooms share one group code; over-asking creates nothing', async () => {
  const r = await book(guest, { typeId: 5, checkIn: day(150), checkOut: day(152), rooms: 3 });   // Skyline Family Suite: 4 rooms
  assert.equal(r.status, 201);
  assert.equal(r.data.reservations.length, 3);
  assert.equal(new Set(r.data.reservations.map((x) => x.group_code)).size, 1);
  assert.equal(new Set(r.data.reservations.map((x) => x.room_number)).size, 3);
  const over = await book(guest, { typeId: 5, checkIn: day(150), checkOut: day(152), rooms: 2 }); // only 1 left
  assert.equal(over.status, 400); assert.match(over.data.error, /Not enough rooms/);
  const [[{ n }]] = await conn.query("SELECT COUNT(*) n FROM reservations WHERE check_in = CURDATE() + INTERVAL 150 DAY AND status = 'pending'");
  assert.equal(n, 3);                                                                              // nothing half-booked
  assert.equal((await book(guest, { typeId: 5, checkIn: day(160), checkOut: day(161), rooms: 9 })).status, 400); // above the allowed maximum
});

test('the last room is never sold twice, even to simultaneous requests', async () => {
  const [a, b] = await Promise.all([loginAs(EMAIL.guest), loginAs(EMAIL.desk)]);
  await book(a, { typeId: 6, checkIn: day(200), checkOut: day(202) });                // Presidential: 2 rooms, one now taken
  const results = await Promise.all([book(a, { typeId: 6, checkIn: day(200), checkOut: day(202) }), book(b, { typeId: 6, checkIn: day(200), checkOut: day(202), guestId: 2 })]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
});

test('invoices are PDFs, only for the owner or staff', async () => {
  const id = state.single.reservation_id;
  const r = await guest.get(`/api/reservations/${id}/invoice`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.ok(r.text.startsWith('%PDF-'));
  assert.equal((await new Client().get(`/api/reservations/${id}/invoice`)).status, 401);
  const stranger = new Client();
  await stranger.post('/api/auth/register', { fullName: 'Some Stranger', email: `${unique('stranger')}@example.com`, password: 'Secret123' });
  assert.equal((await stranger.get(`/api/reservations/${id}/invoice`)).status, 404);
  assert.equal((await desk.get(`/api/reservations/${id}/invoice`)).status, 200);
});

test('staff list: pagination metadata, status filter and search by code', async () => {
  const p = await desk.get('/api/reservations?limit=5&page=2');
  assert.equal(p.status, 200);
  assert.equal(p.data.page, 2); assert.equal(p.data.reservations.length, 5);
  assert.equal(p.data.pages, Math.ceil(p.data.total / 5));
  const conf = await desk.get('/api/reservations?status=confirmed&limit=50');
  assert.ok(conf.data.reservations.every((r) => r.status === 'confirmed'));
  const code = state.single.reservation_code;
  const q = await desk.get(`/api/reservations?q=${code}`);
  assert.deepEqual(q.data.reservations.map((r) => r.reservation_code), [code]);
});

test('CSV exports: correct type, Excel-friendly BOM, header row, and per-permission access', async () => {
  const r = await desk.get('/api/export/reservations?status=confirmed');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.ok(r.text.startsWith('﻿'));
  assert.match(r.text.split('\n')[0], /reservation_code,status,source,guest_name/);
  assert.equal((await admin.get('/api/export/audit')).status, 200);
  assert.equal((await desk.get('/api/export/audit')).status, 403);
});

test('front-desk lifecycle: check-in → balance blocks check-out → pay → check-out → room cleaning → housekeeping frees it', async () => {
  const arr = (await desk.get('/api/reservations?view=arrivals')).data.reservations.find((r) => r.status === 'confirmed');
  assert.ok(arr, 'seed data should contain an arrival today');
  const ci = await desk.patch(`/api/reservations/${arr.reservation_id}`, { action: 'check_in' });
  assert.equal(ci.status, 200, ci.text);
  const early = await desk.patch(`/api/reservations/${arr.reservation_id}`, { action: 'check_out' });
  assert.equal(early.status, 400); assert.match(early.data.error, /balance must be settled/);
  const bal = (await desk.get(`/api/reservations/${arr.reservation_id}`)).data.reservation.balance_due;
  assert.equal((await desk.post(`/api/reservations/${arr.reservation_id}/payments`, { amount: bal, method: 'cash' })).status, 200);
  assert.equal((await desk.patch(`/api/reservations/${arr.reservation_id}`, { action: 'check_out' })).status, 200);
  const room = (await desk.get('/api/rooms')).data.rooms.find((r) => r.room_number === arr.room_number);
  assert.equal(room.status, 'cleaning');
  const task = (await desk.get('/api/housekeeping')).data.tasks.find((t) => t.room_number === arr.room_number && t.status === 'pending');
  assert.ok(task, 'checkout should create a housekeeping task');
  assert.equal((await desk.patch(`/api/housekeeping/${task.task_id}`, { status: 'done' })).status, 200);
  assert.equal((await desk.get('/api/rooms')).data.rooms.find((r) => r.room_number === arr.room_number).status, 'available');
});
