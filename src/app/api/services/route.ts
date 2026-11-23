import { z } from 'zod';
import { route, parseBody } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { query, withConn } from '@/lib/db';
import { listServices } from '@/lib/hotel';

export const GET = route(async () => ({ services: await listServices() }));

export const POST = route(async (req) => {
  const s = await requirePerm('services.manage');
  const b = await parseBody(req, z.object({
    name: z.string().trim().min(2).max(80),
    category: z.enum(['dining', 'spa', 'transport', 'laundry', 'experience']),
    description: z.string().trim().min(3).max(255),
    price: z.coerce.number().min(0),
  }));
  await withConn(s.userId, (c) => c.query('INSERT INTO services (name, category, description, price) VALUES (?,?,?,?)', [b.name, b.category, b.description, b.price]));
  return Response.json({ services: await query('SELECT * FROM services ORDER BY category, price') }, { status: 201 });
});
