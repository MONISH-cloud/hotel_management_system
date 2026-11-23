import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { requireEnv } from '@/lib/env';

/**
 * First line of defence (edge of the app): coarse route protection by role.
 * Fine-grained permission checks + Redis session revocation happen in the
 * pages / route handlers (see lib/auth.ts).
 */
const secret = () => new TextEncoder().encode(requireEnv('JWT_SECRET', 32));

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('ma_session')?.value;
  let role: string | null = null;
  if (token) {
    try { role = String((await jwtVerify(token, secret())).payload.role); } catch { role = null; }
  }

  const toLogin = () => {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  };
  const go = (to: string) => { const u = req.nextUrl.clone(); u.pathname = to; u.search = ''; return NextResponse.redirect(u); };

  if (pathname.startsWith('/dashboard')) {
    if (!role) return toLogin();
    if (role === 'guest') return go('/account');
  }
  if (pathname.startsWith('/account')) {
    if (!role) return toLogin();
    if (role !== 'guest') return go('/dashboard');
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/account/:path*'] };
