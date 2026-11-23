'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Reply, Trash2, MessageSquareQuote } from 'lucide-react';
import type { Review } from '@/lib/graph';
import { api } from '@/lib/client';
import { fmtDate } from '@/lib/format';
import { Modal, Stars, Segmented, Confirm, Spinner, Empty, Badge } from './ui';
import { useToast } from './Toast';

export function ReviewsModeration({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<'all' | 'unanswered' | 'low'>('all');
  const [replyFor, setReplyFor] = useState<Review | null>(null);
  const [text, setText] = useState('');
  const [del, setDel] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const list = reviews.filter((r) => (f === 'all' ? true : f === 'unanswered' ? !r.reply : r.rating <= 3));

  const saveReply = async () => { if (!replyFor) return; setBusy(true); try { await api(`/api/reviews/${replyFor.id}`, { method: 'PATCH', body: { reply: text } }); toast.success(text ? 'Reply published' : 'Reply removed'); setReplyFor(null); router.refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  const remove = async () => { if (!del) return; setBusy(true); try { await api(`/api/reviews/${del.id}`, { method: 'DELETE' }); toast.success('Review deleted'); setDel(null); router.refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };

  return (
    <>
      <Segmented value={f} onChange={setF} options={[{ value: 'all', label: 'All', count: reviews.length }, { value: 'unanswered', label: 'Needs reply', count: reviews.filter((r) => !r.reply).length }, { value: 'low', label: '3★ and below', count: reviews.filter((r) => r.rating <= 3).length }]} />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {!list.length && <div className="panel lg:col-span-2"><Empty icon={<MessageSquareQuote className="size-6" />} title="Nothing to show" /></div>}
        {list.map((r) => (
          <article key={r.id} className="panel flex flex-col p-6">
            <div className="flex items-start justify-between gap-3"><div><Stars value={r.rating} /><h3 className="font-display mt-2.5 text-2xl font-semibold leading-snug">{r.title}</h3></div>{r.reply ? <Badge tone="ok">Replied</Badge> : <Badge tone="warn">Needs reply</Badge>}</div>
            <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{r.body}</p>
            {r.reply && <div className="mt-4 rounded-xl border-l-2 border-gold-400 bg-gold-400/[0.06] p-4 text-sm text-ivory-dim">{r.reply}</div>}
            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <p className="text-xs text-mist"><b className="text-ivory-dim">{r.guestName}</b> · {r.roomType} · {fmtDate(r.createdAt.slice(0, 10))}</p>
              <div className="flex gap-1.5"><button className="btn btn-ghost btn-xs" onClick={() => { setReplyFor(r); setText(r.reply ?? ''); }}><Reply className="size-3.5" />{r.reply ? 'Edit reply' : 'Reply'}</button><button className="btn btn-danger btn-xs" aria-label="Delete review" onClick={() => setDel(r)}><Trash2 className="size-3.5" /></button></div>
            </div>
          </article>
        ))}
      </div>
      <Modal open={!!replyFor} onClose={() => setReplyFor(null)} title="Reply to guest" subtitle={replyFor ? `${replyFor.guestName} · “${replyFor.title}”` : ''}>
        <textarea className="field min-h-32 resize-y" value={text} maxLength={800} onChange={(e) => setText(e.target.value)} placeholder="Thank the guest and address anything they raised…" />
        <div className="mt-5 flex justify-end gap-3">{replyFor?.reply && <button className="btn btn-danger" onClick={() => { setText(''); }}>Clear text</button>}<button className="btn btn-gold" disabled={busy} onClick={saveReply}>{busy && <Spinner />}{text ? 'Publish reply' : 'Remove reply'}</button></div>
      </Modal>
      <Confirm open={!!del} danger busy={busy} title="Delete this review?" confirmLabel="Delete" message="The review node and its relationships are permanently removed from the graph." onConfirm={remove} onClose={() => setDel(null)} />
    </>
  );
}
