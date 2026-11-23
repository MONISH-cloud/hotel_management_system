'use client';
import { useEffect, useState } from 'react';
import type { Reservation } from '@/lib/hotel';
import { api } from '@/lib/client';
import { money, nightsBetween } from '@/lib/format';
import { Modal, Field, Spinner, cn } from './ui';
import { DateRange } from './DateRange';
import { useToast } from './Toast';
import { useSettings } from './SettingsProvider';

type AvailRoom = { type_id: number; name: string; base_price: number; max_adults: number; max_children: number; available: number };
type RoomRow = { room_id: number; room_number: string; type_id: number; status: string };

/** Change dates and/or room type of an upcoming booking (guests), or pick an exact room (staff). */
export function ModifyModal({ reservation, staff, onClose, onDone }: { reservation: Reservation | null; staff?: boolean; onClose: () => void; onDone: () => void }) {
  if (!reservation) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  return <Inner key={reservation.reservation_id} r={reservation} staff={staff} onClose={onClose} onDone={onDone} />;
}

function Inner({ r, staff, onClose, onDone }: { r: Reservation; staff?: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { tax_rate_pct } = useSettings();
  const [stay, setStay] = useState({ checkIn: r.check_in, checkOut: r.check_out });
  const [typeId, setTypeId] = useState(r.type_id);
  const [roomId, setRoomId] = useState<string>('');
  const [types, setTypes] = useState<AvailRoom[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [busy, setBusy] = useState(false);
  const nights = stay.checkIn && stay.checkOut ? nightsBetween(stay.checkIn, stay.checkOut) : 0;

  useEffect(() => {
    if (nights < 1) return;
    api<{ rooms: AvailRoom[] }>(`/api/rooms/availability?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&adults=1&children=0`).then((d) => setTypes(d.rooms)).catch(() => {});
  }, [stay.checkIn, stay.checkOut, nights]);
  useEffect(() => { if (staff) api<{ rooms: RoomRow[] }>('/api/rooms').then((d) => setRooms(d.rooms)).catch(() => {}); }, [staff]);

  const type = types.find((t) => t.type_id === typeId);
  const newTotal = type && nights > 0 ? Math.round(type.base_price * nights * (1 + tax_rate_pct / 100)) : null;
  const fits = (t: AvailRoom) => t.max_adults >= r.adults && t.max_children >= r.children;
  const changed = stay.checkIn !== r.check_in || stay.checkOut !== r.check_out || typeId !== r.type_id || !!roomId;

  const save = async () => {
    setBusy(true);
    try {
      const res = await api<{ message: string }>(`/api/reservations/${r.reservation_id}`, { method: 'PATCH', body: { action: 'modify', checkIn: stay.checkIn, checkOut: stay.checkOut, typeId, ...(roomId ? { roomId: Number(roomId) } : {}) } });
      toast.success(res.message); onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} wide title="Change this booking" subtitle={`${r.reservation_code} · currently ${r.room_type}, room ${r.room_number}`}>
      <div className="space-y-5">
        <Field label="New dates"><DateRange compact checkIn={stay.checkIn} checkOut={stay.checkOut} onChange={(a, b) => setStay({ checkIn: a, checkOut: b })} /></Field>
        <div>
          <p className="label">Room type</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => {
              const ok = fits(t);
              return (
                <button key={t.type_id} type="button" disabled={!ok} onClick={() => { setTypeId(t.type_id); setRoomId(''); }}
                  className={cn('rounded-xl border p-3.5 text-left transition', typeId === t.type_id ? 'border-gold-400 bg-gold-400/10' : 'hairline hover:border-white/25', !ok && 'cursor-not-allowed opacity-40')}>
                  <span className="flex items-baseline justify-between gap-2"><b className="text-sm">{t.name}</b><span className="text-sm font-semibold text-gold-300">{money(t.base_price)}</span></span>
                  <span className="mt-1 block text-xs text-mist">{!ok ? 'Too small for your party' : t.type_id === r.type_id ? 'Current type · your room may stay the same' : t.available > 0 ? `${t.available} available` : 'Sold out for these dates'}</span>
                </button>
              );
            })}
          </div>
        </div>
        {staff && (
          <Field label="Specific room (optional)">
            <select className="field" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Choose automatically</option>
              {rooms.filter((x) => x.type_id === typeId).map((x) => <option key={x.room_id} value={x.room_id}>Room {x.room_number} ({x.status})</option>)}
            </select>
          </Field>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t hairline pt-5">
          <p className="text-sm text-mist">{newTotal !== null ? <>New total <b className="font-display text-2xl text-ivory">{money(newTotal)}</b> <span className="text-xs">(was {money(r.total_amount)})</span></> : 'Pick valid dates'}</p>
          <button className="btn btn-gold" disabled={busy || !changed || nights < 1} onClick={save}>{busy && <Spinner />}Save changes</button>
        </div>
        <p className="text-xs text-mist">If you have paid more than the new total, the difference is refunded automatically.</p>
      </div>
    </Modal>
  );
}
