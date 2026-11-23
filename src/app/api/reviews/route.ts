import { route, parseBody, ApiError } from '@/lib/api';
import { z } from 'zod';
import { requirePerm } from '@/lib/auth';
import { one } from '@/lib/db';
import { listReviews, createReview } from '@/lib/graph';
import { reviewBody } from '@/lib/schemas';
import { pushFeed } from '@/lib/cache';

export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const reviews = await listReviews({
    typeId: sp.get('typeId') ? Number(sp.get('typeId')) : undefined,
    guestId: sp.get('guestId') ? Number(sp.get('guestId')) : undefined,
    limit: sp.get('limit') ? Math.min(Number(sp.get('limit')), 100) : 50,
  });
  return { reviews };
});

export const POST = route(async (req) => {
  const s = await requirePerm('reviews.write');
  if (!s.guestId) throw new ApiError(403, 'Only guests can write reviews.');
  const b = await parseBody(req, reviewBody.extend({ reservationId: z.coerce.number().int().positive() }));

  // Business rule enforced in MySQL: the stay must be the guest's own and completed
  const stay = await one<{ type_id: number; room_type: string }>(
    `SELECT type_id, room_type FROM v_reservation_details WHERE reservation_id = ? AND guest_id = ? AND status = 'checked_out'`,
    [b.reservationId, s.guestId]);
  if (!stay) throw new ApiError(400, 'You can review a stay once you have checked out of it.');

  try {
    const review = await createReview({ guestId: s.guestId, typeId: stay.type_id, reservationId: b.reservationId, rating: b.rating, title: b.title, body: b.body });
    await pushFeed('New review', `${s.name} rated the ${stay.room_type} ${b.rating}★`);
    return Response.json({ review }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code?.includes('ConstraintValidationFailed')) throw new ApiError(409, 'You have already reviewed this stay. You can edit your review instead.');
    throw e;
  }
});
