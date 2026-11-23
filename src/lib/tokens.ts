import 'server-only';
import crypto from 'node:crypto';
import { query, one } from './db';

type Purpose = 'password_reset' | 'email_verify';
const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** Creates a one-time token; only its SHA-256 hash is stored. Returns the raw token for the email link. */
export async function createToken(userId: number, purpose: Purpose, ttlMinutes: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex');
  await query('UPDATE user_tokens SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [userId, purpose]); // invalidate older links
  await query('INSERT INTO user_tokens (token_hash, user_id, purpose, expires_at) VALUES (?,?,?, NOW() + INTERVAL ? MINUTE)', [hash(raw), userId, purpose, ttlMinutes]);
  return raw;
}

/** Validates and burns a token. Returns the user id, or null if unknown, expired or already used. */
export async function consumeToken(raw: string, purpose: Purpose): Promise<number | null> {
  if (!/^[0-9a-f]{64}$/.test(raw)) return null;
  const row = await one<{ user_id: number }>(
    'SELECT user_id FROM user_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()', [hash(raw), purpose]);
  if (!row) return null;
  const res = await query('UPDATE user_tokens SET used_at = NOW() WHERE token_hash = ? AND used_at IS NULL', [hash(raw)]);
  // @ts-expect-error mysql2 header on UPDATE
  return res.affectedRows === 1 ? row.user_id : null;
}
