import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { revokeUserSessions } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

/** Admin: activate / deactivate an account or change its role. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requirePerm('staff.manage');
  const id = Number((await params).id);
  if (id === s.userId) throw new ApiError(400, "You can't change your own account here.");
  const b = await parseBody(req, z.object({ isActive: z.boolean().optional(), role: z.enum(['admin', 'manager', 'receptionist', 'guest']).optional() }));
  await withConn(s.userId, async (c) => {
    if (b.isActive !== undefined) await c.query('UPDATE users SET is_active = ? WHERE user_id = ?', [b.isActive, id]);
    if (b.role) await c.query('UPDATE users SET role_id = (SELECT role_id FROM roles WHERE role_name = ?) WHERE user_id = ?', [b.role, id]);
    await c.query(`INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details) VALUES (?, 'user.updated', 'user', ?, ?)`,
      [s.userId, id, JSON.stringify(b)]);
  });
  // revoke that user's live sessions so a role/activation change applies immediately
  await revokeUserSessions(id);
  return { ok: true };
});
