import 'server-only';
import nodemailer from 'nodemailer';
import { query } from './db';
import { getSettings } from './settings';

/**
 * Email delivery. If SMTP_HOST (and friends) are set in .env.local the message is really sent;
 * otherwise it is only recorded in the email_outbox table (status "not_configured") so nothing is lost
 * and admins can read it under Dashboard → Activity. This function never throws.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<'sent' | 'failed' | 'not_configured'> {
  let status: 'sent' | 'failed' | 'not_configured' = 'not_configured';
  let error: string | null = null;
  try {
    if (process.env.SMTP_HOST) {
      const s = await getSettings();
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await transporter.sendMail({ from: process.env.MAIL_FROM ?? `${s.hotel_name} <${s.email}>`, to, subject, text });
      status = 'sent';
    }
  } catch (e) {
    status = 'failed';
    error = (e as Error).message.slice(0, 250);
  }
  try {
    await query('INSERT INTO email_outbox (to_address, subject, body, status, error) VALUES (?,?,?,?,?)', [to, subject, text, status, error]);
  } catch (e) {
    console.error('[mail] could not record outbox row', e);
  }
  return status;
}

export async function listOutbox(limit = 40) {
  return query<{ email_id: number; to_address: string; subject: string; body: string; status: string; error: string | null; created_at: string }>(
    'SELECT * FROM email_outbox ORDER BY email_id DESC LIMIT ?', [limit]);
}
