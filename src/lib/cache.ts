import 'server-only';
import Redis from 'ioredis';

/**
 * Redis usage in Maison Aurelia
 * ─────────────────────────────
 *  ma:sess:{jti}        STRING (TTL 7d)   server-side session registry -> instant logout / revocation
 *  ma:perms:{role}      SET    (TTL 5m)   cached role permissions (source of truth: MySQL)
 *  ma:avail:v           STRING            version counter; bumping it invalidates availability caches
 *  ma:avail:{v}:{k}     STRING (TTL 60s)  cached availability search results
 *  ma:rl:{bucket}:{id}  STRING (TTL)      rate-limit counters (login brute-force protection)
 *  ma:wish:{userId}     HASH              guest wishlist (room type -> note)   [CRUD]
 *  ma:feed              LIST (cap 40)     live activity feed shown in the staff dashboard
 *
 * Every helper degrades gracefully: if Redis is down the app keeps working.
 */

declare global {
   
  var __redis: Redis | undefined;
}

function create(): Redis {
  const r = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1500,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  r.on('error', () => {}); // swallow: handled per-call
  return r;
}

export const redis: Redis = globalThis.__redis ?? (globalThis.__redis = create());

let downUntil = 0; // simple circuit breaker so a dead Redis never slows every request

async function ready(): Promise<boolean> {
  if (redis.status === 'ready') return true;
  if (Date.now() < downUntil) return false;
  try {
    if (redis.status === 'wait' || redis.status === 'end') await redis.connect();
    else if (redis.status === 'connecting' || redis.status === 'connect' || redis.status === 'reconnecting') {
      await new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error('redis timeout')), 1500);
        redis.once('ready', () => { clearTimeout(t); res(); });
      });
    }
    if ((redis.status as string) === 'ready') return true;
    downUntil = Date.now() + 8000;
    return false;
  } catch {
    downUntil = Date.now() + 8000;
    return false;
  }
}

/** Run a Redis operation; return `fallback` if Redis is unavailable. */
export async function safe<T>(fn: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
  try {
    if (!(await ready())) return fallback;
    return await fn(redis);
  } catch {
    return fallback;
  }
}

export async function redisAlive(): Promise<boolean> {
  return safe(async (r) => (await r.ping()) === 'PONG', false);
}

/* ───────────── generic read-through cache ───────────── */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  const hit = await safe((r) => r.get(key), null);
  if (hit) {
    try { return JSON.parse(hit) as T; } catch { /* fall through */ }
  }
  const fresh = await load();
  await safe((r) => r.set(key, JSON.stringify(fresh), 'EX', ttlSec), null);
  return fresh;
}

/* ───────────── availability cache versioning ───────────── */
export async function availabilityVersion(): Promise<string> {
  return safe(async (r) => (await r.get('ma:avail:v')) ?? '0', '0');
}
export async function bumpAvailability(): Promise<void> {
  await safe((r) => r.incr('ma:avail:v'), 0);
}

/* ───────────── rate limiting (fixed window) ───────────── */
export async function rateLimit(bucket: string, id: string, limit: number, windowSec: number) {
  const key = `ma:rl:${bucket}:${id}`;
  const count = await safe(async (r) => {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, windowSec);
    return n;
  }, 0);
  const ttl = await safe((r) => r.ttl(key), windowSec);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: Math.max(ttl, 1) };
}
export async function resetRateLimit(bucket: string, id: string) {
  await safe((r) => r.del(`ma:rl:${bucket}:${id}`), 0);
}

/* ───────────── live activity feed ───────────── */
export type FeedItem = { title: string; detail: string; at: number };

export async function pushFeed(title: string, detail: string) {
  const item: FeedItem = { title, detail, at: Date.now() };
  await safe(async (r) => {
    await r.lpush('ma:feed', JSON.stringify(item));
    await r.ltrim('ma:feed', 0, 39);
    return 1;
  }, 0);
}

export async function getFeed(limit = 12): Promise<FeedItem[]> {
  const raw = await safe((r) => r.lrange('ma:feed', 0, limit - 1), [] as string[]);
  return raw.map((s) => { try { return JSON.parse(s) as FeedItem; } catch { return null; } }).filter(Boolean) as FeedItem[];
}

/* ───────────── guest wishlist (Redis hash: full CRUD) ───────────── */
export type WishEntry = { typeId: number; note: string; addedAt: number };

export async function wishList(userId: number): Promise<WishEntry[]> {
  const all = await safe((r) => r.hgetall(`ma:wish:${userId}`), {} as Record<string, string>);
  return Object.entries(all)
    .map(([typeId, v]) => { try { return { typeId: Number(typeId), ...JSON.parse(v) } as WishEntry; } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => b!.addedAt - a!.addedAt) as WishEntry[];
}
export async function wishAdd(userId: number, typeId: number, note = '') {
  await safe((r) => r.hset(`ma:wish:${userId}`, String(typeId), JSON.stringify({ note, addedAt: Date.now() })), 0);
}
export async function wishUpdate(userId: number, typeId: number, note: string): Promise<boolean> {
  return safe(async (r) => {
    const cur = await r.hget(`ma:wish:${userId}`, String(typeId));
    if (!cur) return false;
    const parsed = JSON.parse(cur);
    await r.hset(`ma:wish:${userId}`, String(typeId), JSON.stringify({ ...parsed, note }));
    return true;
  }, false);
}
export async function wishRemove(userId: number, typeId: number) {
  await safe((r) => r.hdel(`ma:wish:${userId}`, String(typeId)), 0);
}
