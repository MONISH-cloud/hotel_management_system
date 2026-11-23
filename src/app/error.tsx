'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { Logo } from '@/components/Logo';

// Boundary for unexpected errors in any page (for example the database being unreachable).
// It never shows the technical message to visitors; only an opaque reference they can quote to staff.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-6 py-8 sm:px-12">
      <div className="pointer-events-none absolute -left-40 -top-40 -z-10 size-[34rem] rounded-full bg-bad/10 blur-3xl" />
      <Logo />
      <div className="flex flex-1 items-center">
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow !text-bad">Something went wrong</p>
          <h1 className="font-display mt-4 text-5xl font-medium leading-tight sm:text-6xl">We hit an unexpected <span className="gold-text italic">snag.</span></h1>
          <p className="mx-auto mt-5 max-w-md text-ivory-dim">Our team has been notified in the server log. Please try again in a moment. Your bookings and payments are safe.</p>
          {error.digest && <p className="mt-4 text-xs text-mist">Reference: <code className="rounded bg-white/5 px-2 py-0.5">{error.digest}</code></p>}
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <button onClick={reset} className="btn btn-gold"><RotateCcw className="size-4" />Try again</button>
            <Link href="/" className="btn btn-ghost">Go to the home page</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
