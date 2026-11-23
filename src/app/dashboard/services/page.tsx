import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { ServicesManager } from '@/components/ServicesManager';
import { pageGuard, hasPerm } from '@/lib/auth';
import { listOrders, listServices } from '@/lib/hotel';

export const metadata: Metadata = { title: 'Services' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await pageGuard('orders.manage', '/dashboard/services');
  const [orders, services, canCatalogue] = await Promise.all([listOrders(80), listServices(true), hasPerm(s, 'services.manage')]);
  return (
    <>
      <PageHeader eyebrow="Guest services" title="Services" subtitle="Work the request queue and (for managers) curate the catalogue. Prices are snapshotted onto each order by a trigger." />
      <ServicesManager orders={orders as never} services={services as never} canCatalogue={canCatalogue} />
    </>
  );
}
