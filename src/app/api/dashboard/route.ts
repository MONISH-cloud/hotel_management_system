import { route } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { dashboardStats, occupancySeries, revenueSeries, roomStatusCounts, revenueByType } from '@/lib/hotel';
import { getFeed } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePerm('dashboard.view');
  const [stats, occupancy, revenue, rooms, byType, feed] = await Promise.all([
    dashboardStats(), occupancySeries(), revenueSeries(6), roomStatusCounts(), revenueByType(), getFeed(12),
  ]);
  return { stats, occupancy, revenue, rooms, byType, feed };
});
