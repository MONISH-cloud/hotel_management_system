import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client, loginAs, db, EMAIL, day, unique, tinyPng, uploadForm } from './helpers.mjs';

let admin, manager, desk, guest, conn;
before(async () => { conn = await db(); [admin, manager, desk, guest] = await Promise.all([loginAs(EMAIL.admin), loginAs(EMAIL.manager), loginAs(EMAIL.desk), loginAs(EMAIL.guest)]); });
after(async () => { await conn.end(); });

test('settings: validated by type, and a change reaches pricing in the very next request', async () => {
  const rows = (await admin.get('/api/settings')).data.settings;
  assert.ok(rows.find((r) => r.setting_key === 'tax_rate_pct'));
  assert.equal((await admin.patch('/api/settings', { values: { tax_rate_pct: 'abc' } })).status, 422);
  assert.equal((await admin.patch('/api/settings', { values: { deposit_pct: '150' } })).status, 422);   // a percentage cannot exceed 100
  assert.equal((await admin.patch('/api/settings', { values: { nope_not_a_key: '1' } })).status, 400);
  try {
    assert.equal((await admin.patch('/api/settings', { values: { tax_rate_pct: '18' } })).data.updated, 1);
    const av = await new Client().get(`/api/rooms/availability?checkIn=${day(300)}&checkOut=${day(301)}&adults=1&children=0`);
    assert.equal(av.data.rooms[0].total, Math.round(av.data.rooms[0].base_price * 1.18));
    const b = await guest.post('/api/reservations', { typeId: 1, checkIn: day(300), checkOut: day(301), adults: 2, children: 0 });
    assert.equal(b.data.reservation.total_amount, 10030);                                                // 8,500 × 1.18, priced by the SQL procedure
  } finally {
    await admin.patch('/api/settings', { values: { tax_rate_pct: '12' } });
  }
  assert.equal(((await admin.get('/api/settings')).data.settings.find((r) => r.setting_key === 'tax_rate_pct')).setting_value, '12');
});

test('admin creates a staff login that works; duplicates, weak passwords and the guest role are refused', async () => {
  const email = `${unique('staff')}@maisonaurelia.com`;
  const ok = await admin.post('/api/users', { fullName: 'New Receptionist', email, role: 'receptionist', password: 'Welcome123' });
  assert.equal(ok.status, 201);
  const login = await new Client().post('/api/auth/login', { email, password: 'Welcome123' });
  assert.equal(login.status, 200); assert.equal(login.data.redirect, '/dashboard');
  assert.equal((await admin.post('/api/users', { fullName: 'Dup', email, role: 'manager', password: 'Welcome123' })).status, 409);
  assert.equal((await admin.post('/api/users', { fullName: 'Weak', email: `${unique('w')}@x.com`, role: 'manager', password: 'short' })).status, 422);
  assert.equal((await admin.post('/api/users', { fullName: 'Guesty', email: `${unique('g')}@x.com`, role: 'guest', password: 'Welcome123' })).status, 422);
});

test('employees: create, update, protect against self-management, delete', async () => {
  const c = await admin.post('/api/staff', { fullName: 'Test Hire', jobTitle: 'Night Auditor', departmentId: 2, managerId: 3, hireDate: day(0), salary: 42000 });
  assert.equal(c.status, 201);
  const emp = c.data.employees.find((e) => e.full_name === 'Test Hire');
  assert.equal(emp.manager, 'Arora Mehtha');
  const u = await admin.patch(`/api/employees/${emp.employee_id}`, { jobTitle: 'Senior Night Auditor', salary: 48000 });
  assert.equal(u.data.employees.find((e) => e.employee_id === emp.employee_id).monthly_salary, 48000);
  const self = await admin.patch(`/api/employees/${emp.employee_id}`, { managerId: emp.employee_id });
  assert.equal(self.status, 400); assert.match(self.data.error, /own manager/);
  assert.equal((await admin.patch(`/api/employees/${emp.employee_id}`, { salary: -1 })).status, 422);
  assert.equal((await admin.del(`/api/employees/${emp.employee_id}`)).status, 200);
});

test('service catalogue: manager CRUD; inactive services vanish for guests; ordered services cannot be deleted', async () => {
  const name = unique('Test Facial');
  assert.equal((await manager.post('/api/services', { name, category: 'spa', description: 'A test treatment', price: 3500 })).status, 201);
  const id = (await new Client().get('/api/services')).data.services.find((s) => s.name === name).service_id;
  assert.equal((await manager.patch(`/api/services/${id}`, { price: 3900 })).status, 200);
  assert.equal((await manager.patch(`/api/services/${id}`, { isActive: false })).status, 200);
  assert.ok(!(await new Client().get('/api/services')).data.services.some((s) => s.name === name));
  assert.equal((await manager.del(`/api/services/${id}`)).status, 200);
  const used = await manager.del('/api/services/3');                        // seed data has orders for it
  assert.equal(used.status, 409); assert.match(used.data.error, /ordered before/);
});

