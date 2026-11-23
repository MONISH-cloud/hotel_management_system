import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: React.ReactNode; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display mt-2.5 text-5xl font-medium leading-none">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-sm text-mist">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Kpi({ icon: I, label, value, sub, tone = 'gold', className }: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'gold' | 'ok' | 'info' | 'warn'; className?: string }) {
  const c = { gold: 'text-gold-300 bg-gold-400/10 border-gold-400/25', ok: 'text-ok bg-ok/10 border-ok/25', info: 'text-info bg-info/10 border-info/25', warn: 'text-warn bg-warn/10 border-warn/25' }[tone];
  return (
    <div className={cn('panel group relative overflow-hidden p-6 transition hover:border-white/15', className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">{label}</p>
        <span className={cn('grid size-10 place-items-center rounded-xl border', c)}><I className="size-[1.1rem]" /></span>
      </div>
      <p className="font-display mt-4 text-[2.6rem] font-semibold leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-3 text-xs text-mist">{sub}</p>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className, pad = true }: { title?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn('panel', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b hairline px-6 py-4">
          <div><h2 className="font-display text-2xl font-semibold">{title}</h2>{subtitle && <p className="text-xs text-mist">{subtitle}</p>}</div>
          {actions}
        </header>
      )}
      <div className={pad ? 'p-6' : ''}>{children}</div>
    </section>
  );
}
