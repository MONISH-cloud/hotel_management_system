import { getSession } from '@/lib/auth';
import { HeaderShell } from './HeaderShell';

export async function SiteHeader({ solid = false }: { solid?: boolean }) {
  const s = await getSession();
  return <HeaderShell solid={solid} user={s ? { name: s.name, role: s.role } : null} />;
}
