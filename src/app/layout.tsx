import type { Metadata, Viewport } from 'next';
import { Manrope, Cormorant_Garamond } from 'next/font/google';
import { ToastProvider } from '@/components/Toast';
import { SettingsProvider } from '@/components/SettingsProvider';
import { getSettings } from '@/lib/settings';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const serif = Cormorant_Garamond({
  subsets: ['latin'], variable: '--font-cormorant', display: 'swap',
  weight: ['400', '500', '600', '700'], style: ['normal', 'italic'],
});

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: `${s.hotel_name} · ${s.hotel_tagline}`, template: `%s · ${s.hotel_name}` },
    description: `${s.hotel_name}: book rooms, order services and manage your stay.`,
  };
}
export const viewport: Viewport = { themeColor: '#07080a' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh">
        <SettingsProvider value={settings}>
          <ToastProvider>{children}</ToastProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
