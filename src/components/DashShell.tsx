'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, CalendarCheck, BedDouble, Users, Sparkles, ConciergeBell, MessageSquareQuote, BarChart3, ShieldCheck, Activity, SlidersHorizontal, Building2, LogOut, Menu, X, ExternalLink } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';
import { Badge, cn } from './ui';
import { api } from '@/lib/client';

const ICONS = { dashboard: LayoutDashboard, reservations: CalendarCheck, rooms: BedDouble, guests: Users, housekeeping: Sparkles, services: ConciergeBell, reviews: MessageSquareQuote, reports: BarChart3, staff: ShieldCheck, activity: Activity, settings: SlidersHorizontal, inventory: Building2 };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function DashShell({ user, nav, children }: { user: { name: string; role: string }; nav: NavItem[]; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const signOut = async () => { await api('/api/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); };
  const roleTone = { admin: 'gold', manager: 'info', receptionist: 'ok' }[user.role] as 'gold' | 'info' | 'ok';

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-6 pt-7"><Logo href="/dashboard" /></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Dashboard">
        {nav.map((n) => {
          const active = n.href === '/dashboard' ? path === '/dashboard' : path.startsWith(n.href);
          const I = ICONS[n.icon];
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
              className={cn('group relative flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition', active ? 'text-gold-200' : 'text-ivory-dim hover:bg-white/[0.04] hover:text-ivory')}>
              {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl border border-gold-400/25 bg-gradient-to-r from-gold-400/15 to-transparent" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <I className={cn('relative size-[1.15rem]', active ? 'text-gold-400' : 'text-mist group-hover:text-gold-400')} /><span className="relative">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="m-3 space-y-3 rounded-2xl border hairline bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-sm font-bold text-ink-950">{user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><Badge tone={roleTone} className="mt-1 !py-0.5">{user.role}</Badge></div>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn btn-ghost btn-xs flex-1"><ExternalLink className="size-3.5" />Site</Link>
          <button onClick={signOut} className="btn btn-dark btn-xs flex-1"><LogOut className="size-3.5" />Sign out</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r hairline bg-ink-900/80 lg:block">{Sidebar}</aside>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b hairline bg-ink-950/90 px-5 py-3 backdrop-blur lg:hidden">
        <Logo href="/dashboard" className="scale-90 origin-left" />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-full p-2"><Menu className="size-6" /></button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'spring', stiffness: 360, damping: 36 }} className="absolute inset-y-0 left-0 w-72 border-r hairline bg-ink-900">
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-full p-2"><X className="size-5" /></button>
              {Sidebar}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
