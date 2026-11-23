import mysql from 'mysql2/promise';
import { loadEnv } from '../scripts/env.mjs';

loadEnv();
export const TEST_DB = 'maison_aurelia_test';

export async function connect() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_ROOT_USER ?? 'root',
    password: process.env.MYSQL_ROOT_PASSWORD ?? '',
    database: TEST_DB,
    dateStrings: true,
    decimalNumbers: true,
  });
}

/** 'YYYY-MM-DD' for today + n days, computed by MySQL so tests share the server's clock. */
export async function day(c, n) {
  const [[r]] = await c.query("SELECT DATE_FORMAT(CURDATE() + INTERVAL ? DAY, '%Y-%m-%d') AS d", [n]);
  return r.d;
}

export async function typeId(c, slug) {
  const [[r]] = await c.query('SELECT type_id FROM room_types WHERE slug = ?', [slug]);
  return r.type_id;
}

/** Runs a statement and returns the MySQL SIGNAL message if it raises one (or null if it succeeds). */
export async function failure(promise) {
  try { await promise; return null; } catch (e) { return e.sqlMessage ?? e.message; }
}

export async function book(c, { guest = 1, type, inDays, outDays, adults = 2, children = 0, rooms = 1, by = null }) {
  const [a, b] = [await day(c, inDays), await day(c, outDays)];
  await c.query('CALL sp_create_booking(?,?,?,?,?,?,NULL,?,?,@g,@id)', [guest, type, a, b, adults, children, by, rooms]);
  const [[r]] = await c.query('SELECT @g AS grp, @id AS id');
  return { group: r.grp, id: r.id, checkIn: a, checkOut: b };
}

export async function setSetting(c, key, value) {
  await c.query('UPDATE hotel_settings SET setting_value = ? WHERE setting_key = ?', [String(value), key]);
}
