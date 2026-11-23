'use client';
import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from './Toast';
import { cn } from './ui';

export function WishlistButton({ typeId, initial, signedIn, className }: { typeId: number; initial: boolean; signedIn: boolean; className?: string }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!signedIn) { router.push('/login?next=' + encodeURIComponent(location.pathname + location.search)); return; }
    setBusy(true);
    try {
      if (on) await api(`/api/wishlist?typeId=${typeId}`, { method: 'DELETE' });
      else await api('/api/wishlist', { body: { typeId } });
      setOn(!on);
      toast.success(on ? 'Removed from your wishlist' : 'Saved to your wishlist');
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <button onClick={toggle} disabled={busy} aria-pressed={on} aria-label={on ? 'Remove from wishlist' : 'Save to wishlist'}
      className={cn('glass grid size-10 place-items-center rounded-full transition hover:scale-110', className)}>
      <Heart className={cn('size-[1.05rem] transition', on ? 'fill-bad text-bad' : 'text-ivory')} />
    </button>
  );
}
