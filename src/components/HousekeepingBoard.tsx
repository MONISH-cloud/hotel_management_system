'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, CheckCheck } from 'lucide-react';
import { api } from '@/lib/client';
import { label, timeAgo } from '@/lib/format';
import { Modal, Field, Spinner, cn } from './ui';
import { useToast } from './Toast';

type Task = { task_id: number; task_type: string; status: string; created_at: string; completed_at: string | null; employee_id: number | null; room_number: string; assignee: string | null };
type Staff = { employee_id: number; full_name: string };

const COLS = [{ key: 'pending', title: 'To do', dot: 'bg-warn' }, { key: 'in_progress', title: 'In progress', dot: 'bg-info' }, { key: 'done', title: 'Done', dot: 'bg-ok' }];

export function HousekeepingBoard({ tasks, staff, rooms }: { tasks: Task[]; staff: Staff[]; rooms: { room_id: number; room_number: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ roomId: rooms[0]?.room_id ?? 0, taskType: 'deep_clean', employeeId: '' });

  const patch = async (id: number, body: object) => { try { await api(`/api/housekeeping/${id}`, { method: 'PATCH', body }); router.refresh(); } catch (e) { toast.error((e as Error).message); } };
  const create = async () => {
    setBusy(true);
    try { await api('/api/housekeeping', { body: { roomId: Number(form.roomId), taskType: form.taskType, employeeId: form.employeeId ? Number(form.employeeId) : undefined } }); toast.success('Task created'); setOpen(false); router.refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="mb-6 flex justify-end"><button className="btn btn-gold btn-sm" onClick={() => setOpen(true)}><Plus className="size-4" />New task</button></div>
      <div className="grid gap-6 lg:grid-cols-3">
        {COLS.map((c) => {
          const list = tasks.filter((t) => t.status === c.key);
          return (
            <section key={c.key} className="rounded-[1.1rem] border hairline bg-white/[0.015] p-4">
              <h2 className="mb-4 flex items-center gap-2.5 px-2 text-sm font-semibold"><span className={cn('size-2 rounded-full', c.dot)} />{c.title}<span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-ivory-dim">{list.length}</span></h2>
              <div className="space-y-3">
                {list.map((t) => (
                  <article key={t.task_id} className="panel p-4">
                    <div className="flex items-start justify-between"><p className="font-display text-3xl font-semibold leading-none">{t.room_number}</p><span className="rounded-full border hairline px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ivory-dim">{label(t.task_type)}</span></div>
                    <p className="mt-2 text-xs text-mist">{t.status === 'done' && t.completed_at ? `Done ${timeAgo(t.completed_at)}` : `Created ${timeAgo(t.created_at)}`}</p>
                    <select value={t.employee_id ?? ''} onChange={(e) => patch(t.task_id, { employeeId: e.target.value ? Number(e.target.value) : null })} disabled={t.status === 'done'} className="field !mt-3 !py-2 text-xs" aria-label="Assignee"><option value="">Unassigned</option>{staff.map((s) => <option key={s.employee_id} value={s.employee_id}>{s.full_name}</option>)}</select>
                    {t.status !== 'done' && <button onClick={() => patch(t.task_id, { status: t.status === 'pending' ? 'in_progress' : 'done' })} className={cn('btn btn-xs mt-3 w-full', t.status === 'pending' ? 'btn-ghost' : 'btn-gold')}>{t.status === 'pending' ? <><Play className="size-3.5" />Start</> : <><CheckCheck className="size-3.5" />Complete</>}</button>}
                  </article>
                ))}
                {!list.length && <p className="px-2 py-6 text-center text-xs text-mist">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New housekeeping task">
        <div className="space-y-4">
          <Field label="Room"><select className="field" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: Number(e.target.value) })}>{rooms.map((r) => <option key={r.room_id} value={r.room_id}>{r.room_number}</option>)}</select></Field>
          <Field label="Type"><select className="field" value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })}>{['checkout_clean', 'turndown', 'deep_clean', 'maintenance'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
          <Field label="Assign to"><select className="field" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}><option value="">Unassigned</option>{staff.map((s) => <option key={s.employee_id} value={s.employee_id}>{s.full_name}</option>)}</select></Field>
          <button className="btn btn-gold w-full" disabled={busy} onClick={create}>{busy && <Spinner />}Create task</button>
        </div>
      </Modal>
    </>
  );
}
