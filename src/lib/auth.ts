import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { query, one } from './db';
import { safe } from './cache';
import { ApiError } from './api';
import { isStaff, type Role } from './format';
import { requireEnv } from './env';

export const COOKIE = 'ma_session';
const TTL_SEC = 60 * 60 * 24 * 7;

const secret = () => new TextEncoder().encode(requireEnv('JWT_SECRET', 32));

export type Session = {
  userId: number;
  role: Role;
  name: string;
  email: string;
  guestId: number | null;
  jti: string;
};

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

/** Issues a signed JWT, registers it in Redis (so it can be revoked) and sets the cookie. */
export async function startSession(user: { userId: number; role: Role; name: string; email: string; guestId: number | null }) {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ role: user.role, name: user.name, email: user.email, gid: user.guestId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.userId))
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secret());

  await safe((r) => r.set(`ma:sess:${jti}`, String(user.userId), 'EX', TTL_SEC), null);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SEC,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      if (payload.jti) await safe((r) => r.del(`ma:sess:${payload.jti}`), 0);
    } catch { /* token already invalid */ }
  }
  jar.delete(COOKIE);
}

/** Current session (deduplicated per request). Verifies the JWT AND that it was not revoked in Redis. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const jti = String(payload.jti);
    // Redis registry: if Redis is up and the key is gone, the session was revoked (logout).
    const state = await safe(async (r) => ((await r.exists(`ma:sess:${jti}`)) ? 'live' : 'revoked'), 'unknown');
    if (state === 'revoked') return null;
    return {
      userId: Number(payload.sub),
      role: payload.role as Role,
      name: String(payload.name),
      email: String(payload.email),
      guestId: payload.gid != null ? Number(payload.gid) : null,
      jti,
    };
  } catch {
    return null;
  }
});

/** Deletes every live session of a user (role change, deactivation, password reset). */
export async function revokeUserSessions(userId: number) {
  await safe(async (r) => {
    const keys = await r.keys('ma:sess:*');
    for (const k of keys) if ((await r.get(k)) === String(userId)) await r.del(k);
    return 1;
  }, 0);
}

/* ───────────── RBAC: permissions live in MySQL, cached in Redis ───────────── */

export async function permissionsFor(role: string): Promise<Set<string>> {
  const key = `ma:perms:${role}`;
  const hit = await safe((r) => r.smembers(key), [] as string[]);
  if (hit.length) return new Set(hit);
  const rows = await query<{ code: string }>(
    `SELECT p.code
       FROM roles r
       JOIN role_permissions rp ON rp.role_id = r.role_id
       JOIN permissions p       ON p.permission_id = rp.permission_id
      WHERE r.role_name = ?`,
    [role],
  );
  const codes = rows.map((r) => r.code);
  if (codes.length)
    await safe(async (r) => { await r.sadd(key, ...codes); await r.expire(key, 300); return 1; }, 0);
  return new Set(codes);
}

export async function can(session: Session | null, code: string) {
  if (!session) return false;
  return (await permissionsFor(session.role)).has(code);
}

/** Double-checks against the database function fn_has_permission (used for destructive actions). */
export async function canInDb(session: Session, code: string) {
  const row = await one<{ ok: number }>('SELECT fn_has_permission(?, ?) AS ok', [session.userId, code]);
  return row?.ok === 1;
}

/* ───────────── guards for route handlers ───────────── */

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new ApiError(401, 'Please sign in to continue.');
  return s;
}

export async function requirePerm(code: string): Promise<Session> {
  const s = await requireSession();
  if (!(await permissionsFor(s.role)).has(code)) throw new ApiError(403, "Your role doesn't have permission to do that.");
  return s;
}

/** Staff with `staffCode` OR a guest holding `guestCode` on their own data. */
export async function hasPerm(s: Session, code: string) {
  return (await permissionsFor(s.role)).has(code);
}

/* ───────────── guards for server-rendered pages ───────────── */

export async function pageGuard(code?: string, next = '/dashboard'): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isStaff(s.role)) redirect('/account');
  if (code && !(await permissionsFor(s.role)).has(code)) redirect('/dashboard?denied=1');
  return s;
}

export async function guestGuard(next = '/account'): Promise<Session> {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s;
}
