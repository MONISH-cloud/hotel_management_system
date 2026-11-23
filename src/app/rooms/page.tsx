import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { BookingBar } from '@/components/BookingBar';
import { RoomCard } from '@/components/RoomCard';
import { Reveal } from '@/components/Reveal';
import { getSession } from '@/lib/auth';
import { listRoomTypes, availabilityByType } from '@/lib/hotel';
import { wishList } from '@/lib/cache';
import { addDays, nightsBetween, today } from '@/lib/format';

export const metadata: Metadata = { title: 'Rooms & Suites' };
export const dynamic = 'force-dynamic';

const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function RoomsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const session = await getSession();
  const checkIn = valid(sp.checkIn) && sp.checkIn! >= today() ? sp.checkIn! : addDays(today(), 1);
  const checkOut = valid(sp.checkOut) && sp.checkOut! > checkIn ? sp.checkOut! : addDays(checkIn, 3);
  const adults = Math.min(Math.max(Number(sp.adults ?? 2) || 2, 1), 4);
  const children = Math.min(Math.max(Number(sp.children ?? 0) || 0, 0), 3);
  const sort = sp.sort === 'price-desc' ? 'price-desc' : sp.sort === 'rating' ? 'rating' : 'price-asc';
  const nights = nightsBetween(checkIn, checkOut);
  const qs = `?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`;

  const [all, free, wished] = await Promise.all([
    listRoomTypes(), availabilityByType(checkIn, checkOut), session ? wishList(session.userId) : Promise.resolve([]),
  ]);
  const wishSet = new Set(wished.map((w) => w.typeId));
  const fits = all.filter((r) => r.max_adults >= adults && r.max_children >= children);
  const rooms = [...fits].sort((a, b) =>
    sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : sort === 'price-desc' ? b.base_price - a.base_price : a.base_price - b.base_price);
  const availableCount = rooms.filter((r) => (free[r.type_id] ?? 0) > 0).length;

  const sorts = [['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['rating', 'Top rated']] as const;

  return (
    <>
      <SiteHeader solid />
      <main className="mx-auto max-w-7xl px-5 pb-28 pt-36 sm:px-8">
        <Reveal>
          <p className="eyebrow">Rooms &amp; Suites</p>
          <h1 className="font-display mt-4 text-5xl font-medium leading-[1.02] sm:text-7xl">Find your <span className="gold-text italic">room</span></h1>
        </Reveal>
        <Reveal delay={0.1} className="relative z-20 mt-10"><BookingBar initial={{ checkIn, checkOut, adults, children }} className="!rounded-3xl md:!rounded-full" /></Reveal>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-b hairline pb-5">
          <p className="text-sm text-mist">
            <b className="text-ivory">{availableCount} of {rooms.length}</b> room types available for <b className="text-ivory">{nights} night{nights > 1 ? 's' : ''}</b>
          </p>
          <div className="flex flex-wrap gap-2">
            {sorts.map(([k, l]) => (
              <Link key={k} href={`/rooms${qs}&sort=${k}`} scroll={false} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${sort === k ? 'border-gold-400 bg-gold-400/10 text-gold-200' : 'hairline text-ivory-dim hover:border-white/25'}`}>{l}</Link>
            ))}
          </div>
        </div>

        {rooms.length ? (
          <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r, i) => (
              <Reveal key={r.type_id} delay={(i % 3) * 0.08}>
                <RoomCard room={r} query={qs} available={free[r.type_id] ?? 0} nights={nights} wished={wishSet.has(r.type_id)} signedIn={!!session} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="panel mt-12 p-16 text-center">
            <p className="font-display text-3xl">No room fits that party size</p>
            <p className="mt-2 text-mist">Try fewer guests, or book two rooms for larger groups.</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
