import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requireSession, hasPerm } from '@/lib/auth';
import { withConn, one } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requireSession();
  const id = Number((await params).id);
  const { status } = await parseBody(req, z.object({ status: z.enum(['requested', 'confirmed', 'delivered', 'cancelled']) }));

  const order = await one<{ status: string; guest_id: number }>(
    `SELECT so.status, r.guest_id FROM service_orders so JOIN reservations r ON r.reservation_id = so.reservation_id WHERE so.order_id = ?`, [id]);
  if (!order) throw new ApiError(404, 'Order not found');

  const staffOk = await hasPerm(s, 'orders.manage');
  const guestCancel = order.guest_id === s.guestId && status === 'cancelled' && order.status === 'requested';
  if (!staffOk && !guestCancel) throw new ApiError(403, "You can't change this order.");

  await withConn(s.userId, (c) => c.query('UPDATE service_orders SET status = ? WHERE order_id = ?', [status, id]));
  return { ok: true };
});
