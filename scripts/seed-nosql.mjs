// Builds the Neo4j graph from MySQL + seeds reviews, and primes Redis.
// Usage: npm run db:seed-nosql   (run AFTER npm run db:setup)
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import neo4j from 'neo4j-driver';
import Redis from 'ioredis';
import { loadEnv, requireEnv } from './env.mjs';

loadEnv();
const I = (n) => neo4j.int(n);

const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: requireEnv('MYSQL_PASSWORD'),
  database: process.env.MYSQL_DATABASE,
  dateStrings: true,
  decimalNumbers: true,
});

const driver = neo4j.driver(
  process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687',
  neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', requireEnv('NEO4J_PASSWORD')),
);
await driver.verifyConnectivity();
const session = driver.session();
console.log('Connected to MySQL and Neo4j');

// 1) constraints / indexes ------------------------------------------------
const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'neo4j', 'schema.cypher'), 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
  .split(';').map((s) => s.trim()).filter(Boolean);
for (const stmt of schema) await session.run(stmt);
console.log(`Applied ${schema.length} constraints/indexes`);

// 2) wipe + rebuild nodes -------------------------------------------------
await session.run('MATCH (n) DETACH DELETE n');

const [types] = await db.query('SELECT type_id, slug, name FROM room_types');
for (const t of types)
  await session.run('CREATE (:RoomType {id:$id, slug:$slug, name:$name})', { id: I(t.type_id), slug: t.slug, name: t.name });

const [services] = await db.query('SELECT service_id, name, category FROM services');
for (const s of services)
  await session.run('CREATE (:Service {id:$id, name:$name, category:$category})', { id: I(s.service_id), name: s.name, category: s.category });

const [guests] = await db.query('SELECT guest_id, full_name, country, loyalty_tier FROM guests');
for (const g of guests)
  await session.run('CREATE (:Guest {id:$id, name:$name, country:$country, tier:$tier})', {
    id: I(g.guest_id), name: g.full_name, country: g.country, tier: g.loyalty_tier,
  });

// 3) relationships --------------------------------------------------------
const [stays] = await db.query(`
  SELECT r.reservation_id, r.guest_id, rt.type_id, r.check_in, DATEDIFF(r.check_out, r.check_in) AS nights
    FROM reservations r JOIN rooms rm ON rm.room_id = r.room_id JOIN room_types rt ON rt.type_id = rm.type_id
   WHERE r.status IN ('checked_in','checked_out')`);
for (const s of stays)
  await session.run(
    `MATCH (g:Guest {id:$g}), (t:RoomType {id:$t})
     CREATE (g)-[:STAYED_IN {reservationId:$r, checkIn:date($d), nights:$n}]->(t)`,
    { g: I(s.guest_id), t: I(s.type_id), r: I(s.reservation_id), d: s.check_in, n: I(s.nights) },
  );

const [orders] = await db.query(`
  SELECT r.guest_id, so.service_id, SUM(so.quantity) AS qty
    FROM service_orders so JOIN reservations r ON r.reservation_id = so.reservation_id
   WHERE so.status <> 'cancelled' GROUP BY r.guest_id, so.service_id`);
for (const o of orders)
  await session.run(
    `MATCH (g:Guest {id:$g}), (s:Service {id:$s}) CREATE (g)-[:ORDERED {quantity:$q}]->(s)`,
    { g: I(o.guest_id), s: I(o.service_id), q: I(o.qty) },
  );
console.log(`Graph: ${types.length} room types, ${services.length} services, ${guests.length} guests, ${stays.length} stays, ${orders.length} orders`);

