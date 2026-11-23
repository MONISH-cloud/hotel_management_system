import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { HousekeepingBoard } from '@/components/HousekeepingBoard';
import { pageGuard } from '@/lib/auth';
import { listTasks, listHousekeepers, listRooms } from '@/lib/hotel';

export const metadata: Metadata = { title: 'Housekeeping' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await pageGuard('housekeeping.manage', '/dashboard/housekeeping');
  const [tasks, staff, rooms] = await Promise.all([listTasks(), listHousekeepers(), listRooms()]);
  return (
    <>
      <PageHeader eyebrow="Operations" title="Housekeeping" subtitle="Check-outs create tasks automatically. Completing a clean returns the room to inventory through a trigger." />
      <HousekeepingBoard tasks={tasks as never} staff={staff as never} rooms={rooms.map((r) => ({ room_id: r.room_id, room_number: r.room_number }))} />
    </>
  );
}
