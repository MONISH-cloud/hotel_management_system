import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connect, day, typeId, failure, book, setSetting } from './helpers.mjs';

let c;
before(async () => { c = await connect(); });
after(async () => { await c.end(); });

const balance = async (id) => (await c.query('SELECT fn_reservation_balance(?) b', [id]))[0][0].b;
const status = async (id) => (await c.query('SELECT status FROM reservations WHERE reservation_id = ?', [id]))[0][0].status;
const pay = (id, amount, method = 'upi') => c.query("CALL sp_record_payment(?,?,?,@r)", [id, amount, method]);

test('prices a stay using the configured tax rate', async () => {
  const t = await typeId(c, 'deluxe-garden');
  const { id } = await book(c, { type: t, inDays: 300, outDays: 303 });
  const [[r]] = await c.query('SELECT nightly_rate, tax_amount, total_amount FROM reservations WHERE reservation_id = ?', [id]);
  assert.equal(r.nightly_rate, 8500);
  assert.equal(r.tax_amount, 3060);           // 3 nights x 8,500 x 12%
  assert.equal(r.total_amount, 28560);
  await setSetting(c, 'tax_rate_pct', 18);
  const b = await book(c, { type: t, inDays: 310, outDays: 312 });
  const [[r2]] = await c.query('SELECT total_amount FROM reservations WHERE reservation_id = ?', [b.id]);
  assert.equal(r2.total_amount, 20060);       // 2 x 8,500 x 1.18
  await setSetting(c, 'tax_rate_pct', 12);
});

test('rejects invalid dates and over-long stays', async () => {
  const t = await typeId(c, 'deluxe-garden');
  assert.match(await failure(book(c, { type: t, inDays: 5, outDays: 5 })), /Check-out must be after check-in/);
  assert.match(await failure(book(c, { type: t, inDays: -2, outDays: 2 })), /past/);
  assert.match(await failure(book(c, { type: t, inDays: 320, outDays: 400 })), /longer than the maximum/);
});

test('enforces room capacity (trigger)', async () => {
  const t = await typeId(c, 'deluxe-garden');                       // sleeps 2 adults + 1 child
  assert.match(await failure(book(c, { type: t, inDays: 330, outDays: 332, adults: 5 })), /capacity/);
});

test('never double-books: the last room is given to exactly one of two concurrent requests', async () => {
  const t = await typeId(c, 'royal-presidential-suite');            // only 2 rooms
  const c2 = await connect(), c3 = await connect();
  await book(c, { type: t, inDays: 400, outDays: 402 });            // one of the two is taken
  const results = await Promise.allSettled([book(c2, { type: t, inDays: 400, outDays: 402 }), book(c3, { type: t, inDays: 400, outDays: 402 })]);
  await c2.end(); await c3.end();
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const [[n]] = await c.query("SELECT COUNT(DISTINCT room_id) n, COUNT(*) total FROM reservations WHERE check_in = CURDATE() + INTERVAL 400 DAY AND status='pending'");
  assert.equal(n.n, 2); assert.equal(n.total, 2);                  // two different rooms, none shared
});

test('a deposit confirms the booking; the deposit percentage is configurable', async () => {
  const t = await typeId(c, 'premier-terrace');
  const a = await book(c, { type: t, inDays: 420, outDays: 422 });
  const [[{ total_amount: total }]] = await c.query('SELECT total_amount FROM reservations WHERE reservation_id = ?', [a.id]);
  await pay(a.id, Math.floor(total * 0.2));
  assert.equal(await status(a.id), 'pending');                      // 20% < 25%
  await pay(a.id, Math.ceil(total * 0.05));
  assert.equal(await status(a.id), 'confirmed');                    // reaches 25%
  await setSetting(c, 'deposit_pct', 50);
  const b = await book(c, { type: t, inDays: 430, outDays: 432 });
  const [[{ total_amount: tb }]] = await c.query('SELECT total_amount FROM reservations WHERE reservation_id = ?', [b.id]);
  await pay(b.id, Math.ceil(tb * 0.3));
  assert.equal(await status(b.id), 'pending');                      // 30% < 50%
  await setSetting(c, 'deposit_pct', 25);
});

test('refuses payments that exceed the balance', async () => {
  const t = await typeId(c, 'deluxe-garden');
  const a = await book(c, { type: t, inDays: 440, outDays: 441 });
  assert.match(await failure(pay(a.id, 9_999_999)), /exceeds the outstanding balance/);
  assert.match(await failure(pay(a.id, 0)), /positive/);
});

