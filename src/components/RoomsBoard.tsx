'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, SprayCan, CircleCheck, UserRound } from 'lucide-react';
import { api } from '@/lib/client';
import { fmtDateShort } from '@/lib/format';
import { Segmented, StatusBadge, cn } from './ui';
import { useToast } from './Toast';

const BAR: Record<string, string> = { available: 'bg-ok', occupied: 'bg-gold-400', cleaning: 'bg-warn', maintenance: 'bg-bad' };
type Room = { room_id: number; room_number: string; floor_no: number; status: string; room_type: string; guest_name: string | null; guest_check_out: string | null };

export function RoomsBoard({ rooms }: { rooms: Room[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<number | null>(null);
  const counts = rooms.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});
  const floors = [...new Set(rooms.map((r) => r.floor_no))].sort();

  const set = async (id: number, status: string) => {
    setBusy(id);
    try { await api(`/api/rooms/${id}`, { method: 'PATCH', body: { status } }); toast.success(`Room updated to ${status}`); router.refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <>
      <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All', count: rooms.length }, ...['available', 'occupied', 'cleaning', 'maintenance'].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: counts[s] ?? 0 }))]} />
      <div className="mt-8 space-y-9">
        {floors.map((f) => (
          <section key={f}>
            <h2 className="eyebrow mb-4">Floor {f}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {rooms.filter((r) => r.floor_no === f && (filter === 'all' || r.status === filter)).map((r) => (
                <div key={r.room_id} className={cn('panel relative overflow-hidden p-5 transition', busy === r.room_id && 'opacity-60')}>
                  <span className={cn('absolute inset-x-0 top-0 h-0.5', BAR[r.status])} />
                  <div className="flex items-start justify-between"><p className="font-display text-4xl font-semibold leading-none">{r.room_number}</p><StatusBadge status={r.status} kind="room" /></div>
                  <p className="mt-2 truncate text-xs text-mist">{r.room_type}</p>
                  <div className="mt-4 min-h-10 text-xs">
                    {r.status === 'occupied' && r.guest_name ? <p className="flex items-center gap-2 text-ivory-dim"><UserRound className="size-3.5 text-gold-400" /><span className="truncate"><b className="text-ivory">{r.guest_name}</b> · out {fmtDateShort(r.guest_check_out)}</span></p> : <p className="text-mist">{r.status === 'available' ? 'Ready for arrival' : r.status === 'cleaning' ? 'Being prepared' : 'Out of service'}</p>}
                  </div>
                  {r.status !== 'occupied' && (
                    <div className="mt-3 flex gap-1.5">
                      {r.status !== 'available' && <button disabled={busy === r.room_id} onClick={() => set(r.room_id, 'available')} className="btn btn-ghost btn-xs flex-1" title="Mark available"><CircleCheck className="size-3.5" />Ready</button>}
                      {r.status !== 'cleaning' && <button disabled={busy === r.room_id} onClick={() => set(r.room_id, 'cleaning')} className="btn btn-ghost btn-xs flex-1" title="Mark cleaning"><SprayCan className="size-3.5" />Clean</button>}
                      {r.status !== 'maintenance' && <button disabled={busy === r.room_id} onClick={() => set(r.room_id, 'maintenance')} className="btn btn-ghost btn-xs flex-1" title="Mark maintenance"><Wrench className="size-3.5" />Fix</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
