import { route, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/auth';
import { one } from '@/lib/db';
import { rateLimit } from '@/lib/cache';
import { createToken } from '@/lib/tokens';
import { sendMail } from '@/lib/mailer';
import { verifyEmail } from '@/lib/emails';

export const POST = route(async (req) => {
  const s = await requireSession();
  const rl = await rateLimit('resend', String(s.userId), 3, 3600);
  if (!rl.allowed) throw new ApiError(429, 'Please wait before requesting another email.');
  const u = await one<{ verified: number }>('SELECT email_verified_at IS NOT NULL AS verified FROM users WHERE user_id = ?', [s.userId]);
  if (u?.verified) return { ok: true, message: 'Your email is already verified.' };
  const origin = process.env.APP_URL ?? new URL(req.url).origin;
  const mail = await verifyEmail(s.name, `${origin}/verify-email?token=${await createToken(s.userId, 'email_verify', 60 * 24)}`);
  await sendMail(s.email, mail.subject, mail.text);
  return { ok: true, message: 'Verification email sent.' };
});
