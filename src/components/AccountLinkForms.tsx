'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/client';
import { Spinner } from './ui';

function Shell({ title, accent, sub, children }: { title: string; accent: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md">
      <h1 className="font-display text-5xl font-medium leading-none">{title} <span className="gold-text italic">{accent}</span></h1>
      {sub && <p className="mt-4 text-mist">{sub}</p>}
      <div className="mt-9">{children}</div>
    </div>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const r = await api<{ message: string }>('/api/auth/forgot', { body: { email } }); setDone(r.message); }
    catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Forgot your" accent="password?" sub="Enter your account email and we'll send you a link to choose a new one.">
      {done ? (
        <div className="animate-pop rounded-2xl border border-ok/30 bg-ok/10 p-5 text-sm text-ok"><CheckCircle2 className="mb-2 size-6" />{done}</div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" /><input required type="email" className="field !pl-11" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" /></div>
          {err && <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</p>}
          <button disabled={busy || !email} className="btn btn-gold w-full !py-4">{busy && <Spinner />}Send reset link</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-mist"><Link href="/login" className="font-semibold text-gold-300 hover:underline">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/auth/reset', { body: { token, password: pw } }); setDone(true); }
    catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Choose a new" accent="password">
      {done ? (
        <div className="animate-pop space-y-4"><div className="rounded-2xl border border-ok/30 bg-ok/10 p-5 text-sm text-ok"><CheckCircle2 className="mb-2 size-6" />Your password has been changed. Other devices were signed out.</div>
          <Link href="/login" className="btn btn-gold w-full !py-4">Sign in <ArrowRight className="size-4" /></Link></div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="relative"><Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" /><input required type="password" className="field !pl-11" placeholder="New password (8+ characters, with a number)" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" /></div>
          {err && <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{err} <Link href="/forgot-password" className="underline">Request a new link</Link></p>}
          <button disabled={busy || pw.length < 8} className="btn btn-gold w-full !py-4">{busy && <Spinner />}Change password</button>
        </form>
      )}
    </Shell>
  );
}

export function VerifyStatus({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working');
  const [msg, setMsg] = useState('');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; ran.current = true; // the token is single-use, so only call once (React dev double-mount)
    api('/api/auth/verify', { body: { token } }).then(() => setState('ok')).catch((e) => { setMsg((e as Error).message); setState('fail'); });
  }, [token]);
  return (
    <Shell title="Email" accent="verification">
      {state === 'working' && <p className="flex items-center gap-3 text-mist"><Spinner className="size-5" />Verifying your address…</p>}
      {state === 'ok' && <div className="animate-pop space-y-4"><div className="rounded-2xl border border-ok/30 bg-ok/10 p-5 text-sm text-ok"><CheckCircle2 className="mb-2 size-6" />Thank you. Your email address is verified.</div><Link href="/account" className="btn btn-gold w-full !py-4">Go to my stays <ArrowRight className="size-4" /></Link></div>}
      {state === 'fail' && <div className="animate-pop space-y-4"><div className="rounded-2xl border border-bad/30 bg-bad/10 p-5 text-sm text-bad"><XCircle className="mb-2 size-6" />{msg}</div><p className="text-sm text-mist">Sign in and use “Resend verification email” on your account page.</p><Link href="/login" className="btn btn-ghost w-full">Sign in</Link></div>}
    </Shell>
  );
}
