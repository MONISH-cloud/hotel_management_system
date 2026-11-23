import type { Metadata } from 'next';
import { PageHeader } from '@/components/DashKit';
import { ReportsExplorer } from '@/components/ReportsExplorer';
import { pageGuard } from '@/lib/auth';
import { loadReports } from '@/lib/hotel';

export const metadata: Metadata = { title: 'SQL Reports' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await pageGuard('reports.view', '/dashboard/reports');
  const reports = await loadReports();
  return (
    <>
      <PageHeader eyebrow="Analytics · MySQL" title="SQL Reports" subtitle="Sixteen live queries: nested, correlated and recursive subqueries, CTEs, window functions and joins. The SQL shown here is read from db/mysql/04_queries.sql and executed against the real database." />
      <ReportsExplorer reports={reports} />
    </>
  );
}
