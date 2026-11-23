import 'server-only';
import { getSettings } from './settings';
import { money, fmtDate } from './format';

type Res = { reservation_code: string; guest_name: string; room_type: string; room_number: string; check_in: string; check_out: string; nights: number; total_amount: number };

async function frame() {
  const s = await getSettings();
  return { s, wrap: (greeting: string, body: string) => `${greeting}\n\n${body}\n\n— ${s.hotel_name}\n${s.address} · ${s.phone}\n${s.email}\n` };
}

export async function bookingEmail(r: Res, extra = '') {
  const { s, wrap } = await frame();
  const body = `Your reservation ${r.reservation_code} is held.\n\nRoom: ${r.room_type} (${r.room_number})\nStay: ${fmtDate(r.check_in)} → ${fmtDate(r.check_out)} (${r.nights} night${r.nights > 1 ? 's' : ''})\nTotal: ${money(r.total_amount)} incl. ${s.tax_rate_pct}% tax\n\nPay a ${s.deposit_pct}% deposit from My Stays to confirm it. Free cancellation until ${s.free_cancel_hours} hours before arrival.${extra}`;
  return { subject: `Reservation ${r.reservation_code} received`, text: wrap(`Dear ${r.guest_name},`, body) };
}

export async function paymentEmail(r: Res, amount: number, reference: string, status: string, balance: number) {
  const { wrap } = await frame();
  const body = `We received your payment of ${money(amount)} (ref ${reference}) for reservation ${r.reservation_code}.\nStatus: ${status.replace('_', ' ')}. Balance due: ${balance > 0 ? money(balance) : 'settled'}.`;
  return { subject: `Payment received · ${r.reservation_code}`, text: wrap(`Dear ${r.guest_name},`, body) };
}

export async function cancelEmail(r: Res, message: string) {
  const { wrap } = await frame();
  const body = `Reservation ${r.reservation_code} (${r.room_type}, ${fmtDate(r.check_in)} → ${fmtDate(r.check_out)}) has been cancelled.\n${message}`;
  return { subject: `Reservation ${r.reservation_code} cancelled`, text: wrap(`Dear ${r.guest_name},`, body) };
}

export async function modifiedEmail(r: Res) {
  const { wrap } = await frame();
  const body = `Reservation ${r.reservation_code} has been updated.\n\nRoom: ${r.room_type} (${r.room_number})\nStay: ${fmtDate(r.check_in)} → ${fmtDate(r.check_out)}\nNew total: ${money(r.total_amount)}`;
  return { subject: `Reservation ${r.reservation_code} updated`, text: wrap(`Dear ${r.guest_name},`, body) };
}

export async function verifyEmail(name: string, link: string) {
  const { wrap } = await frame();
  const body = `Please confirm your email address to finish setting up your account:\n\n${link}\n\nThe link is valid for 24 hours.`;
  return { subject: 'Confirm your email address', text: wrap(`Dear ${name},`, body) };
}

export async function resetEmail(name: string, link: string) {
  const { wrap } = await frame();
  const body = `We received a request to reset your password. Choose a new one here:\n\n${link}\n\nThe link is valid for 60 minutes. If you didn't ask for this, you can ignore this email.`;
  return { subject: 'Reset your password', text: wrap(`Dear ${name},`, body) };
}
