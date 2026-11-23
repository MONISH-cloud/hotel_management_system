'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, ShieldCheck, Crown, KeyRound, BedDouble } from 'lucide-react';
import { Spinner, cn } from './ui';
import { api } from '@/lib/client';
import { useToast } from './Toast';
import { useSettings } from './SettingsProvider';

const ROLE_ICON = { admin: Crown, manager: ShieldCheck, receptionist: KeyRound, guest: BedDouble } as const;
export type DemoLogin = { email: string; full_name: string; role: string; description: string };

export function AuthForm({ mode, next, demo = [], demoPassword = '' }: { mode: 'login' | 'register'; next?: string; demo?: DemoLogin[]; demoPassword?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { hotel_name } = useSettings();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const register = mode === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await api<{ redirect: string; user: { name: string } }>(register ? '/api/auth/register' : '/api/auth/login', {
        body: register ? f : { email: f.email, password: f.password },
      });
      toast.success(register ? `Welcome to ${hotel_name}, ${res.user.name.split(' ')[0]}` : `Welcome back, ${res.user.name.split(' ')[0]}`);
      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : res.redirect;
      router.push(res.redirect === '/dashboard' && !target.startsWith('/dashboard') ? '/dashboard' : target);
      router.refresh();
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="w-full max-w-md">
      <h1 className="font-display text-5xl font-medium leading-none">{register ? 'Create your ' : 'Welcome '}<span className="gold-text italic">{register ? 'account' : 'back'}</span></h1>
      <p className="mt-4 text-mist">{register ? 'Join to book directly, earn loyalty points and manage your stays.' : 'Sign in to manage your stays, services and reviews.'}</p>

      <form onSubmit={submit} className="mt-9 space-y-4" noValidate>
        {register && (
          <div className="relative"><User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
            <input required className="field !pl-11" placeholder="Full name" autoComplete="name" value={f.fullName} onChange={set('fullName')} aria-label="Full name" /></div>
        )}
        <div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
          <input required type="email" className="field !pl-11" placeholder="Email address" autoComplete="email" value={f.email} onChange={set('email')} aria-label="Email" /></div>
        {register && (
          <div className="relative"><Phone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
            <input className="field !pl-11" placeholder="Phone (optional)" autoComplete="tel" value={f.phone} onChange={set('phone')} aria-label="Phone" /></div>
        )}
        <div className="relative"><Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" />
          <input required type={show ? 'text' : 'password'} className="field !px-11" placeholder={register ? 'Password (8+ characters, with a number)' : 'Password'} autoComplete={register ? 'new-password' : 'current-password'} value={f.password} onChange={set('password')} aria-label="Password" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-mist hover:text-ivory">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
        </div>
        {err && <p role="alert" className="animate-pop rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</p>}
        {!register && <p className="-mt-1 text-right text-sm"><Link href="/forgot-password" className="text-mist transition hover:text-gold-300">Forgot password?</Link></p>}
        <button disabled={busy} className="btn btn-gold w-full !py-4">{busy ? <Spinner /> : null}{register ? 'Create account' : 'Sign in'}{!busy && <ArrowRight className="size-4" />}</button>
      </form>

      <p className="mt-6 text-center text-sm text-mist">
        {register ? 'Already have an account?' : `New to ${hotel_name}?`}{' '}
        <Link href={register ? '/login' : '/register'} className="font-semibold text-gold-300 hover:underline">{register ? 'Sign in' : 'Create an account'}</Link>
      </p>

      {!register && demo.length > 0 && (
        <div className="mt-10 border-t hairline pt-8">
          <p className="eyebrow !text-mist">Demo accounts · password <span className="text-gold-300">{demoPassword}</span></p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {demo.map((d) => {
              const Ico = ROLE_ICON[d.role as keyof typeof ROLE_ICON] ?? User;
              return (
              <button key={d.email} type="button" onClick={() => setF((s) => ({ ...s, email: d.email, password: demoPassword }))}
                className={cn('group flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-gold-400/60 hover:bg-gold-400/5', f.email === d.email ? 'border-gold-400 bg-gold-400/10' : 'hairline')}>
                <Ico className="size-4 shrink-0 text-gold-400" /><span className="min-w-0"><span className="block text-sm font-semibold capitalize">{d.role}</span><span className="block truncate text-[0.7rem] text-mist" title={d.description}>{d.full_name}</span></span>
              </button>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}
