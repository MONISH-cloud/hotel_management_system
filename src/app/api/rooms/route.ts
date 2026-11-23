import { z } from 'zod';
import { route, parseBody } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { listRooms } from '@/lib/hotel';
import { bumpAvailability } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePerm('rooms.manage');
  return { rooms: await listRooms() };
});

export const POST = route(async (req) => {
  const s = await requirePerm('inventory.manage');
  const b = await parseBody(req, z.object({
    typeId: z.coerce.number().int().positive(),
    roomNumber: z.string().trim().min(1).max(10),
    floorNo: z.coerce.number().int().min(1).max(60),
  }));
  await withConn(s.userId, async (c) => {
    const [r] = await c.query('INSERT INTO rooms (type_id, room_number, floor_no) VALUES (?,?,?)', [b.typeId, b.roomNumber, b.floorNo]);
    await c.query(`INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details) VALUES (?, 'room.created', 'room', ?, ?)`, [s.userId, (r as { insertId: number }).insertId, JSON.stringify({ room: b.roomNumber })]);
  });
  await bumpAvailability();
  return Response.json({ rooms: await listRooms() }, { status: 201 });
});
