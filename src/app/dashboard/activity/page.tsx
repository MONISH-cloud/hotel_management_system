import type { Metadata } from 'next';
import { Database, Network, Zap } from 'lucide-react';
import { PageHeader, Card } from '@/components/DashKit';
import { LiveFeed } from '@/components/LiveFeed';
import { Badge } from '@/components/ui';
import { pageGuard } from '@/lib/auth';
import { listAudit, countAudit } from '@/lib/hotel';
import { listOutbox } from '@/lib/mailer';
import { Pagination } from '@/components/Pagination';
import { ExportButton } from '@/components/ExportButton';
import { pool } from '@/lib/db';
import { redisAlive, getFeed } from '@/lib/cache';
import { graphAlive, graphCounts } from '@/lib/graph';
import { fmtDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Activity & Health' };
export const dynamic = 'force-dynamic';
const PAGE = 25;

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await pageGuard('audit.view', '/dashboard/activity');
  const page = Math.max(Number((await searchParams).page ?? 1) || 1, 1);
  const [audit, auditTotal, outbox, feed, my, rd, gr] = await Promise.all([
    listAudit(PAGE, (page - 1) * PAGE), countAudit(), listOutbox(12), getFeed(14), pool.query('SELECT VERSION() v').then(([r]) => (r as { v: string }[])[0].v).catch(() => null), redisAlive(), graphAlive(),
  ]);
  const counts = gr ? await graphCounts() : null;
  const sys = [
    { icon: Database, name: 'MySQL', role: 'Relational core: bookings, billing, RBAC', up: !!my, detail: my ? `v${my}` : 'unreachable' },
    { icon: Network, name: 'Neo4j', role: 'Graph: reviews and recommendations', up: gr, detail: counts ? `${counts.nodes} nodes · ${counts.relationships} rels` : 'unreachable' },
    { icon: Zap, name: 'Redis', role: 'Sessions, cache, rate limit, live feed', up: rd, detail: rd ? 'PONG' : 'unreachable' },
  ];
  return (
    <>
      <PageHeader eyebrow="Administration" title="Activity & health" subtitle="Every change made through stored procedures and triggers is written to the audit_log table with the acting user." />
      <div className="mb-6 grid gap-5 md:grid-cols-3">
        {sys.map((s) => (
          <div key={s.name} className="panel flex items-center gap-4 p-5">
            <span className="grid size-12 place-items-center rounded-xl border hairline bg-white/[0.03] text-gold-400"><s.icon className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-semibold">{s.name}</p><p className="truncate text-xs text-mist">{s.role}</p><p className="mt-1 text-xs text-ivory-dim">{s.detail}</p></div>
            <Badge tone={s.up ? 'ok' : 'bad'}>{s.up ? 'Online' : 'Offline'}</Badge>
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <Card title="Audit log" subtitle="MySQL · written by triggers and procedures" pad={false} actions={<ExportButton href="/api/export/audit" />}>
          <div className="max-h-[40rem] overflow-auto"><table className="tbl"><thead className="sticky top-0 bg-ink-800"><tr><th>When</th><th>Action</th><th>Entity</th><th>By</th><th>Details</th></tr></thead>
            <tbody>{audit.map((a) => (
              <tr key={a.log_id}><td className="whitespace-nowrap text-ivory-dim">{fmtDateTime(a.created_at)}</td><td><Badge tone="gold">{a.action}</Badge></td><td className="text-ivory-dim">{a.entity} #{a.entity_id}</td><td>{a.actor ?? <span className="text-mist">system</span>}</td>
                <td className="max-w-xs truncate font-mono text-xs text-mist" title={JSON.stringify(a.details)}>{a.details ? JSON.stringify(a.details) : '—'}</td></tr>))}
              {!audit.length && <tr><td colSpan={5} className="py-12 text-center text-mist">No activity recorded yet. Make a booking to see triggers at work.</td></tr>}</tbody></table></div>
        </Card>
        <Card title="Live feed" subtitle="Redis list"><LiveFeed initial={feed} /></Card>
      </div>
      <Pagination page={page} pageSize={PAGE} total={auditTotal} />

      <Card className="mt-8" title="Email outbox" subtitle="Every email the system sends. Without SMTP settings they are recorded here instead of delivered." pad={false}>
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th><th>Message</th></tr></thead><tbody>
          {outbox.map((m) => (<tr key={m.email_id}><td className="whitespace-nowrap text-ivory-dim">{fmtDateTime(m.created_at)}</td><td>{m.to_address}</td><td>{m.subject}</td><td><Badge tone={m.status === 'sent' ? 'ok' : m.status === 'failed' ? 'bad' : 'warn'}>{m.status.replace('_', ' ')}</Badge></td><td className="max-w-md"><details><summary className="cursor-pointer text-xs text-gold-300">View</summary><pre className="mt-2 whitespace-pre-wrap text-xs text-ivory-dim">{m.body}</pre></details></td></tr>))}
          {!outbox.length && <tr><td colSpan={5} className="py-10 text-center text-mist">No emails yet. They appear here after bookings, payments and sign-ups.</td></tr>}
        </tbody></table></div>
      </Card>
    </>
  );
}
