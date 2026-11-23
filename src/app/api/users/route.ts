import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm, hashPassword } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { passwordRule } from '@/lib/schemas';
import { listUsers } from '@/lib/hotel';

/** Admin: create a staff login (admin / manager / receptionist). Guests register themselves. */
export const POST = route(async (req) => {
  const s = await requirePerm('staff.manage');
  const b = await parseBody(req, z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    phone: z.string().trim().max(20).optional().or(z.literal('')),
    role: z.enum(['admin', 'manager', 'receptionist']),
    password: passwordRule,
  }));
  const hash = await hashPassword(b.password);
  await withConn(s.userId, async (c) => {
    const [dup] = await c.query('SELECT user_id FROM users WHERE email = ?', [b.email]);
    if ((dup as unknown[]).length) throw new ApiError(409, 'An account with this email already exists.');
    const [r] = await c.query(
      `INSERT INTO users (role_id, email, password_hash, full_name, phone, email_verified_at)
       VALUES ((SELECT role_id FROM roles WHERE role_name = ?), ?, ?, ?, ?, NOW())`,
      [b.role, b.email, hash, b.fullName, b.phone || null]);
    await c.query(`INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details) VALUES (?, 'user.created', 'user', ?, ?)`,
      [s.userId, (r as { insertId: number }).insertId, JSON.stringify({ email: b.email, role: b.role })]);
  });
  return Response.json({ users: await listUsers() }, { status: 201 });
});
