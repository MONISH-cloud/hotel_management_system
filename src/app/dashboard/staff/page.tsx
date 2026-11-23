import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { StaffManager } from '@/components/StaffManager';
import { pageGuard } from '@/lib/auth';
import { listEmployees, listUsers, listRolesWithPermissions, listDepartments } from '@/lib/hotel';

export const metadata: Metadata = { title: 'Staff & Access' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await pageGuard('staff.manage', '/dashboard/staff');
  const [employees, users, roles, departments] = await Promise.all([listEmployees(), listUsers(), listRolesWithPermissions(), listDepartments()]);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Staff & access" subtitle="Manage the team, their reporting lines and what each role is allowed to do. Role permissions are rows in role_permissions; changing a user's role revokes their live sessions in Redis." />
      <StaffManager employees={employees as never} users={users as never} roles={roles} departments={departments} meId={s.userId} />
    </>
  );
}
