import 'server-only';
import neo4j, { type Driver } from 'neo4j-driver';
import { requireEnv } from './env';

/**
 * Neo4j graph store (NoSQL)
 * ─────────────────────────
 *  (:Guest)-[:STAYED_IN]->(:RoomType)      built from MySQL stays
 *  (:Guest)-[:ORDERED]->(:Service)         built from MySQL service orders
 *  (:Guest)-[:WROTE]->(:Review)-[:ABOUT]->(:RoomType)    reviews live ONLY here (full CRUD)
 *
 * Powers: guest reviews, rating summaries, "guests like you also enjoyed"
 * service recommendations and "also stayed in" room suggestions.
 * All helpers degrade to empty results if Neo4j is unreachable.
 */

declare global {
   
  var __neo4j: Driver | undefined;
}

function driver(): Driver {
  if (!globalThis.__neo4j) {
    globalThis.__neo4j = neo4j.driver(
      process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687',
      neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', requireEnv('NEO4J_PASSWORD')),
      { maxConnectionPoolSize: 10, connectionTimeout: 2500, maxTransactionRetryTime: 3000 },
    );
  }
  return globalThis.__neo4j;
}

export const int = (n: number) => neo4j.int(n);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJs(v: any): any {
  if (v === null || v === undefined) return v;
  if (neo4j.isInt(v)) return v.toNumber();
  if (Array.isArray(v)) return v.map(toJs);
  if (typeof v === 'object') {
    if (neo4j.isDateTime(v) || neo4j.isDate(v)) return v.toString();
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = toJs(val);
    return out;
  }
  return v;
}

export class GraphError extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cypher<T = any>(query: string, params: Record<string, unknown> = {}, mode: 'r' | 'w' = 'r'): Promise<T[]> {
  const session = driver().session({ defaultAccessMode: mode === 'r' ? neo4j.session.READ : neo4j.session.WRITE });
  try {
    const res = await session.run(query, params);
    return res.records.map((rec) => toJs(rec.toObject()) as T);
  } finally {
    await session.close();
  }
}

/** Never throws – returns `fallback` when the graph is unavailable. */
export async function tryGraph<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[neo4j] unavailable:', (e as Error).message);
    return fallback;
  }
}

export async function graphAlive(): Promise<boolean> {
  return tryGraph(async () => (await cypher('RETURN 1 AS ok')).length === 1, false);
}

/* ───────────────────────── Reviews ───────────────────────── */

export type Review = {
  id: string;
  reservationId: number;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
  reply: string | null;
  repliedAt: string | null;
  guestId: number;
  guestName: string;
  guestCountry: string;
  guestTier: string;
  typeId: number;
  roomType: string;
  roomSlug: string;
};

const REVIEW_RETURN = `
  RETURN r.id AS id, r.reservationId AS reservationId, r.rating AS rating, r.title AS title, r.body AS body,
         toString(r.createdAt) AS createdAt, toString(r.updatedAt) AS updatedAt,
         r.reply AS reply, toString(r.repliedAt) AS repliedAt,
         g.id AS guestId, g.name AS guestName, g.country AS guestCountry, g.tier AS guestTier,
         t.id AS typeId, t.name AS roomType, t.slug AS roomSlug`;

/** READ */
export async function listReviews(opts: { typeId?: number; guestId?: number; limit?: number; minRating?: number } = {}): Promise<Review[]> {
  return tryGraph(
    () => cypher<Review>(
      `MATCH (g:Guest)-[:WROTE]->(r:Review)-[:ABOUT]->(t:RoomType)
       WHERE ($typeId IS NULL OR t.id = $typeId)
         AND ($guestId IS NULL OR g.id = $guestId)
         AND ($minRating IS NULL OR r.rating >= $minRating)
       ${REVIEW_RETURN}
       ORDER BY r.createdAt DESC LIMIT $limit`,
      {
        typeId: opts.typeId != null ? int(opts.typeId) : null,
        guestId: opts.guestId != null ? int(opts.guestId) : null,
        minRating: opts.minRating != null ? int(opts.minRating) : null,
        limit: int(opts.limit ?? 50),
      },
    ),
    [],
  );
}

export async function getReview(id: string): Promise<Review | null> {
  const rows = await tryGraph(
    () => cypher<Review>(`MATCH (g:Guest)-[:WROTE]->(r:Review {id:$id})-[:ABOUT]->(t:RoomType) ${REVIEW_RETURN}`, { id }),
    [],
  );
  return rows[0] ?? null;
}

