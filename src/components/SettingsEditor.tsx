'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, RotateCcw } from 'lucide-react';
import type { SettingRow } from '@/lib/settings';
import { api } from '@/lib/client';
import { Spinner } from './ui';
import { useToast } from './Toast';

export function SettingsEditor({ rows }: { rows: SettingRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value])), [rows]);
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = Object.keys(vals).filter((k) => vals[k] !== initial[k]);
  const groups = [...new Set(rows.map((r) => r.group_name))];

  const save = async () => {
    setBusy(true);
    try {
      const values = Object.fromEntries(dirty.map((k) => [k, vals[k]]));
      const res = await api<{ updated: number }>('/api/settings', { method: 'PATCH', body: { values } });
      toast.success(`${res.updated} setting${res.updated !== 1 ? 's' : ''} saved`);
      router.refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g} className="panel">
            <header className="border-b hairline px-6 py-4"><h2 className="font-display text-2xl font-semibold">{g}</h2></header>
            <div className="grid gap-x-8 gap-y-5 p-6 md:grid-cols-2">
              {rows.filter((r) => r.group_name === g).map((r) => (
                <div key={r.setting_key} className={r.value_type === 'longtext' ? 'md:col-span-2' : ''}>
                  <label className="label" htmlFor={r.setting_key}>{r.label}{vals[r.setting_key] !== initial[r.setting_key] && <span className="ml-2 normal-case tracking-normal text-gold-300">· edited</span>}</label>
                  {r.value_type === 'longtext'
                    ? <textarea id={r.setting_key} className="field min-h-24 resize-y" value={vals[r.setting_key]} maxLength={1000} onChange={(e) => setVals({ ...vals, [r.setting_key]: e.target.value })} />
                    : <input id={r.setting_key} className="field" inputMode={r.value_type === 'number' ? 'decimal' : 'text'} value={vals[r.setting_key]} maxLength={500} onChange={(e) => setVals({ ...vals, [r.setting_key]: e.target.value })} />}
                  <p className="mt-1.5 text-xs text-mist"><code className="text-ink-500">{r.setting_key}</code>{r.help_text && <> · {r.help_text}</>}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="sticky bottom-4 mt-8 flex items-center justify-between gap-4 rounded-2xl border border-gold-400/30 bg-ink-800/95 px-6 py-4 shadow-2xl shadow-black/60 backdrop-blur">
        <p className="text-sm text-ivory-dim">{dirty.length ? <><b className="text-gold-300">{dirty.length}</b> unsaved change{dirty.length > 1 ? 's' : ''}</> : 'All changes saved'}</p>
        <div className="flex gap-3">
          <button className="btn btn-ghost btn-sm" disabled={!dirty.length || busy} onClick={() => setVals(initial)}><RotateCcw className="size-4" />Reset</button>
          <button className="btn btn-gold btn-sm" disabled={!dirty.length || busy} onClick={save}>{busy ? <Spinner /> : <Save className="size-4" />}Save changes</button>
        </div>
      </div>
    </>
  );
}
