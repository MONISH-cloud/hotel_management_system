'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchInput({ initial, placeholder }: { initial: string; placeholder: string }) {
  const [v, setV] = useState(initial);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (v === initial) return; const t = setTimeout(() => router.replace(v ? `${path}?q=${encodeURIComponent(v)}` : path, { scroll: false }), 350); return () => clearTimeout(t); }, [v, initial, path, router]);
  return <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" /><input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="field !w-80 !rounded-full !py-2.5 !pl-11 text-sm" /></div>;
}
