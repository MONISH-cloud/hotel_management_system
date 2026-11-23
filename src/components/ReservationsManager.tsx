'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Search, CalendarX2, Eye, ReceiptText, FileText } from 'lucide-react';
import type { Reservation } from '@/lib/hotel';
import { api } from '@/lib/client';
import { fmtDateShort, fmtDate, fmtDateTime, money, nightsBetween, today, addDays } from '@/lib/format';
import { Modal, Segmented, StatusBadge, Empty, Field, Spinner, cn } from './ui';
import { DateRange } from './DateRange';
import { ReservationActions } from './ReservationActions';
import { PaymentModal, type PayTarget } from './PaymentModal';
import { useSettings } from './SettingsProvider';
import { Pagination } from './Pagination';
import { ExportButton } from './ExportButton';
import { useToast } from './Toast';

type RT = { type_id: number; name: string; base_price: number; max_adults: number; max_children: number };
type Props = { rows: Reservation[]; counts: Record<string, number>; types: RT[]; view: string; status: string; q: string; page: number; pageSize: number; total: number; canManage: boolean; canPay: boolean; canBook: boolean };

export function ReservationsManager({ rows, counts, types, view, status, q, page, pageSize, total, canManage, canPay, canBook }: Props) {
  const router = useRouter();
  const path = usePathname();
  const [search, setSearch] = useState(q);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);

  const go = (next: Partial<{ view: string; status: string; q: string }>) => {
    const p = new URLSearchParams();
    const v = next.view ?? view, st = next.status ?? status, qq = next.q ?? search;
    if (v !== 'all') p.set('view', v);
    if (st !== 'all') p.set('status', st);
    if (qq) p.set('q', qq);
    router.replace(`${path}${p.size ? '?' + p : ''}`, { scroll: false });
  };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSearch = (v: string) => { setSearch(v); clearTimeout(timer.current); timer.current = setTimeout(() => go({ q: v }), 350); };

  const statuses = ['all', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented value={view as 'all'} onChange={(v) => go({ view: v })} options={[{ value: 'all', label: 'All' }, { value: 'arrivals', label: 'Arrivals today' }, { value: 'departures', label: 'Departures today' }, { value: 'inhouse', label: 'In house', count: counts.checked_in ?? 0 }, { value: 'upcoming', label: 'Upcoming' }]} />
        <div className="flex flex-wrap gap-3">
          <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" /><input value={search} onChange={(e) => onSearch(e.target.value)} className="field !w-72 !rounded-full !py-2.5 !pl-11 text-sm" placeholder="Search guest, code, room…" aria-label="Search reservations" /></div>
          <select value={status} onChange={(e) => go({ status: e.target.value })} className="field !w-44 !rounded-full !py-2.5 text-sm capitalize" aria-label="Status filter">{statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace('_', ' ')}{s !== 'all' && counts[s] !== undefined ? ` (${counts[s]})` : ''}</option>)}</select>
          <ExportButton href={`/api/export/reservations?${new URLSearchParams({ ...(view !== 'all' ? { view } : {}), ...(status !== 'all' ? { status } : {}), ...(q ? { q } : {}) })}`} />
          {canBook && <button className="btn btn-gold btn-sm" onClick={() => setCreating(true)}><Plus className="size-4" />New reservation</button>}
        </div>
      </div>

      <div className="panel overflow-hidden">
        {rows.length === 0 ? <Empty icon={<CalendarX2 className="size-6" />} title="No reservations match" hint="Adjust the filters or create a new booking." /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Guest</th><th>Room</th><th>Stay</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reservation_id}>
                    <td><p className="font-semibold">{r.guest_name}</p><p className="text-xs text-mist">{r.reservation_code}{r.loyalty_tier !== 'Silver' && <span className="ml-2 text-gold-300">★ {r.loyalty_tier}</span>}</p></td>
                    <td><p>{r.room_type}</p><p className="text-xs text-mist">Room {r.room_number}</p></td>
                    <td className="whitespace-nowrap"><p>{fmtDateShort(r.check_in)} → {fmtDateShort(r.check_out)}</p><p className="text-xs text-mist">{r.nights} night{r.nights > 1 ? 's' : ''} · {r.adults + r.children} guests</p></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-right tabular-nums">{money(r.total_amount + r.services_total)}</td>
                    <td className={cn('text-right font-semibold tabular-nums', r.balance_due > 0 && !['cancelled', 'no_show'].includes(r.status) ? 'text-warn' : 'text-mist')}>{['cancelled', 'no_show'].includes(r.status) ? '—' : r.balance_due > 0 ? money(r.balance_due) : 'Paid'}</td>
                    <td><div className="flex items-center gap-2"><button className="btn btn-dark btn-xs" onClick={() => setDetail(r.reservation_id)} aria-label="View folio"><Eye className="size-3.5" />Folio</button><ReservationActions r={r} canManage={canManage} canPay={canPay} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} />

      <NewReservation open={creating} onClose={() => setCreating(false)} types={types} onCreated={() => { setCreating(false); router.refresh(); }} />
      <FolioModal id={detail} onClose={() => setDetail(null)} canPay={canPay} />
    </>
  );
}

