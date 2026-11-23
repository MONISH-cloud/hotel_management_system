'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck, ArrowRight, Minus, Plus, BedDouble } from 'lucide-react';
import { DateRange } from './DateRange';
import { GuestPicker } from './GuestPicker';
import { PaymentModal, type PayTarget } from './PaymentModal';
import { Spinner } from './ui';
import { useToast } from './Toast';
import { api } from '@/lib/client';
import { money, nightsBetween } from '@/lib/format';
import { useSettings } from './SettingsProvider';

type Room = { type_id: number; name: string; base_price: number; max_adults: number; max_children: number };
type Created = PayTarget & { check_in: string; check_out: string; room_number: string };

export function RoomBooking({ room, signedIn, role, initial }: { room: Room; signedIn: boolean; role: string | null; initial: { checkIn: string; checkOut: string; adults: number; children: number } }) {
  const router = useRouter();
  const toast = useToast();
  const { tax_rate_pct, free_cancel_hours, max_rooms_per_booking } = useSettings();
  const [rooms, setRooms] = useState(1);
  const [stay, setStay] = useState({ checkIn: initial.checkIn, checkOut: initial.checkOut });
  const [adults, setAdults] = useState(Math.min(initial.adults, room.max_adults));
  const [children, setChildren] = useState(Math.min(initial.children, room.max_children));
  const [requests, setRequests] = useState('');
  const [avail, setAvail] = useState<{ key: string; free: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[] | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidRef, setPaidRef] = useState<string | null>(null);

  const nights = stay.checkIn && stay.checkOut ? nightsBetween(stay.checkIn, stay.checkOut) : 0;
  const subtotal = room.base_price * nights * rooms;
  const tax = Math.round((subtotal * tax_rate_pct) / 100);
  const isStaff = !!role && role !== 'guest';

  const availKey = `${stay.checkIn}|${stay.checkOut}`;
  const free = avail?.key === availKey ? avail.free : null; // null while loading or for invalid dates
  useEffect(() => {
    if (nights < 1) return;
    let live = true;
    api<{ rooms: { type_id: number; available: number }[] }>(`/api/rooms/availability?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&adults=1&children=0`)
      .then((d) => live && setAvail({ key: availKey, free: d.rooms.find((r) => r.type_id === room.type_id)?.available ?? 0 }))
      .catch(() => {});
    return () => { live = false; };
  }, [stay.checkIn, stay.checkOut, room.type_id, nights, availKey]);

  const reserve = async () => {
    if (!signedIn) { router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
    setBusy(true);
    try {
      const { reservations } = await api<{ reservations: Created[] }>('/api/reservations', {
        body: { typeId: room.type_id, checkIn: stay.checkIn, checkOut: stay.checkOut, adults, children, rooms, requests: requests || undefined },
      });
      setCreated(reservations); setPaying(true);
      toast.success(reservations.length > 1 ? `${reservations.length} rooms are held for you` : `Room ${reservations[0].room_number} is held for you`);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  if (paidRef && created) {
    return (
      <div className="panel animate-pop p-8 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <h3 className="font-display mt-4 text-3xl font-semibold">You&apos;re booked!</h3>
        <p className="mt-2 text-sm text-mist">Confirmation <b className="text-ivory">{created.map((c) => c.reservation_code).join(', ')}</b><br />Payment ref {paidRef}</p>
        <Link href="/account" className="btn btn-gold mt-6 w-full">View my stays <ArrowRight className="size-4" /></Link>
      </div>
    );
  }

  const sold = free === 0;
  return (
    <div className="panel p-7 shadow-2xl shadow-black/40">
      <div className="flex items-end justify-between">
        <p><span className="font-display text-4xl font-semibold">{money(room.base_price)}</span> <span className="text-sm text-mist">/ night</span></p>
        {free !== null && (sold ? <span className="text-xs font-semibold text-bad">Sold out for these dates</span> : <span className="text-xs font-semibold text-ok">{free} room{free > 1 ? 's' : ''} available</span>)}
      </div>

      <div className="mt-6 space-y-3">
        <DateRange compact single checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={(a, b) => setStay({ checkIn: a, checkOut: b })} />
        <div className="field !py-3 flex items-center justify-between gap-3">
          <span className="flex items-center gap-3"><BedDouble className="size-5 text-gold-400" /><span><span className="label !mb-0.5 !text-[0.62rem]">Rooms</span><span className="block text-sm font-semibold">{rooms} room{rooms > 1 ? 's' : ''}{free !== null && rooms > free ? <span className="ml-2 text-xs font-normal text-bad">only {free} free</span> : null}</span></span></span>
          <span className="flex items-center gap-2.5">
            <button type="button" aria-label="Fewer rooms" disabled={rooms <= 1} onClick={() => setRooms((n) => n - 1)} className="grid size-8 place-items-center rounded-full border hairline transition hover:border-gold-400 disabled:opacity-30"><Minus className="size-4" /></button>
            <span className="w-4 text-center font-semibold tabular-nums">{rooms}</span>
            <button type="button" aria-label="More rooms" disabled={rooms >= max_rooms_per_booking} onClick={() => setRooms((n) => n + 1)} className="grid size-8 place-items-center rounded-full border hairline transition hover:border-gold-400 disabled:opacity-30"><Plus className="size-4" /></button>
          </span>
        </div>
        <GuestPicker compact adults={adults} kids={children} onChange={(a, c) => { setAdults(Math.min(a, room.max_adults)); setChildren(Math.min(c, room.max_children)); }} />
        <p className="text-xs text-mist">Each room sleeps up to {room.max_adults} adults and {room.max_children} child{room.max_children !== 1 ? 'ren' : ''}. Guests above are per room.</p>
        <textarea value={requests} onChange={(e) => setRequests(e.target.value)} rows={2} maxLength={500} className="field resize-none" placeholder="Special requests (optional): late arrival, anniversary, allergies…" aria-label="Special requests" />
      </div>

      {nights > 0 && (
        <dl className="mt-6 space-y-2.5 border-t hairline pt-5 text-sm">
          <div className="flex justify-between text-ivory-dim"><dt>{money(room.base_price)} × {nights} night{nights > 1 ? 's' : ''}{rooms > 1 ? ` × ${rooms} rooms` : ''}</dt><dd>{money(subtotal)}</dd></div>
          <div className="flex justify-between text-ivory-dim"><dt>Taxes &amp; fees ({tax_rate_pct}%)</dt><dd>{money(tax)}</dd></div>
          <div className="flex justify-between border-t hairline pt-3 text-base font-bold"><dt>Total</dt><dd className="gold-text font-display text-2xl">{money(subtotal + tax)}</dd></div>
        </dl>
      )}

      {isStaff ? (
        <Link href="/dashboard/reservations" className="btn btn-ghost mt-6 w-full">Book for a guest in the dashboard</Link>
      ) : (
        <button onClick={reserve} disabled={busy || nights < 1 || sold || (free !== null && rooms > free)} className="btn btn-gold mt-6 w-full !py-4">
          {busy ? <Spinner /> : null}{sold ? 'Unavailable' : signedIn ? (rooms > 1 ? `Reserve ${rooms} rooms` : 'Reserve this room') : 'Sign in to reserve'}
        </button>
      )}
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-mist"><ShieldCheck className="size-4 text-ok" />Free cancellation until {free_cancel_hours} hours before arrival</p>

      <PaymentModal target={paying && created ? created[0] : null} group={created ?? undefined} onClose={() => { setPaying(false); if (created && !paidRef) toast.info('Your room is held. Pay a deposit from My Stays to confirm it.'); }}
        onPaid={(ref) => { setPaidRef(ref); setPaying(false); }} />
    </div>
  );
}
