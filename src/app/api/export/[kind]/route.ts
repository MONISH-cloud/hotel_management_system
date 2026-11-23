import { route, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/csv';
import { listReservations, listGuests, listAudit, type Reservation } from '@/lib/hotel';

type Ctx = { params: Promise<{ kind: string }> };

/** CSV downloads for reservations, guests and the audit log (each needs its own permission). */
export const GET = route<Ctx>(async (req, { params }) => {
  const kind = (await params).kind;
  const sp = req.nextUrl.searchParams;
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === 'reservations') {
    await requirePerm('reservations.view_all');
    const rows = await listReservations({ status: sp.get('status') ?? undefined, q: sp.get('q') ?? undefined, view: (sp.get('view') as 'arrivals') ?? undefined, limit: 5000 });
    const cols: (keyof Reservation)[] = ['reservation_code', 'status', 'source', 'guest_name', 'guest_email', 'room_type', 'room_number', 'check_in', 'check_out', 'nights', 'adults', 'children', 'nightly_rate', 'tax_amount', 'total_amount', 'services_total', 'balance_due', 'group_code', 'created_at'];
    return csvResponse(`reservations-${stamp}.csv`, toCsv(rows as unknown as Record<string, unknown>[], cols as string[]));
  }
  if (kind === 'guests') {
    await requirePerm('guests.view');
    return csvResponse(`guests-${stamp}.csv`, toCsv(await listGuests(sp.get('q') ?? '', 5000, 0), ['guest_id', 'full_name', 'email', 'country', 'loyalty_tier', 'loyalty_points', 'stays', 'room_spend', 'last_stay']));
  }
  if (kind === 'audit') {
    await requirePerm('audit.view');
    return csvResponse(`audit-log-${stamp}.csv`, toCsv(await listAudit(5000, 0), ['log_id', 'created_at', 'action', 'entity', 'entity_id', 'actor', 'details']));
  }
  throw new ApiError(404, 'Unknown export');
});
