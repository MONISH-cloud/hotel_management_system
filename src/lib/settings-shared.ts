// Types + helpers shared by server and client (no server imports).

export type Settings = {
  hotel_name: string; hotel_tagline: string; neighbourhood: string; established_year: number;
  address: string; phone: string; email: string; spa_treatment_rooms: number;
  tax_rate_pct: number; deposit_pct: number; free_cancel_hours: number; max_stay_nights: number;
  max_rooms_per_booking: number; require_verified_email: number;
  loyalty_inr_per_point: number; loyalty_gold_points: number; loyalty_platinum_points: number;
  hero_headline_lead: string; hero_headline_accent: string; hero_subtitle: string;
  story_headline_lead: string; story_headline_accent: string; story_text: string;
  cta_headline_lead: string; cta_headline_accent: string; cta_text: string; footer_blurb: string;
  demo_logins_enabled: number; demo_password_hint: string;
  /** live counts, derived from the database (not stored as settings) */
  rooms: number; room_types: number;
};

/** Used only if the database is unreachable, so the site shell can still render. */
export const FALLBACK_SETTINGS: Settings = {
  hotel_name: 'Hotel', hotel_tagline: '', neighbourhood: '', established_year: 0, address: '', phone: '', email: '',
  spa_treatment_rooms: 0, tax_rate_pct: 0, deposit_pct: 25, free_cancel_hours: 48, max_stay_nights: 30,
  max_rooms_per_booking: 5, require_verified_email: 0,
  loyalty_inr_per_point: 100, loyalty_gold_points: 2000, loyalty_platinum_points: 6000,
  hero_headline_lead: '', hero_headline_accent: '', hero_subtitle: '', story_headline_lead: '', story_headline_accent: '',
  story_text: '', cta_headline_lead: '', cta_headline_accent: '', cta_text: '', footer_blurb: '',
  demo_logins_enabled: 0, demo_password_hint: '', rooms: 0, room_types: 0,
};

/** Replaces {placeholders} in copy with live values, e.g. "{rooms} rooms". */
export function fill(text: string, s: Settings): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = (s as unknown as Record<string, unknown>)[k];
    return v === undefined ? m : String(v);
  });
}

export type Feature = { feature_id: number; icon: string; title: string; description: string };
export type Category = { category: string; title: string; tagline: string; image_url: string | null };
export type Media = Record<string, { url: string; alt: string }>;
