// Client-safe formatting helpers (no server imports).

export const money = (n: number | string | null | undefined, compact = false) => {
  const v = Number(n ?? 0);
  if (compact && Math.abs(v) >= 100000)
    return '₹' + new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);
};

const parse = (d: string) => new Date(d.length <= 10 ? d + 'T00:00:00' : d.replace(' ', 'T'));

export const fmtDate = (d?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Intl.DateTimeFormat('en-IN', opts).format(parse(d)) : '—';

export const fmtDateShort = (d?: string | null) => fmtDate(d, { day: 'numeric', month: 'short' });
export const fmtDateTime = (d?: string | null) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(parse(d)) : '—';

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const today = () => ymd(new Date());
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const nightsBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

export function timeAgo(ts: number | string) {
  const t = typeof ts === 'number' ? ts : parse(ts).getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : fmtDate(typeof ts === 'number' ? new Date(ts).toISOString() : ts);
}

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'gold' | 'mute';

export const toneClass: Record<Tone, string> = {
  ok: 'text-ok bg-ok/10 border-ok/30',
  warn: 'text-warn bg-warn/10 border-warn/30',
  bad: 'text-bad bg-bad/10 border-bad/30',
  info: 'text-info bg-info/10 border-info/30',
  gold: 'text-gold-300 bg-gold-400/10 border-gold-400/30',
  mute: 'text-ivory-dim bg-white/5 border-white/15',
};

export const reservationTone: Record<string, Tone> = {
  pending: 'warn', confirmed: 'info', checked_in: 'ok', checked_out: 'mute', cancelled: 'bad', no_show: 'bad',
};
export const roomTone: Record<string, Tone> = { available: 'ok', occupied: 'gold', cleaning: 'warn', maintenance: 'bad' };
export const taskTone: Record<string, Tone> = { pending: 'warn', in_progress: 'info', done: 'ok' };
export const orderTone: Record<string, Tone> = { requested: 'warn', confirmed: 'info', delivered: 'ok', cancelled: 'bad' };

export const label = (s: string) => s.replace(/_/g, ' ');

export const STAFF_ROLES = ['admin', 'manager', 'receptionist'] as const;
export type Role = 'admin' | 'manager' | 'receptionist' | 'guest';
export const isStaff = (r?: string | null) => !!r && (STAFF_ROLES as readonly string[]).includes(r);
