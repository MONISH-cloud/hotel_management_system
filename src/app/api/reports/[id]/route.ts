import { route, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { runReport } from '@/lib/hotel';
import { csvResponse, toCsv } from '@/lib/csv';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  await requirePerm('reports.view');
  const out = await runReport((await params).id);
  if (!out) throw new ApiError(404, 'Unknown report');
  if (req.nextUrl.searchParams.get('format') === 'csv') return csvResponse(`${out.report.id}-${out.report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, toCsv(out.rows));
  return out;
});
