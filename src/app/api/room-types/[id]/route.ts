import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { pool } from '@/lib/db';
import { listTypesForAdmin } from '@/lib/hotel';
import { roomTypeBody, slugify } from '@/lib/inventory-schema';
import { bumpAvailability } from '@/lib/cache';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requirePerm('inventory.manage');
  const id = Number((await params).id);
  const b = await parseBody(req, roomTypeBody);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET @app_user_id = ?', [s.userId]);
    const [r] = await conn.query(
      `UPDATE room_types SET slug=?, name=?, tagline=?, description=?, base_price=?, max_adults=?, max_children=?, size_sqm=?, bed_type=?, view_type=?, image_url=? WHERE type_id=?`,
      [slugify(b.slug || b.name), b.name, b.tagline, b.description, b.basePrice, b.maxAdults, b.maxChildren, b.sizeSqm, b.bedType, b.viewType, b.imageUrl, id]);
    if (!(r as { affectedRows: number }).affectedRows) throw new ApiError(404, 'Room type not found');
    await conn.query('DELETE FROM room_type_amenities WHERE type_id = ?', [id]);
    for (const a of b.amenityIds) await conn.query('INSERT IGNORE INTO room_type_amenities (type_id, amenity_id) VALUES (?,?)', [id, a]);
    await conn.query(`INSERT INTO audit_log (actor_user_id, action, entity, entity_id, details) VALUES (?, 'room_type.updated', 'room_type', ?, ?)`, [s.userId, id, JSON.stringify({ name: b.name, price: b.basePrice })]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  await bumpAvailability();
  return { types: await listTypesForAdmin() };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const s = await requirePerm('inventory.manage');
  const id = Number((await params).id);
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query('SET @app_user_id = ?', [s.userId]);
      await conn.query('DELETE FROM room_types WHERE type_id = ?', [id]); // FK RESTRICT: fails while rooms exist
      await conn.query(`INSERT INTO audit_log (actor_user_id, action, entity, entity_id) VALUES (?, 'room_type.deleted', 'room_type', ?)`, [s.userId, id]);
    } finally { conn.release(); }
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_ROW_IS_REFERENCED_2') throw new ApiError(409, 'This room type still has rooms. Delete or reassign its rooms first.');
    throw e;
  }
  await bumpAvailability();
  return { types: await listTypesForAdmin() };
});
