'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil, Check, Network, KeyRound, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { api } from '@/lib/client';
import { money, fmtDate, fmtDateTime } from '@/lib/format';
import { Modal, Segmented, Badge, Field, Spinner, Confirm, cn } from './ui';
import { useToast } from './Toast';

type Emp = { employee_id: number; full_name: string; job_title: string; hire_date: string; monthly_salary: number; manager_id: number | null; department: string; manager: string | null; email: string | null; role: string | null };
type User = { user_id: number; full_name: string; email: string; is_active: number; last_login_at: string | null; role: string };
type Role = { role_id: number; role_name: string; description: string; permissions: string[] };

export function StaffManager({ employees, users, roles, departments, meId }: { employees: Emp[]; users: User[]; roles: Role[]; departments: { department_id: number; name: string }[]; meId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<'team' | 'org' | 'users' | 'matrix'>('team');
  const [form, setForm] = useState<null | { id?: number; fullName: string; jobTitle: string; departmentId: number; managerId: string; hireDate: string; salary: string }>(null);
  const [del, setDel] = useState<Emp | null>(null);
  const [acct, setAcct] = useState<null | { fullName: string; email: string; role: string; password: string }>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => router.refresh();

  const save = async () => {
    if (!form) return; setBusy(true);
    try {
      if (form.id) await api(`/api/employees/${form.id}`, { method: 'PATCH', body: { jobTitle: form.jobTitle, salary: Number(form.salary), managerId: form.managerId ? Number(form.managerId) : null } });
      else await api('/api/staff', { body: { fullName: form.fullName, jobTitle: form.jobTitle, departmentId: form.departmentId, managerId: form.managerId ? Number(form.managerId) : null, hireDate: form.hireDate, salary: Number(form.salary) } });
      toast.success(form.id ? 'Employee updated' : 'Employee added'); setForm(null); refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => { if (!del) return; setBusy(true); try { await api(`/api/employees/${del.employee_id}`, { method: 'DELETE' }); toast.success('Employee removed'); setDel(null); refresh(); } catch (e) { toast.error((e as Error).message); setDel(null); } finally { setBusy(false); } };
  const createAccount = async () => {
    if (!acct) return; setBusy(true);
    try { await api('/api/users', { body: acct }); toast.success(`Account created for ${acct.fullName}`); setAcct(null); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const patchUser = async (id: number, body: object, msg: string) => { try { await api(`/api/users/${id}`, { method: 'PATCH', body }); toast.success(msg); refresh(); } catch (e) { toast.error((e as Error).message); } };

  // org tree
  const tree = useMemo(() => {
    const by = new Map<number | null, Emp[]>();
    employees.forEach((e) => by.set(e.manager_id, [...(by.get(e.manager_id) ?? []), e]));
    const walk = (parent: number | null, depth: number): { e: Emp; depth: number }[] => (by.get(parent) ?? []).flatMap((e) => [{ e, depth }, ...walk(e.employee_id, depth + 1)]);
    return walk(null, 0);
  }, [employees]);

  const allPerms = [...new Set(roles.flatMap((r) => r.permissions))].sort();
  const roleTone = (r: string) => (r === 'admin' ? 'gold' : r === 'manager' ? 'info' : r === 'receptionist' ? 'ok' : 'mute') as 'gold';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'team', label: 'Team', count: employees.length }, { value: 'org', label: 'Org chart' }, { value: 'users', label: 'Accounts', count: users.length }, { value: 'matrix', label: 'Role permissions' }]} />
        {tab === 'users' && <button className="btn btn-gold btn-sm" onClick={() => setAcct({ fullName: '', email: '', role: 'receptionist', password: '' })}><UserPlus className="size-4" />Create staff account</button>}
        {tab === 'team' && <button className="btn btn-gold btn-sm" onClick={() => setForm({ fullName: '', jobTitle: '', departmentId: departments[0].department_id, managerId: '', hireDate: new Date().toISOString().slice(0, 10), salary: '' })}><Plus className="size-4" />Add employee</button>}
      </div>

      {tab === 'team' && (
        <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>Employee</th><th>Department</th><th>Reports to</th><th>Joined</th><th className="text-right">Salary / mo</th><th /></tr></thead>
          <tbody>{employees.map((e) => (
            <tr key={e.employee_id}><td><p className="font-semibold">{e.full_name}</p><p className="text-xs text-mist">{e.job_title}</p></td><td className="text-ivory-dim">{e.department}</td><td className="text-ivory-dim">{e.manager ?? <span className="text-mist">—</span>}</td><td className="text-ivory-dim">{fmtDate(e.hire_date)}</td><td className="text-right tabular-nums">{money(e.monthly_salary)}</td>
              <td><div className="flex justify-end gap-1"><button aria-label="Edit" className="rounded-full p-2 text-mist hover:text-gold-300" onClick={() => setForm({ id: e.employee_id, fullName: e.full_name, jobTitle: e.job_title, departmentId: departments.find((d) => d.name === e.department)!.department_id, managerId: e.manager_id ? String(e.manager_id) : '', hireDate: e.hire_date, salary: String(e.monthly_salary) })}><Pencil className="size-4" /></button><button aria-label="Delete" className="rounded-full p-2 text-mist hover:text-bad" onClick={() => setDel(e)}><Trash2 className="size-4" /></button></div></td></tr>))}</tbody></table></div></div>
      )}

      {tab === 'org' && (
        <div className="panel p-6"><p className="mb-5 flex items-center gap-2 text-xs text-mist"><Network className="size-4" />Built from employees.manager_id (self-referencing foreign key). Report #4 renders the same tree in SQL with a recursive CTE.</p>
          <ul>{tree.map(({ e, depth }) => (
            <li key={e.employee_id} className="relative flex items-center gap-4 py-2" style={{ paddingLeft: depth * 34 }}>
              {depth > 0 && <span className="absolute top-0 h-1/2 w-5 rounded-bl-xl border-b border-l hairline" style={{ left: depth * 34 - 20 }} />}
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold', depth === 0 ? 'bg-gradient-to-br from-gold-200 to-gold-500 text-ink-950' : 'border hairline bg-white/[0.04] text-ivory-dim')}>{e.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
              <span><b className="block text-sm">{e.full_name}</b><span className="text-xs text-mist">{e.job_title} · {e.department}</span></span>
            </li>))}</ul></div>
      )}

      {tab === 'users' && (
        <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>Account</th><th>Role</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.user_id} className={u.is_active ? '' : 'opacity-55'}>
              <td><p className="font-semibold">{u.full_name}{u.user_id === meId && <span className="ml-2 text-xs text-gold-300">(you)</span>}</p><p className="text-xs text-mist">{u.email}</p></td>
              <td><select disabled={u.user_id === meId} value={u.role} onChange={(e) => patchUser(u.user_id, { role: e.target.value }, `Role changed to ${e.target.value}`)} className="field !w-40 !rounded-full !py-1.5 text-xs capitalize" aria-label={`Role for ${u.full_name}`}>{roles.map((r) => <option key={r.role_id} value={r.role_name}>{r.role_name}</option>)}</select></td>
              <td className="text-ivory-dim">{fmtDateTime(u.last_login_at)}</td><td><Badge tone={u.is_active ? 'ok' : 'bad'}>{u.is_active ? 'Active' : 'Disabled'}</Badge></td>
              <td className="text-right">{u.user_id !== meId && <button className="btn btn-ghost btn-xs" onClick={() => patchUser(u.user_id, { isActive: !u.is_active }, u.is_active ? 'Account disabled' : 'Account enabled')}>{u.is_active ? <><ShieldOff className="size-3.5" />Disable</> : <><ShieldCheck className="size-3.5" />Enable</>}</button>}</td></tr>))}</tbody></table></div></div>
      )}

      {tab === 'matrix' && (
        <div className="panel overflow-hidden"><div className="flex items-center gap-2 border-b hairline px-6 py-4 text-xs text-mist"><KeyRound className="size-4 text-gold-400" />Live from roles → role_permissions → permissions. Every API route and page checks these rows (cached in Redis for 5 minutes).</div>
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Permission</th>{roles.map((r) => <th key={r.role_id} className="text-center"><Badge tone={roleTone(r.role_name)}>{r.role_name}</Badge></th>)}</tr></thead>
            <tbody>{allPerms.map((p) => <tr key={p}><td className="font-mono text-xs text-ivory-dim">{p}</td>{roles.map((r) => <td key={r.role_id} className="text-center">{r.permissions.includes(p) ? <Check className="mx-auto size-4 text-ok" /> : <span className="text-ink-500">·</span>}</td>)}</tr>)}</tbody></table></div></div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit employee' : 'Add employee'}>
        {form && <div className="space-y-4">
          {!form.id && <Field label="Full name"><input className="field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>}
          <Field label="Job title"><input className="field" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            {!form.id && <Field label="Department"><select className="field" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: Number(e.target.value) })}>{departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}</select></Field>}
            <Field label="Reports to"><select className="field" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}><option value="">— nobody —</option>{employees.filter((e) => e.employee_id !== form.id).map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>)}</select></Field>
            {!form.id && <Field label="Hire date"><input type="date" className="field" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></Field>}
            <Field label="Monthly salary (₹)"><input className="field" inputMode="numeric" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></Field>
          </div>
          <button className="btn btn-gold w-full" disabled={busy || !form.jobTitle || !form.salary || (!form.id && !form.fullName)} onClick={save}>{busy && <Spinner />}{form.id ? 'Save changes' : 'Add employee'}</button>
        </div>}
      </Modal>
      <Modal open={!!acct} onClose={() => setAcct(null)} title="Create staff account" subtitle="The person can sign in immediately with this email and temporary password, and can change it with “Forgot password?”.">
        {acct && <div className="space-y-4">
          <Field label="Full name"><input className="field" value={acct.fullName} onChange={(e) => setAcct({ ...acct, fullName: e.target.value })} /></Field>
          <Field label="Email"><input className="field" type="email" value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role"><select className="field capitalize" value={acct.role} onChange={(e) => setAcct({ ...acct, role: e.target.value })}>{roles.filter((r) => r.role_name !== 'guest').map((r) => <option key={r.role_id} value={r.role_name}>{r.role_name}</option>)}</select></Field>
            <Field label="Temporary password" hint="8+ characters, with a number"><input className="field" type="text" autoComplete="off" value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} /></Field>
          </div>
          <button className="btn btn-gold w-full" disabled={busy || !acct.fullName || !acct.email || acct.password.length < 8} onClick={createAccount}>{busy && <Spinner />}Create account</button>
        </div>}
      </Modal>
      <Confirm open={!!del} danger busy={busy} title="Remove this employee?" confirmLabel="Remove" message={`${del?.full_name} will be deleted. Direct reports are kept and left without a manager (ON DELETE SET NULL).`} onConfirm={remove} onClose={() => setDel(null)} />
    </>
  );
}
