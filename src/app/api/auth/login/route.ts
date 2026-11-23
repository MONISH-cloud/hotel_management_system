import { z } from 'zod';
import { route, parseBody, ApiError, clientIp } from '@/lib/api';
import { one, query } from '@/lib/db';
import { startSession, verifyPassword } from '@/lib/auth';
import { rateLimit, resetRateLimit } from '@/lib/cache';
import { isStaff, type Role } from '@/lib/format';

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Enter your password'),
  }));

  // Redis-backed brute-force protection: 8 attempts / 10 min per IP+email
  const bucketId = `${clientIp(req)}:${email}`;
  const rl = await rateLimit('login', bucketId, 8, 600);
  if (!rl.allowed) throw new ApiError(429, `Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} minute(s).`);

  const u = await one(
    `SELECT u.user_id, u.password_hash, u.full_name, u.email, u.is_active, r.role_name, g.guest_id
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN guests g ON g.user_id = u.user_id
      WHERE u.email = ?`, [email]);

  if (!u || !(await verifyPassword(password, u.password_hash))) throw new ApiError(401, 'Incorrect email or password.');
  if (!u.is_active) throw new ApiError(403, 'This account has been deactivated. Please contact the hotel.');

  await query('UPDATE users SET last_login_at = NOW() WHERE user_id = ?', [u.user_id]);
  await resetRateLimit('login', bucketId);

  await startSession({ userId: u.user_id, role: u.role_name as Role, name: u.full_name, email: u.email, guestId: u.guest_id ?? null });
  return { user: { name: u.full_name, role: u.role_name }, redirect: isStaff(u.role_name) ? '/dashboard' : '/account' };
});
