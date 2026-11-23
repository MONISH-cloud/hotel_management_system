'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, X, CheckCheck, CreditCard, UserX, CalendarClock } from 'lucide-react';
import type { Reservation } from '@/lib/hotel';
import { api } from '@/lib/client';
import { today } from '@/lib/format';
import { Confirm, Spinner } from './ui';
import { useToast } from './Toast';
import { PaymentModal } from './PaymentModal';
import { ModifyModal } from './ModifyModal';
import { useSettings } from './SettingsProvider';

type Action = 'check_in' | 'check_out' | 'cancel' | 'confirm' | 'no_show';

export function ReservationActions({ r, canManage, canPay, onChanged }: { r: Reservation; canManage: boolean; canPay: boolean; onChanged?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { free_cancel_hours } = useSettings();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [pay, setPay] = useState(false);
  const [modify, setModify] = useState(false);

  const run = async (action: Action) => {
    setBusy(action);
    try {
      const res = await api<{ message: string }>(`/api/reservations/${r.reservation_id}`, { method: 'PATCH', body: { action } });
      toast.success(res.message); setConfirm(null); router.refresh(); onChanged?.();
    } catch (e) { toast.error((e as Error).message); setConfirm(null); } finally { setBusy(null); }
  };
  const btn = (action: Action, label: string, icon: React.ReactNode, cls: string, ask = false) => (
    <button key={action} className={`btn btn-xs ${cls}`} disabled={!!busy} onClick={() => (ask ? setConfirm(action) : run(action))}>
      {busy === action ? <Spinner className="size-3" /> : icon}{label}
    </button>
  );

  const canCheckIn = r.check_in <= today();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canManage && r.status === 'pending' && btn('confirm', 'Confirm', <CheckCheck className="size-3.5" />, 'btn-ghost')}
      {canManage && ['pending', 'confirmed'].includes(r.status) && canCheckIn && btn('check_in', 'Check in', <LogIn className="size-3.5" />, 'btn-gold')}
      {canManage && r.status === 'checked_in' && btn('check_out', 'Check out', <LogOut className="size-3.5" />, 'btn-gold')}
      {canPay && ['pending', 'confirmed', 'checked_in'].includes(r.status) && r.balance_due > 0 && (
        <button className="btn btn-ghost btn-xs" onClick={() => setPay(true)}><CreditCard className="size-3.5" />Payment</button>
      )}
      {canManage && ['pending', 'confirmed'].includes(r.status) && (
        <button className="btn btn-ghost btn-xs" onClick={() => setModify(true)}><CalendarClock className="size-3.5" />Change</button>
      )}
      {canManage && ['pending', 'confirmed'].includes(r.status) && r.check_in <= today() && btn('no_show', 'No-show', <UserX className="size-3.5" />, 'btn-dark', true)}
      {canManage && ['pending', 'confirmed'].includes(r.status) && btn('cancel', 'Cancel', <X className="size-3.5" />, 'btn-danger', true)}

      <Confirm open={!!confirm} danger busy={!!busy} title={confirm === 'cancel' ? 'Cancel this reservation?' : 'Mark as no-show?'} confirmLabel={confirm === 'cancel' ? 'Cancel reservation' : 'Mark no-show'}
        message={`${r.guest_name}, ${r.room_type} (room ${r.room_number}). ${confirm === 'cancel' ? `Refund rules apply: full refund ${free_cancel_hours}+ hours before arrival.` : 'The room will be released.'}`}
        onConfirm={() => confirm && run(confirm)} onClose={() => setConfirm(null)} />
      <ModifyModal staff reservation={modify ? r : null} onClose={() => setModify(false)} onDone={() => { setModify(false); router.refresh(); onChanged?.(); }} />
      <PaymentModal staff target={pay ? r : null} onClose={() => setPay(false)} onPaid={() => { setPay(false); router.refresh(); onChanged?.(); }} />
    </div>
  );
}
