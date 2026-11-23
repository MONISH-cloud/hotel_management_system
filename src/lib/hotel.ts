import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { query, one, callRows, pool, type Row } from './db';
import { availabilityVersion, cached } from './cache';
import { ratingSummaries } from './graph';

/* ═══════════════════════════ types ═══════════════════════════ */
export type Amenity = { name: string; icon: string };
export type RoomType = {
  type_id: number; slug: string; name: string; tagline: string; description: string;
  base_price: number; max_adults: number; max_children: number; size_sqm: number;
  bed_type: string; view_type: string; image_url: string;
  amenities: Amenity[]; rating: number | null; review_count: number; room_count: number;
};

export type Reservation = {
  reservation_id: number; reservation_code: string; status: string; source: 'online' | 'front_desk'; group_code: string | null; group_size: number;
  check_in: string; check_out: string; nights: number; adults: number; children: number;
  nightly_rate: number; tax_amount: number; total_amount: number; services_total: number; balance_due: number;
  special_requests: string | null; created_at: string; checked_in_at: string | null; checked_out_at: string | null;
  guest_id: number; guest_name: string; guest_email: string; guest_phone: string | null; loyalty_tier: string;
  room_id: number; room_number: string; floor_no: number;
  type_id: number; room_type: string; room_slug: string; image_url: string;
};

export type Service = { service_id: number; name: string; category: string; description: string; price: number; is_active: number };

/* ═══════════════════════════ rooms ═══════════════════════════ */
export async function listRoomTypes(): Promise<RoomType[]> {
  const [types, amenities, counts, ratings] = await Promise.all([
    query<Row>('SELECT * FROM room_types ORDER BY base_price'),
    query<Row>(`SELECT rta.type_id, a.name, a.icon
                  FROM room_type_amenities rta JOIN amenities a ON a.amenity_id = rta.amenity_id
                 ORDER BY a.amenity_id`),
    query<Row>('SELECT type_id, COUNT(*) AS n FROM rooms GROUP BY type_id'),
    ratingSummaries(),
  ]);
  return types.map((t) => ({
    ...(t as Omit<RoomType, 'amenities' | 'rating' | 'review_count' | 'room_count'>),
    amenities: amenities.filter((a) => a.type_id === t.type_id).map((a) => ({ name: a.name, icon: a.icon })),
    rating: ratings.get(t.type_id)?.avg ?? null,
    review_count: ratings.get(t.type_id)?.count ?? 0,
    room_count: counts.find((c) => c.type_id === t.type_id)?.n ?? 0,
  }));
}

export async function getRoomTypeBySlug(slug: string) {
  return (await listRoomTypes()).find((t) => t.slug === slug) ?? null;
}

/** Free rooms per type for a date range. Cached in Redis (version-stamped, invalidated by every booking). */
export async function availabilityByType(checkIn: string, checkOut: string): Promise<Record<number, number>> {
  const v = await availabilityVersion();
  return cached(`ma:avail:${v}:${checkIn}:${checkOut}`, 60, async () => {
    const rows = await query<{ type_id: number; free: number }>(
      `SELECT t.type_id,
              (SELECT COUNT(*) FROM rooms r
                WHERE r.type_id = t.type_id AND fn_room_is_available(r.room_id, ?, ?, NULL) = 1) AS free
         FROM room_types t`,
      [checkIn, checkOut],
    );
    return Object.fromEntries(rows.map((r) => [r.type_id, Number(r.free)]));
  });
}

export async function listRooms() {
  return query<Row>(
    `SELECT rm.room_id, rm.room_number, rm.floor_no, rm.status, rt.name AS room_type, rt.type_id,
            g.full_name AS guest_name, r.check_out AS guest_check_out
       FROM rooms rm
       JOIN room_types rt ON rt.type_id = rm.type_id
       LEFT JOIN reservations r ON r.room_id = rm.room_id AND r.status = 'checked_in'
       LEFT JOIN guests g ON g.guest_id = r.guest_id
      ORDER BY rm.room_number`,
  );
}

/* ═══════════════════════ reservations ═══════════════════════ */
export type ReservationFilter = {
  guestId?: number; status?: string; q?: string; groupCode?: string;
  view?: 'arrivals' | 'departures' | 'inhouse' | 'upcoming' | 'all';
  limit?: number; offset?: number;
};

