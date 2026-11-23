import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn, one } from '@/lib/db';
import { bumpAvailability, pushFeed } from '@/lib/cache';
import { requirePerm as requireInventory } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requirePerm('rooms.manage');
  const id = Number((await params).id);
  const { status } = await parseBody(req, z.object({ status: z.enum(['available', 'cleaning', 'maintenance']) }));
  const room = await one<{ status: string; room_number: string }>('SELECT status, room_number FROM rooms WHERE room_id = ?', [id]);
  if (!room) throw new ApiError(404, 'Room not found');
  if (room.status === 'occupied') throw new ApiError(400, 'This room is occupied. Check the guest out first.');
  await withConn(s.userId, (c) => c.query('UPDATE rooms SET status = ? WHERE room_id = ?', [status, id]));
  await bumpAvailability();
  await pushFeed('Room status', `Room ${room.room_number} set to ${status}`);
  return { ok: true };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const s = await requireInventory('inventory.manage');
  const id = Number((await params).id);
  const room = await one<{ room_number: string }>('SELECT room_number FROM rooms WHERE room_id = ?', [id]);
  if (!room) throw new ApiError(404, 'Room not found');
  try {
    await withConn(s.userId, async (c) => {
      await c.query('DELETE FROM rooms WHERE room_id = ?', [id]); // FK RESTRICT: fails if it has reservations
      await c.query(`INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details) VALUES (?, 'room.deleted', 'room', ?, ?)`, [s.userId, id, JSON.stringify({ room: room.room_number })]);
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_ROW_IS_REFERENCED_2') throw new ApiError(409, 'This room has reservations or housekeeping history, so it cannot be deleted. Mark it as maintenance instead.');
    throw e;
  }
  await bumpAvailability();
  return { ok: true };
});
