import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requireSession, hasPerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { pushFeed } from '@/lib/cache';
import { getReservation } from '@/lib/hotel';
import { syncOrder } from '@/lib/graph';
import { loadAuthorised } from '@/lib/access';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const s = await requireSession();
  const b = await parseBody(req, z.object({
    serviceId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(20).default(1),
    notes: z.string().trim().max(255).optional(),
  }));
  const { r } = await loadAuthorised(s, (await params).id);

  const staffOk = await hasPerm(s, 'orders.manage');
  const ownOk = r.guest_id === s.guestId && (await hasPerm(s, 'booking.own'));
  if (!staffOk && !ownOk) throw new ApiError(403, "You can't order services on this reservation.");

  // unit_price is snapshotted by the trg_so_bi trigger; the same trigger rejects orders on cancelled/pending stays
  await withConn(s.userId, (c) =>
    c.query('INSERT INTO service_orders (reservation_id, service_id, quantity, notes) VALUES (?,?,?,?)', [
      r.reservation_id, b.serviceId, b.quantity, b.notes || null,
    ]));

  await syncOrder({ guestId: r.guest_id, serviceId: b.serviceId, quantity: b.quantity });
  await pushFeed('Service requested', `${r.guest_name} · room ${r.room_number}`);
  return Response.json({ reservation: await getReservation(r.reservation_id) }, { status: 201 });
});
