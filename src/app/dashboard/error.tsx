'use client';
import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Keeps the dashboard sidebar visible when one screen fails (for example a database query errors).
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="panel mx-auto mt-16 max-w-xl p-10 text-center" role="alert">
      <span className="mx-auto grid size-14 place-items-center rounded-full border border-bad/30 bg-bad/10 text-bad"><AlertTriangle className="size-6" /></span>
      <h1 className="font-display mt-5 text-4xl font-medium">This screen couldn&apos;t load</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm text-mist">Something went wrong while reading the data. Other screens are unaffected. Check the database status under Activity &amp; health, then try again.</p>
      {error.digest && <p className="mt-3 text-xs text-mist">Reference: <code className="rounded bg-white/5 px-2 py-0.5">{error.digest}</code></p>}
      <button onClick={reset} className="btn btn-gold mt-7"><RotateCcw className="size-4" />Try again</button>
    </div>
  );
}
