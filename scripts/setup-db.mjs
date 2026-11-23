// Creates the MySQL database: schema -> routines -> seed -> DB roles.
// Usage: npm run db:setup [-- --database=NAME] [-- --skip-roles]
//   --database=NAME  build the schema under another database name (used by `npm test`)
//   --skip-roles     do not run 05_db_roles.sql
// Env MYSQL_ALLOW_ANY_HOST=1 also lets the app user connect from any host (needed when MySQL runs in Docker).
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { loadEnv, requireEnv } from './env.mjs';

loadEnv();

const dir = path.join(process.cwd(), 'db', 'mysql');
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const DB = arg('database') ?? 'maison_aurelia';
if (!/^[A-Za-z0-9_]+$/.test(DB)) { console.error('Invalid database name'); process.exit(1); }
const SKIP_ROLES = process.argv.includes('--skip-roles');
const ANY_HOST = process.env.MYSQL_ALLOW_ANY_HOST === '1';
const FILES = ['01_schema.sql', '01b_alter_tables.sql', '02_routines.sql', '03_seed.sql', ...(SKIP_ROLES ? [] : ['05_db_roles.sql'])];

/** Splits an SQL script into statements, honouring DELIMITER directives. */
function splitStatements(sql) {
  const out = [];
  let delimiter = ';';
  let buf = [];
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    const dm = trimmed.match(/^DELIMITER\s+(\S+)\s*$/i);
    if (dm) {
      delimiter = dm[1];
      continue;
    }
    if (trimmed.startsWith('--') || trimmed === '') {
      if (buf.length === 0) continue; // skip leading comments / blank lines
    }
    buf.push(line);
    if (trimmed.startsWith('--')) continue; // a comment line never terminates a statement
    if (trimmed.endsWith(delimiter)) {
      let stmt = buf.join('\n').trim();
      stmt = stmt.slice(0, stmt.length - delimiter.length).trim();
      if (stmt) out.push(stmt);
      buf = [];
    }
  }
  const rest = buf.join('\n').trim();
  if (rest && !rest.split('\n').every((l) => l.trim().startsWith('--'))) out.push(rest);
  return out;
}

const appPassword = requireEnv('MYSQL_PASSWORD');

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_ROOT_USER ?? 'root',
  password: process.env.MYSQL_ROOT_PASSWORD ?? '',
  multipleStatements: false,
});

console.log('Connected to MySQL', (await conn.query('SELECT VERSION() v'))[0][0].v);

for (const file of FILES) {
  let sql = fs.readFileSync(path.join(dir, file), 'utf8');
  sql = sql.replaceAll('__APP_PASSWORD__', appPassword.replaceAll("'", "''")).replaceAll('maison_aurelia', DB);
  // least privilege by default: the '%' (any host) app account is only created when explicitly requested
  const statements = splitStatements(sql).filter((st) => ANY_HOST || !st.includes("@'%'"));
  process.stdout.write(`> ${file} (${statements.length} statements) ... `);
  let n = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      n++;
    } catch (err) {
      console.error(`\n\nFAILED in ${file}, statement #${n + 1}:\n${stmt.slice(0, 600)}\n\n${err.message}`);
      process.exit(1);
    }
  }
  console.log('ok');
}

if (!ANY_HOST && !SKIP_ROLES) await conn.query("DROP USER IF EXISTS 'hotel_app'@'%'"); // remove any broader account left by an earlier run
await conn.query(`USE ${DB}`);
const [[counts]] = await conn.query(`
  SELECT (SELECT COUNT(*) FROM rooms)        AS rooms,
         (SELECT COUNT(*) FROM guests)       AS guests,
         (SELECT COUNT(*) FROM reservations) AS reservations,
         (SELECT COUNT(*) FROM payments)     AS payments,
         (SELECT COUNT(*) FROM service_orders) AS service_orders
  FROM ${DB}.room_types LIMIT 1`);
console.log('Seeded:', counts);
await conn.end();
console.log('\nMySQL ready. Next: npm run db:seed-nosql');
