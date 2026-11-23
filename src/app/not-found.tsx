import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { Logo } from '@/components/Logo';

// Shown for any unknown URL. Deliberately touches no database, so it works even when MySQL is down.
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-6 py-8 sm:px-12">
      <div className="pointer-events-none absolute -right-40 -top-40 -z-10 size-[34rem] rounded-full bg-gold-400/10 blur-3xl" />
      <Logo />
      <div className="flex flex-1 items-center">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Error 404</p>
          <h1 className="font-display mt-4 text-[clamp(5rem,16vw,11rem)] font-medium leading-none"><span className="gold-text italic">404</span></h1>
          <p className="font-display mt-2 text-4xl font-medium sm:text-5xl">This page has checked out.</p>
          <p className="mx-auto mt-5 max-w-md text-ivory-dim">The page you are looking for does not exist, or has moved. Let us take you somewhere you can book a stay.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-gold">Back to the hotel <ArrowRight className="size-4" /></Link>
            <Link href="/rooms" className="btn btn-ghost"><Compass className="size-4" />Browse rooms</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
