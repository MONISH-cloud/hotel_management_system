'use client';
import { useEffect, useMemo, useState } from 'react';
import { Play, Timer, Rows3, Copy, Check, Download } from 'lucide-react';
import type { Report } from '@/lib/hotel';
import { api } from '@/lib/client';
import { Badge, Spinner, cn } from './ui';

const KW = 'WITH RECURSIVE|WITH ROLLUP|WITH|SELECT|DISTINCT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LEFT JOIN|RIGHT JOIN|CROSS JOIN|INNER JOIN|JOIN|ON|AS|AND|OR|NOT EXISTS|NOT|EXISTS|IN|IS NULL|IS|NULL|UNION ALL|UNION|OVER|PARTITION BY|CASE|WHEN|THEN|ELSE|END|BETWEEN|LIMIT|DESC|ASC|INTERVAL|DAY|MONTH';
const TOKEN = new RegExp(`(?<str>'[^']*')|(?<kw>\\b(?:${KW})\\b)|(?<fn>\\b[A-Za-z_]+(?=\\())|(?<num>\\b\\d+\\b)`, 'g');

function Sql({ sql }: { sql: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border hairline bg-ink-950 p-5 text-[0.8rem] leading-relaxed" aria-label="SQL source">
      <code>
        {sql.split('\n').map((line, i) => {
          const parts: React.ReactNode[] = [];
          let last = 0;
          for (const m of line.matchAll(TOKEN)) {
            const at = m.index ?? 0;
            if (at > last) parts.push(line.slice(last, at));
            const g = m.groups ?? {};
            const cls = g.str ? 'text-ok' : g.num ? 'text-warn' : g.fn ? 'text-info' : 'font-semibold text-gold-300';
            parts.push(<span key={`${i}-${at}`} className={cls}>{m[0]}</span>);
            last = at + m[0].length;
          }
          parts.push(line.slice(last));
          return <div key={i} className="whitespace-pre"><span className="mr-4 inline-block w-5 select-none text-right text-ink-500">{i + 1}</span>{parts}</div>;
        })}
      </code>
    </pre>
  );
}

type Result = { rows: Record<string, unknown>[]; ms: number };

export function ReportsExplorer({ reports }: { reports: Report[] }) {
  const [id, setId] = useState(reports[0]?.id);
  const [loaded, setLoaded] = useState<{ id: string; nonce: number; data?: Result; err?: string } | null>(null);
  const [nonce, setNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const report = useMemo(() => reports.find((r) => r.id === id)!, [reports, id]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    api<Result>(`/api/reports/${id}`)
      .then((data) => alive && setLoaded({ id, nonce, data }))
      .catch((e) => alive && setLoaded({ id, nonce, err: (e as Error).message }));
    return () => { alive = false; };
  }, [id, nonce]);

  const current = loaded && loaded.id === id && loaded.nonce === nonce ? loaded : null;
  const busy = !current;
  const res = current?.data ?? null;
  const err = current?.err ?? '';
  const run = () => setNonce((n) => n + 1);

  const cols = res?.rows[0] ? Object.keys(res.rows[0]) : [];
  const fmt = (v: unknown) => v === null || v === undefined ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { maximumFractionDigits: 2 })) : String(v);

  return (
    <div className="grid gap-6 xl:grid-cols-[19rem_1fr]">
      <nav className="panel max-h-[78vh] overflow-y-auto p-2.5 xl:sticky xl:top-8" aria-label="Reports">
        {reports.map((r, i) => (
          <button key={r.id} onClick={() => setId(r.id)} className={cn('group w-full rounded-xl px-4 py-3 text-left transition', id === r.id ? 'bg-gold-400/10 ring-1 ring-gold-400/30' : 'hover:bg-white/[0.04]')}>
            <span className="flex items-baseline gap-3"><span className="text-xs tabular-nums text-mist">{String(i + 1).padStart(2, '0')}</span><span className={cn('text-sm font-semibold leading-snug', id === r.id ? 'text-gold-200' : 'text-ivory')}>{r.title}</span></span>
            <span className="mt-1 block pl-7 text-[0.7rem] text-mist">{r.concept}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-6">
        {report && (
          <>
            <div className="panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><Badge tone="gold">{report.concept}</Badge><h2 className="font-display mt-3 text-4xl font-semibold leading-tight">{report.title}</h2><p className="mt-2 max-w-2xl text-sm text-ivory-dim">{report.description}</p></div>
                <div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(report.sql); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy SQL'}</button><a className="btn btn-ghost btn-sm" href={`/api/reports/${report.id}?format=csv`} download><Download className="size-4" />CSV</a><button className="btn btn-gold btn-sm" onClick={run} disabled={busy}>{busy ? <Spinner /> : <Play className="size-4" />}Run</button></div>
              </div>
              <div className="mt-6"><Sql sql={report.sql} /></div>
            </div>

            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b hairline px-6 py-4"><h3 className="font-display text-2xl font-semibold">Result</h3>
                {res && <p className="flex items-center gap-4 text-xs text-mist"><span className="inline-flex items-center gap-1.5"><Rows3 className="size-3.5" />{res.rows.length} row{res.rows.length !== 1 ? 's' : ''}</span><span className="inline-flex items-center gap-1.5"><Timer className="size-3.5" />{res.ms} ms</span></p>}</div>
              {err && <p role="alert" className="m-6 rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">{err}</p>}
              {busy && !res && <div className="grid h-40 place-items-center"><Spinner className="size-6" /></div>}
              {res && (res.rows.length ? <div className="max-h-[32rem] overflow-auto"><table className="tbl"><thead className="sticky top-0 z-10 bg-ink-800"><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                <tbody>{res.rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={cn('whitespace-pre', typeof r[c] === 'number' && 'tabular-nums')}>{fmt(r[c])}</td>)}</tr>)}</tbody></table></div>
                : <p className="p-10 text-center text-sm text-mist">The query returned no rows. That is a valid result for this dataset.</p>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
