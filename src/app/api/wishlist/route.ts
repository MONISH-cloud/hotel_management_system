import { z } from 'zod';
import { route, parseBody } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { wishList, wishAdd, wishUpdate, wishRemove } from '@/lib/cache';
import { listRoomTypes } from '@/lib/hotel';

const body = z.object({ typeId: z.coerce.number().int().positive(), note: z.string().trim().max(160).default('') });

async function view(userId: number) {
  const [entries, types] = await Promise.all([wishList(userId), listRoomTypes()]);
  return entries.map((e) => ({ ...e, room: types.find((t) => t.type_id === e.typeId) })).filter((e) => e.room);
}

// Redis hash ma:wish:{userId}  ->  Read / Create / Update / Delete
export const GET = route(async () => ({ wishlist: await view((await requireSession()).userId) }));

export const POST = route(async (req) => {
  const s = await requireSession();
  const b = await parseBody(req, body);
  await wishAdd(s.userId, b.typeId, b.note);
  return { wishlist: await view(s.userId) };
});

export const PATCH = route(async (req) => {
  const s = await requireSession();
  const b = await parseBody(req, body);
  await wishUpdate(s.userId, b.typeId, b.note);
  return { wishlist: await view(s.userId) };
});

export const DELETE = route(async (req) => {
  const s = await requireSession();
  const typeId = Number(req.nextUrl.searchParams.get('typeId'));
  if (typeId) await wishRemove(s.userId, typeId);
  return { wishlist: await view(s.userId) };
});
