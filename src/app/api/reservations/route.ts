import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requireSession, hasPerm } from '@/lib/auth';
import { withConn, one } from '@/lib/db';
import { bumpAvailability, pushFeed } from '@/lib/cache';
import { listReservations, getReservation, countReservations } from '@/lib/hotel';
import { getSettings } from '@/lib/settings';
import { sendMail } from '@/lib/mailer';
import { bookingEmail } from '@/lib/emails';
import { dateStr } from '@/lib/schemas';
import { syncGuest } from '@/lib/graph';
import { fmtDateShort } from '@/lib/format';

export const GET = route(async (req) => {
  const s = await requireSession();
  const sp = req.nextUrl.searchParams;
  const seeAll = await hasPerm(s, 'reservations.view_all');
  if (!seeAll && !s.guestId) throw new ApiError(403, 'No guest profile is linked to this account.');
  const filter = {
    guestId: seeAll ? undefined : s.guestId!,
    status: sp.get('status') ?? undefined,
    q: sp.get('q') ?? undefined,
    view: (sp.get('view') as 'arrivals') ?? undefined,
  };
  const limit = Math.min(Number(sp.get('limit') ?? 25), 200);
  const page = Math.max(Number(sp.get('page') ?? 1), 1);
  const [rows, total] = await Promise.all([listReservations({ ...filter, limit, offset: (page - 1) * limit }), countReservations(filter)]);
  return { reservations: rows, total, page, pages: Math.max(Math.ceil(total / limit), 1) };
});

const createSchema = z.object({
  typeId: z.coerce.number().int().positive(),
  checkIn: dateStr,
  checkOut: dateStr,
  adults: z.coerce.number().int().min(1).max(8),
  children: z.coerce.number().int().min(0).max(6).default(0),
  rooms: z.coerce.number().int().min(1).max(10).default(1),
  requests: z.string().trim().max(500).optional(),
  // staff only: book on behalf of a guest (existing id) or a brand-new walk-in
  guestId: z.coerce.number().int().positive().optional(),
  newGuest: z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().max(20).optional(),
    country: z.string().trim().max(60).optional(),
  }).optional(),
});

export const POST = route(async (req) => {
  const s = await requireSession();
  const b = await parseBody(req, createSchema);

  let guestId: number;
  if (b.guestId || b.newGuest) {
    if (!(await hasPerm(s, 'reservations.book_for_guest'))) throw new ApiError(403, "Your role can't book on behalf of a guest.");
    if (b.guestId) guestId = b.guestId;
    else {
      const g = b.newGuest!;
      const existing = await one<{ guest_id: number }>('SELECT guest_id FROM guests WHERE email = ?', [g.email]);
      if (existing) guestId = existing.guest_id;
      else {
        const res = await withConn(s.userId, async (c) => {
          const [r] = await c.query('INSERT INTO guests (full_name, email, phone, country) VALUES (?,?,?,?)',
            [g.fullName, g.email, g.phone || null, g.country || 'India']);
          return (r as { insertId: number }).insertId;
        });
        guestId = res;
        await syncGuest({ id: guestId, name: g.fullName, country: g.country || 'India', tier: 'Silver' });
      }
    }
  } else {
    if (!(await hasPerm(s, 'booking.own')) || !s.guestId) throw new ApiError(403, 'Only guests can book for themselves.');
    guestId = s.guestId;
    const cfg = await getSettings();
    if (cfg.require_verified_email) {
      const v = await one<{ ok: number }>('SELECT email_verified_at IS NOT NULL AS ok FROM users WHERE user_id = ?', [s.userId]);
      if (!v?.ok) throw new ApiError(403, 'Please verify your email address before booking. Check your inbox for the link.');
    }
  }

  // one transaction: either every requested room is booked, or none is
  const { id, group } = await withConn(s.userId, async (c) => {
    await c.query('CALL sp_create_booking(?,?,?,?,?,?,?,?,?,@grp,@rid)', [
      guestId, b.typeId, b.checkIn, b.checkOut, b.adults, b.children, b.requests || null, s.userId, b.rooms,
    ]);
    const [rows] = await c.query('SELECT @rid AS id, @grp AS grp');
    const r = (rows as { id: number; grp: string | null }[])[0];
    return { id: Number(r.id), group: r.grp };
  });

  await bumpAvailability();
  const reservations = group ? await listReservations({ groupCode: group, limit: 20 }) : [await getReservation(id)].filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getReservation>>>[];
  const reservation = reservations.find((r) => r.reservation_id === id) ?? reservations[0];
  const total = reservations.reduce((a, r) => a + r.total_amount, 0);
  await pushFeed('New reservation', `${reservation.guest_name} booked ${b.rooms > 1 ? `${b.rooms} × ` : 'the '}${reservation.room_type} · ${fmtDateShort(b.checkIn)}–${fmtDateShort(b.checkOut)}`);
  const mail = await bookingEmail({ ...reservation, total_amount: total }, b.rooms > 1 ? `\n\nThis booking covers ${b.rooms} rooms: ${reservations.map((r) => r.room_number).join(', ')}.` : '');
  await sendMail(reservation.guest_email, mail.subject, mail.text);
  return Response.json({ reservation, reservations }, { status: 201 });
});
