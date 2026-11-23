import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { query } from '@/lib/db';
import { consumeToken } from '@/lib/tokens';

export const POST = route(async (req) => {
  const { token } = await parseBody(req, z.object({ token: z.string().min(10) }));
  const userId = await consumeToken(token, 'email_verify');
  if (!userId) throw new ApiError(400, 'This verification link is invalid or has expired.');
  await query('UPDATE users SET email_verified_at = NOW() WHERE user_id = ? AND email_verified_at IS NULL', [userId]);
  return { ok: true };
});
