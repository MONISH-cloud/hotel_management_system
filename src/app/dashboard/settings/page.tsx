import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { SettingsEditor } from '@/components/SettingsEditor';
import { pageGuard } from '@/lib/auth';
import { listSettingRows } from '@/lib/settings';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await pageGuard('settings.manage', '/dashboard/settings');
  const rows = await listSettingRows();
  return (
    <>
      <PageHeader eyebrow="Administration" title="Hotel settings" subtitle="Policies, loyalty rules and website copy are rows in the hotel_settings table. The stored procedures and triggers read the same values, so a change here applies to new bookings immediately." />
      <SettingsEditor rows={rows} />
    </>
  );
}
