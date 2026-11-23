import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requireSession, hasPerm } from '@/lib/auth';
import { loadAuthorised } from '@/lib/access';
import { withConn, one } from '@/lib/db';
import { bumpAvailability, pushFeed } from '@/lib/cache';
import { getReservation, type Reservation } from '@/lib/hotel';
import { syncStay, syncGuest } from '@/lib/graph';
import { money } from '@/lib/format';
import { sendMail } from '@/lib/mailer';
import { cancelEmail, modifiedEmail } from '@/lib/emails';
import { dateStr } from '@/lib/schemas';
import { getSettings } from '@/lib/settings';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const s = await requireSession();
  const { r } = await loadAuthorised(s, (await params).id);
  return { reservation: r };
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requireSession();
  const body = await parseBody(req, z.object({
    action: z.enum(['check_in', 'check_out', 'cancel', 'confirm', 'no_show', 'modify']),
    checkIn: dateStr.optional(), checkOut: dateStr.optional(),
    typeId: z.coerce.number().int().positive().optional(), roomId: z.coerce.number().int().positive().optional(),
  }));
  const { action } = body;
  const { r } = await loadAuthorised(s, (await params).id);
  const manage = await hasPerm(s, 'reservations.manage');

  if (action === 'cancel' || action === 'modify') {
    const own = r.guest_id === s.guestId && (await hasPerm(s, 'booking.own'));
    if (!manage && !own) throw new ApiError(403, `You can't ${action} this reservation.`);
    if (action === 'modify' && body.roomId && !manage) throw new ApiError(403, 'Only staff can choose a specific room.');
  } else if (!manage) {
    throw new ApiError(403, "Your role doesn't have permission to do that.");
  }

  let message = '';
  const cfg = await getSettings();
  await withConn(s.userId, async (c) => {
    switch (action) {
      case 'check_in':
        await c.query('CALL sp_check_in(?)', [r.reservation_id]);
        message = `${r.guest_name} checked in to room ${r.room_number}`;
        break;
      case 'check_out':
        await c.query('CALL sp_check_out(?)', [r.reservation_id]);
        message = `${r.guest_name} checked out of room ${r.room_number}`;
        break;
      case 'cancel': {
        await c.query('CALL sp_cancel_reservation(?, @refund)', [r.reservation_id]);
        const [rows] = await c.query('SELECT @refund AS refund');
        const refund = Number((rows as { refund: number }[])[0].refund);
        message = refund > 0 ? `Reservation cancelled. ${money(refund)} refunded.` : `Reservation cancelled. Inside the ${cfg.free_cancel_hours}-hour window, so no refund applies.`;
        break;
      }
      case 'modify': {
        if (!body.checkIn || !body.checkOut) throw new ApiError(422, 'Choose the new check-in and check-out dates.');
        await c.query('CALL sp_modify_reservation(?,?,?,?,?,@total,@refund)', [r.reservation_id, body.checkIn, body.checkOut, body.typeId ?? null, body.roomId ?? null]);
        const [rows] = await c.query('SELECT @total AS total, @refund AS refund');
        const x = (rows as { total: number; refund: number }[])[0];
        message = `Reservation updated. New total ${money(Number(x.total))}.${Number(x.refund) > 0 ? ` ${money(Number(x.refund))} refunded.` : ''}`;
        break;
      }
      case 'confirm':
        if (r.status !== 'pending') throw new ApiError(400, 'Only pending reservations can be confirmed.');
        await c.query("UPDATE reservations SET status = 'confirmed' WHERE reservation_id = ?", [r.reservation_id]);
        message = 'Reservation confirmed';
        break;
      case 'no_show':
        if (!['pending', 'confirmed'].includes(r.status)) throw new ApiError(400, 'Only upcoming reservations can be marked no-show.');
        await c.query("UPDATE reservations SET status = 'no_show' WHERE reservation_id = ?", [r.reservation_id]);
        message = 'Marked as no-show';
        break;
    }
  });

  // side effects: Redis cache + live feed + Neo4j graph
  await bumpAvailability();
  const titles = { check_in: 'Guest check-in', check_out: 'Guest check-out', cancel: 'Cancellation', confirm: 'Reservation confirmed', no_show: 'No-show', modify: 'Booking changed' };
  await pushFeed(titles[action], `${r.guest_name} · ${r.room_type} ${r.room_number}`);

  if (action === 'check_in') {
    await syncStay({ guestId: r.guest_id, typeId: r.type_id, reservationId: r.reservation_id, checkIn: r.check_in, nights: r.nights });
  }
  if (action === 'check_out') {
    const g = await one<{ full_name: string; country: string; loyalty_tier: string }>('SELECT full_name, country, loyalty_tier FROM guests WHERE guest_id = ?', [r.guest_id]);
    if (g) await syncGuest({ id: r.guest_id, name: g.full_name, country: g.country, tier: g.loyalty_tier });
  }

  const updated = (await getReservation(r.reservation_id)) as Reservation;
  if (action === 'cancel') { const m = await cancelEmail(updated, message); await sendMail(updated.guest_email, m.subject, m.text); }
  if (action === 'modify') { const m = await modifiedEmail(updated); await sendMail(updated.guest_email, m.subject, m.text); }
  return { message, reservation: updated };
});
