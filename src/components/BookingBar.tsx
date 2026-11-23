'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { DateRange, defaultStay } from './DateRange';
import { GuestPicker } from './GuestPicker';
import { cn } from './ui';

export function BookingBar({ initial, className }: { initial?: { checkIn: string; checkOut: string; adults: number; children: number }; className?: string }) {
  const router = useRouter();
  const def = defaultStay();
  const [stay, setStay] = useState({ checkIn: initial?.checkIn ?? def.checkIn, checkOut: initial?.checkOut ?? def.checkOut });
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [children, setChildren] = useState(initial?.children ?? 0);

  const go = () => {
    if (!stay.checkIn || !stay.checkOut) return;
    router.push(`/rooms?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&adults=${adults}&children=${children}`);
  };

  return (
    <div className={cn('glass grid gap-2 rounded-[1.6rem] p-2.5 shadow-2xl shadow-black/50 md:grid-cols-[1.7fr_1fr_auto] md:items-center md:rounded-full md:p-2', className)}>
      <DateRange checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={(a, b) => setStay({ checkIn: a, checkOut: b })} className="rounded-2xl px-5 py-3 transition hover:bg-white/5 md:rounded-full" />
      <GuestPicker adults={adults} kids={children} onChange={(a, c) => { setAdults(a); setChildren(c); }} className="rounded-2xl px-5 py-3 transition hover:bg-white/5 md:rounded-full md:border-l md:border-white/10" />
      <button onClick={go} disabled={!stay.checkIn || !stay.checkOut} className="btn btn-gold !rounded-2xl !py-4 md:!rounded-full md:!px-8">
        <Search className="size-4" /> Check availability
      </button>
    </div>
  );
}
