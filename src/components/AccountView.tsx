'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarDays, Moon, Users, Receipt, BellRing, Star, Heart, Pencil, Trash2, Crown, Sparkles, Plus, ArrowRight, BedDouble, CreditCard, X, FileText, CalendarClock, MailWarning } from 'lucide-react';
import type { Reservation, Service, RoomType } from '@/lib/hotel';
import type { Review, ServiceReco } from '@/lib/graph';
import { api } from '@/lib/client';
import { fmtDate, fmtDateShort, money } from '@/lib/format';
import { Modal, Confirm, StatusBadge, Stars, StarPicker, Spinner, Segmented, Empty, Badge, cn } from './ui';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { PaymentModal } from './PaymentModal';
import { ModifyModal } from './ModifyModal';
import { useSettings } from './SettingsProvider';

type Order = { order_id: number; reservation_id: number; quantity: number; unit_price: number; status: string; service_name: string; category: string };
type Wish = { typeId: number; note: string; addedAt: number; room: RoomType };
type Props = {
  guest: { name: string; tier: string; points: number; email: string; verified: boolean };
  types?: { type_id: number; name: string; base_price: number }[];
  reservations: Reservation[]; orders: Order[]; services: Service[]; reviewedIds: number[];
  myReviews: Review[]; reco: ServiceReco[]; wishlist: Wish[];
};

function Loyalty({ tier, points }: { tier: string; points: number }) {
  const cfg = useSettings();
  const TIERS = [{ name: 'Silver', at: 0 }, { name: 'Gold', at: cfg.loyalty_gold_points }, { name: 'Platinum', at: cfg.loyalty_platinum_points }];
  const idx = TIERS.findIndex((t) => t.name === tier);
  const next = TIERS[idx + 1];
  const pct = next ? Math.min(100, ((points - TIERS[idx].at) / (next.at - TIERS[idx].at)) * 100) : 100;
  return (
    <div className="relative isolate overflow-hidden rounded-[1.4rem] border border-gold-400/30 bg-gradient-to-br from-gold-400/20 via-ink-800 to-ink-900 p-7 grain">
      <div className="flex items-start justify-between">
        <div><p className="eyebrow">{cfg.hotel_name.split(' ').pop()} Circle</p><p className="font-display mt-2 text-5xl font-semibold">{tier}</p></div>
        <Crown className="size-9 text-gold-300" />
      </div>
      <p className="mt-7 text-sm text-ivory-dim"><b className="font-display text-3xl text-ivory">{points.toLocaleString('en-IN')}</b> points</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-200" /></div>
      <p className="mt-2.5 text-xs text-mist">{next ? `${(next.at - points).toLocaleString('en-IN')} points to ${next.name}` : 'You hold our highest tier'}</p>
    </div>
  );
}

