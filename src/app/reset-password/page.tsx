import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { ResetForm } from '@/components/AccountLinkForms';

export const metadata: Metadata = { title: 'Reset password' };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col px-6 py-10 sm:px-12">
      <Logo />
      <div className="flex flex-1 items-center justify-center py-12">{token ? <ResetForm token={token} /> : <p className="text-mist">This link is incomplete. Please use the full link from your email.</p>}</div>
    </main>
  );
}