test('full stay lifecycle: check-in rules, balance before check-out, room + housekeeping + loyalty', async () => {
  const t = await typeId(c, 'deluxe-garden');
  const { id } = await book(c, { guest: 2, type: t, inDays: 0, outDays: 2 });
  const [[{ room_id: room }]] = await c.query('SELECT room_id FROM reservations WHERE reservation_id = ?', [id]);
  const [[{ total_amount: total }]] = await c.query('SELECT total_amount FROM reservations WHERE reservation_id = ?', [id]);
  const [[before]] = await c.query('SELECT loyalty_points p FROM guests WHERE guest_id = 2');

  const future = await book(c, { type: t, inDays: 500, outDays: 501 });
  assert.match(await failure(c.query('CALL sp_check_in(?)', [future.id])), /Too early/);

  await c.query('CALL sp_check_in(?)', [id]);
  assert.equal(await status(id), 'checked_in');
  assert.equal((await c.query('SELECT status FROM rooms WHERE room_id = ?', [room]))[0][0].status, 'occupied');

  assert.match(await failure(c.query('CALL sp_check_out(?)', [id])), /balance must be settled/);
  await pay(id, total);
  await c.query('CALL sp_check_out(?)', [id]);
  assert.equal(await status(id), 'checked_out');
  assert.equal((await c.query('SELECT status FROM rooms WHERE room_id = ?', [room]))[0][0].status, 'cleaning');
  const [[hk]] = await c.query("SELECT COUNT(*) n FROM housekeeping_tasks WHERE room_id = ? AND status = 'pending' AND task_type = 'checkout_clean'", [room]);
  assert.equal(hk.n, 1);
  const [[after]] = await c.query('SELECT loyalty_points p FROM guests WHERE guest_id = 2');
  assert.equal(after.p - before.p, Math.floor(total / 100));         // 1 point per Rs.100

  // finishing the clean returns the room to inventory (trigger)
  await c.query("UPDATE housekeeping_tasks SET status = 'done', completed_at = NOW() WHERE room_id = ? AND status = 'pending'", [room]);
  assert.equal((await c.query('SELECT status FROM rooms WHERE room_id = ?', [room]))[0][0].status, 'available');
  assert.match(await failure(c.query("UPDATE reservations SET status = 'pending' WHERE reservation_id = ?", [id])), /finalised/);
});

test('cancellation refunds in full outside the window, nothing inside it', async () => {
  const t = await typeId(c, 'deluxe-garden');
  const far = await book(c, { type: t, inDays: 450, outDays: 452 });
  await pay(far.id, 5000);
  await c.query('CALL sp_cancel_reservation(?,@rf)', [far.id]);
  assert.equal((await c.query('SELECT @rf r'))[0][0].r, 5000);
  assert.equal(await status(far.id), 'cancelled');

  const near = await book(c, { type: t, inDays: 1, outDays: 3 });    // arrives tomorrow (< 48h)
  await pay(near.id, 5000);
  await c.query('CALL sp_cancel_reservation(?,@rf)', [near.id]);
  assert.equal((await c.query('SELECT @rf r'))[0][0].r, 0);
  assert.match(await failure(c.query('CALL sp_cancel_reservation(?,@rf)', [near.id])), /Only pending or confirmed/);
});

test('multi-room booking is atomic and shares a group code', async () => {
  const t = await typeId(c, 'skyline-family-suite');                 // 4 rooms
  const g = await book(c, { type: t, inDays: 600, outDays: 602, rooms: 3 });
  assert.match(g.group, /^GR[0-9A-F]{8}$/);
  const [rows] = await c.query('SELECT DISTINCT room_id FROM reservations WHERE group_code = ?', [g.group]);
  assert.equal(rows.length, 3);
  // asking for more rooms than remain must create nothing (the one free room is not half-booked)
  const msg = await failure(book(c, { type: t, inDays: 600, outDays: 602, rooms: 2 }));
  assert.match(msg, /Not enough rooms/);
  const [[left]] = await c.query("SELECT COUNT(*) n FROM reservations WHERE check_in = CURDATE() + INTERVAL 600 DAY AND status = 'pending'");
  assert.equal(left.n, 3);
  assert.match(await failure(book(c, { type: t, inDays: 610, outDays: 611, rooms: 9 })), /outside the allowed range/);
});

test('modifying a booking re-prices it, keeps availability honest and refunds overpayment', async () => {
  const deluxe = await typeId(c, 'deluxe-garden'), presidential = await typeId(c, 'royal-presidential-suite');
  const a = await book(c, { type: presidential, inDays: 700, outDays: 703 });
  const [[{ total_amount: bigTotal }]] = await c.query('SELECT total_amount FROM reservations WHERE reservation_id = ?', [a.id]);
  await pay(a.id, Math.ceil(bigTotal * 0.5));
  const paid = Math.ceil(bigTotal * 0.5);

  const [in2, out2] = [await day(c, 700), await day(c, 702)];
  await c.query('CALL sp_modify_reservation(?,?,?,?,NULL,@t,@r)', [a.id, in2, out2, deluxe]);
  const [[o]] = await c.query('SELECT @t t, @r r');
  assert.equal(o.t, 19040);                                          // 2 nights x 8,500 x 1.12
  assert.equal(o.r, paid - 19040);                                    // paid more than the new total => refund the excess
  assert.equal(await balance(a.id), 0);

  // cannot modify into a room that is taken, nor once checked in / cancelled
  const full = await typeId(c, 'royal-presidential-suite');
  await book(c, { type: full, inDays: 710, outDays: 712 }); await book(c, { type: full, inDays: 710, outDays: 712 });
  assert.match(await failure(c.query('CALL sp_modify_reservation(?,?,?,?,NULL,@t,@r)', [a.id, await day(c, 710), await day(c, 712), full])), /No matching room is available/);
  await c.query('CALL sp_cancel_reservation(?,@rf)', [a.id]);
  assert.match(await failure(c.query('CALL sp_modify_reservation(?,?,?,NULL,NULL,@t,@r)', [a.id, in2, out2])), /Only pending or confirmed/);
});