/** CREATE – the API verifies in MySQL that the stay belongs to the guest and is completed. */
export async function createReview(p: { guestId: number; typeId: number; reservationId: number; rating: number; title: string; body: string }): Promise<Review> {
  const id = crypto.randomUUID();
  await ensureGuest(p.guestId);
  const rows = await cypher<{ id: string }>(
    `MATCH (g:Guest {id:$g}), (t:RoomType {id:$t})
     CREATE (g)-[:WROTE]->(r:Review {id:$id, reservationId:$res, rating:$rating, title:$title, body:$body, createdAt: datetime()})-[:ABOUT]->(t)
     RETURN r.id AS id`,
    { g: int(p.guestId), t: int(p.typeId), id, res: int(p.reservationId), rating: int(p.rating), title: p.title, body: p.body },
    'w',
  );
  if (!rows.length) throw new GraphError('Could not store the review');
  return (await getReview(id))!;
}

/** UPDATE (guest edits own review) */
export async function updateReview(id: string, guestId: number | null, p: { rating: number; title: string; body: string }): Promise<Review | null> {
  const rows = await cypher<{ id: string }>(
    `MATCH (g:Guest)-[:WROTE]->(r:Review {id:$id}) WHERE $guestId IS NULL OR g.id = $guestId
     SET r.rating = $rating, r.title = $title, r.body = $body, r.updatedAt = datetime()
     RETURN r.id AS id`,
    { id, guestId: guestId != null ? int(guestId) : null, rating: int(p.rating), title: p.title, body: p.body },
    'w',
  );
  return rows.length ? getReview(id) : null;
}

/** UPDATE (management reply). Empty reply removes it. */
export async function replyToReview(id: string, reply: string): Promise<Review | null> {
  const rows = await cypher<{ id: string }>(
    `MATCH (r:Review {id:$id})
     SET r.reply = CASE WHEN $reply = '' THEN null ELSE $reply END,
         r.repliedAt = CASE WHEN $reply = '' THEN null ELSE datetime() END
     RETURN r.id AS id`,
    { id, reply },
    'w',
  );
  return rows.length ? getReview(id) : null;
}

/** DELETE */
export async function deleteReview(id: string, guestId: number | null): Promise<boolean> {
  const rows = await cypher<{ n: number }>(
    `MATCH (g:Guest)-[:WROTE]->(r:Review {id:$id}) WHERE $guestId IS NULL OR g.id = $guestId
     DETACH DELETE r RETURN 1 AS n`,
    { id, guestId: guestId != null ? int(guestId) : null },
    'w',
  );
  return rows.length > 0;
}

export type RatingSummary = { typeId: number; avg: number; count: number };

export async function ratingSummaries(): Promise<Map<number, RatingSummary>> {
  const rows = await tryGraph(
    () => cypher<RatingSummary>(
      `MATCH (r:Review)-[:ABOUT]->(t:RoomType)
       RETURN t.id AS typeId, round(avg(r.rating) * 10) / 10.0 AS avg, count(r) AS count`,
    ),
    [],
  );
  return new Map(rows.map((r) => [r.typeId, r]));
}

export async function overallRating(): Promise<{ avg: number; count: number; distribution: Record<number, number> }> {
  const rows = await tryGraph(
    () => cypher<{ rating: number; n: number }>(`MATCH (r:Review) RETURN r.rating AS rating, count(*) AS n`),
    [],
  );
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0, sum = 0;
  for (const r of rows) { distribution[r.rating] = r.n; total += r.n; sum += r.n * r.rating; }
  return { avg: total ? Math.round((sum / total) * 10) / 10 : 0, count: total, distribution };
}

/** Reservation ids that already have a review (to hide the "write review" button). */
export async function reviewedReservations(guestId: number): Promise<Set<number>> {
  const rows = await tryGraph(
    () => cypher<{ id: number }>(`MATCH (:Guest {id:$g})-[:WROTE]->(r:Review) RETURN r.reservationId AS id`, { g: int(guestId) }),
    [],
  );
  return new Set(rows.map((r) => r.id));
}

/* ───────────────────── Graph sync from MySQL ───────────────────── */

async function ensureGuest(guestId: number) {
  // the node is normally created by the seed script / sync; this is a safety net
  await cypher(`MERGE (:Guest {id:$id})`, { id: int(guestId) }, 'w');
}