function reservationWhere(f: ReservationFilter) {
  const where: string[] = [];
  const p: unknown[] = [];
  if (f.groupCode) { where.push('group_code = ?'); p.push(f.groupCode); }
  if (f.guestId) { where.push('guest_id = ?'); p.push(f.guestId); }
  if (f.status && f.status !== 'all') { where.push('status = ?'); p.push(f.status); }
  if (f.q) {
    where.push('(reservation_code LIKE ? OR guest_name LIKE ? OR guest_email LIKE ? OR room_number LIKE ?)');
    const like = `%${f.q}%`;
    p.push(like, like, like, like);
  }
  let order = 'check_in DESC, reservation_id DESC';
  if (f.view === 'arrivals') { where.push("check_in = CURDATE() AND status IN ('pending','confirmed')"); order = 'reservation_id'; }
  if (f.view === 'departures') { where.push("check_out = CURDATE() AND status = 'checked_in'"); order = 'reservation_id'; }
  if (f.view === 'inhouse') { where.push("status = 'checked_in'"); order = 'check_out'; }
  if (f.view === 'upcoming') { where.push("check_in > CURDATE() AND status IN ('pending','confirmed')"); order = 'check_in'; }
  return { clause: where.length ? 'WHERE ' + where.join(' AND ') : '', params: p, order };
}

export async function listReservations(f: ReservationFilter = {}) {
  const { clause, params, order } = reservationWhere(f);
  return query<Reservation>(`SELECT * FROM v_reservation_details ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, f.limit ?? 60, f.offset ?? 0]);
}

export async function countReservations(f: ReservationFilter = {}) {
  const { clause, params } = reservationWhere(f);
  const r = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM v_reservation_details ${clause}`, params);
  return Number(r?.n ?? 0);
}

export async function getReservation(id: number) {
  const r = await one<Reservation>('SELECT * FROM v_reservation_details WHERE reservation_id = ?', [id]);
  if (!r) return null;
  const [payments, orders] = await Promise.all([
    query<Row>('SELECT * FROM payments WHERE reservation_id = ? ORDER BY paid_at DESC, payment_id DESC', [id]),
    query<Row>(
      `SELECT so.*, s.name AS service_name, s.category
         FROM service_orders so JOIN services s ON s.service_id = so.service_id
        WHERE so.reservation_id = ? ORDER BY so.ordered_at DESC`, [id]),
  ]);
  return { ...r, payments, orders };
}

export async function reservationCounts() {
  const rows = await query<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM reservations GROUP BY status');
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}

/* ═══════════════════════ services & orders ═══════════════════════ */
export async function listServices(all = false) {
  return query<Service>(`SELECT * FROM services ${all ? '' : 'WHERE is_active = TRUE'} ORDER BY category, price`);
}

export async function listOrders(limit = 60) {
  return query<Row>(
    `SELECT so.order_id, so.quantity, so.unit_price, so.status, so.notes, so.ordered_at,
            s.name AS service_name, s.category, r.reservation_id, r.reservation_code,
            g.full_name AS guest_name, rm.room_number
       FROM service_orders so
       JOIN services s     ON s.service_id = so.service_id
       JOIN reservations r ON r.reservation_id = so.reservation_id
       JOIN guests g       ON g.guest_id = r.guest_id
       JOIN rooms rm       ON rm.room_id = r.room_id
      ORDER BY FIELD(so.status,'requested','confirmed','delivered','cancelled'), so.ordered_at DESC
      LIMIT ?`, [limit]);
}

/* ═══════════════════════ people ═══════════════════════ */
export async function countGuests(q?: string) {
  const like = `%${q ?? ''}%`;
  const r = await one<{ n: number }>('SELECT COUNT(*) AS n FROM guests WHERE full_name LIKE ? OR email LIKE ?', [like, like]);
  return Number(r?.n ?? 0);
}

export async function listGuests(q?: string, limit = 100, offset = 0) {
  const like = `%${q ?? ''}%`;
  return query<Row>(
    `SELECT v.*, g.country, g.phone,
            (SELECT COUNT(*) FROM reservations r WHERE r.guest_id = v.guest_id AND r.status IN ('pending','confirmed')) AS upcoming
       FROM v_guest_value v JOIN guests g ON g.guest_id = v.guest_id
      WHERE v.full_name LIKE ? OR v.email LIKE ?
      ORDER BY v.room_spend DESC, v.full_name LIMIT ? OFFSET ?`, [like, like, limit, offset]);
}

