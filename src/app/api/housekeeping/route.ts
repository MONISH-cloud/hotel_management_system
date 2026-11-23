import { z } from 'zod';
import { route, parseBody } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { listTasks } from '@/lib/hotel';

export const GET = route(async () => {
  await requirePerm('housekeeping.manage');
  return { tasks: await listTasks() };
});

export const POST = route(async (req) => {
  const s = await requirePerm('housekeeping.manage');
  const b = await parseBody(req, z.object({
    roomId: z.coerce.number().int().positive(),
    taskType: z.enum(['checkout_clean', 'turndown', 'deep_clean', 'maintenance']),
    employeeId: z.coerce.number().int().positive().optional(),
  }));
  await withConn(s.userId, (c) => c.query('INSERT INTO housekeeping_tasks (room_id, employee_id, task_type) VALUES (?,?,?)', [b.roomId, b.employeeId ?? null, b.taskType]));
  return Response.json({ tasks: await listTasks() }, { status: 201 });
});
