import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { InventoryManager } from '@/components/InventoryManager';
import { pageGuard } from '@/lib/auth';
import { listTypesForAdmin, listAmenities, listRooms } from '@/lib/hotel';

export const metadata: Metadata = { title: 'Inventory' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await pageGuard('inventory.manage', '/dashboard/inventory');
  const [types, amenities, rooms] = await Promise.all([listTypesForAdmin(), listAmenities(), listRooms()]);
  return (
    <>
      <PageHeader eyebrow="Inventory" title="Rooms & room types" subtitle="Create and edit room categories (price, capacity, amenities, photo) and the individual rooms behind them. Photos you upload are stored on the server and served from /api/media." />
      <InventoryManager types={types} amenities={amenities} rooms={rooms as never} />
    </>
  );
}
