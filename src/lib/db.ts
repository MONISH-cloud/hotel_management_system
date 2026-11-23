import 'server-only';
import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import { requireEnv } from './env';

declare global {
   
  var __mysqlPool: Pool | undefined;
}

/** One pool per server process (survives hot reloads in dev). */
export const pool: Pool =
  globalThis.__mysqlPool ??
  (globalThis.__mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'hotel_app',
    password: requireEnv('MYSQL_PASSWORD'),
    database: process.env.MYSQL_DATABASE ?? 'maison_aurelia',
    waitForConnections: true,
    connectionLimit: 12,
    dateStrings: true, // DATE/DATETIME as plain strings: JSON-safe, timezone-safe
    decimalNumbers: true, // DECIMAL as JS numbers
    namedPlaceholders: false,
  }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` on a dedicated connection with @app_user_id set, so the audit
 * triggers in MySQL can record WHO performed the action.
 */
export async function withConn<T>(userId: number | null, fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET @app_user_id = ?', [userId]);
    return await fn(conn);
  } finally {
    conn.release();
  }
}

/** First result set of a CALL ... statement. */
export async function callRows<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [res] = await pool.query(sql, params);
  return ((res as unknown[])[0] ?? []) as T[];
}
