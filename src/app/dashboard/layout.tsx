import { pageGuard, permissionsFor } from '@/lib/auth';
import { DashShell, type NavItem } from '@/components/DashShell';

const NAV: (NavItem & { perm: string })[] = [
  { href: '/dashboard', label: 'Overview', icon: 'dashboard', perm: 'dashboard.view' },
  { href: '/dashboard/reservations', label: 'Reservations', icon: 'reservations', perm: 'reservations.view_all' },
  { href: '/dashboard/rooms', label: 'Rooms', icon: 'rooms', perm: 'rooms.manage' },
  { href: '/dashboard/inventory', label: 'Inventory', icon: 'inventory', perm: 'inventory.manage' },
  { href: '/dashboard/guests', label: 'Guests', icon: 'guests', perm: 'guests.view' },
  { href: '/dashboard/housekeeping', label: 'Housekeeping', icon: 'housekeeping', perm: 'housekeeping.manage' },
  { href: '/dashboard/services', label: 'Services', icon: 'services', perm: 'orders.manage' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: 'reviews', perm: 'reviews.moderate' },
  { href: '/dashboard/reports', label: 'SQL Reports', icon: 'reports', perm: 'reports.view' },
  { href: '/dashboard/staff', label: 'Staff & Access', icon: 'staff', perm: 'staff.manage' },
  { href: '/dashboard/activity', label: 'Activity & Health', icon: 'activity', perm: 'audit.view' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings', perm: 'settings.manage' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await pageGuard('dashboard.view');
  const perms = await permissionsFor(s.role);
  const nav = NAV.filter((n) => perms.has(n.perm)).map(({ perm: _p, ...n }) => n);
  return <DashShell user={{ name: s.name, role: s.role }} nav={nav}>{children}</DashShell>;
}
