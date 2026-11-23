// =====================================================================
//  Neo4j graph model - Maison Aurelia
//  Created by scripts/seed-nosql.mjs (idempotent: IF NOT EXISTS)
//
//  (:Guest {id, name, country, tier})
//  (:RoomType {id, slug, name})
//  (:Service {id, name, category})
//  (:Review {id, reservationId, rating, title, body, createdAt, updatedAt, reply, repliedAt})
//
//  (:Guest)-[:STAYED_IN {reservationId, checkIn, nights}]->(:RoomType)
//  (:Guest)-[:ORDERED {quantity}]->(:Service)
//  (:Guest)-[:WROTE]->(:Review)-[:ABOUT]->(:RoomType)
// =====================================================================

CREATE CONSTRAINT guest_id_unique        IF NOT EXISTS FOR (g:Guest)    REQUIRE g.id IS UNIQUE;
CREATE CONSTRAINT roomtype_id_unique     IF NOT EXISTS FOR (t:RoomType) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT service_id_unique      IF NOT EXISTS FOR (s:Service)  REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT review_id_unique       IF NOT EXISTS FOR (r:Review)   REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT review_reservation_uq  IF NOT EXISTS FOR (r:Review)   REQUIRE r.reservationId IS UNIQUE;
CREATE INDEX review_created_idx          IF NOT EXISTS FOR (r:Review)   ON (r.createdAt);
CREATE INDEX review_rating_idx           IF NOT EXISTS FOR (r:Review)   ON (r.rating);
