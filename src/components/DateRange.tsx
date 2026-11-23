'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from './ui';
import { addDays, fmtDate, nightsBetween, today, ymd } from '@/lib/format';

const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function monthGrid(first: Date) {
  const y = first.getFullYear(), m = first.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(ymd(new Date(y, m, d)));
  return cells;
}

export function DateRange({ checkIn, checkOut, onChange, className, compact, single }: {
  checkIn: string; checkOut: string; onChange: (a: string, b: string) => void; className?: string; compact?: boolean; single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(() => { const d = checkIn ? new Date(checkIn + 'T00:00:00') : new Date(); d.setDate(1); return d; });
  const ref = useRef<HTMLDivElement>(null);
  const min = today();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);

  const pick = (d: string) => {
    if (!checkIn || (checkIn && checkOut)) { onChange(d, ''); return; }
    if (d <= checkIn) onChange(d, '');
    else { onChange(checkIn, d); setOpen(false); setHover(null); }
  };

  const months = useMemo(() => (single ? [view] : [view, new Date(view.getFullYear(), view.getMonth() + 1, 1)]), [view, single]);
  const end = checkOut || (checkIn && hover && hover > checkIn ? hover : '');
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cn('flex w-full items-center gap-3 text-left', compact ? 'field !py-3' : '')}>
        <CalendarDays className="size-5 shrink-0 text-gold-400" />
        <span className="grid flex-1 grid-cols-2 gap-4">
          <span>
            <span className="label !mb-0.5 !text-[0.62rem]">Check-in</span>
            <span className={cn('block text-sm font-semibold', !checkIn && 'text-mist')}>{checkIn ? fmtDate(checkIn, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Add date'}</span>
          </span>
          <span>
            <span className="label !mb-0.5 !text-[0.62rem]">Check-out{nights > 0 && <span className="ml-1 normal-case tracking-normal text-gold-400">· {nights} night{nights > 1 ? 's' : ''}</span>}</span>
            <span className={cn('block text-sm font-semibold', !checkOut && 'text-mist')}>{checkOut ? fmtDate(checkOut, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Add date'}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className={cn('panel animate-pop absolute left-0 top-[calc(100%+0.75rem)] z-50 p-5 shadow-2xl shadow-black/70 sm:p-6', single ? 'w-[min(88vw,22rem)]' : 'w-[min(92vw,44rem)]')}>
          <div className={cn('grid gap-8', !single && 'md:grid-cols-2')}>
            {months.map((m, idx) => (
              <div key={m.toISOString()}>
                <div className="mb-3 flex items-center justify-between">
                  {idx === 0 ? (
                    <button type="button" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                      disabled={ymd(new Date(view.getFullYear(), view.getMonth(), 1)) <= min.slice(0, 8) + '01'}
                      className="rounded-full p-2 text-ivory-dim transition hover:bg-white/10 disabled:opacity-25"><ChevronLeft className="size-4" /></button>
                  ) : <span className="size-8 max-md:hidden" />}
                  <p className="font-display text-xl font-semibold">{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(m)}</p>
                  {idx === months.length - 1 ? (
                    <button type="button" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                      className="rounded-full p-2 text-ivory-dim transition hover:bg-white/10"><ChevronRight className="size-4" /></button>
                  ) : <span className="size-8" />}
                </div>
                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {WEEK.map((w) => <span key={w} className="pb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-mist">{w}</span>)}
                  {monthGrid(m).map((d, i) => {
                    if (!d) return <span key={i} />;
                    const disabled = d < min;
                    const isStart = d === checkIn, isEnd = d === checkOut;
                    const inRange = !!checkIn && !!end && d > checkIn && d < end;
                    return (
                      <button key={d} type="button" disabled={disabled} onClick={() => pick(d)} onMouseEnter={() => setHover(d)}
                        className={cn('relative h-10 text-sm transition',
                          disabled && 'cursor-not-allowed text-ink-500 line-through decoration-ink-600',
                          !disabled && !isStart && !isEnd && 'hover:rounded-full hover:bg-white/10',
                          inRange && 'bg-gold-400/15 text-gold-200',
                          (isStart || isEnd) && 'z-10 rounded-full bg-gold-400 font-bold text-ink-950 shadow-lg shadow-gold-400/30',
                          isStart && end && 'rounded-r-none', isEnd && 'rounded-l-none')}>
                        {Number(d.slice(8))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t hairline pt-4 text-xs text-mist">
            <span>{!checkIn ? 'Select your arrival date' : !checkOut ? 'Now select your departure date' : `${nights} night${nights > 1 ? 's' : ''} selected`}</span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => { onChange('', ''); }}>Clear</button>
              <button type="button" className="btn btn-gold btn-xs" onClick={() => setOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const defaultStay = () => ({ checkIn: addDays(today(), 1), checkOut: addDays(today(), 4) });
