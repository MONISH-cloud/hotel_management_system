import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requireSession, hasPerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { pushFeed } from '@/lib/cache';
import { getReservation } from '@/lib/hotel';
import { paymentMethod } from '@/lib/schemas';
import { money } from '@/lib/format';
import { sendMail } from '@/lib/mailer';
import { paymentEmail } from '@/lib/emails';
import { loadAuthorised } from '@/lib/access';

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const s = await requireSession();
  const b = await parseBody(req, z.object({ amount: z.coerce.number().positive('Enter an amount'), method: paymentMethod }));
  const { r } = await loadAuthorised(s, (await params).id);

  const staffOk = await hasPerm(s, 'payments.record');
  const ownOk = r.guest_id === s.guestId && (await hasPerm(s, 'booking.own'));
  if (!staffOk && !ownOk) throw new ApiError(403, "You can't record payments on this reservation.");

  const reference = await withConn(s.userId, async (c) => {
    await c.query('CALL sp_record_payment(?,?,?,@ref)', [r.reservation_id, b.amount, b.method]);
    const [rows] = await c.query('SELECT @ref AS ref');
    return (rows as { ref: string }[])[0].ref;
  });

  await pushFeed('Payment received', `${money(b.amount)} via ${b.method.toUpperCase()} · ${r.guest_name}`);
  const updated = (await getReservation(r.reservation_id))!;
  const m = await paymentEmail(updated, b.amount, reference, updated.status, updated.balance_due);
  await sendMail(updated.guest_email, m.subject, m.text);
  return { reference, reservation: updated };
});
