import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requirePerm('services.manage');
  const id = Number((await params).id);
  const b = await parseBody(req, z.object({
    price: z.coerce.number().min(0).optional(),
    isActive: z.boolean().optional(),
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().min(3).max(255).optional(),
  }));
  const sets: string[] = [], vals: unknown[] = [];
  if (b.price !== undefined) { sets.push('price = ?'); vals.push(b.price); }
  if (b.isActive !== undefined) { sets.push('is_active = ?'); vals.push(b.isActive); }
  if (b.name) { sets.push('name = ?'); vals.push(b.name); }
  if (b.description) { sets.push('description = ?'); vals.push(b.description); }
  if (!sets.length) throw new ApiError(400, 'Nothing to update');
  await withConn(s.userId, (c) => c.query(`UPDATE services SET ${sets.join(', ')} WHERE service_id = ?`, [...vals, id]));
  return { ok: true };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const s = await requirePerm('services.manage');
  const id = Number((await params).id);
  try {
    const res = await withConn(s.userId, (c) => c.query('DELETE FROM services WHERE service_id = ?', [id]));
    if (!(res[0] as { affectedRows: number }).affectedRows) throw new ApiError(404, 'Service not found');
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_ROW_IS_REFERENCED_2')
      throw new ApiError(409, 'This service has been ordered before, so it cannot be deleted. Deactivate it instead.');
    throw e;
  }
  return { ok: true };
});
