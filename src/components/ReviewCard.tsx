import { Quote } from 'lucide-react';
import type { Review } from '@/lib/graph';
import { fmtDate } from '@/lib/format';
import { Stars, Badge } from './ui';
import { getSettings } from '@/lib/settings';

export async function ReviewCard({ review, compact }: { review: Review; compact?: boolean }) {
  const { hotel_name } = await getSettings();
  const initials = review.guestName.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <figure className="panel relative flex h-full flex-col p-7">
      <Quote className="absolute right-6 top-6 size-8 text-gold-400/20" />
      <Stars value={review.rating} />
      <h4 className="font-display mt-4 text-[1.55rem] font-semibold leading-snug">{review.title}</h4>
      <blockquote className={`mt-3 text-sm leading-relaxed text-ivory-dim ${compact ? 'line-clamp-4' : ''}`}>{review.body}</blockquote>
      {review.reply && (
        <div className="mt-5 rounded-xl border-l-2 border-gold-400 bg-gold-400/[0.06] p-4 text-sm">
          <p className="eyebrow !text-[0.6rem]">Reply from {hotel_name}</p>
          <p className="mt-1.5 text-ivory-dim">{review.reply}</p>
        </div>
      )}
      <figcaption className="mt-auto flex items-center gap-3 pt-6">
        <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-sm font-bold text-ink-950">{initials}</span>
        <span className="flex-1 text-sm">
          <span className="block font-semibold">{review.guestName}</span>
          <span className="block text-xs text-mist">{review.guestCountry} · {review.roomType} · {fmtDate(review.createdAt.slice(0, 10), { month: 'short', year: 'numeric' })}</span>
        </span>
        {review.guestTier !== 'Silver' && <Badge tone="gold">{review.guestTier}</Badge>}
      </figcaption>
    </figure>
  );
}
