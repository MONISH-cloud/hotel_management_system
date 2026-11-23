import Link from 'next/link';
import { ArrowRight, Star, ChevronDown } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { BookingBar } from '@/components/BookingBar';
import { RoomCard } from '@/components/RoomCard';
import { ReviewCard } from '@/components/ReviewCard';
import { Reveal } from '@/components/Reveal';
import { Icon } from '@/components/Icon';
import { Stars } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { listRoomTypes, listServices } from '@/lib/hotel';
import { getSettings, fill, listFeatures, listHomeCategories, getMedia } from '@/lib/settings';
import { listReviews, overallRating } from '@/lib/graph';
import { wishList } from '@/lib/cache';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getSession();
  const [rooms, services, rating, reviews, wished, cfg, features, categories, media] = await Promise.all([
    listRoomTypes(),
    listServices(),
    overallRating(),
    listReviews({ limit: 6, minRating: 4 }),
    session ? wishList(session.userId) : Promise.resolve([]),
    getSettings(), listFeatures(), listHomeCategories(), getMedia(),
  ]);
  const wishSet = new Set(wished.map((w) => w.typeId));
  const featured = [...rooms].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.base_price - a.base_price).slice(0, 3);
  const fromPrice = Math.min(...rooms.map((r) => r.base_price));
  const maxDist = Math.max(1, ...Object.values(rating.distribution));

  return (
    <>
      <SiteHeader />
      <main>
        {/* ───────────── HERO ───────────── */}
        <section className="relative isolate flex min-h-[100dvh] flex-col justify-end overflow-hidden pb-10 pt-40 grain">
          { }
          <img src={media.hero?.url} alt={media.hero?.alt ?? ''} className="absolute inset-0 -z-20 size-full scale-105 object-cover" fetchPriority="high" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/80 via-ink-950/25 to-ink-950" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_20%_60%,rgba(7,8,10,.65),transparent)]" />

          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <p className="eyebrow animate-fade-up">Est. {cfg.established_year} · {cfg.neighbourhood}</p>
            <h1 className="font-display animate-fade-up delay-1 mt-6 max-w-4xl text-[clamp(3.4rem,9vw,8rem)] font-medium leading-[0.92]">
              {cfg.hero_headline_lead} <span className="gold-text italic">{cfg.hero_headline_accent}</span>
            </h1>
            <p className="animate-fade-up delay-2 mt-8 max-w-xl text-lg leading-relaxed text-ivory-dim">
              {fill(cfg.hero_subtitle, cfg)}
            </p>
            <div className="animate-fade-up delay-3 mt-10 flex flex-wrap items-center gap-x-10 gap-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Stars value={rating.avg} size={18} />
                <span><b className="text-base">{rating.avg ? rating.avg.toFixed(1) : '–'}</b> <span className="text-mist">from {rating.count} verified guest review{rating.count !== 1 ? 's' : ''}</span></span>
              </div>
              <span className="text-mist">Rooms from <b className="text-ivory">{money(fromPrice)}</b> / night</span>
            </div>
            <div className="animate-fade-up delay-4 mt-12"><BookingBar /></div>
            <a href="#rooms" className="mx-auto mt-10 flex w-fit flex-col items-center gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-mist transition hover:text-gold-300" aria-label="Scroll to rooms">
              Discover <ChevronDown className="size-4 animate-float" />
            </a>
          </div>
        </section>

        {/* ───────────── PILLARS ───────────── */}
        <section className="border-y hairline bg-ink-900">
          <div className="mx-auto grid max-w-7xl gap-px px-5 sm:px-8 md:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.feature_id} delay={i * 0.08} className="flex items-start gap-4 py-8 md:px-6 md:first:pl-0">
                <span className="grid size-12 shrink-0 place-items-center rounded-full border border-gold-400/30 text-gold-400"><Icon name={f.icon} className="size-5" /></span>
                <div><p className="font-semibold">{f.title}</p><p className="mt-1 text-sm text-mist">{fill(f.description, cfg)}</p></div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ───────────── ROOMS ───────────── */}
        <section id="rooms" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Rooms &amp; Suites</p>
              <h2 className="font-display mt-4 max-w-2xl text-5xl font-medium leading-[1.02] sm:text-6xl">{cfg.room_types} ways to <span className="italic text-gold-300">come home</span></h2>
            </div>
            <Link href="/rooms" className="btn btn-ghost">View all rooms <ArrowRight className="size-4" /></Link>
          </Reveal>
          <div className="mt-14 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((r, i) => (
              <Reveal key={r.type_id} delay={i * 0.1}>
                <RoomCard room={r} wished={wishSet.has(r.type_id)} signedIn={!!session} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* ───────────── EXPERIENCES ───────────── */}
        <section id="experiences" className="relative scroll-mt-24 overflow-hidden bg-ink-900 py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="max-w-2xl">
              <p className="eyebrow">Experiences</p>
              <h2 className="font-display mt-4 text-5xl font-medium leading-[1.02] sm:text-6xl">Beyond the <span className="italic text-gold-300">room</span></h2>
              <p className="mt-6 text-ivory-dim">Order any of these from your account during your stay. They are added to your folio and settled at check-out.</p>
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {categories.map((t, i) => {
                const items = services.filter((s) => s.category === t.category).slice(0, 3);
                return (
                  <Reveal key={t.category} delay={(i % 2) * 0.1}>
                    <div className="img-zoom group relative isolate min-h-[27rem] overflow-hidden rounded-[1.4rem] border hairline">
                      { }
                      <img src={t.image_url ?? ''} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover" />
                      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/10" />
                      <div className="flex h-full min-h-[27rem] flex-col justify-end p-8">
                        <span className="mb-4 grid size-11 place-items-center rounded-full border border-gold-400/40 bg-ink-950/40 text-gold-300 backdrop-blur"><Icon name={t.category} className="size-5" /></span>
                        <h3 className="font-display text-4xl font-semibold">{t.title}</h3>
                        <p className="mt-2 max-w-sm text-sm text-ivory-dim">{t.tagline}</p>
                        <ul className="mt-5 space-y-1.5 border-t border-white/15 pt-4 text-sm">
                          {items.map((s) => (
                            <li key={s.service_id} className="flex justify-between gap-4"><span className="text-ivory-dim">{s.name}</span><span className="font-semibold text-gold-300">{money(s.price)}</span></li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───────────── STORY (light) ───────────── */}
        <section className="bg-paper text-ink-900">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 py-28 sm:px-8 lg:grid-cols-2">
            <Reveal>
              <p className="eyebrow !text-gold-600">The {cfg.hotel_name.split(' ').pop()} standard</p>
              <h2 className="font-display mt-4 text-5xl font-medium leading-[1.02] sm:text-6xl">{cfg.story_headline_lead} <span className="italic text-gold-600">{cfg.story_headline_accent}</span></h2>
              <p className="mt-7 max-w-lg leading-relaxed text-ink-600">{fill(cfg.story_text, cfg)}</p>
              <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-ink-900/10 pt-8">
                {[[String(cfg.rooms), 'Rooms & suites'], [String(cfg.spa_treatment_rooms), 'Spa treatment rooms'], [String(cfg.established_year), 'Welcoming guests since']].map(([n, l]) => (
                  <div key={l}><dt className="font-display text-5xl font-semibold text-gold-600">{n}</dt><dd className="mt-1 text-xs uppercase tracking-wider text-ink-500">{l}</dd></div>
                ))}
              </dl>
            </Reveal>
            <Reveal delay={0.1} className="grid grid-cols-5 grid-rows-2 gap-4">
              { }
              <img src={media.story_main?.url} alt={media.story_main?.alt ?? ''} loading="lazy" className="col-span-3 row-span-2 size-full rounded-3xl object-cover shadow-2xl shadow-ink-900/20" />
              <img src={media.story_a?.url} alt={media.story_a?.alt ?? ''} loading="lazy" className="col-span-2 aspect-square size-full rounded-3xl object-cover shadow-xl shadow-ink-900/15" />
              <img src={media.story_b?.url} alt={media.story_b?.alt ?? ''} loading="lazy" className="col-span-2 aspect-square size-full rounded-3xl object-cover shadow-xl shadow-ink-900/15" />
            </Reveal>
          </div>
        </section>

        {/* ───────────── REVIEWS (Neo4j) ───────────── */}
        <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-28 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_2fr]">
            <Reveal>
              <p className="eyebrow">Guest voices</p>
              <h2 className="font-display mt-4 text-5xl font-medium leading-[1.02]">Words from <span className="italic text-gold-300">our guests</span></h2>
              <div className="panel mt-10 p-7">
                <div className="flex items-end gap-4">
                  <p className="font-display text-7xl font-semibold leading-none gold-text">{rating.avg ? rating.avg.toFixed(1) : '–'}</p>
                  <div className="pb-1.5"><Stars value={rating.avg} /><p className="mt-1.5 text-xs text-mist">{rating.count} verified reviews</p></div>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <li key={n} className="flex items-center gap-3 text-xs text-mist">
                      <span className="flex w-6 items-center gap-1">{n}<Star className="size-3 fill-gold-400 text-gold-400" /></span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300" style={{ width: `${(rating.distribution[n] / maxDist) * 100}%` }} /></span>
                      <span className="w-5 text-right tabular-nums">{rating.distribution[n]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <div className="grid gap-5 md:grid-cols-2">
              {reviews.slice(0, 4).map((r, i) => <Reveal key={r.id} delay={i * 0.08}><ReviewCard review={r} compact /></Reveal>)}
              {!reviews.length && <p className="panel col-span-2 p-10 text-center text-mist">Reviews will appear here once guests share their stays.</p>}
            </div>
          </div>
        </section>

        {/* ───────────── CTA ───────────── */}
        <section className="relative isolate overflow-hidden">
          { }
          <img src={media.cta?.url} alt={media.cta?.alt ?? ''} loading="lazy" className="absolute inset-0 -z-20 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-ink-950/75" />
          <div className="mx-auto max-w-3xl px-5 py-32 text-center sm:px-8">
            <Reveal>
              <h2 className="font-display text-5xl font-medium leading-[1.02] sm:text-7xl">{cfg.cta_headline_lead} <span className="gold-text italic">{cfg.cta_headline_accent}</span></h2>
              <p className="mx-auto mt-6 max-w-lg text-ivory-dim">{cfg.cta_text}</p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link href="/rooms" className="btn btn-gold !px-8 !py-4">Reserve your stay <ArrowRight className="size-4" /></Link>
                <Link href="/register" className="btn btn-ghost !px-8 !py-4">Create an account</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
