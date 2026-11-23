import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { query } from '@/lib/db';
import { hashPassword, revokeUserSessions } from '@/lib/auth';
import { consumeToken } from '@/lib/tokens';
import { passwordRule } from '@/lib/schemas';

export const POST = route(async (req) => {
  const { token, password } = await parseBody(req, z.object({ token: z.string().min(10), password: passwordRule }));
  const userId = await consumeToken(token, 'password_reset');
  if (!userId) throw new ApiError(400, 'This reset link is invalid or has expired. Request a new one.');
  await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [await hashPassword(password), userId]);
  await revokeUserSessions(userId); // everyone signed in with the old password is logged out
  return { ok: true };
});
