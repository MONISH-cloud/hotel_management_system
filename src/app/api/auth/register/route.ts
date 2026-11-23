import { z } from 'zod';
import { route, parseBody, ApiError, clientIp } from '@/lib/api';
import { pool } from '@/lib/db';
import { hashPassword, startSession } from '@/lib/auth';
import { rateLimit } from '@/lib/cache';
import { passwordRule } from '@/lib/schemas';
import { syncGuest } from '@/lib/graph';
import { pushFeed } from '@/lib/cache';
import { getSettings } from '@/lib/settings';
import { createToken } from '@/lib/tokens';
import { sendMail } from '@/lib/mailer';
import { verifyEmail } from '@/lib/emails';

export const POST = route(async (req) => {
  const b = await parseBody(req, z.object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(100),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    phone: z.string().trim().max(20).optional().or(z.literal('')),
    country: z.string().trim().max(60).optional().or(z.literal('')),
    password: passwordRule,
  }));

  const rl = await rateLimit('register', clientIp(req), 10, 3600);
  if (!rl.allowed) throw new ApiError(429, 'Too many sign-ups from this network. Please try again later.');

  const hash = await hashPassword(b.password);
  const conn = await pool.getConnection();
  let userId: number, guestId: number;
  try {
    await conn.beginTransaction();
    const [dup] = await conn.query('SELECT user_id FROM users WHERE email = ?', [b.email]);
    if ((dup as unknown[]).length) throw new ApiError(409, 'An account with this email already exists. Try signing in.');

    const [ins] = await conn.query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone)
       VALUES ((SELECT role_id FROM roles WHERE role_name = 'guest'), ?, ?, ?, ?)`,
      [b.email, hash, b.fullName, b.phone || null]);
    userId = (ins as { insertId: number }).insertId;

    // a walk-in guest profile may already exist for this email: link it, otherwise create one
    const [existing] = await conn.query('SELECT guest_id, user_id FROM guests WHERE email = ?', [b.email]);
    const ex = (existing as { guest_id: number; user_id: number | null }[])[0];
    if (ex && ex.user_id === null) {
      await conn.query('UPDATE guests SET user_id = ?, full_name = ? WHERE guest_id = ?', [userId, b.fullName, ex.guest_id]);
      guestId = ex.guest_id;
    } else {
      const [g] = await conn.query(
        'INSERT INTO guests (user_id, full_name, email, phone, country) VALUES (?, ?, ?, ?, ?)',
        [userId, b.fullName, b.email, b.phone || null, b.country || 'India']);
      guestId = (g as { insertId: number }).insertId;
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  await syncGuest({ id: guestId, name: b.fullName, country: b.country || 'India', tier: 'Silver' });
  await pushFeed('New guest account', `${b.fullName} just joined ${(await getSettings()).hotel_name}`);
  const origin = process.env.APP_URL ?? new URL(req.url).origin;
  const mail = await verifyEmail(b.fullName, `${origin}/verify-email?token=${await createToken(userId, 'email_verify', 60 * 24)}`);
  await sendMail(b.email, mail.subject, mail.text);
  await startSession({ userId, role: 'guest', name: b.fullName, email: b.email, guestId });
  return { user: { name: b.fullName, role: 'guest' }, redirect: '/account' };
});