// 4) seed reviews (Create) -------------------------------------------------
const REVIEWS = [
  ['vikram.singh@example.com', '101', 5, 'Exactly the reset we needed', 'The garden room was quiet, spotless and beautifully lit. Breakfast in bed on the second morning was the highlight. Staff remembered our names from the first evening.', 55],
  ['meera.iyer@example.com', '201', 5, 'That terrace at sunrise', 'Floor-to-ceiling glass, teak underfoot and a terrace that catches the first light. We barely left the room. The soaking tub deserves its own review.', 52],
  ['arjun.reddy@example.com', '301', 4, 'Old-world charm, modern comfort', 'Loved the chesterfield lounge and the butler who anticipated everything. Only wish the desk lamp was a bit brighter. Would happily return.', 45],
  ['sofia.rossi@example.com', '401', 5, 'We celebrated our anniversary in paradise', 'The pavilion villa felt like our own private garden. Rose petals, a plunge pool and a cake sent up at midnight. Impossible to fault.', 43],
  ['james.carter@example.com', '601', 5, 'Presidential in every sense', 'The marble bath, the private dining salon, the chauffeur - everything was flawless. The best hotel suite I have stayed in across three continents.', 42],
  ['guest@maisonaurelia.com', '102', 4, 'Lovely, calm and very well run', 'Check-in took two minutes, the room was ready early and the bed was incredibly comfortable. The spa booking via the app was effortless.', 37],
  ['priyanka.das@example.com', '202', 5, 'Spa day and a terrace room - perfect', 'Booked the couple\'s ritual and the terrace room together. The therapists were superb and the room felt like a resort inside the city.', 34],
  ['kabir.malhotra@example.com', '501', 5, 'Our kids did not want to leave', 'Two bedrooms, a proper dining table and staff who brought colouring sets and cots without being asked. A rare family-friendly luxury hotel.', 31],
  ['isabella.laurent@example.com', '302', 4, 'Elegant and quiet', 'A beautifully appointed suite with attentive service. Dinner at the restaurant was memorable; the vegetarian tasting menu in particular.', 28],
  ['guest@maisonaurelia.com', '301', 5, 'Second stay and even better', 'Returned for a longer stay in the Heritage Suite. The team remembered my tea preference and upgraded the pillow menu. This is now our family hotel.', 22],
  ['naomi.tanaka@example.com', '203', 4, 'Thoughtful details everywhere', 'Everything from the bedside lighting to the Japanese-style green tea selection showed care. Wi-Fi was fast and the desk was great for work.', 17],
  ['daniel.okafor@example.com', '402', 5, 'Villa life, right in the city', 'Private garden, outdoor shower, silent nights. The yacht cruise arranged by the concierge was unforgettable.', 15],
  ['guest@maisonaurelia.com', '601', 5, 'A birthday I will never forget', 'The Presidential Suite, a rooftop dinner and a handwritten card from the whole team. Truly special.', 6],
  ['omar.haddad@example.com', '204', 4, 'Halal breakfast done right', 'Appreciated how seriously the kitchen took dietary requests. The terrace room is gorgeous. Housekeeping could be a little quicker in the afternoon.', 7],
  ['sneha.kulkarni@example.com', '104', 3, 'Good, but street noise on the garden side', 'The room itself was lovely and clean, staff were friendly. We heard some traffic early morning though - ask for a higher floor.', 10],
];

let created = 0;
for (const [email, roomNo, rating, title, body, daysAgo] of REVIEWS) {
  const [[row]] = await db.query(
    `SELECT r.reservation_id, r.guest_id, rt.type_id
       FROM reservations r JOIN guests g ON g.guest_id = r.guest_id
       JOIN rooms rm ON rm.room_id = r.room_id JOIN room_types rt ON rt.type_id = rm.type_id
      WHERE g.email = ? AND rm.room_number = ? AND r.status = 'checked_out' LIMIT 1`, [email, roomNo]);
  if (!row) { console.warn('  skip review (no matching stay):', email, roomNo); continue; }
  await session.run(
    `MATCH (g:Guest {id:$g}), (t:RoomType {id:$t})
     CREATE (g)-[:WROTE]->(r:Review {id:$id, reservationId:$res, rating:$rating, title:$title, body:$body,
                                     createdAt: datetime() - duration({days:$days})})-[:ABOUT]->(t)`,
    { g: I(row.guest_id), t: I(row.type_id), id: randomUUID(), res: I(row.reservation_id), rating: I(rating), title, body, days: I(daysAgo) },
  );
  created++;
}
// a staff reply on one review (Update demo)
await session.run(
  `MATCH (r:Review) WHERE r.title = 'Good, but street noise on the garden side'
   SET r.reply = 'Thank you for the honest feedback, Sneha. We have added a note to your profile so we can place you on a quieter floor next time.',
       r.repliedAt = datetime()`);
console.log(`Seeded ${created} reviews`);

await session.close();
await driver.close();
await db.end();

// 5) Redis: flush cache namespace (the activity feed starts empty and fills with real events) ----
try {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', { lazyConnect: true, maxRetriesPerRequest: 1 });
  await redis.connect();
  const keys = await redis.keys('ma:*');
  if (keys.length) await redis.del(...keys);
  await redis.incr('ma:avail:v');
  console.log('Redis primed');
  redis.disconnect();
} catch (e) {
  console.warn('Redis not reachable - skipped (the app still runs without it):', e.message);
}
console.log('\nDone. Start the app with: npm run dev');
