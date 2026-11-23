'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut, LayoutDashboard, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';
import { cn } from './ui';
import { api } from '@/lib/client';
import { isStaff } from '@/lib/format';

const NAV = [
  { href: '/rooms', label: 'Rooms & Suites' },
  { href: '/#experiences', label: 'Experiences' },
  { href: '/#reviews', label: 'Guest Voices' },
  { href: '/#visit', label: 'Visit' },
];

export function HeaderShell({ user, solid }: { user: { name: string; role: string } | null; solid: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 24);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  const signOut = async () => { await api('/api/auth/logout', { method: 'POST' }); router.push('/'); router.refresh(); };
  const home = user ? (isStaff(user.role) ? '/dashboard' : '/account') : '/login';
  const bg = solid || scrolled || open;

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-500', bg ? 'glass border-x-0 border-t-0 py-3 shadow-xl shadow-black/30' : 'py-6')}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-9 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="group relative text-sm font-medium text-ivory-dim transition hover:text-ivory">
              {n.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-gold-400 transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <Link href={home} className="btn btn-ghost btn-sm">
                {isStaff(user.role) ? <LayoutDashboard className="size-4" /> : <UserRound className="size-4" />}
                {user.name.split(' ')[0]}
              </Link>
              <button onClick={signOut} className="btn btn-dark btn-sm" aria-label="Sign out"><LogOut className="size-4" /></button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link href="/rooms" className="btn btn-gold btn-sm">Book your stay</Link>
            </>
          )}
        </div>
        <button className="rounded-full p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden lg:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 pb-6 pt-4 sm:px-8">
              {NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="font-display border-b hairline py-3 text-2xl">{n.label}</Link>)}
              <div className="mt-4 flex gap-3">
                {user ? (<><Link href={home} onClick={() => setOpen(false)} className="btn btn-gold flex-1">{isStaff(user.role) ? 'Dashboard' : 'My stays'}</Link><button onClick={signOut} className="btn btn-ghost">Sign out</button></>)
                  : (<><Link href="/login" onClick={() => setOpen(false)} className="btn btn-ghost flex-1">Sign in</Link><Link href="/rooms" onClick={() => setOpen(false)} className="btn btn-gold flex-1">Book now</Link></>)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