test('RBAC lives in the database: permissions per role', async () => {
  const has = async (user, code) => (await c.query('SELECT fn_has_permission(?,?) ok', [user, code]))[0][0].ok === 1;
  assert.equal(await has(1, 'staff.manage'), true);                 // admin
  assert.equal(await has(1, 'settings.manage'), true);
  assert.equal(await has(2, 'reports.view'), true);                 // manager
  assert.equal(await has(2, 'staff.manage'), false);
  assert.equal(await has(3, 'reservations.manage'), true);          // receptionist
  assert.equal(await has(3, 'reports.view'), false);
  assert.equal(await has(4, 'booking.own'), true);                  // guest
  assert.equal(await has(4, 'reservations.view_all'), false);
  await c.query('UPDATE users SET is_active = FALSE WHERE user_id = 4');
  assert.equal(await has(4, 'booking.own'), false);                 // deactivated accounts lose everything
  await c.query('UPDATE users SET is_active = TRUE WHERE user_id = 4');
});

test('constraints protect the data', async () => {
  assert.match(await failure(c.query("UPDATE room_types SET base_price = 0 WHERE type_id = 1")), /check constraint|chk_rt_price/i);
  assert.match(await failure(c.query("INSERT INTO users (role_id,email,password_hash,full_name) VALUES (1,'admin@maisonaurelia.com','x','Dup')")), /Duplicate entry/);
  const [[{ room_id }]] = await c.query('SELECT room_id FROM reservations LIMIT 1');
  assert.match(await failure(c.query('DELETE FROM rooms WHERE room_id = ?', [room_id])), /foreign key/i);
  assert.match(await failure(c.query('UPDATE employees SET manager_id = employee_id WHERE employee_id = 2')), /own manager/);
});

test('triggers write an audit trail', async () => {
  const [[before]] = await c.query("SELECT COUNT(*) n FROM audit_log WHERE action = 'reservation.created'");
  await c.query('SET @app_user_id = 3');
  await book(c, { type: await typeId(c, 'deluxe-garden'), inDays: 800, outDays: 801, by: 3 });
  const [[after]] = await c.query("SELECT COUNT(*) n FROM audit_log WHERE action = 'reservation.created'");
  assert.equal(after.n, before.n + 1);
  const [[last]] = await c.query("SELECT actor_user_id FROM audit_log WHERE action = 'reservation.created' ORDER BY log_id DESC LIMIT 1");
  assert.equal(last.actor_user_id, 3);
});

test('all 16 analytical reports execute', async () => {
  const fs = await import('node:fs');
  const blocks = fs.readFileSync('db/mysql/04_queries.sql', 'utf8').split(/^-- @report /m).slice(1);
  assert.equal(blocks.length, 16);
  for (const b of blocks) {
    const sql = b.slice(b.indexOf('\n') + 1).trim().replace(/;\s*$/, '');
    const [rows] = await c.query(sql);
    assert.ok(Array.isArray(rows), b.slice(0, 30));
  }
});

test('ALTER TABLE changes are in place: booking channel is set by trigger, name constraints enforced, indexes exist', async () => {
  const t = await typeId(c, 'deluxe-garden');
  const online = await book(c, { type: t, inDays: 900, outDays: 901, by: 4 });      // guest account
  const desk = await book(c, { type: t, inDays: 902, outDays: 903, by: 3 });        // receptionist
  const src = async (id) => (await c.query('SELECT source FROM reservations WHERE reservation_id = ?', [id]))[0][0].source;
  assert.equal(await src(online.id), 'online');
  assert.equal(await src(desk.id), 'front_desk');
  assert.match(await failure(c.query("UPDATE guests SET full_name = ' ' WHERE guest_id = 1")), /check constraint|chk_guests_name/i);
  const [idx] = await c.query("SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name IN ('idx_audit_action','idx_pay_paid_at')");
  assert.equal(new Set(idx.map((r) => r.INDEX_NAME ?? r.index_name)).size, 2);
  const [[col]] = await c.query("SELECT character_maximum_length AS len FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'room_types' AND column_name = 'view_type'");
  assert.equal(col.len, 60);
});
