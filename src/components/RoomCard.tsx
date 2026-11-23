import Link from 'next/link';
import { Users, Maximize2, BedDouble, Star } from 'lucide-react';
import type { RoomType } from '@/lib/hotel';
import { money } from '@/lib/format';
import { WishlistButton } from './WishlistButton';
import { Badge } from './ui';
import { getSettings } from '@/lib/settings';

export async function RoomCard({ room, query = '', wished = false, signedIn = false, available, nights, priority }: {
  room: RoomType; query?: string; wished?: boolean; signedIn?: boolean; available?: number; nights?: number; priority?: boolean;
}) {
  const sold = available !== undefined && available === 0;
  const { tax_rate_pct } = await getSettings();
  return (
    <article className="panel group relative flex flex-col overflow-hidden transition duration-500 hover:-translate-y-1.5 hover:border-gold-400/30">
      <Link href={`/rooms/${room.slug}${query}`} className="img-zoom relative block aspect-[4/3] overflow-hidden" aria-label={room.name}>
        { }
        <img src={room.image_url.replace('w=1600', 'w=900')} alt={room.name} loading={priority ? 'eager' : 'lazy'} className={`size-full object-cover ${sold ? 'grayscale' : ''}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-transparent to-transparent opacity-80" />
        <div className="absolute left-4 top-4 flex gap-2">
          {available !== undefined && (sold ? <Badge tone="bad">Sold out</Badge> : available <= 2 ? <Badge tone="warn">Only {available} left</Badge> : <Badge tone="ok">Available</Badge>)}
        </div>
        {room.rating && (
          <span className="glass absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
            <Star className="size-3.5 fill-gold-400 text-gold-400" />{room.rating.toFixed(1)}<span className="font-normal text-ivory-dim">({room.review_count})</span>
          </span>
        )}
      </Link>
      <WishlistButton typeId={room.type_id} initial={wished} signedIn={signedIn} className="absolute right-4 top-4" />
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-[1.7rem] font-semibold leading-tight"><Link href={`/rooms/${room.slug}${query}`}>{room.name}</Link></h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-mist">{room.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ivory-dim">
          <span className="inline-flex items-center gap-1.5"><Maximize2 className="size-3.5 text-gold-400" />{room.size_sqm} m²</span>
          <span className="inline-flex items-center gap-1.5"><Users className="size-3.5 text-gold-400" />Up to {room.max_adults + room.max_children}</span>
          <span className="inline-flex items-center gap-1.5"><BedDouble className="size-3.5 text-gold-400" />{room.bed_type}</span>
        </div>
        <div className="mt-auto flex items-end justify-between border-t hairline pt-5 mt-6">
          <div>
            <p className="font-display text-3xl font-semibold leading-none">{money(room.base_price)}</p>
            <p className="mt-1 text-xs text-mist">per night{nights && nights > 1 ? ` · ${money(room.base_price * nights)} for ${nights}` : ''} · + {tax_rate_pct}% tax</p>
          </div>
          <Link href={`/rooms/${room.slug}${query}`} className={`btn btn-sm ${sold ? 'btn-ghost' : 'btn-gold'}`}>{sold ? 'View' : 'Reserve'}</Link>
        </div>
      </div>
    </article>
  );
}