export async function syncGuest(g: { id: number; name: string; country: string; tier: string }) {
  await tryGraph(
    () => cypher(`MERGE (g:Guest {id:$id}) SET g.name=$name, g.country=$country, g.tier=$tier`, { id: int(g.id), name: g.name, country: g.country, tier: g.tier }, 'w'),
    [],
  );
}

export async function syncStay(p: { guestId: number; typeId: number; reservationId: number; checkIn: string; nights: number }) {
  await tryGraph(
    () => cypher(
      `MATCH (g:Guest {id:$g}), (t:RoomType {id:$t})
       MERGE (g)-[s:STAYED_IN {reservationId:$r}]->(t)
       SET s.checkIn = date($d), s.nights = $n`,
      { g: int(p.guestId), t: int(p.typeId), r: int(p.reservationId), d: p.checkIn, n: int(p.nights) },
      'w',
    ),
    [],
  );
}

export async function syncOrder(p: { guestId: number; serviceId: number; quantity: number }) {
  await tryGraph(
    () => cypher(
      `MATCH (g:Guest {id:$g}), (s:Service {id:$s})
       MERGE (g)-[o:ORDERED]->(s)
       ON CREATE SET o.quantity = $q ON MATCH SET o.quantity = o.quantity + $q`,
      { g: int(p.guestId), s: int(p.serviceId), q: int(p.quantity) },
      'w',
    ),
    [],
  );
}

/* ───────────────────── Recommendations (graph traversals) ───────────────────── */

export type ServiceReco = { serviceId: number; name: string; category: string; fans: number };

/**
 * Collaborative filtering: services ordered by guests who stayed in the same room types as me.
 * If that yields fewer than `limit` results (e.g. the guest has already tried everything their
 * look-alikes enjoyed), it is topped up with the hotel's most popular services the guest hasn't ordered.
 */
export async function recommendServices(guestId: number, limit = 4): Promise<ServiceReco[]> {
  return tryGraph(async () => {
    const similar = await cypher<ServiceReco>(
      `MATCH (me:Guest {id:$g})-[:STAYED_IN]->(:RoomType)<-[:STAYED_IN]-(other:Guest)
       WHERE other <> me
       MATCH (other)-[o:ORDERED]->(s:Service)
       WHERE NOT (me)-[:ORDERED]->(s)
       RETURN s.id AS serviceId, s.name AS name, s.category AS category, count(DISTINCT other) AS fans, sum(o.quantity) AS qty
       ORDER BY fans DESC, qty DESC LIMIT $limit`,
      { g: int(guestId), limit: int(limit) },
    );
    if (similar.length >= limit) return similar;
    const popular = await cypher<ServiceReco>(
      `MATCH (me:Guest {id:$g})
       MATCH (other:Guest)-[o:ORDERED]->(s:Service)
       WHERE other <> me AND NOT (me)-[:ORDERED]->(s) AND NOT s.id IN $skip
       RETURN s.id AS serviceId, s.name AS name, s.category AS category, count(DISTINCT other) AS fans, sum(o.quantity) AS qty
       ORDER BY fans DESC, qty DESC LIMIT $limit`,
      { g: int(guestId), skip: similar.map((x) => int(x.serviceId)), limit: int(limit - similar.length) },
    );
    return [...similar, ...popular];
  }, []);
}

export type SimilarType = { typeId: number; name: string; slug: string; guests: number };

/** "Guests who stayed here also stayed in…" */
export async function alsoStayedIn(typeId: number, limit = 3): Promise<SimilarType[]> {
  return tryGraph(
    () => cypher<SimilarType>(
      `MATCH (t:RoomType {id:$t})<-[:STAYED_IN]-(g:Guest)-[:STAYED_IN]->(o:RoomType)
       WHERE o <> t
       RETURN o.id AS typeId, o.name AS name, o.slug AS slug, count(DISTINCT g) AS guests
       ORDER BY guests DESC LIMIT $limit`,
      { t: int(typeId), limit: int(limit) },
    ),
    [],
  );
}

export async function graphCounts(): Promise<{ nodes: number; relationships: number; reviews: number }> {
  const rows = await tryGraph(
    () => cypher<{ nodes: number; relationships: number; reviews: number }>(
      `MATCH (n) WITH count(n) AS nodes
       OPTIONAL MATCH ()-[r]->() WITH nodes, count(r) AS relationships
       OPTIONAL MATCH (rv:Review) RETURN nodes, relationships, count(rv) AS reviews`,
    ),
    [],
  );
  return rows[0] ?? { nodes: 0, relationships: 0, reviews: 0 };
}
