'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { toneClass, reservationTone, roomTone, taskTone, orderTone, label, type Tone } from '@/lib/format';

export { cn };

export function Badge({ tone = 'mute', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('badge', toneClass[tone], className)}>{children}</span>;
}

const maps = { reservation: reservationTone, room: roomTone, task: taskTone, order: orderTone };
export function StatusBadge({ status, kind = 'reservation' }: { status: string; kind?: keyof typeof maps }) {
  return <Badge tone={maps[kind][status] ?? 'mute'}>{label(status)}</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />;
}

export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} width={size} height={size} className={i <= Math.round(value) ? 'fill-gold-400 text-gold-400' : 'text-ink-500'} />
      ))}
    </span>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} onClick={() => onChange(i)}
          className="rounded-md p-1 transition-transform hover:scale-125">
          <Star className={cn('size-8 transition-colors', i <= value ? 'fill-gold-400 text-gold-400' : 'text-ink-500 hover:text-gold-500')} />
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, subtitle, children, wide }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            className={cn('panel relative max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-6 sm:rounded-b-[1.1rem] sm:p-8', wide ? 'max-w-3xl' : 'max-w-lg')}>
            <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-mist transition hover:bg-white/10 hover:text-ivory"><X className="size-5" /></button>
            <h2 className="font-display pr-10 text-3xl font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm text-mist">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label: l, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{l}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-mist">{hint}</p>}
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="grid size-14 place-items-center rounded-full border hairline bg-white/[0.03] text-gold-400">{icon}</div>}
      <p className="font-display text-2xl">{title}</p>
      {hint && <p className="max-w-sm text-sm text-mist">{hint}</p>}
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border hairline bg-white/[0.03] p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn('rounded-full px-4 py-2 text-xs font-semibold transition', value === o.value ? 'bg-gold-400 text-ink-950 shadow-lg shadow-gold-400/20' : 'text-ivory-dim hover:text-ivory')}>
          {o.label}{o.count !== undefined && <span className={cn('ml-1.5', value === o.value ? 'text-ink-950/60' : 'text-mist')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm leading-relaxed text-ivory-dim">{message}</p>
      <div className="mt-7 flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Keep it</button>
        <button className={cn('btn', danger ? 'btn-danger' : 'btn-gold')} onClick={onConfirm} disabled={busy}>{busy && <Spinner />}{confirmLabel}</button>
      </div>
    </Modal>
  );
}