test('inventory: validated photo upload, room type + room CRUD, and the database refuses to orphan history', async () => {
  const up = await manager.req('POST', '/api/upload', { body: uploadForm(tinyPng()) });
  assert.equal(up.status, 200);
  const served = await new Client().get(up.data.url);
  assert.equal(served.status, 200); assert.equal(served.headers.get('content-type'), 'image/png');
  assert.equal((await manager.req('POST', '/api/upload', { body: uploadForm(Buffer.from('this is not an image')) })).status, 415); // bytes checked, not the name
  assert.equal((await desk.req('POST', '/api/upload', { body: uploadForm(tinyPng()) })).status, 403);
  assert.equal((await new Client().get('/api/media/..%2F..%2F.env.local')).status, 404);

  const body = { name: 'Test Penthouse', tagline: 'A tagline for the test', description: 'A long enough description for the room type.', basePrice: 95000, maxAdults: 4, maxChildren: 2, sizeSqm: 210, bedType: 'Emperor bed', viewType: 'Skyline', imageUrl: up.data.url, amenityIds: [1, 2] };
  assert.equal((await manager.post('/api/room-types', { ...body, basePrice: -5 })).status, 422);
  assert.equal((await manager.post('/api/room-types', { ...body, imageUrl: 'javascript:alert(1)' })).status, 422);
  const created = await manager.post('/api/room-types', body);
  assert.equal(created.status, 201);
  const type = created.data.types.find((t) => t.name === 'Test Penthouse');
  assert.equal(type.slug, 'test-penthouse'); assert.deepEqual(type.amenity_ids, [1, 2]);
  assert.equal((await manager.patch(`/api/room-types/${type.type_id}`, { ...body, basePrice: 99000 })).data.types.find((t) => t.type_id === type.type_id).base_price, 99000);

  const room = await manager.post('/api/rooms', { typeId: type.type_id, roomNumber: '701', floorNo: 7 });
  assert.equal(room.status, 201);
  assert.equal((await manager.post('/api/rooms', { typeId: type.type_id, roomNumber: '701', floorNo: 7 })).status, 409); // duplicate number
  assert.match((await manager.del(`/api/room-types/${type.type_id}`)).data.error, /still has rooms/);
  const roomId = room.data.rooms.find((r) => r.room_number === '701').room_id;
  assert.equal((await manager.del(`/api/rooms/${roomId}`)).status, 200);
  assert.equal((await manager.del(`/api/room-types/${type.type_id}`)).status, 200);
  const used = (await desk.get('/api/rooms')).data.rooms[0];                 // has reservations in the seed data
  assert.equal((await manager.del(`/api/rooms/${used.room_id}`)).status, 409);
});

test('room status: staff can change it, but never an occupied room', async () => {
  const rooms = (await desk.get('/api/rooms')).data.rooms;
  const free = rooms.find((r) => r.status === 'available');
  assert.equal((await desk.patch(`/api/rooms/${free.room_id}`, { status: 'maintenance' })).status, 200);
  assert.equal((await desk.patch(`/api/rooms/${free.room_id}`, { status: 'available' })).status, 200);
  const busy = rooms.find((r) => r.status === 'occupied');
  const r = await desk.patch(`/api/rooms/${busy.room_id}`, { status: 'maintenance' });
  assert.equal(r.status, 400); assert.match(r.data.error, /occupied/);
});

test('housekeeping: create a task, assign it, finish it', async () => {
  const room = (await desk.get('/api/rooms')).data.rooms.find((r) => r.status === 'available');
  const c = await desk.post('/api/housekeeping', { roomId: room.room_id, taskType: 'deep_clean', employeeId: 8 });
  assert.equal(c.status, 201);
  const task = c.data.tasks.find((t) => t.room_number === room.room_number && t.task_type === 'deep_clean' && t.status === 'pending');
  assert.equal(task.assignee, 'Ramesh Kumar');
  assert.equal((await desk.patch(`/api/housekeeping/${task.task_id}`, { status: 'in_progress' })).status, 200);
  assert.equal((await desk.patch(`/api/housekeeping/${task.task_id}`, { status: 'done' })).status, 200);
});

test('dashboard, audit log, reports and CSV report export', async () => {
  const d = (await desk.get('/api/dashboard')).data;
  assert.equal(typeof d.stats.in_house, 'number'); assert.equal(d.occupancy.length, 21); assert.ok(d.revenue.length >= 1); assert.ok(d.byType.length >= 1);
  const a = (await admin.get('/api/audit?limit=50')).data.entries;
  assert.ok(a.length > 0); assert.ok(a.every((e) => e.action && e.created_at));
  const r = await manager.get('/api/reports/r04');
  assert.ok(r.data.rows.length >= 10); assert.equal(r.data.report.concept, 'Recursive CTE');
  assert.equal((await manager.get('/api/reports/r999')).status, 404);
  const csv = await manager.get('/api/reports/r06?format=csv');
  assert.match(csv.headers.get('content-type'), /text\/csv/); assert.match(csv.text, /room_type,bookings/);
});

test('wishlist (Redis): add, update note, remove', async () => {
  const a = await guest.post('/api/wishlist', { typeId: 4, note: 'anniversary' });
  assert.equal(a.data.wishlist.find((w) => w.typeId === 4).note, 'anniversary');
  assert.equal((await guest.patch('/api/wishlist', { typeId: 4, note: 'updated' })).data.wishlist.find((w) => w.typeId === 4).note, 'updated');
  assert.ok(!(await guest.del('/api/wishlist?typeId=4')).data.wishlist.some((w) => w.typeId === 4));
  assert.equal((await new Client().get('/api/wishlist')).status, 401);
});
