import { route } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { getFeed } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePerm('dashboard.view');
  return { feed: await getFeed(14) };
});
