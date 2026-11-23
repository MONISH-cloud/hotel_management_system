'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Upload, ImageIcon, Users, Maximize2 } from 'lucide-react';
import type { AdminType } from '@/lib/hotel';
import { api } from '@/lib/client';
import { money } from '@/lib/format';
import { Modal, Segmented, Field, Spinner, Confirm, StatusBadge, cn } from './ui';
import { Icon } from './Icon';
import { useToast } from './Toast';

type Amenity = { amenity_id: number; name: string; icon: string };
type Room = { room_id: number; room_number: string; floor_no: number; status: string; room_type: string; type_id: number };
type Form = { id?: number; name: string; tagline: string; description: string; basePrice: string; maxAdults: string; maxChildren: string; sizeSqm: string; bedType: string; viewType: string; imageUrl: string; amenityIds: number[] };

const blank: Form = { name: '', tagline: '', description: '', basePrice: '', maxAdults: '2', maxChildren: '1', sizeSqm: '40', bedType: 'King bed', viewType: '', imageUrl: '', amenityIds: [] };

export function InventoryManager({ types, amenities, rooms }: { types: AdminType[]; amenities: Amenity[]; rooms: Room[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<'types' | 'rooms'>('types');
  const [form, setForm] = useState<Form | null>(null);
  const [roomForm, setRoomForm] = useState<null | { typeId: string; roomNumber: string; floorNo: string }>(null);
  const [delType, setDelType] = useState<AdminType | null>(null);
  const [delRoom, setDelRoom] = useState<Room | null>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const refresh = () => router.refresh();
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => f && { ...f, [k]: e.target.value });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setForm((f) => f && { ...f, imageUrl: data.url });
      toast.success('Photo uploaded');
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };

  const saveType = async () => {
    if (!form) return; setBusy(true);
    try {
      const body = { ...form, id: undefined };
      if (form.id) await api(`/api/room-types/${form.id}`, { method: 'PATCH', body }); else await api('/api/room-types', { body });
      toast.success(form.id ? 'Room type updated' : 'Room type created'); setForm(null); refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const removeType = async () => { if (!delType) return; setBusy(true); try { await api(`/api/room-types/${delType.type_id}`, { method: 'DELETE' }); toast.success('Room type deleted'); setDelType(null); refresh(); } catch (e) { toast.error((e as Error).message); setDelType(null); } finally { setBusy(false); } };
  const saveRoom = async () => { if (!roomForm) return; setBusy(true); try { await api('/api/rooms', { body: { typeId: Number(roomForm.typeId), roomNumber: roomForm.roomNumber, floorNo: Number(roomForm.floorNo) } }); toast.success('Room added'); setRoomForm(null); refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  const removeRoom = async () => { if (!delRoom) return; setBusy(true); try { await api(`/api/rooms/${delRoom.room_id}`, { method: 'DELETE' }); toast.success('Room deleted'); setDelRoom(null); refresh(); } catch (e) { toast.error((e as Error).message); setDelRoom(null); } finally { setBusy(false); } };

  const edit = (t: AdminType) => setForm({ id: t.type_id, name: t.name, tagline: t.tagline, description: t.description, basePrice: String(t.base_price), maxAdults: String(t.max_adults), maxChildren: String(t.max_children), sizeSqm: String(t.size_sqm), bedType: t.bed_type, viewType: t.view_type, imageUrl: t.image_url, amenityIds: t.amenity_ids });
  const shown = rooms.filter((r) => filter === 'all' || String(r.type_id) === filter);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'types', label: 'Room types', count: types.length }, { value: 'rooms', label: 'Rooms', count: rooms.length }]} />
        {tab === 'types'
          ? <button className="btn btn-gold btn-sm" onClick={() => setForm({ ...blank })}><Plus className="size-4" />New room type</button>
          : <button className="btn btn-gold btn-sm" onClick={() => setRoomForm({ typeId: String(types[0]?.type_id ?? ''), roomNumber: '', floorNo: '1' })}><Plus className="size-4" />Add room</button>}
      </div>

      {tab === 'types' && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {types.map((t) => (
            <article key={t.type_id} className="panel overflow-hidden">
              <div className="relative aspect-[16/9] overflow-hidden bg-ink-700">{ }<img src={t.image_url} alt={t.name} loading="lazy" className="size-full object-cover" /></div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3"><h3 className="font-display text-2xl font-semibold leading-tight">{t.name}</h3><p className="font-semibold text-gold-300">{money(t.base_price)}</p></div>
                <p className="mt-1 line-clamp-1 text-sm text-mist">{t.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ivory-dim"><span className="inline-flex items-center gap-1.5"><Maximize2 className="size-3.5 text-gold-400" />{t.size_sqm} m²</span><span className="inline-flex items-center gap-1.5"><Users className="size-3.5 text-gold-400" />{t.max_adults}+{t.max_children}</span><span>{t.room_count} room{t.room_count !== 1 ? 's' : ''}</span></div>
                <div className="mt-5 flex gap-2"><button className="btn btn-ghost btn-xs flex-1" onClick={() => edit(t)}><Pencil className="size-3.5" />Edit</button><button className="btn btn-danger btn-xs" aria-label={`Delete ${t.name}`} onClick={() => setDelType(t)}><Trash2 className="size-3.5" /></button></div>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'rooms' && (
        <>
          <div className="mb-4"><select className="field !w-64 !rounded-full !py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by room type"><option value="all">All room types</option>{types.map((t) => <option key={t.type_id} value={t.type_id}>{t.name}</option>)}</select></div>
          <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Room</th><th>Type</th><th>Floor</th><th>Status</th><th /></tr></thead>
            <tbody>{shown.map((r) => (<tr key={r.room_id}><td className="font-display text-2xl font-semibold">{r.room_number}</td><td className="text-ivory-dim">{r.room_type}</td><td className="text-ivory-dim">{r.floor_no}</td><td><StatusBadge status={r.status} kind="room" /></td><td className="text-right"><button className="rounded-full p-2 text-mist hover:text-bad" aria-label={`Delete room ${r.room_number}`} onClick={() => setDelRoom(r)}><Trash2 className="size-4" /></button></td></tr>))}</tbody>
          </table></div></div>
        </>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} wide title={form?.id ? 'Edit room type' : 'New room type'}>
        {form && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input className="field" value={form.name} onChange={set('name')} /></Field>
              <Field label="Price per night (₹)"><input className="field" inputMode="numeric" value={form.basePrice} onChange={set('basePrice')} /></Field>
              <div className="sm:col-span-2"><Field label="Tagline"><input className="field" value={form.tagline} onChange={set('tagline')} /></Field></div>
              <div className="sm:col-span-2"><Field label="Description"><textarea className="field min-h-24 resize-y" value={form.description} onChange={set('description')} /></Field></div>
              <Field label="Max adults"><input className="field" inputMode="numeric" value={form.maxAdults} onChange={set('maxAdults')} /></Field>
              <Field label="Max children"><input className="field" inputMode="numeric" value={form.maxChildren} onChange={set('maxChildren')} /></Field>
              <Field label="Size (m²)"><input className="field" inputMode="numeric" value={form.sizeSqm} onChange={set('sizeSqm')} /></Field>
              <Field label="Bed type"><input className="field" value={form.bedType} onChange={set('bedType')} /></Field>
              <div className="sm:col-span-2"><Field label="View"><input className="field" value={form.viewType} onChange={set('viewType')} placeholder="e.g. Garden view" /></Field></div>
            </div>
            <div>
              <p className="label">Photo</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border hairline bg-white/[0.03]">
                  {form.imageUrl ?   <img src={form.imageUrl} alt="Preview" className="size-full object-cover" /> : <ImageIcon className="size-6 text-mist" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="btn btn-ghost btn-sm cursor-pointer">{uploading ? <Spinner /> : <Upload className="size-4" />}Upload image<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} /></label>
                  <input className="field !py-2 text-xs" placeholder="…or paste an https:// image URL" value={form.imageUrl} onChange={set('imageUrl')} aria-label="Image URL" />
                </div>
              </div>
            </div>
            <div>
              <p className="label">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {amenities.map((a) => { const on = form.amenityIds.includes(a.amenity_id); return (
                  <button type="button" key={a.amenity_id} aria-pressed={on} onClick={() => setForm({ ...form, amenityIds: on ? form.amenityIds.filter((x) => x !== a.amenity_id) : [...form.amenityIds, a.amenity_id] })}
                    className={cn('inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition', on ? 'border-gold-400 bg-gold-400/10 text-gold-200' : 'hairline text-ivory-dim hover:border-white/25')}><Icon name={a.icon} className="size-3.5" />{a.name}</button>); })}
              </div>
            </div>
            <button className="btn btn-gold w-full" disabled={busy || uploading || !form.name || !form.basePrice || !form.imageUrl} onClick={saveType}>{busy && <Spinner />}{form.id ? 'Save changes' : 'Create room type'}</button>
          </div>
        )}
      </Modal>

      <Modal open={!!roomForm} onClose={() => setRoomForm(null)} title="Add a room">
        {roomForm && (
          <div className="space-y-4">
            <Field label="Room type"><select className="field" value={roomForm.typeId} onChange={(e) => setRoomForm({ ...roomForm, typeId: e.target.value })}>{types.map((t) => <option key={t.type_id} value={t.type_id}>{t.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-4"><Field label="Room number"><input className="field" value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} placeholder="e.g. 109" /></Field><Field label="Floor"><input className="field" inputMode="numeric" value={roomForm.floorNo} onChange={(e) => setRoomForm({ ...roomForm, floorNo: e.target.value })} /></Field></div>
            <button className="btn btn-gold w-full" disabled={busy || !roomForm.roomNumber} onClick={saveRoom}>{busy && <Spinner />}Add room</button>
          </div>
        )}
      </Modal>
      <Confirm open={!!delType} danger busy={busy} title="Delete this room type?" confirmLabel="Delete" message={`“${delType?.name}” will be removed. The database refuses if it still has rooms, so delete or move those first.`} onConfirm={removeType} onClose={() => setDelType(null)} />
      <Confirm open={!!delRoom} danger busy={busy} title="Delete this room?" confirmLabel="Delete" message={`Room ${delRoom?.room_number}. Rooms with reservation history can't be deleted (mark them as maintenance instead).`} onConfirm={removeRoom} onClose={() => setDelRoom(null)} />
    </>
  );
}