export function AccountView({ guest, reservations, orders, services, reviewedIds, myReviews, reco, wishlist }: Props) {
  const router = useRouter();
  const toast = useToast();
  const cfg = useSettings();
  const [tab, setTab] = useState<'stays' | 'wishlist' | 'reviews'>('stays');
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [pay, setPay] = useState<Reservation | null>(null);
  const [modifyFor, setModifyFor] = useState<Reservation | null>(null);
  const [resent, setResent] = useState(false);
  const [orderFor, setOrderFor] = useState<Reservation | null>(null);
  const [reviewFor, setReviewFor] = useState<{ reservation?: Reservation; review?: Review } | null>(null);
  const [cancelFor, setCancelFor] = useState<Reservation | null>(null);
  const [delReview, setDelReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => router.refresh();
  const live = (x: Reservation) => ['pending', 'confirmed', 'checked_in'].includes(x.status);
  const payGroup = pay?.group_code ? reservations.filter((x) => x.group_code === pay.group_code && live(x) && x.balance_due > 0) : undefined;
  const resend = async () => { try { const d = await api<{ message: string }>('/api/auth/resend-verification', { method: 'POST' }); toast.success(d.message); setResent(true); } catch (e) { toast.error((e as Error).message); } };

  const upcoming = reservations.filter((r) => ['pending', 'confirmed', 'checked_in'].includes(r.status));
  const past = reservations.filter((r) => !['pending', 'confirmed', 'checked_in'].includes(r.status));
  const shown = filter === 'upcoming' ? upcoming : filter === 'past' ? past : reservations;
  const ordersBy = useMemo(() => { const m = new Map<number, Order[]>(); orders.forEach((o) => m.set(o.reservation_id, [...(m.get(o.reservation_id) ?? []), o])); return m; }, [orders]);

  const doCancel = async () => {
    if (!cancelFor) return; setBusy(true);
    try { const r = await api<{ message: string }>(`/api/reservations/${cancelFor.reservation_id}`, { method: 'PATCH', body: { action: 'cancel' } }); toast.success(r.message); setCancelFor(null); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const cancelOrder = async (id: number) => { try { await api(`/api/orders/${id}`, { method: 'PATCH', body: { status: 'cancelled' } }); toast.success('Request cancelled'); refresh(); } catch (e) { toast.error((e as Error).message); } };
  const removeReview = async () => {
    if (!delReview) return; setBusy(true);
    try { await api(`/api/reviews/${delReview.id}`, { method: 'DELETE' }); toast.success('Review deleted'); setDelReview(null); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const unwish = async (typeId: number) => { try { await api(`/api/wishlist?typeId=${typeId}`, { method: 'DELETE' }); refresh(); } catch (e) { toast.error((e as Error).message); } };

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="font-display mt-3 text-5xl font-medium leading-[1.02] sm:text-6xl">Hello, <span className="gold-text italic">{guest.name.split(' ')[0]}</span></h1>
          <p className="mt-4 text-mist">{upcoming.length ? `You have ${upcoming.length} upcoming or current stay${upcoming.length > 1 ? 's' : ''}.` : 'No upcoming stays yet. Your next escape is a click away.'}</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link href="/rooms" className="btn btn-gold"><Plus className="size-4" />New reservation</Link></div>
        </div>
        <Loyalty tier={guest.tier} points={guest.points} />
      </div>

      {!guest.verified && (
        <div role="status" className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-warn/30 bg-warn/10 px-5 py-4 text-sm text-warn">
          <MailWarning className="size-5 shrink-0" /><p className="flex-1">Please verify your email address ({guest.email}). We sent you a link when you signed up.</p>
          <button className="btn btn-ghost btn-xs" onClick={resend} disabled={resent}>{resent ? 'Email sent' : 'Resend verification email'}</button>
        </div>
      )}

      {reco.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2.5"><Sparkles className="size-4 text-gold-400" /><h2 className="eyebrow">Recommended for you</h2><span className="text-xs text-mist">· guests with similar stays loved these</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {reco.map((r) => (
              <div key={r.serviceId} className="panel flex items-center gap-4 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold-400/30 text-gold-400"><Icon name={r.category} className="size-5" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{r.name}</span><span className="block text-xs text-mist">{r.fans} similar guest{r.fans > 1 ? 's' : ''} ordered</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-b hairline pb-5">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'stays', label: 'My stays', count: reservations.length }, { value: 'wishlist', label: 'Wishlist', count: wishlist.length }, { value: 'reviews', label: 'My reviews', count: myReviews.length }]} />
        {tab === 'stays' && <Segmented value={filter} onChange={setFilter} options={[{ value: 'upcoming', label: 'Upcoming', count: upcoming.length }, { value: 'past', label: 'Past', count: past.length }, { value: 'all', label: 'All' }]} />}
      </div>

      {tab === 'stays' && (
        <div className="mt-8 space-y-6">
          {!shown.length && <div className="panel"><Empty icon={<BedDouble className="size-6" />} title="Nothing here yet" hint="When you book a room, your stay will appear here with every detail." action={<Link href="/rooms" className="btn btn-gold btn-sm">Browse rooms</Link>} /></div>}
          {shown.map((r) => {
            const live = ['pending', 'confirmed', 'checked_in'].includes(r.status);
            const rOrders = ordersBy.get(r.reservation_id) ?? [];
            return (
              <motion.article key={r.reservation_id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel grid overflow-hidden md:grid-cols-[17rem_1fr]">
                <div className="relative min-h-44">
                  { }
                  <img src={r.image_url.replace('w=1600', 'w=700')} alt={r.room_type} loading="lazy" className={cn('absolute inset-0 size-full object-cover', !live && 'grayscale-[0.6]')} />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-ink-900/70 max-md:bg-gradient-to-t" />
                </div>
                <div className="flex flex-col p-6 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold tracking-widest text-gold-400">{r.reservation_code}{r.group_code && <span className="ml-3 rounded-full border border-gold-400/30 px-2.5 py-0.5 text-[0.62rem] tracking-wider text-gold-200">{r.group_size} rooms · {r.group_code}</span>}</p><h3 className="font-display mt-1 text-3xl font-semibold leading-tight">{r.room_type}</h3></div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-sm text-ivory-dim">
                    <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-gold-400" />{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</span>
                    <span className="inline-flex items-center gap-2"><Moon className="size-4 text-gold-400" />{r.nights} night{r.nights > 1 ? 's' : ''}</span>
                    <span className="inline-flex items-center gap-2"><Users className="size-4 text-gold-400" />{r.adults + r.children} guest{r.adults + r.children > 1 ? 's' : ''}</span>
                    <span className="inline-flex items-center gap-2"><BedDouble className="size-4 text-gold-400" />Room {r.room_number}</span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border hairline bg-white/[0.02] p-4 text-sm">
                    <div><p className="text-xs text-mist">Room total</p><p className="mt-0.5 font-semibold">{money(r.total_amount)}</p></div>
                    <div><p className="text-xs text-mist">Services</p><p className="mt-0.5 font-semibold">{money(r.services_total)}</p></div>
                    <div><p className="text-xs text-mist">Balance due</p><p className={cn('mt-0.5 font-bold', r.balance_due > 0 ? 'text-warn' : 'text-ok')}>{r.balance_due > 0 ? money(r.balance_due) : 'Settled'}</p></div>
                  </div>

                  {rOrders.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {rOrders.map((o) => (
                        <li key={o.order_id} className="flex items-center gap-3 text-sm">
                          <Icon name={o.category} className="size-4 shrink-0 text-gold-400" /><span className="flex-1 truncate text-ivory-dim">{o.quantity > 1 && `${o.quantity}× `}{o.service_name}</span>
                          <span className="text-mist">{money(o.quantity * o.unit_price)}</span><StatusBadge status={o.status} kind="order" />
                          {o.status === 'requested' && <button onClick={() => cancelOrder(o.order_id)} aria-label="Cancel request" className="rounded-full p-1 text-mist hover:text-bad"><X className="size-4" /></button>}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-6 flex flex-wrap gap-2.5 pt-1">
                    {live && r.balance_due > 0 && <button className="btn btn-gold btn-sm" onClick={() => setPay(r)}><CreditCard className="size-4" />{r.group_code ? `Pay for all ${r.group_size} rooms` : r.status === 'pending' ? 'Pay deposit to confirm' : 'Pay balance'}</button>}
                    {['confirmed', 'checked_in'].includes(r.status) && <button className="btn btn-ghost btn-sm" onClick={() => setOrderFor(r)}><BellRing className="size-4" />Order services</button>}
                    {r.status === 'checked_out' && !reviewedIds.includes(r.reservation_id) && <button className="btn btn-gold btn-sm" onClick={() => setReviewFor({ reservation: r })}><Star className="size-4" />Write a review</button>}
                    {r.status === 'checked_out' && reviewedIds.includes(r.reservation_id) && <Badge tone="ok">Reviewed</Badge>}
                    {['pending', 'confirmed'].includes(r.status) && <button className="btn btn-ghost btn-sm" onClick={() => setModifyFor(r)}><CalendarClock className="size-4" />Change dates / room</button>}
                    {!['cancelled', 'no_show'].includes(r.status) && <a className="btn btn-ghost btn-sm" href={`/api/reservations/${r.reservation_id}/invoice`} target="_blank" rel="noreferrer"><FileText className="size-4" />Invoice</a>}
                    {['pending', 'confirmed'].includes(r.status) && <button className="btn btn-danger btn-sm ml-auto" onClick={() => setCancelFor(r)}>Cancel</button>}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {tab === 'wishlist' && (
        <div className="mt-8">
          {!wishlist.length ? <div className="panel"><Empty icon={<Heart className="size-6" />} title="Your wishlist is empty" hint="Tap the heart on any room to save it here." action={<Link href="/rooms" className="btn btn-gold btn-sm">Explore rooms</Link>} /></div> : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((w) => <WishCard key={w.typeId} w={w} onRemove={() => unwish(w.typeId)} onSaved={refresh} />)}
            </div>
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="mt-8 space-y-5">
          {!myReviews.length && <div className="panel"><Empty icon={<Star className="size-6" />} title="No reviews yet" hint="After a stay, share your experience. Your words help future guests." /></div>}
          {myReviews.map((rv) => (
            <article key={rv.id} className="panel p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><Stars value={rv.rating} /><h3 className="font-display mt-3 text-2xl font-semibold">{rv.title}</h3><p className="mt-1 text-xs text-mist">{rv.roomType} · {fmtDate(rv.createdAt.slice(0, 10))}{rv.updatedAt && ' · edited'}</p></div>
                <div className="flex gap-2"><button className="btn btn-ghost btn-xs" onClick={() => setReviewFor({ review: rv })}><Pencil className="size-3.5" />Edit</button><button className="btn btn-danger btn-xs" onClick={() => setDelReview(rv)}><Trash2 className="size-3.5" />Delete</button></div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ivory-dim">{rv.body}</p>
              {rv.reply && <div className="mt-5 rounded-xl border-l-2 border-gold-400 bg-gold-400/[0.06] p-4 text-sm"><p className="eyebrow !text-[0.6rem]">Reply from {cfg.hotel_name}</p><p className="mt-1.5 text-ivory-dim">{rv.reply}</p></div>}
            </article>
          ))}
        </div>
      )}

      <PaymentModal target={pay} group={payGroup} onClose={() => setPay(null)} onPaid={() => { setPay(null); refresh(); }} />
      <ModifyModal reservation={modifyFor} onClose={() => setModifyFor(null)} onDone={() => { setModifyFor(null); refresh(); }} />
      <ServiceModal reservation={orderFor} services={services} onClose={() => setOrderFor(null)} onDone={() => { setOrderFor(null); refresh(); }} />
      <ReviewModal ctx={reviewFor} onClose={() => setReviewFor(null)} onDone={() => { setReviewFor(null); refresh(); }} />
      <Confirm open={!!cancelFor} danger busy={busy} title="Cancel this reservation?" confirmLabel="Yes, cancel"
        message={cancelFor ? `${cancelFor.room_type} · ${fmtDateShort(cancelFor.check_in)} → ${fmtDateShort(cancelFor.check_out)}. Cancellations ${cfg.free_cancel_hours}+ hours before arrival are refunded in full; inside that window the stay is non-refundable.` : ''}
        onConfirm={doCancel} onClose={() => setCancelFor(null)} />
      <Confirm open={!!delReview} danger busy={busy} title="Delete this review?" confirmLabel="Delete" message="This permanently removes your review from the hotel's guest graph." onConfirm={removeReview} onClose={() => setDelReview(null)} />
    </>
  );
}

/* ───────── wishlist card with inline note editing (Redis UPDATE) ───────── */
function WishCard({ w, onRemove, onSaved }: { w: Wish; onRemove: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState(w.note);
  const [editing, setEditing] = useState(false);
  const save = async () => { try { await api('/api/wishlist', { method: 'PATCH', body: { typeId: w.typeId, note } }); setEditing(false); toast.success('Note saved'); onSaved(); } catch (e) { toast.error((e as Error).message); } };
  return (
    <article className="panel overflow-hidden">
      <Link href={`/rooms/${w.room.slug}`} className="img-zoom block aspect-[16/10] overflow-hidden">{ }<img src={w.room.image_url.replace('w=1600', 'w=700')} alt={w.room.name} loading="lazy" className="size-full object-cover" /></Link>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3"><h3 className="font-display text-2xl font-semibold leading-tight">{w.room.name}</h3><button onClick={onRemove} aria-label="Remove" className="rounded-full p-1.5 text-mist hover:text-bad"><Trash2 className="size-4" /></button></div>
        <p className="mt-1 text-sm text-gold-300">{money(w.room.base_price)} <span className="text-mist">/ night</span></p>
        {editing ? (
          <div className="mt-3 flex gap-2"><input className="field !py-2 text-sm" value={note} maxLength={160} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" aria-label="Note" autoFocus /><button className="btn btn-gold btn-xs" onClick={save}>Save</button></div>
        ) : (
          <button onClick={() => setEditing(true)} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed hairline px-3 py-2 text-left text-xs text-mist transition hover:border-gold-400/50 hover:text-ivory"><Pencil className="size-3.5" />{w.note || 'Add a note (e.g. “for our anniversary”)'}</button>
        )}
        <Link href={`/rooms/${w.room.slug}`} className="btn btn-ghost btn-sm mt-4 w-full">Check dates <ArrowRight className="size-4" /></Link>
      </div>
    </article>
  );
}

/* ───────── order services ───────── */
function ServiceModal({ reservation, services, onClose, onDone }: { reservation: Reservation | null; services: Service[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const cats = ['all', ...Array.from(new Set(services.map((s) => s.category)))];
  const list = services.filter((s) => cat === 'all' || s.category === cat);
  const total = services.reduce((a, s) => a + (cart[s.service_id] ?? 0) * s.price, 0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const bump = (id: number, d: number) => setCart((c) => { const n = Math.max(0, Math.min(10, (c[id] ?? 0) + d)); const x = { ...c }; if (n) x[id] = n; else delete x[id]; return x; });

  const submit = async () => {
    if (!reservation) return; setBusy(true);
    try {
      for (const [id, q] of Object.entries(cart)) await api(`/api/reservations/${reservation.reservation_id}/orders`, { body: { serviceId: Number(id), quantity: q, notes: notes || undefined } });
      toast.success('Requests sent. Our team will confirm shortly.'); setCart({}); setNotes(''); onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!reservation} onClose={onClose} wide title="Order services" subtitle={reservation ? `Added to your folio for ${reservation.room_type}, room ${reservation.room_number}` : ''}>
      <div className="flex flex-wrap gap-2">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={cn('rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition', cat === c ? 'border-gold-400 bg-gold-400/10 text-gold-200' : 'hairline text-ivory-dim hover:border-white/25')}>{c}</button>)}</div>
      <ul className="mt-5 grid max-h-[46vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {list.map((s) => {
          const q = cart[s.service_id] ?? 0;
          return (
            <li key={s.service_id} className={cn('rounded-2xl border p-4 transition', q ? 'border-gold-400/60 bg-gold-400/[0.06]' : 'hairline')}>
              <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold-400/30 text-gold-400"><Icon name={s.category} /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-snug">{s.name}</p><p className="mt-0.5 line-clamp-2 text-xs text-mist">{s.description}</p></div></div>
              <div className="mt-3 flex items-center justify-between"><span className="font-semibold text-gold-300">{money(s.price)}</span>
                <div className="flex items-center gap-2.5"><button aria-label="Less" disabled={!q} onClick={() => bump(s.service_id, -1)} className="grid size-7 place-items-center rounded-full border hairline text-sm disabled:opacity-30">−</button><span className="w-4 text-center text-sm font-semibold tabular-nums">{q}</span><button aria-label="More" onClick={() => bump(s.service_id, 1)} className="grid size-7 place-items-center rounded-full border hairline text-sm hover:border-gold-400">+</button></div></div>
            </li>
          );
        })}
      </ul>
      <input className="field mt-4" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={255} placeholder="Notes for the team (timing, allergies…)" aria-label="Notes" />
      <div className="mt-5 flex items-center justify-between gap-4 border-t hairline pt-5">
        <p className="text-sm text-mist">{count} item{count !== 1 ? 's' : ''} · <b className="font-display text-2xl text-ivory">{money(total)}</b></p>
        <button className="btn btn-gold" disabled={!count || busy} onClick={submit}>{busy && <Spinner />}<Receipt className="size-4" />Send request</button>
      </div>
    </Modal>
  );
}

/* ───────── write / edit review (Neo4j CREATE / UPDATE) ───────── */
function ReviewModal({ ctx, onClose, onDone }: { ctx: { reservation?: Reservation; review?: Review } | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const editing = !!ctx?.review;
  const key = ctx?.review?.id ?? ctx?.reservation?.reservation_id ?? 'none';
  return <ReviewForm key={String(key)} ctx={ctx} editing={editing} toast={toast} onClose={onClose} onDone={onDone} />;
}
function ReviewForm({ ctx, editing, toast, onClose, onDone }: { ctx: { reservation?: Reservation; review?: Review } | null; editing: boolean; toast: ReturnType<typeof useToast>; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(ctx?.review?.rating ?? 0);
  const [title, setTitle] = useState(ctx?.review?.title ?? '');
  const [body, setBody] = useState(ctx?.review?.body ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      if (editing) await api(`/api/reviews/${ctx!.review!.id}`, { method: 'PATCH', body: { rating, title, body } });
      else await api('/api/reviews', { body: { reservationId: ctx!.reservation!.reservation_id, rating, title, body } });
      toast.success(editing ? 'Review updated' : 'Thank you. Your review is live.'); onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const room = ctx?.review?.roomType ?? ctx?.reservation?.room_type;
  return (
    <Modal open={!!ctx} onClose={onClose} title={editing ? 'Edit your review' : 'Share your stay'} subtitle={room}>
      <div className="space-y-5">
        <div><p className="label">Your rating</p><StarPicker value={rating} onChange={setRating} /></div>
        <div><label className="label">Headline</label><input className="field" value={title} maxLength={90} onChange={(e) => setTitle(e.target.value)} placeholder="Sum up your stay" /></div>
        <div><label className="label">Your review</label><textarea className="field min-h-32 resize-y" value={body} maxLength={1200} onChange={(e) => setBody(e.target.value)} placeholder="What made it memorable?" /><p className="mt-1 text-right text-xs text-mist">{body.length}/1200</p></div>
        <button className="btn btn-gold w-full" disabled={busy || !rating || title.trim().length < 3 || body.trim().length < 10} onClick={submit}>{busy && <Spinner />}{editing ? 'Save changes' : 'Publish review'}</button>
      </div>
    </Modal>
  );
}
