'use client';
import Link from 'next/link';
import { useSettings } from './SettingsProvider';

export function Logo({ className = '', href = '/' }: { className?: string; href?: string }) {
  const { hotel_name, hotel_tagline } = useSettings();
  const [first, ...rest] = hotel_name.split(' ');
  return (
    <Link href={href} className={`group inline-flex items-center gap-3 ${className}`} aria-label={`${hotel_name} home`}>
      <span className="relative grid size-10 place-items-center rounded-full border border-gold-400/50 bg-gradient-to-br from-gold-400/20 to-transparent transition group-hover:border-gold-300">
        <svg viewBox="0 0 24 24" className="size-5 text-gold-300" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-6h6v6" /><path d="M12 4v3" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="font-display block text-[1.6rem] font-semibold tracking-wide">{first}{rest.length > 0 && <> <span className="gold-text italic">{rest.join(' ')}</span></>}</span>
        <span className="mt-1 block text-[0.55rem] font-semibold uppercase tracking-[0.42em] text-mist">{hotel_tagline}</span>
      </span>
    </Link>
  );
}
