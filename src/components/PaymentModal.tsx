'use client';
import { useState } from 'react';
import { CreditCard, Smartphone, Landmark, Banknote, Lock, ShieldCheck } from 'lucide-react';
import { Modal, Spinner, cn } from './ui';
import { useToast } from './Toast';
import { api } from '@/lib/client';
import { money } from '@/lib/format';
import { useSettings } from './SettingsProvider';

const METHODS = [
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'netbanking', label: 'Net banking', icon: Landmark },
  { id: 'cash', label: 'Cash', icon: Banknote },
] as const;

export type PayTarget = { reservation_id: number; reservation_code: string; total_amount: number; balance_due: number; status: string };

export function PaymentModal({ target, group, onClose, onPaid, staff }: { target: PayTarget | null; group?: PayTarget[]; onClose: () => void; onPaid: (reference: string) => void; staff?: boolean }) {
  const toast = useToast();
  const { deposit_pct } = useSettings();
  const [method, setMethod] = useState<'card' | 'upi' | 'netbanking' | 'cash'>('card');
  const [mode, setMode] = useState<'deposit' | 'full'>('deposit');
  const [busy, setBusy] = useState(false);
  if (!target) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  // a multi-room booking is paid in one go: each room gets its own payment row
  const items = group && group.length > 1 ? group.filter((g) => g.balance_due > 0) : [target];
  const depositOf = (i: PayTarget) => Math.min(i.balance_due, Math.ceil((i.total_amount * deposit_pct) / 100));
  const needsDeposit = items.some((i) => i.status === 'pending');
  const amountOf = (i: PayTarget) => (i.status === 'pending' && mode === 'deposit' ? depositOf(i) : i.balance_due);
  const amount = items.reduce((a, i) => a + amountOf(i), 0);
  const depositTotal = items.reduce((a, i) => a + depositOf(i), 0);
  const balanceTotal = items.reduce((a, i) => a + i.balance_due, 0);
  const methods = staff ? METHODS : METHODS.filter((m) => m.id !== 'cash');

  const pay = async () => {
    setBusy(true);
    try {
      let ref = '';
      for (const i of items) {
        const a = amountOf(i);
        if (a <= 0) continue;
        const res = await api<{ reference: string }>(`/api/reservations/${i.reservation_id}/payments`, { body: { amount: a, method } });
        ref = res.reference;
      }
      toast.success(`Payment of ${money(amount)} received`);
      onPaid(ref);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!target} onClose={onClose} title={needsDeposit ? 'Secure your reservation' : 'Settle your balance'} subtitle={items.length > 1 ? `${items.length} rooms in this booking` : `Reservation ${target.reservation_code}`}>
      {needsDeposit && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          {([['deposit', `Pay ${deposit_pct}% deposit`, depositTotal], ['full', 'Pay in full', balanceTotal]] as const).map(([k, l, a]) => (
            <button key={k} onClick={() => setMode(k)} className={cn('rounded-2xl border p-4 text-left transition', mode === k ? 'border-gold-400 bg-gold-400/10' : 'hairline hover:border-white/25')}>
              <p className="text-xs text-mist">{l}</p><p className="font-display mt-1 text-2xl font-semibold">{money(a)}</p>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        {methods.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className={cn('flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition', method === m.id ? 'border-gold-400 bg-gold-400/10 text-gold-200' : 'hairline text-ivory-dim hover:border-white/25')}>
            <m.icon className="size-5" />{m.label}
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {method === 'card' && (<>
          <input className="field" placeholder="Card number" inputMode="numeric" defaultValue="4242 4242 4242 4242" aria-label="Card number" />
          <div className="grid grid-cols-2 gap-3"><input className="field" placeholder="MM / YY" defaultValue="12 / 29" aria-label="Expiry" /><input className="field" placeholder="CVC" defaultValue="123" aria-label="CVC" /></div>
        </>)}
        {method === 'upi' && <input className="field" placeholder="yourname@upi" defaultValue="guest@okaurelia" aria-label="UPI ID" />}
        {method === 'netbanking' && <select className="field" aria-label="Bank" defaultValue="HDFC Bank"><option>HDFC Bank</option><option>ICICI Bank</option><option>State Bank of India</option><option>Axis Bank</option></select>}
        {method === 'cash' && <p className="rounded-xl border hairline bg-white/[0.03] p-4 text-sm text-ivory-dim">Cash received at the front desk will be recorded against this reservation.</p>}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-mist"><ShieldCheck className="size-4 text-ok" />Demo environment: no real payment is processed and no card data is stored.</p>
      <button onClick={pay} disabled={busy || amount <= 0} className="btn btn-gold mt-6 w-full !py-4">
        {busy ? <Spinner /> : <Lock className="size-4" />} Pay {money(amount)}
      </button>
    </Modal>
  );
}
