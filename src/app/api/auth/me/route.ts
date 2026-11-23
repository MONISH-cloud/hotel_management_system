import { route } from '@/lib/api';
import { getSession, permissionsFor } from '@/lib/auth';
import { one } from '@/lib/db';

export const GET = route(async () => {
  const s = await getSession();
  if (!s) return { user: null };
  const v = await one<{ v: number }>('SELECT email_verified_at IS NOT NULL AS v FROM users WHERE user_id = ?', [s.userId]);
  return { user: { id: s.userId, name: s.name, email: s.email, role: s.role, guestId: s.guestId, emailVerified: !!v?.v }, permissions: [...(await permissionsFor(s.role))] };
});
