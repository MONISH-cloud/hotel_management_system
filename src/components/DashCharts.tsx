'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money, fmtDateShort } from '@/lib/format';

const GOLD = '#cbab6a', GOLD_L = '#efdcb0', INFO = '#8bb9ec', OK = '#7bd3a2', WARN = '#ecbd63', BAD = '#ee7d76';

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt?: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-4 py-3 text-xs shadow-xl">
      {label && <p className="mb-1.5 font-semibold text-ivory">{label}</p>}
      {payload.map((p) => <p key={p.name} className="flex items-center gap-2 text-ivory-dim"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}: <b className="text-ivory">{fmt ? fmt(p.value) : p.value}</b></p>)}
    </div>
  );
}

export function OccupancyChart({ data }: { data: { stay_date: string; occupancy_pct: number; occupied_rooms: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: fmtDateShort(d.stay_date), pct: Number(d.occupancy_pct) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={rows} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <defs><linearGradient id="occ" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.5} /><stop offset="100%" stopColor={GOLD} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} interval={2} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
        <Tooltip content={<Tip fmt={(n) => `${n}%`} />} cursor={{ stroke: 'rgba(255,255,255,.15)' }} />
        <Area type="monotone" dataKey="pct" name="Occupancy" stroke={GOLD_L} strokeWidth={2.5} fill="url(#occ)" dot={false} activeDot={{ r: 5, fill: GOLD_L }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: { month: string; room_revenue: number; service_revenue: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' }).format(new Date(d.month + '-01')) }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(v) => money(v, true)} />
        <Tooltip content={<Tip fmt={(n) => money(n)} />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="room_revenue" name="Rooms" stackId="a" fill={GOLD} radius={[0, 0, 0, 0]} />
        <Bar dataKey="service_revenue" name="Services" stackId="a" fill={INFO} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STATUS_COLORS: Record<string, string> = { available: OK, occupied: INFO, cleaning: WARN, maintenance: BAD };
export function RoomStatusChart({ data }: { data: { status: string; n: number }[] }) {
  const total = data.reduce((a, b) => a + Number(b.n), 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer><PieChart><Pie data={data.map((d) => ({ ...d, n: Number(d.n) }))} dataKey="n" nameKey="status" innerRadius={66} outerRadius={92} paddingAngle={3} stroke="none" cornerRadius={5}>
          {data.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? INFO} />)}</Pie><Tooltip content={<Tip />} /></PieChart></ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-4xl font-semibold">{total}</p><p className="text-[0.65rem] uppercase tracking-widest text-mist">rooms</p></div></div>
      </div>
      <ul className="w-full space-y-3 text-sm">
        {data.map((d) => <li key={d.status} className="flex items-center gap-3"><span className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[d.status] }} /><span className="flex-1 capitalize text-ivory-dim">{d.status}</span><b className="tabular-nums">{d.n}</b></li>)}
      </ul>
    </div>
  );
}

export function TypeRevenueChart({ data }: { data: { name: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 46)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} />
        <Tooltip content={<Tip fmt={(n) => money(n)} />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
        <Bar dataKey="revenue" name="Revenue" fill={GOLD} radius={[0, 8, 8, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
