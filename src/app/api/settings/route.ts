import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { pool } from '@/lib/db';
import { listSettingRows, invalidateSettings } from '@/lib/settings';
import { pushFeed } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requirePerm('settings.manage');
  return { settings: await listSettingRows() };
});

/** Update one or more settings. Values are validated against each setting's declared type. */
export const PATCH = route(async (req) => {
  const s = await requirePerm('settings.manage');
  const { values } = await parseBody(req, z.object({ values: z.record(z.string(), z.string().max(1000)) }));
  const rows = await listSettingRows();
  const byKey = new Map(rows.map((r) => [r.setting_key, r]));

  const changes: [string, string][] = [];
  for (const [key, raw] of Object.entries(values)) {
    const def = byKey.get(key);
    if (!def) throw new ApiError(400, `Unknown setting: ${key}`);
    const v = raw.trim();
    if (def.value_type === 'number') {
      if (v === '' || !Number.isFinite(Number(v)) || Number(v) < 0) throw new ApiError(422, `${def.label}: enter a number that is 0 or more`);
      if (key.endsWith('_pct') && Number(v) > 100) throw new ApiError(422, `${def.label}: a percentage can't exceed 100`);
    } else if (v === '' && !['hotel_tagline'].includes(key)) {
      throw new ApiError(422, `${def.label} can't be empty`);
    }
    if (v !== def.setting_value) changes.push([key, v]);
  }

  if (changes.length) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('SET @app_user_id = ?', [s.userId]);
      for (const [k, v] of changes) await conn.query('UPDATE hotel_settings SET setting_value = ? WHERE setting_key = ?', [v, k]);
      await conn.query(`INSERT INTO audit_log (actor_user_id, action, entity, details) VALUES (?, 'settings.updated', 'settings', ?)`,
        [s.userId, JSON.stringify(Object.fromEntries(changes))]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
    await invalidateSettings();
    await pushFeed('Settings updated', `${changes.length} setting${changes.length > 1 ? 's' : ''} changed by ${s.name}`);
  }
  return { updated: changes.length, settings: await listSettingRows() };
});
