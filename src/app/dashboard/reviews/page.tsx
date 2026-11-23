import type { Metadata } from 'next';
import { Share2, Network, MessageSquareQuote, Star } from 'lucide-react';
import { PageHeader, Kpi } from '@/components/DashKit';
import { ReviewsModeration } from '@/components/ReviewsModeration';
import { pageGuard } from '@/lib/auth';
import { listReviews, overallRating, graphCounts, graphAlive } from '@/lib/graph';

export const metadata: Metadata = { title: 'Reviews' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await pageGuard('reviews.moderate', '/dashboard/reviews');
  const [reviews, rating, counts, alive] = await Promise.all([listReviews({ limit: 100 }), overallRating(), graphCounts(), graphAlive()]);
  return (
    <>
      <PageHeader eyebrow="Reputation · Neo4j" title="Guest reviews" subtitle="Reviews are stored as nodes in a Neo4j graph: (Guest)-[:WROTE]->(Review)-[:ABOUT]->(RoomType). Reply, moderate and delete from here." />
      {!alive && <p role="alert" className="mb-6 rounded-2xl border border-warn/30 bg-warn/10 px-5 py-4 text-sm text-warn">Neo4j is not reachable. Start it and run <code>npm run db:seed-nosql</code>.</p>}
      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Star} label="Average rating" value={rating.avg ? rating.avg.toFixed(1) : '–'} sub={`${rating.count} reviews`} />
        <Kpi icon={MessageSquareQuote} label="Awaiting reply" value={reviews.filter((r) => !r.reply).length} sub="Without a management response" tone="warn" />
        <Kpi icon={Network} label="Graph nodes" value={counts.nodes} sub="Guests, room types, services, reviews" tone="info" />
        <Kpi icon={Share2} label="Relationships" value={counts.relationships} sub="STAYED_IN · ORDERED · WROTE · ABOUT" tone="ok" />
      </div>
      <ReviewsModeration reviews={reviews} />
    </>
  );
}
