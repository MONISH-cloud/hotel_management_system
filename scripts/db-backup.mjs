// `npm run db:backup`: a safe, read-only backup of everything that is NOT rebuilt by the seed scripts.
//   1. MySQL  → backups/<database>-<timestamp>.sql   (tables, data, procedures, functions, triggers, views)
//   2. Neo4j  → backups/reviews-<timestamp>.json     (reviews live ONLY in Neo4j, and `npm run db:seed-nosql` wipes the graph)
// Redis (sessions, caches, wishlist, feed) is intentionally not backed up: it is ephemeral.
// Options: --out=DIR   (default ./backups)    --database=NAME   (default MYSQL_DATABASE)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import neo4j from 'neo4j-driver';
import { loadEnv } from './env.mjs';

loadEnv();
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const DB = arg('database') ?? process.env.MYSQL_DATABASE ?? 'maison_aurelia';
const OUT = arg('out') ?? 'backups';
if (!/^[A-Za-z0-9_]+$/.test(DB)) { console.error('Invalid database name'); process.exit(1); }
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
fs.mkdirSync(OUT, { recursive: true });

// Credentials go through a private temporary option file, never through the command line (visible in `ps`).
const cnf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-backup-')), 'client.cnf');
fs.writeFileSync(cnf, `[client]\nuser=${process.env.MYSQL_ROOT_USER ?? 'root'}\npassword=${process.env.MYSQL_ROOT_PASSWORD ?? ''}\nhost=${process.env.MYSQL_HOST ?? '127.0.0.1'}\nport=${process.env.MYSQL_PORT ?? 3306}\n`, { mode: 0o600 });
const cleanup = () => { try { fs.rmSync(path.dirname(cnf), { recursive: true, force: true }); } catch { /* ignore */ } };
process.on('exit', cleanup);

// 1) MySQL ------------------------------------------------------------------------------------
const sqlFile = path.join(OUT, `${DB}-${stamp}.sql`);
const dump = spawn(process.env.MYSQLDUMP_PATH ?? 'mysqldump', [
  `--defaults-extra-file=${cnf}`, '--single-transaction', '--routines', '--triggers', '--events', '--hex-blob',
  '--default-character-set=utf8mb4', '--no-tablespaces', '--set-gtid-purged=OFF', DB, // GTID off: the dump must load into any server, not just the one that made it
], { stdio: ['ignore', fs.openSync(sqlFile, 'w', 0o600), 'pipe'] });
let err = '';
dump.stderr.on('data', (d) => (err += d));
const code = await new Promise((r) => { dump.on('error', (e) => { err = e.message; r(1); }); dump.on('close', r); });
if (code !== 0) { fs.rmSync(sqlFile, { force: true }); console.error(`✖ mysqldump failed: ${err.trim() || 'is mysqldump installed and on PATH? (or set MYSQLDUMP_PATH)'}`); process.exit(1); }
const sql = fs.readFileSync(sqlFile, 'utf8');
const count = (re) => (sql.match(re) ?? []).length;
console.log(`✔ MySQL   ${sqlFile}  (${(fs.statSync(sqlFile).size / 1024).toFixed(0)} KB, ${count(/^CREATE TABLE /gm)} tables, ${count(/PROCEDURE /g) ? 'routines' : 'NO routines'}, ${count(/TRIGGER /g) ? 'triggers' : 'NO triggers'})`);

// 2) Neo4j reviews ----------------------------------------------------------------------------
try {
  if (!process.env.NEO4J_PASSWORD) throw new Error('NEO4J_PASSWORD not set');
  const driver = neo4j.driver(process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687', neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', process.env.NEO4J_PASSWORD), { connectionTimeout: 4000 });
  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  const res = await session.run(`
    MATCH (g:Guest)-[:WROTE]->(r:Review)-[:ABOUT]->(t:RoomType)
    RETURN r.id AS id, r.reservationId AS reservationId, g.id AS guestId, t.id AS typeId, r.rating AS rating, r.title AS title, r.body AS body,
           toString(r.createdAt) AS createdAt, toString(r.updatedAt) AS updatedAt, r.reply AS reply, toString(r.repliedAt) AS repliedAt
    ORDER BY r.createdAt`);
  const num = (v) => (neo4j.isInt(v) ? v.toNumber() : v);
  const reviews = res.records.map((rec) => Object.fromEntries(rec.keys.map((k) => [k, num(rec.get(k))])));
  await session.close(); await driver.close();
  const file = path.join(OUT, `reviews-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), count: reviews.length, reviews }, null, 2), { mode: 0o600 });
  console.log(`✔ Neo4j   ${file}  (${reviews.length} reviews)`);
} catch (e) {
  console.warn(`⚠ Neo4j   reviews NOT backed up (${e.message}). Start Neo4j and run again; reviews exist nowhere else.`);
}
console.log('\nKeep these files private: they contain guest data. The backups/ folder is git-ignored.');
