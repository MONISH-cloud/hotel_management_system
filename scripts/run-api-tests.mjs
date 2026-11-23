// `npm run test:api`: end-to-end HTTP tests against an ISOLATED copy of the whole stack.
//
//   • database : maison_aurelia_test   (rebuilt from the real SQL files; your real data is never touched)
//   • redis    : database number 15     (flushed afterwards; your real keys live in database 0)
//   • neo4j    : deliberately unreachable (the app degrades gracefully; review endpoints are not covered here)
//   • app      : a production build in .next-test served on port 3100 (your dev server on 3000 is not disturbed)
//
// Needs MySQL and Redis running. Takes about a minute (it builds the app).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import Redis from 'ioredis';
import { loadEnv } from './env.mjs';

loadEnv();
const PORT = Number(process.env.API_TEST_PORT ?? 3100);
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = 'maison_aurelia_test';
const REDIS_URL = (process.env.REDIS_URL ?? 'redis://127.0.0.1:6379').replace(/\/\d+$/, '') + '/15';

const env = {
  ...process.env,
  MYSQL_DATABASE: TEST_DB,
  REDIS_URL,
  NEO4J_URI: 'bolt://127.0.0.1:1', // nothing listens here: graph features switch off, everything else runs
  NEXT_DIST_DIR: '.next-test',
  API_BASE: BASE,
  NODE_ENV: 'production',
};
// Next.js rewrites tsconfig.json when it builds into a different folder; snapshot it so this run leaves no trace.
const TSCONFIG = 'tsconfig.json';
const tsconfigBefore = fs.readFileSync(TSCONFIG);
const restoreTsconfig = () => { try { if (!fs.readFileSync(TSCONFIG).equals(tsconfigBefore)) fs.writeFileSync(TSCONFIG, tsconfigBefore); } catch { /* ignore */ } };
process.on('exit', restoreTsconfig);
const step = (msg) => console.log(`\n▶ ${msg}`);
const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1); };

const portOpen = (port) => new Promise((res) => { const s = net.connect(port, '127.0.0.1').once('connect', () => { s.destroy(); res(true); }).once('error', () => res(false)); });
if (await portOpen(PORT)) fail(`Port ${PORT} is already in use. Stop whatever is listening there (or set API_TEST_PORT) and retry.`);
if (!(await portOpen(Number(process.env.MYSQL_PORT ?? 3306)))) fail('MySQL is not reachable. Start it first.');
const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
try { await redis.connect(); await redis.ping(); } catch { fail('Redis is not reachable. Start it first (the session tests need it).'); }

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, ...opts });
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} failed`);
};

step(`Building the isolated test database (${TEST_DB})…`);
run('node', ['scripts/setup-db.mjs', `--database=${TEST_DB}`]);

step('Building the app into .next-test …');
run('npx', ['next', 'build'], { env: { ...env, NODE_OPTIONS: '--experimental-require-module' } });
restoreTsconfig();

step(`Starting the app on ${BASE} …`);
const server = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], { env: { ...env, NODE_OPTIONS: '--experimental-require-module' }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d)); server.stderr.on('data', (d) => (serverLog += d));
const stop = async () => { restoreTsconfig(); try { server.kill('SIGTERM'); } catch { /* gone */ } try { await redis.flushdb(); redis.disconnect(); } catch { /* ignore */ } };
process.on('SIGINT', async () => { await stop(); process.exit(130); });

let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  try { ready = (await fetch(`${BASE}/api/health`)).ok; } catch { /* not yet */ }
  if (!ready) await new Promise((r) => setTimeout(r, 1000));
}
if (!ready) { console.error(serverLog.slice(-2000)); await stop(); fail('The test server did not start.'); }
await redis.flushdb(); // start from an empty Redis database 15

step('Running API tests…\n');
const files = fs.readdirSync('tests/api').filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `tests/api/${f}`);
const t = spawnSync('node', ['--no-warnings', '--test', '--test-concurrency=1', ...files], { stdio: 'inherit', env });
await stop();
if (t.status !== 0) { console.error('\nServer log (tail):\n' + serverLog.slice(-1500)); }
process.exit(t.status ?? 1);
