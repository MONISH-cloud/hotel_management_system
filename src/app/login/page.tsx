import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { AuthForm } from '@/components/AuthForm';
import { getSession } from '@/lib/auth';
import { isStaff } from '@/lib/format';
import { getSettings, getMedia, listDemoLogins } from '@/lib/settings';
import { listReviews } from '@/lib/graph';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, s] = await Promise.all([searchParams, getSession()]);
  if (s) redirect(isStaff(s.role) ? '/dashboard' : '/account');
  const [cfg, media, quotes, demo] = await Promise.all([getSettings(), getMedia(), listReviews({ minRating: 5, limit: 1 }), listDemoLogins()]);
  const quote = quotes[0];
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden isolate overflow-hidden lg:block grain">
        { }
        <img src={media.login_side?.url} alt={media.login_side?.alt ?? ''} className="absolute inset-0 -z-20 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/40 to-ink-950/60" />
        <div className="flex h-full flex-col justify-between p-12">
          <Logo />
          {quote && (
            <div className="max-w-md">
              <p className="font-display text-5xl font-medium italic leading-[1.1]">&ldquo;{quote.title}&rdquo;</p>
              <p className="mt-6 text-sm text-ivory-dim">{quote.guestName} · {quote.roomType}</p>
            </div>
          )}
        </div>
      </section>
      <section className="flex flex-col px-6 py-10 sm:px-12">
        <div className="lg:hidden"><Logo /></div>
        <div className="flex flex-1 items-center justify-center py-12"><AuthForm mode="login" next={next} demo={cfg.demo_logins_enabled ? demo : []} demoPassword={cfg.demo_password_hint} /></div>
      </section>
    </main>
  );
}