/* ───────────── folio / detail ───────────── */
type Folio = Reservation & { payments: { payment_id: number; payment_type: string; method: string; amount: number; reference: string; paid_at: string }[]; orders: { order_id: number; service_name: string; quantity: number; unit_price: number; status: string }[] };

function FolioModal({ id, onClose, canPay }: { id: number | null; onClose: () => void; canPay: boolean }) {
  const [loaded, setLoaded] = useState<{ id: number; folio: Folio } | null>(null);
  const [pay, setPay] = useState<PayTarget | null>(null);
  const data = id && loaded?.id === id ? loaded.folio : null;   // derived: switching reservation shows the spinner again
  const load = (rid: number) => api<{ reservation: Folio }>(`/api/reservations/${rid}`).then((d) => setLoaded({ id: rid, folio: d.reservation })).catch(() => {});
  useEffect(() => { if (id) load(id);   }, [id]);
  return (
    <>
      <Modal open={!!id} onClose={onClose} wide title={data ? `${data.guest_name}` : 'Folio'} subtitle={data ? `${data.reservation_code} · ${data.room_type}, room ${data.room_number}` : undefined}>
        {!data ? <div className="grid h-40 place-items-center"><Spinner className="size-6" /></div> : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[['Check-in', fmtDate(data.check_in)], ['Check-out', fmtDate(data.check_out)], ['Guests', `${data.adults} adult${data.adults > 1 ? 's' : ''}${data.children ? `, ${data.children} child` : ''}`], ['Status', <StatusBadge key="s" status={data.status} />], ['Email', data.guest_email], ['Phone', data.guest_phone ?? '—'], ['Booked via', data.source === 'front_desk' ? 'Front desk' : 'Website']].map(([k, v]) => (
                  <div key={String(k)} className="rounded-xl border hairline bg-white/[0.02] p-3"><p className="text-xs text-mist">{k}</p><div className="mt-1 break-words font-semibold">{v}</div></div>))}
              </div>
              {data.special_requests && <div className="rounded-xl border-l-2 border-gold-400 bg-gold-400/[0.06] p-4 text-sm"><p className="eyebrow !text-[0.6rem]">Special request</p><p className="mt-1 text-ivory-dim">{data.special_requests}</p></div>}
              <div><p className="label">Payments</p>{data.payments.length ? <ul className="space-y-2 text-sm">{data.payments.map((p) => <li key={p.payment_id} className="flex justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2"><span className="text-ivory-dim"><b className="capitalize text-ivory">{p.payment_type}</b> · {p.method.toUpperCase()}<span className="block text-xs text-mist">{p.reference} · {fmtDateTime(p.paid_at)}</span></span><b className={p.payment_type === 'refund' ? 'text-bad' : 'text-ok'}>{p.payment_type === 'refund' ? '−' : '+'}{money(p.amount)}</b></li>)}</ul> : <p className="text-sm text-mist">No payments yet.</p>}</div>
            </div>
            <div>
              <p className="label">Folio</p>
              <dl className="space-y-2.5 rounded-2xl border hairline bg-white/[0.02] p-5 text-sm">
                <div className="flex justify-between text-ivory-dim"><dt>{data.nights} × {money(data.nightly_rate)}</dt><dd>{money(data.total_amount - data.tax_amount)}</dd></div>
                <div className="flex justify-between text-ivory-dim"><dt>Tax ({Math.round((data.tax_amount / (data.total_amount - data.tax_amount)) * 100)}%)</dt><dd>{money(data.tax_amount)}</dd></div>
                {data.orders.filter((o) => o.status !== 'cancelled').map((o) => <div key={o.order_id} className="flex justify-between text-ivory-dim"><dt className="truncate pr-3">{o.quantity > 1 && `${o.quantity}× `}{o.service_name}</dt><dd>{money(o.quantity * o.unit_price)}</dd></div>)}
                <div className="flex justify-between border-t hairline pt-3 font-semibold"><dt>Total charges</dt><dd>{money(data.total_amount + data.services_total)}</dd></div>
                <div className="flex justify-between text-base font-bold"><dt>Balance due</dt><dd className={data.balance_due > 0 ? 'text-warn' : 'text-ok'}>{data.balance_due > 0 ? money(data.balance_due) : 'Settled'}</dd></div>
              </dl>
              {canPay && data.balance_due > 0 && !['cancelled', 'no_show'].includes(data.status) && <button className="btn btn-gold mt-4 w-full" onClick={() => setPay(data)}><ReceiptText className="size-4" />Take payment</button>}
              <a className="btn btn-ghost mt-3 w-full" href={`/api/reservations/${data.reservation_id}/invoice`} target="_blank" rel="noreferrer"><FileText className="size-4" />Open invoice (PDF)</a>
            </div>
          </div>
        )}
      </Modal>
      <PaymentModal staff target={pay} onClose={() => setPay(null)} onPaid={() => { setPay(null); if (id) load(id); }} />
    </>
  );
}

