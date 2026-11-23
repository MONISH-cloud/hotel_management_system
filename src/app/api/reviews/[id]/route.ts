import { z } from 'zod';
import { route, ApiError } from '@/lib/api';
import { requireSession, hasPerm } from '@/lib/auth';
import { getReview, updateReview, replyToReview, deleteReview } from '@/lib/graph';
import { reviewBody } from '@/lib/schemas';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const r = await getReview((await params).id);
  if (!r) throw new ApiError(404, 'Review not found');
  return { review: r };
});

/** Guests edit their own review; moderators post (or clear) the management reply. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requireSession();
  const id = (await params).id;
  const raw = await req.json().catch(() => null);
  if (raw && typeof raw === 'object' && 'reply' in raw) {
    if (!(await hasPerm(s, 'reviews.moderate'))) throw new ApiError(403, "Your role can't reply to reviews.");
    const { reply } = z.object({ reply: z.string().trim().max(800) }).parse(raw);
    const r = await replyToReview(id, reply);
    if (!r) throw new ApiError(404, 'Review not found');
    return { review: r };
  }
  if (!(await hasPerm(s, 'reviews.write')) || !s.guestId) throw new ApiError(403, 'Only the author can edit a review.');
  const parsed = reviewBody.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, parsed.error.issues[0].message);
  const r = await updateReview(id, s.guestId, parsed.data);
  if (!r) throw new ApiError(404, 'Review not found, or it is not yours to edit.');
  return { review: r };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const s = await requireSession();
  const id = (await params).id;
  const moderator = await hasPerm(s, 'reviews.moderate');
  if (!moderator && !s.guestId) throw new ApiError(403, "You can't delete this review.");
  const ok = await deleteReview(id, moderator ? null : s.guestId);
  if (!ok) throw new ApiError(404, 'Review not found, or it is not yours to delete.');
  return { ok: true };
});
