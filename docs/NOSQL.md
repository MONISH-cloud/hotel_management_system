# NoSQL Design: Neo4j (graph) and Redis (key-value)

## Neo4j: guest graph

Created by `npm run db:seed-nosql` (constraints in [`db/neo4j/schema.cypher`](../db/neo4j/schema.cypher)).

```
(:Guest {id, name, country, tier})
(:RoomType {id, slug, name})
(:Service {id, name, category})
(:Review {id, reservationId, rating, title, body, createdAt, updatedAt, reply, repliedAt})

(:Guest)-[:STAYED_IN {reservationId, checkIn, nights}]->(:RoomType)
(:Guest)-[:ORDERED {quantity}]->(:Service)
(:Guest)-[:WROTE]->(:Review)-[:ABOUT]->(:RoomType)
```

Guests, stays and orders are projected from MySQL (on check-in, order and registration, and in bulk by the seed script). **Reviews exist only in Neo4j.**

### Database creation (constraints & indexes)

```cypher
CREATE CONSTRAINT guest_id_unique       IF NOT EXISTS FOR (g:Guest)    REQUIRE g.id IS UNIQUE;
CREATE CONSTRAINT review_id_unique      IF NOT EXISTS FOR (r:Review)   REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT review_reservation_uq IF NOT EXISTS FOR (r:Review)   REQUIRE r.reservationId IS UNIQUE;  // one review per stay
CREATE INDEX review_created_idx         IF NOT EXISTS FOR (r:Review)   ON (r.createdAt);
```

### CRUD on reviews (`src/lib/graph.ts`, `/api/reviews`)

| Op | Cypher | Who |
|---|---|---|
| **Create** | `MATCH (g:Guest {id:$g}), (t:RoomType {id:$t}) CREATE (g)-[:WROTE]->(r:Review {…})-[:ABOUT]->(t)` | Guest, only for own `checked_out` stay (verified in MySQL) |
| **Read** | `MATCH (g)-[:WROTE]->(r:Review)-[:ABOUT]->(t) WHERE … RETURN … ORDER BY r.createdAt DESC` | Public |
| **Update** | `MATCH (g)-[:WROTE]->(r:Review {id:$id}) WHERE g.id = $guestId SET r.rating=…, r.updatedAt=datetime()` | Author |
| **Update** | `MATCH (r:Review {id:$id}) SET r.reply=$reply, r.repliedAt=datetime()` | Staff with `reviews.moderate` |
| **Delete** | `MATCH (g)-[:WROTE]->(r:Review {id:$id}) DETACH DELETE r` | Author or moderator |

### Graph queries

```cypher
// Collaborative-filtering service recommendations
MATCH (me:Guest {id:$g})-[:STAYED_IN]->(:RoomType)<-[:STAYED_IN]-(other:Guest)
WHERE other <> me
MATCH (other)-[o:ORDERED]->(s:Service) WHERE NOT (me)-[:ORDERED]->(s)
RETURN s.name, count(DISTINCT other) AS fans, sum(o.quantity) AS qty ORDER BY fans DESC, qty DESC LIMIT 4;

// "Guests who stayed here also stayed in…"
MATCH (t:RoomType {id:$t})<-[:STAYED_IN]-(g:Guest)-[:STAYED_IN]->(o:RoomType) WHERE o <> t
RETURN o.name, count(DISTINCT g) AS guests ORDER BY guests DESC LIMIT 3;

// Rating summary per room type
MATCH (r:Review)-[:ABOUT]->(t:RoomType) RETURN t.id, round(avg(r.rating)*10)/10.0 AS avg, count(r);
```

## Redis: key design (`src/lib/cache.ts`)

| Key | Type | TTL | Purpose |
|---|---|---|---|
| `ma:sess:{jti}` | STRING | 7 d | Server-side session registry. Deleting it revokes a JWT instantly (logout, role change) |
| `ma:perms:{role}` | SET | 5 min | Cached role permissions (source of truth: MySQL) |
| `ma:avail:v` | STRING (counter) | none | Version stamp; `INCR` on any booking / cancel / room change invalidates all availability caches at once |
| `ma:avail:{v}:{in}:{out}` | STRING (JSON) | 60 s | Cached availability search |
| `ma:rl:login:{ip:email}` | STRING (counter) | 10 min | Brute-force protection |
| `ma:wish:{userId}` | **HASH** `typeId → {note, addedAt}` | none | Guest wishlist: full CRUD (`HSET`, `HGETALL`, `HSET` update, `HDEL`) |
| `ma:feed` | LIST (capped at 40) | none | Live activity stream shown on the staff dashboard (`LPUSH` + `LTRIM`) |

### Wishlist CRUD (`/api/wishlist`)

| Op | Redis | HTTP |
|---|---|---|
| Create | `HSET ma:wish:7 3 '{"note":"","addedAt":…}'` | `POST` |
| Read | `HGETALL ma:wish:7` | `GET` |
| Update | `HGET` then `HSET` with new note | `PATCH` |
| Delete | `HDEL ma:wish:7 3` | `DELETE ?typeId=3` |
