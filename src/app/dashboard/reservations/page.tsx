import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { ReservationsManager } from '@/components/ReservationsManager';
import { pageGuard, hasPerm } from '@/lib/auth';
import { listReservations, listRoomTypes, reservationCounts, countReservations } from '@/lib/hotel';

export const metadata: Metadata = { title: 'Reservations' };
export const dynamic = 'force-dynamic';
const PAGE = 20;

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; q?: string; page?: string }> }) {
  const s = await pageGuard('reservations.view_all', '/dashboard/reservations');
  const sp = await searchParams;
  const view = (['arrivals', 'departures', 'inhouse', 'upcoming'].includes(sp.view ?? '') ? sp.view : 'all') as 'all';
  const page = Math.max(Number(sp.page ?? 1) || 1, 1);
  const filter = { view, status: sp.status, q: sp.q };
  const [rows, total, types, counts, manage, pay, book] = await Promise.all([
    listReservations({ ...filter, limit: PAGE, offset: (page - 1) * PAGE }), countReservations(filter), listRoomTypes(), reservationCounts(),
    hasPerm(s, 'reservations.manage'), hasPerm(s, 'payments.record'), hasPerm(s, 'reservations.book_for_guest'),
  ]);
  return (
    <>
      <PageHeader eyebrow="Front desk" title={<>Reservations</>} subtitle="Create bookings, confirm, check guests in and out, and take payments. Each action runs a stored procedure; triggers keep rooms, housekeeping and the audit log in sync." />
      <ReservationsManager rows={rows} counts={counts} types={types.map((t) => ({ type_id: t.type_id, name: t.name, base_price: t.base_price, max_adults: t.max_adults, max_children: t.max_children }))}
        view={view} status={sp.status ?? 'all'} q={sp.q ?? ''} page={page} pageSize={PAGE} total={total} canManage={manage} canPay={pay} canBook={book} />
    </>
  );
}
