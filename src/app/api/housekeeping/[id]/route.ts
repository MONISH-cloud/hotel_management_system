import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { bumpAvailability, pushFeed } from '@/lib/cache';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requirePerm('housekeeping.manage');
  const id = Number((await params).id);
  const b = await parseBody(req, z.object({
    status: z.enum(['pending', 'in_progress', 'done']).optional(),
    employeeId: z.coerce.number().int().positive().nullable().optional(),
  }));
  if (b.status === undefined && b.employeeId === undefined) throw new ApiError(400, 'Nothing to update');
  await withConn(s.userId, async (c) => {
    if (b.employeeId !== undefined) await c.query('UPDATE housekeeping_tasks SET employee_id = ? WHERE task_id = ?', [b.employeeId, id]);
    if (b.status) await c.query('UPDATE housekeeping_tasks SET status = ?, completed_at = IF(? = \'done\', NOW(), NULL) WHERE task_id = ?', [b.status, b.status, id]);
  });
  if (b.status === 'done') { await bumpAvailability(); await pushFeed('Housekeeping', `Task #${id} completed. The room is back in service`); }
  return { ok: true };
});
