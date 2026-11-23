// Tiny .env.local loader for the standalone scripts (Next.js loads it itself at runtime).
import fs from 'node:fs';
import path from 'node:path';

/** Required variable, no fallback: fails with a clear message instead of using a guessable default. */
export function requireEnv(name, minLength = 1) {
  const v = process.env[name];
  if (!v || v.length < minLength || v.startsWith('change-me')) {
    console.error(`Environment variable ${name} is not set to a real value. Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return v;
}

export function loadEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
