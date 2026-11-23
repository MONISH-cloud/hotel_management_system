// Generates docs/DATA_DICTIONARY.md from the live database (types, keys, defaults, constraints)
// plus the human-written descriptions in scripts/dictionary-descriptions.mjs.
// Usage: npm run docs:dictionary
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { loadEnv } from './env.mjs';
import { TABLES } from './dictionary-descriptions.mjs';

loadEnv();
const DB = process.env.MYSQL_DATABASE ?? 'maison_aurelia';
const c = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1', port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_ROOT_USER ?? 'root', password: process.env.MYSQL_ROOT_PASSWORD ?? '', database: DB, dateStrings: true,
});
const q = async (sql, p = []) => (await c.query(sql, p))[0];

const tables = (await q("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name", [DB])).map((r) => r.t);
const cols = await q('SELECT table_name t, column_name n, column_type ty, is_nullable nul, column_key k, column_default d, extra ex FROM information_schema.columns WHERE table_schema = ? ORDER BY table_name, ordinal_position', [DB]);
const fks = await q(`SELECT k.table_name t, k.column_name n, k.referenced_table_name rt, k.referenced_column_name rc, r.delete_rule dr, r.update_rule ur, k.constraint_name cn
  FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r ON r.constraint_name = k.constraint_name AND r.constraint_schema = k.table_schema
  WHERE k.table_schema = ? AND k.referenced_table_name IS NOT NULL ORDER BY k.table_name, k.constraint_name`, [DB]);
const uniques = await q(`SELECT table_name t, index_name i, GROUP_CONCAT(column_name ORDER BY seq_in_index) cs FROM information_schema.statistics
  WHERE table_schema = ? AND non_unique = 0 AND index_name <> 'PRIMARY' GROUP BY table_name, index_name`, [DB]);
const checks = await q(`SELECT tc.table_name t, cc.constraint_name n, cc.check_clause cl FROM information_schema.check_constraints cc
  JOIN information_schema.table_constraints tc ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
  WHERE cc.constraint_schema = ? AND tc.constraint_type = 'CHECK' ORDER BY tc.table_name, cc.constraint_name`, [DB]);
const indexes = await q(`SELECT table_name t, index_name i, GROUP_CONCAT(column_name ORDER BY seq_in_index) cs FROM information_schema.statistics
  WHERE table_schema = ? AND non_unique = 1 GROUP BY table_name, index_name ORDER BY table_name, index_name`, [DB]);

const problems = [];
for (const t of tables) if (!TABLES[t]) problems.push(`table ${t} has no description`);
for (const k of Object.keys(TABLES)) if (!tables.includes(k)) problems.push(`described table ${k} does not exist`);
for (const col of cols) if (TABLES[col.t] && !TABLES[col.t][1][col.n]) problems.push(`column ${col.t}.${col.n} has no description`);
if (problems.length) { console.error('Data dictionary is incomplete:\n - ' + problems.join('\n - ')); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const out = [];
out.push('# Data Dictionary', '',
  `> Generated from the live \`${DB}\` database by \`npm run docs:dictionary\` — types, keys, defaults and constraints are read from MySQL, so they always match the schema.`, '',
  `**${tables.length} tables · ${cols.length} columns.** Legend: **PK** primary key · **FK** foreign key · **UQ** unique · **Null** = may be NULL.`, '', '## Tables', '',
  tables.map((t) => `- [\`${t}\`](#${t}) — ${TABLES[t][0]}`).join('\n'), '');

for (const t of tables) {
  out.push(`## ${t}`, '', TABLES[t][0], '', '| Column | Type | Null | Key | Default | Description |', '|---|---|---|---|---|---|');
  for (const col of cols.filter((x) => x.t === t)) {
    const fk = fks.find((f) => f.t === t && f.n === col.n);
    const uq = uniques.find((u) => u.t === t && u.cs === col.n);
    const key = [col.k === 'PRI' ? 'PK' : '', fk ? `FK → ${fk.rt}.${fk.rc}` : '', uq ? 'UQ' : ''].filter(Boolean).join(', ');
    const def = col.d === null ? (col.nul === 'YES' ? 'NULL' : '') : (col.d === 'CURRENT_TIMESTAMP' || /DEFAULT_GENERATED/.test(col.ex) ? col.d : `'${col.d}'`);
    out.push(`| \`${col.n}\` | ${esc(col.ty)}${col.ex.includes('auto_increment') ? ' AUTO_INCREMENT' : ''} | ${col.nul === 'YES' ? 'yes' : 'no'} | ${key} | ${esc(def)} | ${esc(TABLES[t][1][col.n])} |`);
  }
  const extra = [];
  for (const f of fks.filter((x) => x.t === t)) extra.push(`**FK** \`${f.cn}\`: \`${f.n}\` → \`${f.rt}.${f.rc}\` (ON DELETE ${f.dr}, ON UPDATE ${f.ur})`);
  for (const u of uniques.filter((x) => x.t === t && x.cs.includes(','))) extra.push(`**UNIQUE** \`${u.i}\` on (${u.cs})`);
  for (const k of checks.filter((x) => x.t === t)) extra.push(`**CHECK** \`${k.n}\`: \`${k.cl.replace(/\s+/g, ' ')}\``);
  for (const i of indexes.filter((x) => x.t === t && !fks.some((f) => f.t === t && f.cn === x.i))) extra.push(`**INDEX** \`${i.i}\` on (${i.cs})`);
  if (extra.length) out.push('', '**Constraints & indexes**', '', ...extra.map((e) => `- ${e}`));
  out.push('');
}

const views = await q("SELECT table_name t FROM information_schema.views WHERE table_schema = ? ORDER BY 1", [DB]);
out.push('## Views', '', ...views.map((v) => `- \`${v.t}\``), '', '`v_reservation_details` joins reservations, guests, rooms and room types and adds computed nights, services total and balance due. `v_guest_value` aggregates stays and spend per guest.', '');
fs.writeFileSync('docs/DATA_DICTIONARY.md', out.join('\n'));
console.log(`Wrote docs/DATA_DICTIONARY.md (${tables.length} tables, ${cols.length} columns)`);
await c.end();
