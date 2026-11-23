'use client';
import { useEffect, useRef, useState } from 'react';
import { Users, Minus, Plus } from 'lucide-react';
import { cn } from './ui';

function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-mist">{hint}</p></div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid size-9 place-items-center rounded-full border hairline transition hover:border-gold-400 disabled:opacity-30"><Minus className="size-4" /></button>
        <span className="w-5 text-center font-semibold tabular-nums">{value}</span>
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid size-9 place-items-center rounded-full border hairline transition hover:border-gold-400 disabled:opacity-30"><Plus className="size-4" /></button>
      </div>
    </div>
  );
}

export function GuestPicker({ adults, kids, onChange, className, compact }: {
  adults: number; kids: number; onChange: (a: number, c: number) => void; className?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const total = adults + kids;
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn('flex w-full items-center gap-3 text-left', compact ? 'field !py-3' : '')}>
        <Users className="size-5 shrink-0 text-gold-400" />
        <span>
          <span className="label !mb-0.5 !text-[0.62rem]">Guests</span>
          <span className="block text-sm font-semibold">{total} guest{total > 1 ? 's' : ''}<span className="font-normal text-mist"> · {adults} adult{adults > 1 ? 's' : ''}{kids ? `, ${kids} child${kids > 1 ? 'ren' : ''}` : ''}</span></span>
        </span>
      </button>
      {open && (
        <div className="panel animate-pop absolute right-0 top-[calc(100%+0.75rem)] z-50 w-72 p-5 shadow-2xl shadow-black/70">
          <Stepper label="Adults" hint="Age 13+" value={adults} min={1} max={4} onChange={(n) => onChange(n, kids)} />
          <div className="my-1 border-t hairline" />
          <Stepper label="Children" hint="Age 0–12" value={kids} min={0} max={3} onChange={(n) => onChange(adults, n)} />
        </div>
      )}
    </div>
  );
}
