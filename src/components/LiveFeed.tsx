'use client';
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { api } from '@/lib/client';
import { timeAgo } from '@/lib/format';

type Item = { title: string; detail: string; at: number };

export function LiveFeed({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [, tick] = useState(0);
  useEffect(() => {
    const poll = setInterval(() => { api<{ feed: Item[] }>('/api/feed').then((d) => setItems(d.feed)).catch(() => {}); }, 12000);
    const clock = setInterval(() => tick((n) => n + 1), 30000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, []);
  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-xs text-mist"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-ok" /></span><Radio className="size-3.5" />Live from Redis · refreshes every 12s</p>
      {!items.length ? <p className="py-8 text-center text-sm text-mist">Activity will stream in here as guests and staff act.</p> : (
        <ol className="relative space-y-5 border-l hairline pl-6">
          {items.map((it, i) => (
            <li key={`${it.at}-${i}`} className="relative">
              <span className="absolute -left-[1.95rem] top-1.5 size-2.5 rounded-full border-2 border-ink-900 bg-gold-400" />
              <p className="text-sm font-semibold">{it.title}</p><p className="text-sm text-ivory-dim">{it.detail}</p><p className="mt-0.5 text-xs text-mist">{timeAgo(it.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
