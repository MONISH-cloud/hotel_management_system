import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { getReservation } from './hotel';
import { getSettings } from './settings';

// Standard PDF fonts only cover Latin-1, so keep text safe and write the rupee sign as "Rs."
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, '?');
const inr = (n: number) => 'Rs. ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
const day = (d: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d.slice(0, 10) + 'T00:00:00'));

export async function buildInvoice(reservationId: number): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const r = await getReservation(reservationId);
  if (!r) return null;
  const cfg = await getSettings();

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const ink = rgb(0.09, 0.09, 0.1), mute = rgb(0.45, 0.45, 0.45), gold = rgb(0.69, 0.55, 0.31);
  const W = 595, M = 48;
  let y = 792;

  const text = (t: string, x: number, size = 10, f: PDFFont = font, color = ink) => page.drawText(safe(t), { x, y, size, font: f, color });
  const right = (t: string, xr: number, size = 10, f: PDFFont = font, color = ink) => page.drawText(safe(t), { x: xr - f.widthOfTextAtSize(safe(t), size), y, size, font: f, color });
  const rule = (color = rgb(0.85, 0.85, 0.85)) => page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color });

  text(cfg.hotel_name, M, 26, serif); right('INVOICE', W - M, 12, bold, gold); y -= 16;
  text(`${cfg.address}  |  ${cfg.phone}  |  ${cfg.email}`, M, 8.5, font, mute);
  right(`No. ${r.reservation_code}`, W - M, 10, bold); y -= 26; rule(gold); y -= 24;

  text('BILLED TO', M, 8, bold, mute); text('STAY', 330, 8, bold, mute); y -= 14;
  text(r.guest_name, M, 11, bold); text(`${r.room_type}, room ${r.room_number}`, 330, 10); y -= 14;
  text(r.guest_email, M, 9.5, font, mute); text(`${day(r.check_in)}  to  ${day(r.check_out)}  (${r.nights} night${r.nights > 1 ? 's' : ''})`, 330, 9.5); y -= 13;
  text(`Status: ${r.status.replace('_', ' ')}`, M, 9.5, font, mute); text(`${r.adults} adult${r.adults > 1 ? 's' : ''}${r.children ? `, ${r.children} child` : ''}`, 330, 9.5); y -= 30;

  // line items
  text('DESCRIPTION', M, 8, bold, mute); right('AMOUNT', W - M, 8, bold, mute); y -= 8; rule(); y -= 18;
  const line = (d: string, a: number, f: PDFFont = font) => { text(d, M, 10, f); right(inr(a), W - M, 10, f); y -= 18; };
  const roomSub = r.total_amount - r.tax_amount;
  line(`${r.room_type}: ${r.nights} night${r.nights > 1 ? 's' : ''} x ${inr(r.nightly_rate)}`, roomSub);
  line(`Tax (${roomSub ? Math.round((r.tax_amount / roomSub) * 100) : 0}%)`, r.tax_amount);
  for (const o of r.orders.filter((o) => o.status !== 'cancelled')) line(`${o.quantity > 1 ? o.quantity + ' x ' : ''}${o.service_name}`, o.quantity * o.unit_price);
  y -= 2; rule(); y -= 18;
  line('Total charges', r.total_amount + r.services_total, bold);

  y -= 8; text('PAYMENTS', M, 8, bold, mute); y -= 16;
  if (!r.payments.length) { text('No payments recorded.', M, 9.5, font, mute); y -= 16; }
  for (const p of r.payments) {
    text(`${day(p.paid_at)}   ${p.payment_type === 'refund' ? 'Refund' : 'Payment'} (${String(p.method).toUpperCase()})   ${p.reference}`, M, 9.5, font, mute);
    right(`${p.payment_type === 'refund' ? '-' : ''}${inr(p.amount)}`, W - M, 9.5); y -= 15;
  }
  y -= 6; rule(gold); y -= 24;
  text(r.balance_due > 0 ? 'BALANCE DUE' : 'PAID IN FULL', M, 12, bold, r.balance_due > 0 ? rgb(0.7, 0.3, 0.2) : rgb(0.2, 0.55, 0.35));
  right(r.balance_due > 0 ? inr(r.balance_due) : inr(0), W - M, 16, bold);

  page.drawText(safe(`Thank you for staying with ${cfg.hotel_name}. Generated ${new Date().toISOString().slice(0, 10)}.`), { x: M, y: 40, size: 8, font, color: mute });

  return { bytes: await pdf.save(), filename: `invoice-${r.reservation_code}.pdf` };
}
