'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check, PackageCheck, X, Power } from 'lucide-react';
import { api } from '@/lib/client';
import { money, timeAgo } from '@/lib/format';
import { Modal, Segmented, StatusBadge, Field, Spinner, Confirm, Badge, Empty } from './ui';
import { Icon } from './Icon';
import { useToast } from './Toast';

type Order = { order_id: number; quantity: number; unit_price: number; status: string; notes: string | null; ordered_at: string; service_name: string; category: string; reservation_code: string; guest_name: string; room_number: string };
type Svc = { service_id: number; name: string; category: string; description: string; price: number; is_active: number };

export function ServicesManager({ orders, services, canCatalogue }: { orders: Order[]; services: Svc[]; canCatalogue: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<'queue' | 'catalogue'>('queue');
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<Svc | null>(null);
  const [edit, setEdit] = useState<{ id: number; price: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'dining', description: '', price: '' });
  const open = orders.filter((o) => ['requested', 'confirmed'].includes(o.status)).length;

  const setStatus = async (id: number, status: string) => { try { await api(`/api/orders/${id}`, { method: 'PATCH', body: { status } }); router.refresh(); } catch (e) { toast.error((e as Error).message); } };
  const patchSvc = async (id: number, body: object, msg: string) => { try { await api(`/api/services/${id}`, { method: 'PATCH', body }); toast.success(msg); setEdit(null); router.refresh(); } catch (e) { toast.error((e as Error).message); } };
  const create = async () => { setBusy(true); try { await api('/api/services', { body: { ...form, price: Number(form.price) } }); toast.success('Service added'); setAdding(false); setForm({ name: '', category: 'dining', description: '', price: '' }); router.refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  const remove = async () => { if (!del) return; setBusy(true); try { await api(`/api/services/${del.service_id}`, { method: 'DELETE' }); toast.success('Service deleted'); setDel(null); router.refresh(); } catch (e) { toast.error((e as Error).message); setDel(null); } finally { setBusy(false); } };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'queue', label: 'Request queue', count: open }, ...(canCatalogue ? [{ value: 'catalogue' as const, label: 'Catalogue', count: services.length }] : [])]} />
        {tab === 'catalogue' && <button className="btn btn-gold btn-sm" onClick={() => setAdding(true)}><Plus className="size-4" />Add service</button>}
      </div>

      {tab === 'queue' && (
        <div className="panel overflow-hidden">
          {!orders.length ? <Empty title="No service requests" /> : <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Service</th><th>Guest</th><th>Room</th><th className="text-right">Amount</th><th>Requested</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.order_id}>
                <td><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full border border-gold-400/30 text-gold-400"><Icon name={o.category} /></span><div><p className="font-semibold">{o.quantity > 1 && `${o.quantity}× `}{o.service_name}</p>{o.notes && <p className="max-w-56 truncate text-xs text-mist">“{o.notes}”</p>}</div></div></td>
                <td>{o.guest_name}<p className="text-xs text-mist">{o.reservation_code}</p></td><td>{o.room_number}</td><td className="text-right tabular-nums">{money(o.quantity * o.unit_price)}</td><td className="text-ivory-dim">{timeAgo(o.ordered_at)}</td><td><StatusBadge status={o.status} kind="order" /></td>
                <td><div className="flex gap-1.5">
                  {o.status === 'requested' && <button className="btn btn-ghost btn-xs" onClick={() => setStatus(o.order_id, 'confirmed')}><Check className="size-3.5" />Confirm</button>}
                  {['requested', 'confirmed'].includes(o.status) && <button className="btn btn-gold btn-xs" onClick={() => setStatus(o.order_id, 'delivered')}><PackageCheck className="size-3.5" />Delivered</button>}
                  {['requested', 'confirmed'].includes(o.status) && <button className="btn btn-danger btn-xs" aria-label="Cancel order" onClick={() => setStatus(o.order_id, 'cancelled')}><X className="size-3.5" /></button>}
                </div></td>
              </tr>))}</tbody></table></div>}
        </div>
      )}

      {tab === 'catalogue' && canCatalogue && (
        <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="tbl">
          <thead><tr><th>Service</th><th>Category</th><th className="text-right">Price</th><th>Active</th><th /></tr></thead>
          <tbody>{services.map((s) => (
            <tr key={s.service_id} className={s.is_active ? '' : 'opacity-50'}>
              <td><p className="font-semibold">{s.name}</p><p className="max-w-md truncate text-xs text-mist">{s.description}</p></td><td><Badge tone="gold">{s.category}</Badge></td>
              <td className="text-right">{edit?.id === s.service_id
                ? <span className="inline-flex gap-1.5"><input autoFocus className="field !w-28 !py-1.5 text-right text-sm" value={edit.price} onChange={(e) => setEdit({ id: s.service_id, price: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && patchSvc(s.service_id, { price: Number(edit.price) }, 'Price updated')} aria-label="Price" /><button className="btn btn-gold btn-xs" onClick={() => patchSvc(s.service_id, { price: Number(edit.price) }, 'Price updated')}>Save</button></span>
                : <button className="font-semibold tabular-nums hover:text-gold-300" onClick={() => setEdit({ id: s.service_id, price: String(s.price) })} title="Click to edit price">{money(s.price)}</button>}</td>
              <td><button onClick={() => patchSvc(s.service_id, { isActive: !s.is_active }, s.is_active ? 'Service deactivated' : 'Service activated')} className={`btn btn-xs ${s.is_active ? 'btn-ghost' : 'btn-dark'}`}><Power className="size-3.5" />{s.is_active ? 'On' : 'Off'}</button></td>
              <td className="text-right"><button className="rounded-full p-2 text-mist hover:text-bad" aria-label="Delete service" onClick={() => setDel(s)}><Trash2 className="size-4" /></button></td>
            </tr>))}</tbody></table></div></div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a service">
        <div className="space-y-4">
          <Field label="Name"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4"><Field label="Category"><select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['dining', 'spa', 'transport', 'laundry', 'experience'].map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Price (₹)"><input className="field" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field></div>
          <Field label="Description"><textarea className="field resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <button className="btn btn-gold w-full" disabled={busy || !form.name || !form.price || !form.description} onClick={create}>{busy && <Spinner />}Add service</button>
        </div>
      </Modal>
      <Confirm open={!!del} danger busy={busy} title="Delete this service?" confirmLabel="Delete" message={`“${del?.name}” will be removed. If it has ever been ordered, the database will refuse (foreign key) and you can deactivate it instead.`} onConfirm={remove} onClose={() => setDel(null)} />
    </>
  );
}
