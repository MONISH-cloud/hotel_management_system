import { route } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { listAudit } from '@/lib/hotel';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  await requirePerm('audit.view');
  return { entries: await listAudit(Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 80), 300)) };
});
