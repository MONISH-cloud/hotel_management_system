import 'server-only';
import { cache } from 'react';
import { query, type Row } from './db';
import { cached, safe } from './cache';
import { FALLBACK_SETTINGS, type Settings, type Feature, type Category, type Media } from './settings-shared';

export * from './settings-shared';

export type SettingRow = {
  setting_key: string; setting_value: string; value_type: 'text' | 'number' | 'longtext';
  group_name: string; label: string; help_text: string | null; sort_order: number;
};

async function load(): Promise<Settings> {
  const [rows, counts] = await Promise.all([
    query<SettingRow>('SELECT setting_key, setting_value, value_type FROM hotel_settings'),
    query<Row>('SELECT (SELECT COUNT(*) FROM rooms) AS rooms, (SELECT COUNT(*) FROM room_types) AS room_types'),
  ]);
  const out: Record<string, string | number> = { ...FALLBACK_SETTINGS };
  for (const r of rows) out[r.setting_key] = r.value_type === 'number' ? Number(r.setting_value) : r.setting_value;
  out.rooms = Number(counts[0].rooms);
  out.room_types = Number(counts[0].room_types);
  return out as unknown as Settings;
}

/** All hotel settings (cached 30 s in Redis, deduplicated per request). Never throws. */
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    return await cached('ma:settings', 30, load);
  } catch {
    return FALLBACK_SETTINGS;
  }
});

export async function invalidateSettings() {
  await safe((r) => r.del('ma:settings'), 0);
}

export async function listSettingRows() {
  return query<SettingRow>('SELECT * FROM hotel_settings ORDER BY FIELD(group_name,"General","Policies","Loyalty","Website","Demo"), sort_order');
}

export async function listFeatures(): Promise<Feature[]> {
  return query<Feature>('SELECT feature_id, icon, title, description FROM site_features ORDER BY sort_order');
}

export async function listHomeCategories(): Promise<Category[]> {
  return query<Category>('SELECT category, title, tagline, image_url FROM service_categories WHERE show_on_home = TRUE ORDER BY sort_order');
}

export async function getMedia(): Promise<Media> {
  const rows = await query<{ media_key: string; url: string; alt: string }>('SELECT media_key, url, alt FROM site_media');
  return Object.fromEntries(rows.map((r) => [r.media_key, { url: r.url, alt: r.alt }]));
}

export async function listDemoLogins() {
  return query<{ email: string; full_name: string; role: string; description: string }>(
    `SELECT u.email, u.full_name, r.role_name AS role, r.description
       FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE u.is_active = TRUE AND u.is_demo = TRUE
      ORDER BY r.role_id`);
}
