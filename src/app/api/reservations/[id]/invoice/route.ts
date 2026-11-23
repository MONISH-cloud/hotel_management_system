import { route, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { loadAuthorised } from '@/lib/access';
import { buildInvoice } from '@/lib/invoice';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const s = await requireSession();
  const { r } = await loadAuthorised(s, (await params).id);
  const out = await buildInvoice(r.reservation_id);
  if (!out) throw new ApiError(404, 'Reservation not found');
  return new Response(Buffer.from(out.bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${out.filename}"`, 'Cache-Control': 'no-store' },
  });
});
