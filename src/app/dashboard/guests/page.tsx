import type { Metadata } from 'next';
import { PageHeader, Card } from '@/components/DashKit';
import { SearchInput } from '@/components/SearchInput';
import { Badge, Empty } from '@/components/ui';
import { pageGuard } from '@/lib/auth';
import { listGuests, countGuests } from '@/lib/hotel';
import { Pagination } from '@/components/Pagination';
import { ExportButton } from '@/components/ExportButton';
import { fmtDate, money } from '@/lib/format';
import { Users } from 'lucide-react';

export const metadata: Metadata = { title: 'Guests' };
export const dynamic = 'force-dynamic';
const PAGE = 20;

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await pageGuard('guests.view', '/dashboard/guests');
  const { q = '', page: pageRaw } = await searchParams;
  const page = Math.max(Number(pageRaw ?? 1) || 1, 1);
  const [guests, total] = await Promise.all([listGuests(q, PAGE, (page - 1) * PAGE), countGuests(q)]);
  return (
    <>
      <PageHeader eyebrow="Relationships" title="Guests" subtitle="Lifetime value and loyalty, read from the v_guest_value view." actions={<><SearchInput initial={q} placeholder="Search name or email…" /><ExportButton href={`/api/export/guests?q=${encodeURIComponent(q)}`} /></>} />
      <Card pad={false}>
        {!guests.length ? <Empty icon={<Users className="size-6" />} title="No guests found" /> : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Guest</th><th>Country</th><th>Tier</th><th className="text-right">Points</th><th className="text-right">Stays</th><th className="text-right">Room spend</th><th>Last stay</th><th className="text-right">Upcoming</th></tr></thead>
            <tbody>{guests.map((g) => (
              <tr key={g.guest_id}>
                <td><p className="font-semibold">{g.full_name}</p><p className="text-xs text-mist">{g.email}</p></td><td className="text-ivory-dim">{g.country}</td>
                <td><Badge tone={g.loyalty_tier === 'Platinum' ? 'gold' : g.loyalty_tier === 'Gold' ? 'warn' : 'mute'}>{g.loyalty_tier}</Badge></td>
                <td className="text-right tabular-nums">{Number(g.loyalty_points).toLocaleString('en-IN')}</td><td className="text-right tabular-nums">{g.stays}</td>
                <td className="text-right font-semibold tabular-nums">{money(g.room_spend)}</td><td className="text-ivory-dim">{fmtDate(g.last_stay)}</td><td className="text-right tabular-nums">{g.upcoming || '—'}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      <Pagination page={page} pageSize={PAGE} total={total} />
    </>
  );
}