export async function getGuestByUser(userId: number) {
  return one<Row>('SELECT * FROM guests WHERE user_id = ?', [userId]);
}

export async function listEmployees() {
  return query<Row>(
    `SELECT e.employee_id, e.full_name, e.job_title, e.hire_date, e.monthly_salary, e.manager_id,
            d.name AS department, m.full_name AS manager, u.email, ro.role_name AS role, u.user_id, u.is_active
       FROM employees e
       JOIN departments d ON d.department_id = e.department_id
       LEFT JOIN employees m ON m.employee_id = e.manager_id
       LEFT JOIN users u ON u.user_id = e.user_id
       LEFT JOIN roles ro ON ro.role_id = u.role_id
      ORDER BY d.name, e.manager_id IS NOT NULL, e.full_name`);
}

export async function listUsers() {
  return query<Row>(
    `SELECT u.user_id, u.full_name, u.email, u.is_active, u.last_login_at, u.created_at, r.role_name AS role, r.role_id
       FROM users u JOIN roles r ON r.role_id = u.role_id ORDER BY r.role_id, u.full_name`);
}

export async function listRolesWithPermissions() {
  const rows = await query<Row>(
    `SELECT r.role_id, r.role_name, r.description, p.code
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
       LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      ORDER BY r.role_id, p.code`);
  const map = new Map<number, { role_id: number; role_name: string; description: string; permissions: string[] }>();
  for (const r of rows) {
    if (!map.has(r.role_id)) map.set(r.role_id, { role_id: r.role_id, role_name: r.role_name, description: r.description, permissions: [] });
    if (r.code) map.get(r.role_id)!.permissions.push(r.code);
  }
  return [...map.values()];
}

/* ═══════════════════════ housekeeping ═══════════════════════ */
export async function listTasks() {
  return query<Row>(
    `SELECT t.task_id, t.task_type, t.status, t.created_at, t.completed_at, t.employee_id,
            rm.room_number, rm.room_id, e.full_name AS assignee
       FROM housekeeping_tasks t
       JOIN rooms rm ON rm.room_id = t.room_id
       LEFT JOIN employees e ON e.employee_id = t.employee_id
      ORDER BY FIELD(t.status,'in_progress','pending','done'), t.created_at DESC LIMIT 60`);
}

export async function listHousekeepers() {
  return query<Row>(
    `SELECT e.employee_id, e.full_name FROM employees e JOIN departments d ON d.department_id = e.department_id
      WHERE d.name IN ('Housekeeping','Engineering') ORDER BY e.full_name`);
}

/* ═══════════════════════ analytics ═══════════════════════ */
export async function dashboardStats() {
  const [k] = await query<Row>(`
    SELECT
      (SELECT COUNT(*) FROM reservations WHERE check_in = CURDATE() AND status IN ('pending','confirmed')) AS arrivals_today,
      (SELECT COUNT(*) FROM reservations WHERE check_out = CURDATE() AND status = 'checked_in')            AS departures_today,
      (SELECT COUNT(*) FROM reservations WHERE status = 'checked_in')                                       AS in_house,
      (SELECT COUNT(*) FROM rooms WHERE status = 'occupied')                                                AS occupied_rooms,
      (SELECT COUNT(*) FROM rooms WHERE status <> 'maintenance')                                            AS sellable_rooms,
      (SELECT COUNT(*) FROM rooms)                                                                          AS total_rooms,
      (SELECT COUNT(*) FROM reservations WHERE status = 'pending')                                          AS pending_reservations,
      (SELECT IFNULL(SUM(CASE payment_type WHEN 'payment' THEN amount ELSE -amount END), 0)
         FROM payments WHERE paid_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01'))                                 AS revenue_mtd,
      (SELECT IFNULL(SUM(CASE payment_type WHEN 'payment' THEN amount ELSE -amount END), 0)
         FROM payments WHERE DATE(paid_at) = CURDATE())                                                     AS revenue_today,
      (SELECT IFNULL(SUM(fn_reservation_balance(reservation_id)), 0)
         FROM reservations WHERE status IN ('confirmed','checked_in'))                                      AS outstanding_balance,
      (SELECT IFNULL(ROUND(AVG(nightly_rate)), 0) FROM reservations
        WHERE status IN ('checked_in','checked_out') AND check_in >= CURDATE() - INTERVAL 60 DAY)           AS adr`);
  return k;
}

