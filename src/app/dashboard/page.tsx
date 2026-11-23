import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn, LogOut, BedDouble, Gauge, Wallet, Receipt, TrendingUp, ShieldAlert } from 'lucide-react';
import { PageHeader, Kpi, Card } from '@/components/DashKit';
import { OccupancyChart, RevenueChart, RoomStatusChart, TypeRevenueChart } from '@/components/DashCharts';
import { LiveFeed } from '@/components/LiveFeed';
import { ReservationActions } from '@/components/ReservationActions';
import { Empty, StatusBadge } from '@/components/ui';
import { pageGuard, hasPerm } from '@/lib/auth';
import { dashboardStats, occupancySeries, revenueSeries, roomStatusCounts, revenueByType, listReservations } from '@/lib/hotel';
import { getFeed } from '@/lib/cache';
import { money, fmtDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function Overview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const s = await pageGuard('dashboard.view');
  const { denied } = await searchParams;
  const [stats, occupancy, revenue, rooms, byType, feed, arrivals, departures, canManage, canPay, canReports] = await Promise.all([
    dashboardStats(), occupancySeries(), revenueSeries(6), roomStatusCounts(), revenueByType(), getFeed(12),
    listReservations({ view: 'arrivals' }), listReservations({ view: 'departures' }),
    hasPerm(s, 'reservations.manage'), hasPerm(s, 'payments.record'), hasPerm(s, 'reports.view'),
  ]);
  const occ = stats.sellable_rooms ? Math.round((stats.occupied_rooms / stats.sellable_rooms) * 100) : 0;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      {denied && <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-bad/30 bg-bad/10 px-5 py-4 text-sm text-bad"><ShieldAlert className="size-5" />Your role doesn&apos;t include access to that area. Permissions are enforced from the database role tables.</div>}
      <PageHeader eyebrow={fmtDate(new Date().toISOString().slice(0, 10), { weekday: 'long', day: 'numeric', month: 'long' })} title={<>{greeting}, <span className="gold-text italic">{s.name.split(' ')[0]}</span></>}
        subtitle="Here is what is happening across the hotel right now." />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Kpi icon={LogIn} label="Arrivals today" value={stats.arrivals_today} sub={`${stats.pending_reservations} reservation${stats.pending_reservations !== 1 ? 's' : ''} awaiting confirmation`} tone="info" />
        <Kpi icon={LogOut} label="Departures today" value={stats.departures_today} sub="Guests due to check out" tone="warn" />
        <Kpi icon={BedDouble} label="In house" value={stats.in_house} sub={`${stats.occupied_rooms} of ${stats.sellable_rooms} sellable rooms`} tone="ok" />
        <Kpi icon={Gauge} label="Occupancy" value={`${occ}%`} sub={`${stats.total_rooms - stats.sellable_rooms} room(s) out of service`} />
        <Kpi icon={Wallet} label="Revenue · month" value={money(stats.revenue_mtd, true)} sub={`${money(stats.revenue_today)} collected today`} />
        <Kpi icon={Receipt} label="Outstanding" value={money(stats.outstanding_balance, true)} sub={`ADR ${money(stats.adr)} (60 days)`} tone="warn" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card title="Occupancy" subtitle="Past week and next two weeks · from stored procedure sp_occupancy_report (recursive CTE)"><OccupancyChart data={occupancy} /></Card>
        <Card title="Room status" subtitle="Live inventory"><RoomStatusChart data={rooms} /></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card title="Revenue" subtitle="Rooms + services · sp_revenue_by_month (CTEs)"><RevenueChart data={revenue} /></Card>
        <Card title="Revenue by room type" subtitle="Completed and in-house stays"><TypeRevenueChart data={byType} /></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr_1fr]">
        {[['Arrivals today', arrivals, 'No arrivals scheduled for today.'], ['Departures today', departures, 'No departures scheduled for today.']].map(([title, list, empty], idx) => (
          <Card key={String(title)} title={String(title)} subtitle={`${(list as unknown[]).length} guest${(list as unknown[]).length !== 1 ? 's' : ''}`} pad={false} className={idx === 0 ? 'xl:order-1' : 'xl:order-2'}>
            {(list as typeof arrivals).length === 0 ? <Empty title="All clear" hint={String(empty)} /> : (
              <ul className="divide-y divide-white/5">
                {(list as typeof arrivals).map((r) => (
                  <li key={r.reservation_id} className="flex flex-col gap-3 px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{r.guest_name}</p><p className="text-xs text-mist">{r.room_type} · Room {r.room_number} · {r.nights} nights</p></div>
                      <StatusBadge status={r.status} />
                    </div>
                    <ReservationActions r={r} canManage={canManage} canPay={canPay} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        <Card title="Live activity" subtitle="Redis stream" className="xl:order-3"><LiveFeed initial={feed} /></Card>
      </div>
      {canReports && <p className="mt-10 text-center text-sm text-mist">Looking for deeper analysis? Open the <Link href="/dashboard/reports" className="text-gold-300 underline-offset-4 hover:underline">SQL Reports</Link> to see nested, correlated and recursive queries run live.</p>}
      <TrendingUp className="hidden" />
    </>
  );
}
