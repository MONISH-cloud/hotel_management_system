'use client';
import { createContext, useContext } from 'react';
import { FALLBACK_SETTINGS, type Settings } from '@/lib/settings-shared';

const Ctx = createContext<Settings>(FALLBACK_SETTINGS);

export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ value, children }: { value: Settings; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