export async function occupancySeries() {
  return callRows<{ stay_date: string; occupied_rooms: number; total_rooms: number; occupancy_pct: number }>(
    'CALL sp_occupancy_report(CURDATE() - INTERVAL 6 DAY, 21)');
}

export async function revenueSeries(months = 6) {
  return callRows<{ month: string; room_revenue: number; service_revenue: number; total_revenue: number }>('CALL sp_revenue_by_month(?)', [months]);
}

export async function roomStatusCounts() {
  return query<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM rooms GROUP BY status');
}

export async function revenueByType() {
  return query<{ name: string; revenue: number; bookings: number }>(
    `SELECT rt.name, SUM(r.total_amount) AS revenue, COUNT(*) AS bookings
       FROM reservations r JOIN rooms rm ON rm.room_id = r.room_id JOIN room_types rt ON rt.type_id = rm.type_id
      WHERE r.status IN ('checked_in','checked_out') GROUP BY rt.type_id, rt.name ORDER BY revenue DESC`);
}

export async function countAudit() {
  const r = await one<{ n: number }>('SELECT COUNT(*) AS n FROM audit_log');
  return Number(r?.n ?? 0);
}

export async function listAudit(limit = 80, offset = 0) {
  return query<Row>(
    `SELECT a.log_id, a.action, a.entity, a.entity_id, a.details, a.created_at, u.full_name AS actor
       FROM audit_log a LEFT JOIN users u ON u.user_id = a.actor_user_id
      ORDER BY a.log_id DESC LIMIT ? OFFSET ?`, [limit, offset]);
}

/* ═══════════════════════ SQL report registry ═══════════════════════ */
export type Report = { id: string; title: string; concept: string; description: string; sql: string };

/** The reports are defined in db/mysql/04_queries.sql (single source of truth). */
export async function loadReports(): Promise<Report[]> {
  const file = await fs.readFile(path.join(process.cwd(), 'db', 'mysql', '04_queries.sql'), 'utf8');
  const blocks = file.split(/^-- @report /m).slice(1);
  return blocks.map((b) => {
    const nl = b.indexOf('\n');
    const [id, title, concept, ...desc] = b.slice(0, nl).split('|').map((s) => s.trim());
    const sql = b.slice(nl + 1).split('\n').filter((l) => !l.startsWith('-- =')).join('\n').trim();
    return { id, title, concept, description: desc.join(' | '), sql };
  });
}

export async function runReport(id: string) {
  const report = (await loadReports()).find((r) => r.id === id);
  if (!report) return null;
  const started = Date.now();
  const [rows] = await pool.query(report.sql.replace(/;\s*$/, ''));
  return { report, rows: rows as Row[], ms: Date.now() - started };
}

export async function ordersForGuest(guestId: number) {
  return query<Row>(
    `SELECT so.order_id, so.reservation_id, so.quantity, so.unit_price, so.status, so.ordered_at,
            s.name AS service_name, s.category
       FROM service_orders so
       JOIN services s ON s.service_id = so.service_id
       JOIN reservations r ON r.reservation_id = so.reservation_id
      WHERE r.guest_id = ? ORDER BY so.ordered_at DESC`, [guestId]);
}

export async function listDepartments() {
  return query<{ department_id: number; name: string }>('SELECT department_id, name FROM departments ORDER BY name');
}

/* ═══════════════════════ inventory management ═══════════════════════ */
export async function listAmenities() {
  return query<{ amenity_id: number; name: string; icon: string }>('SELECT amenity_id, name, icon FROM amenities ORDER BY amenity_id');
}

export async function listTypesForAdmin() {
  const [types, links, counts] = await Promise.all([
    query<Row>('SELECT * FROM room_types ORDER BY base_price'),
    query<Row>('SELECT type_id, amenity_id FROM room_type_amenities'),
    query<Row>('SELECT type_id, COUNT(*) AS n FROM rooms GROUP BY type_id'),
  ]);
  return types.map((t) => ({
    ...(t as Omit<RoomType, 'amenities' | 'rating' | 'review_count' | 'room_count'>),
    amenity_ids: links.filter((l) => l.type_id === t.type_id).map((l) => l.amenity_id as number),
    room_count: Number(counts.find((c) => c.type_id === t.type_id)?.n ?? 0),
  }));
}
export type AdminType = Awaited<ReturnType<typeof listTypesForAdmin>>[number];
