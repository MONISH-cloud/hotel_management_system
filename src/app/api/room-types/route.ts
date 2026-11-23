import { route, parseBody } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { pool } from '@/lib/db';
import { listTypesForAdmin } from '@/lib/hotel';
import { roomTypeBody, slugify } from '@/lib/inventory-schema';
import { bumpAvailability } from '@/lib/cache';

export const GET = route(async () => {
  await requirePerm('inventory.manage');
  return { types: await listTypesForAdmin() };
});

export const POST = route(async (req) => {
  const s = await requirePerm('inventory.manage');
  const b = await parseBody(req, roomTypeBody);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET @app_user_id = ?', [s.userId]);
    const [r] = await conn.query(
      `INSERT INTO room_types (slug, name, tagline, description, base_price, max_adults, max_children, size_sqm, bed_type, view_type, image_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [slugify(b.slug || b.name), b.name, b.tagline, b.description, b.basePrice, b.maxAdults, b.maxChildren, b.sizeSqm, b.bedType, b.viewType, b.imageUrl]);
    const id = (r as { insertId: number }).insertId;
    for (const a of b.amenityIds) await conn.query('INSERT IGNORE INTO room_type_amenities (type_id, amenity_id) VALUES (?,?)', [id, a]);
    await conn.query(`INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details) VALUES (?, 'room_type.created', 'room_type', ?, ?)`, [s.userId, id, JSON.stringify({ name: b.name })]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await bumpAvailability();
  return Response.json({ types: await listTypesForAdmin() }, { status: 201 });
});
