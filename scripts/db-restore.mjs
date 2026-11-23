// `npm run db:restore -- <backup.sql> [--database=NAME] [--reviews=<reviews.json>] [--replace-reviews] [--yes]`
//
//   MySQL   Loads a dump made by db:backup into --database (default: MYSQL_DATABASE).
//           Refuses to overwrite an existing, non-empty database unless you pass --yes (it is then dropped first).
//   Reviews With --reviews, MERGES the saved reviews back into Neo4j (safe to repeat: matched by id).
//           Add --replace-reviews to delete the current reviews first. Run `npm run db:seed-nosql` BEFORE this,
//           so the guests and room types the reviews attach to exist in the graph.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import neo4j from 'neo4j-driver';
import { loadEnv } from './env.mjs';

loadEnv();
process.on('unhandledRejection', (e) => { console.error(`✖ ${e?.sqlMessage ?? e?.message ?? e}`); process.exit(1); });
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const flag = (n) => process.argv.includes(`--${n}`);
const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
const DB = arg('database') ?? process.env.MYSQL_DATABASE ?? 'maison_aurelia';
const reviewsFile = arg('reviews');
if (!file && !reviewsFile) { console.error('Usage: npm run db:restore -- <backup.sql> [--database=NAME] [--reviews=<reviews.json>] [--replace-reviews] [--yes]'); process.exit(1); }
if (!/^[A-Za-z0-9_]+$/.test(DB)) { console.error('Invalid database name'); process.exit(1); }

if (file) {
  if (!fs.existsSync(file)) { console.error(`✖ File not found: ${file}`); process.exit(1); }
  const conn = await mysql.createConnection({ host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_ROOT_USER ?? 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? '' });
  const [[{ n }]] = await conn.query('SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = ?', [DB]);
  if (n > 0 && !flag('yes')) {
    console.error(`✖ Database "${DB}" already exists with ${n} tables/views. Restoring replaces it completely.\n  Re-run with --yes to confirm, or choose another name with --database=NAME.`);
    await conn.end(); process.exit(1);
  }
  // reached only if the database is absent, empty, or --yes was given
  await conn.query(`DROP DATABASE IF EXISTS \`${DB}\``);
  await conn.query(`CREATE DATABASE \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await conn.end();

  const cnf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ma-restore-')), 'client.cnf');
  fs.writeFileSync(cnf, `[client]\nuser=${process.env.MYSQL_ROOT_USER ?? 'root'}\npassword=${process.env.MYSQL_ROOT_PASSWORD ?? ''}\nhost=${process.env.MYSQL_HOST ?? '127.0.0.1'}\nport=${process.env.MYSQL_PORT ?? 3306}\n`, { mode: 0o600 });
  const child = spawn(process.env.MYSQL_CLIENT_PATH ?? 'mysql', [`--defaults-extra-file=${cnf}`, '--default-character-set=utf8mb4', DB], { stdio: [fs.openSync(file, 'r'), 'inherit', 'pipe'] });
  let err = ''; child.stderr.on('data', (d) => (err += d));
  const code = await new Promise((r) => { child.on('error', (e) => { err = e.message; r(1); }); child.on('close', r); });
  fs.rmSync(path.dirname(cnf), { recursive: true, force: true });
  if (code !== 0) { console.error(`✖ Restore failed: ${err.trim()}`); process.exit(1); }
  const c2 = await mysql.createConnection({ host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_ROOT_USER ?? 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? '' });
  const [[t]] = await c2.query("SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE') tables, (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=?) routines, (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema=?) triggers", [DB, DB, DB]);
  await c2.end();
  console.log(`✔ MySQL restored into "${DB}": ${t.tables} tables, ${t.routines} routines, ${t.triggers} triggers`);
}

if (reviewsFile) {
  const { reviews } = JSON.parse(fs.readFileSync(reviewsFile, 'utf8'));
  const driver = neo4j.driver(process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687', neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', process.env.NEO4J_PASSWORD ?? ''), { connectionTimeout: 4000 });
  const session = driver.session();
  try {
    if (flag('replace-reviews')) { await session.run('MATCH (r:Review) DETACH DELETE r'); console.log('• existing reviews removed'); }
    let ok = 0, skipped = 0;
    for (const r of reviews) {
      const res = await session.run(
        `MATCH (g:Guest {id:$g}), (t:RoomType {id:$t})
         MERGE (rv:Review {id:$id})
           ON CREATE SET rv.createdAt = datetime($createdAt)
         SET rv.reservationId=$res, rv.rating=$rating, rv.title=$title, rv.body=$body, rv.reply=$reply,
             rv.updatedAt = CASE WHEN $updatedAt IS NULL THEN null ELSE datetime($updatedAt) END,
             rv.repliedAt = CASE WHEN $repliedAt IS NULL THEN null ELSE datetime($repliedAt) END
         MERGE (g)-[:WROTE]->(rv) MERGE (rv)-[:ABOUT]->(t)
         RETURN rv.id AS id`,
        { id: r.id, g: neo4j.int(r.guestId), t: neo4j.int(r.typeId), res: neo4j.int(r.reservationId), rating: neo4j.int(r.rating), title: r.title, body: r.body, reply: r.reply ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt ?? null, repliedAt: r.repliedAt ?? null });
      if (res.records.length) ok++; else skipped++;
    }
    console.log(`✔ Neo4j reviews merged: ${ok} restored${skipped ? `, ${skipped} skipped (guest or room type missing: run npm run db:seed-nosql first)` : ''}`);
  } finally { await session.close(); await driver.close(); }
}
