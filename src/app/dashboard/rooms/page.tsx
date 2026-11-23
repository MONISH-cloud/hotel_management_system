import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { RoomsBoard } from '@/components/RoomsBoard';
import { pageGuard } from '@/lib/auth';
import { listRooms } from '@/lib/hotel';

export const metadata: Metadata = { title: 'Rooms' };
export const dynamic = 'force-dynamic';

export default async function RoomsPage() {
  await pageGuard('rooms.manage', '/dashboard/rooms');
  const rooms = await listRooms();
  return (
    <>
      <PageHeader eyebrow="Inventory" title="Rooms" subtitle="Every room at a glance. Occupancy and cleaning states update automatically from check-in, check-out and housekeeping triggers." />
      <RoomsBoard rooms={rooms as never} />
    </>
  );
}