/* ───────────── new reservation (staff) ───────────── */
function NewReservation({ open, onClose, types, onCreated }: { open: boolean; onClose: () => void; types: RT[]; onCreated: () => void }) {
  const toast = useToast();
  const { tax_rate_pct, max_rooms_per_booking } = useSettings();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [q, setQ] = useState('');
  const [guests, setGuests] = useState<{ guest_id: number; full_name: string; email: string }[]>([]);
  const [guestId, setGuestId] = useState<number | null>(null);
  const [ng, setNg] = useState({ fullName: '', email: '', phone: '', country: 'India' });
  const [typeId, setTypeId] = useState(types[0]?.type_id ?? 0);
  const [stay, setStay] = useState({ checkIn: today(), checkOut: addDays(today(), 2) });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);
  const [requests, setRequests] = useState('');
  const [free, setFree] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const type = types.find((t) => t.type_id === typeId);
  const nights = stay.checkIn && stay.checkOut ? nightsBetween(stay.checkIn, stay.checkOut) : 0;

  useEffect(() => { if (!open || mode !== 'existing') return; const t = setTimeout(() => api<{ guests: typeof guests }>(`/api/guests?q=${encodeURIComponent(q)}`).then((d) => setGuests(d.guests.slice(0, 6))).catch(() => {}), 200); return () => clearTimeout(t); }, [q, open, mode]);
  useEffect(() => {
    if (!open || nights < 1) return;
    api<{ rooms: { type_id: number; available: number }[] }>(`/api/rooms/availability?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&adults=1&children=0`)
      .then((d) => setFree(Object.fromEntries(d.rooms.map((r) => [r.type_id, r.available])))).catch(() => {});
  }, [open, stay.checkIn, stay.checkOut, nights]);

  const submit = async () => {
    setBusy(true);
    try {
      await api('/api/reservations', { body: { typeId, checkIn: stay.checkIn, checkOut: stay.checkOut, adults, children, rooms, requests: requests || undefined, ...(mode === 'existing' ? { guestId } : { newGuest: ng }) } });
      toast.success('Reservation created. Collect a deposit to confirm it.'); onCreated();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const ready = nights > 0 && type && (mode === 'existing' ? !!guestId : ng.fullName.length > 1 && /\S+@\S+\.\S+/.test(ng.email));

  return (
    <Modal open={open} onClose={onClose} wide title="New reservation" subtitle="Calls sp_create_reservation: finds a free room, prices the stay and locks the room type to prevent double-booking.">
      <div className="space-y-6">
        <div>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'existing', label: 'Existing guest' }, { value: 'new', label: 'New guest' }]} />
          {mode === 'existing' ? (
            <div className="mt-4"><input className="field" placeholder="Search guests by name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search guests" />
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">{guests.map((g) => <li key={g.guest_id}><button onClick={() => setGuestId(g.guest_id)} className={cn('w-full rounded-xl border px-4 py-2.5 text-left text-sm transition', guestId === g.guest_id ? 'border-gold-400 bg-gold-400/10' : 'hairline hover:border-white/25')}><b className="block">{g.full_name}</b><span className="text-xs text-mist">{g.email}</span></button></li>)}</ul></div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><input className="field" placeholder="Full name" value={ng.fullName} onChange={(e) => setNg({ ...ng, fullName: e.target.value })} /><input className="field" placeholder="Email" type="email" value={ng.email} onChange={(e) => setNg({ ...ng, email: e.target.value })} /><input className="field" placeholder="Phone" value={ng.phone} onChange={(e) => setNg({ ...ng, phone: e.target.value })} /><input className="field" placeholder="Country" value={ng.country} onChange={(e) => setNg({ ...ng, country: e.target.value })} /></div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room type"><select className="field" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>{types.map((t) => <option key={t.type_id} value={t.type_id}>{t.name} · {money(t.base_price)}{free[t.type_id] !== undefined ? ` · ${free[t.type_id]} free` : ''}</option>)}</select></Field>
          <Field label="Dates"><DateRange compact checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={(a, b) => setStay({ checkIn: a, checkOut: b })} /></Field>
          <Field label="Adults"><select className="field" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>{Array.from({ length: type?.max_adults ?? 2 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Children"><select className="field" value={children} onChange={(e) => setChildren(Number(e.target.value))}>{Array.from({ length: (type?.max_children ?? 0) + 1 }, (_, i) => i).map((n) => <option key={n}>{n}</option>)}</select></Field>
          <Field label="Number of rooms" hint="Guests above are per room. All rooms are booked together or not at all."><select className="field" value={rooms} onChange={(e) => setRooms(Number(e.target.value))}>{Array.from({ length: max_rooms_per_booking }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></Field>
        </div>
        <textarea className="field resize-none" rows={2} placeholder="Special requests…" value={requests} onChange={(e) => setRequests(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-4 border-t hairline pt-5">
          <p className="text-sm text-mist">{nights > 0 && type ? <>Total <b className="font-display text-2xl text-ivory">{money(Math.round(type.base_price * nights * rooms * (1 + tax_rate_pct / 100)))}</b> · {nights} night{nights > 1 ? 's' : ''} incl. {tax_rate_pct}% tax</> : 'Pick valid dates'}</p>
          <button className="btn btn-gold" disabled={!ready || busy || free[typeId] === 0 || (free[typeId] !== undefined && rooms > free[typeId])} onClick={submit}>{busy && <Spinner />}{free[typeId] === 0 ? 'Sold out for these dates' : 'Create reservation'}</button>
        </div>
      </div>
    </Modal>
  );
}
