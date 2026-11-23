import { z } from 'zod';
import { route, parseBody, ApiError, clientIp } from '@/lib/api';
import { one } from '@/lib/db';
import { rateLimit } from '@/lib/cache';
import { createToken } from '@/lib/tokens';
import { sendMail } from '@/lib/mailer';
import { resetEmail } from '@/lib/emails';

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
export const POST = route(async (req) => {
  const { email } = await parseBody(req, z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email') }));
  const rl = await rateLimit('forgot', clientIp(req), 5, 3600);
  if (!rl.allowed) throw new ApiError(429, 'Too many reset requests. Please try again later.');
  const u = await one<{ user_id: number; full_name: string }>('SELECT user_id, full_name FROM users WHERE email = ? AND is_active = TRUE', [email]);
  if (u) {
    const origin = process.env.APP_URL ?? new URL(req.url).origin;
    const mail = await resetEmail(u.full_name, `${origin}/reset-password?token=${await createToken(u.user_id, 'password_reset', 60)}`);
    await sendMail(email, mail.subject, mail.text);
  }
  return { ok: true, message: 'If that email has an account, a reset link is on its way.' };
});
