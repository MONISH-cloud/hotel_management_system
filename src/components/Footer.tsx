import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import { Logo } from './Logo';
import { getSettings, fill } from '@/lib/settings';

export async function Footer() {
  const s = await getSettings();
  return (
    <footer id="visit" className="relative border-t hairline bg-ink-950">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-mist">{fill(s.footer_blurb, s)}</p>
        </div>
        <div>
          <p className="eyebrow mb-5">Stay</p>
          <ul className="space-y-3 text-sm text-ivory-dim">
            <li><Link className="transition hover:text-gold-300" href="/rooms">Rooms &amp; Suites</Link></li>
            <li><Link className="transition hover:text-gold-300" href="/#experiences">Experiences</Link></li>
            <li><Link className="transition hover:text-gold-300" href="/#reviews">Guest Voices</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-5">Account</p>
          <ul className="space-y-3 text-sm text-ivory-dim">
            <li><Link className="transition hover:text-gold-300" href="/login">Sign in</Link></li>
            <li><Link className="transition hover:text-gold-300" href="/register">Create account</Link></li>
            <li><Link className="transition hover:text-gold-300" href="/account">My stays</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-5">Visit</p>
          <ul className="space-y-3 text-sm text-ivory-dim">
            <li className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" />{s.address}</li>
            <li className="flex gap-3"><Phone className="size-4 shrink-0 text-gold-400" />{s.phone}</li>
            <li className="flex gap-3"><Mail className="size-4 shrink-0 text-gold-400" />{s.email}</li>
          </ul>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-mist sm:flex-row sm:px-8">
          <p>© {new Date().getFullYear()} {s.hotel_name}. A demonstration hotel management system.</p>
          <p>Next.js · MySQL · Neo4j · Redis</p>
        </div>
      </div>
    </footer>
  );
}
