'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const path = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const href = (p: number) => { const n = new URLSearchParams(sp.toString()); if (p <= 1) n.delete('page'); else n.set('page', String(p)); const q = n.toString(); return q ? `${path}?${q}` : path; };
  const from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(page * pageSize, total);
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages])).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = 'grid h-9 min-w-9 place-items-center rounded-full border px-3 text-xs font-semibold transition';
  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-mist">Showing <b className="text-ivory-dim">{from}–{to}</b> of <b className="text-ivory-dim">{total}</b></p>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          {page > 1 ? <Link href={href(page - 1)} scroll={false} aria-label="Previous page" className={`${btn} hairline hover:border-white/30`}><ChevronLeft className="size-4" /></Link> : <span className={`${btn} hairline opacity-30`}><ChevronLeft className="size-4" /></span>}
          {nums.map((n, i) => (
            <span key={n} className="flex items-center gap-1.5">
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-mist">…</span>}
              <Link href={href(n)} scroll={false} aria-current={n === page ? 'page' : undefined} className={`${btn} ${n === page ? 'border-gold-400 bg-gold-400 text-ink-950' : 'hairline text-ivory-dim hover:border-white/30'}`}>{n}</Link>
            </span>
          ))}
          {page < pages ? <Link href={href(page + 1)} scroll={false} aria-label="Next page" className={`${btn} hairline hover:border-white/30`}><ChevronRight className="size-4" /></Link> : <span className={`${btn} hairline opacity-30`}><ChevronRight className="size-4" /></span>}
        </div>
      )}
    </nav>
  );
}
