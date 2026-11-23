import 'server-only';
import { ApiError } from './api';
import { hasPerm, type Session } from './auth';
import { getReservation } from './hotel';

/** Guests only touch their own reservations; staff need the view_all permission. */
export async function loadAuthorised(s: Session, idStr: string) {
  const id = Number(idStr);
  if (!Number.isInteger(id)) throw new ApiError(404, 'Reservation not found');
  const r = await getReservation(id);
  if (!r) throw new ApiError(404, 'Reservation not found');
  const seeAll = await hasPerm(s, 'reservations.view_all');
  if (!seeAll && r.guest_id !== s.guestId) throw new ApiError(404, 'Reservation not found');
  return { r, seeAll };
}

