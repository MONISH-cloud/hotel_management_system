import { ShowerHead, Wifi, Tv, Coffee, Sun, Wine, Bath, Thermometer, Lock, ConciergeBell, Waves, Laptop, Utensils, Sparkles, Car, Shirt, Compass, ShieldCheck, type LucideIcon } from 'lucide-react';

const map: Record<string, LucideIcon> = {
  shower: ShowerHead, wifi: Wifi, tv: Tv, coffee: Coffee, sun: Sun, wine: Wine, bath: Bath, thermometer: Thermometer,
  lock: Lock, bell: ConciergeBell, waves: Waves, laptop: Laptop,
  sparkles: Sparkles, shield: ShieldCheck,
  dining: Utensils, spa: Sparkles, transport: Car, laundry: Shirt, experience: Compass,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const C = map[name] ?? Sparkles;
  return <C className={className ?? 'size-4'} />;
}
