// `npm test`: builds a throw-away database (maison_aurelia_test) from the real SQL files, then runs the suites.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { loadEnv } from './env.mjs';
loadEnv();

const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit', env: process.env }); if (r.status !== 0) process.exit(r.status ?? 1); };
console.log('▶ Building test database…');
run('node', ['scripts/setup-db.mjs', '--database=maison_aurelia_test', '--skip-roles']);
console.log('\n▶ Running tests…\n');
const files = fs.readdirSync('tests').filter((f) => f.endsWith('.test.mjs')).map((f) => `tests/${f}`);
run('node', ['--experimental-strip-types', '--no-warnings', '--test', ...files]);
