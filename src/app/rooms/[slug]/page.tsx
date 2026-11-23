import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Maximize2, Users, BedDouble, Eye, Star } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { RoomBooking } from '@/components/RoomBooking';
import { ReviewCard } from '@/components/ReviewCard';
import { WishlistButton } from '@/components/WishlistButton';
import { Icon } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';
import { getSession } from '@/lib/auth';
import { getRoomTypeBySlug, listRoomTypes } from '@/lib/hotel';
import { listReviews, alsoStayedIn } from '@/lib/graph';
import { wishList } from '@/lib/cache';
import { addDays, money, today } from '@/lib/format';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await getRoomTypeBySlug((await params).slug);
  return { title: r?.name ?? 'Room' };
}
export const dynamic = 'force-dynamic';

export default async function RoomPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const room = await getRoomTypeBySlug(slug);
  if (!room) notFound();
  const session = await getSession();

  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const checkIn = ok(sp.checkIn) && sp.checkIn! >= today() ? sp.checkIn! : addDays(today(), 1);
  const checkOut = ok(sp.checkOut) && sp.checkOut! > checkIn ? sp.checkOut! : addDays(checkIn, 3);

  const [reviews, similar, all, wished] = await Promise.all([
    listReviews({ typeId: room.type_id, limit: 6 }),
    alsoStayedIn(room.type_id, 3),
    listRoomTypes(),
    session ? wishList(session.userId) : Promise.resolve([]),
  ]);
  const similarRooms = similar.map((s) => ({ ...s, room: all.find((r) => r.type_id === s.typeId)! })).filter((s) => s.room);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative isolate h-[68vh] min-h-[28rem] overflow-hidden grain">
          { }
          <img src={room.image_url.replace('w=1600', 'w=2200')} alt={room.name} className="absolute inset-0 -z-20 size-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/30 to-ink-950/50" />
          <div className="mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-14 sm:px-8">
            <Link href="/rooms" className="mb-6 inline-flex w-fit items-center gap-2 text-sm text-ivory-dim transition hover:text-gold-300"><ArrowLeft className="size-4" />All rooms</Link>
            <p className="eyebrow animate-fade-up">{room.view_type}</p>
            <h1 className="font-display animate-fade-up delay-1 mt-3 max-w-4xl text-6xl font-medium leading-[0.95] sm:text-8xl">{room.name}</h1>
            <p className="animate-fade-up delay-2 mt-4 max-w-xl text-lg text-ivory-dim">{room.tagline}</p>
          </div>
          <WishlistButton typeId={room.type_id} initial={wished.some((w) => w.typeId === room.type_id)} signedIn={!!session} className="absolute right-6 top-28 !size-12 sm:right-10" />
        </section>

        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-16">
            <Reveal>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[[Maximize2, `${room.size_sqm} m²`, 'Space'], [Users, `${room.max_adults}+${room.max_children}`, 'Adults + children'], [BedDouble, room.bed_type, 'Bedding'], [Eye, room.view_type, 'View']].map(([I, v, l]) => {
                  const Ico = I as typeof Eye;
                  return <div key={String(l)} className="panel p-5"><Ico className="size-5 text-gold-400" /><p className="mt-4 font-semibold leading-snug">{String(v)}</p><p className="mt-1 text-xs text-mist">{String(l)}</p></div>;
                })}
              </div>
              <p className="mt-10 text-lg leading-[1.8] text-ivory-dim">{room.description}</p>
            </Reveal>

            <Reveal>
              <h2 className="font-display text-4xl font-medium">Amenities</h2>
              <ul className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {room.amenities.map((a) => (
                  <li key={a.name} className="flex items-center gap-4 border-b hairline pb-5 text-ivory-dim">
                    <span className="grid size-10 place-items-center rounded-full border border-gold-400/30 text-gold-400"><Icon name={a.icon} className="size-[1.1rem]" /></span>{a.name}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="font-display text-4xl font-medium">Guest reviews</h2>
                {room.rating && <p className="flex items-center gap-2 text-sm"><Star className="size-5 fill-gold-400 text-gold-400" /><b className="text-lg">{room.rating.toFixed(1)}</b><span className="text-mist">· {room.review_count} review{room.review_count !== 1 ? 's' : ''}</span></p>}
              </div>
              {reviews.length ? (
                <div className="mt-8 grid gap-5 md:grid-cols-2">{reviews.map((r) => <ReviewCard key={r.id} review={r} compact />)}</div>
              ) : (
                <p className="panel mt-8 p-10 text-center text-mist">No reviews for this room yet. Stay with us and be the first.</p>
              )}
            </Reveal>

            {similarRooms.length > 0 && (
              <Reveal>
                <h2 className="font-display text-4xl font-medium">Guests also stayed in</h2>
                <p className="mt-2 text-sm text-mist">Suggested by our guest graph: people who stayed here also booked these.</p>
                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  {similarRooms.map((s) => (
                    <Link key={s.typeId} href={`/rooms/${s.slug}`} className="panel img-zoom group overflow-hidden transition hover:border-gold-400/30">
                      { }
                      <div className="aspect-[4/3] overflow-hidden"><img src={s.room.image_url.replace('w=1600', 'w=600')} alt={s.name} loading="lazy" className="size-full object-cover" /></div>
                      <div className="p-4"><p className="font-display text-xl font-semibold leading-tight">{s.name}</p><p className="mt-1 text-xs text-mist">{money(s.room.base_price)} · {s.guests} shared guest{s.guests > 1 ? 's' : ''}</p></div>
                    </Link>
                  ))}
                </div>
              </Reveal>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <RoomBooking room={room} signedIn={!!session} role={session?.role ?? null} initial={{ checkIn, checkOut, adults: Math.min(Number(sp.adults ?? 2) || 2, room.max_adults), children: Math.min(Number(sp.children ?? 0) || 0, room.max_children) }} />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
