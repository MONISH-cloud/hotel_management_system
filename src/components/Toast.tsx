'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
type T = { id: number; kind: Kind; msg: string };
const Ctx = createContext<{ success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }>({
  success: () => {}, error: () => {}, info: () => {},
});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: Kind, msg: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, msg }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6500 : 4200);
  }, []);
  const api = useMemo(() => ({
    success: (m: string) => push('success', m), error: (m: string) => push('error', m), info: (m: string) => push('info', m),
  }), [push]);

  const icon = { success: <CheckCircle2 className="size-5 text-ok" />, error: <AlertTriangle className="size-5 text-bad" />, info: <Info className="size-5 text-info" /> };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-3 p-4 sm:items-end sm:p-6" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-4 shadow-2xl shadow-black/50">
              {icon[t.kind]}
              <p className="flex-1 text-sm leading-snug text-ivory">{t.msg}</p>
              <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="text-mist hover:text-ivory" aria-label="Dismiss"><X className="size-4" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
