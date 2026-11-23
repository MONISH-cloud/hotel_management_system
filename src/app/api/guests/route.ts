import { route } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { listGuests } from '@/lib/hotel';

export const GET = route(async (req) => {
  await requirePerm('guests.view');
  return { guests: await listGuests(req.nextUrl.searchParams.get('q') ?? '') };
});
