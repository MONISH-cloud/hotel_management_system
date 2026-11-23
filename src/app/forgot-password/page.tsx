import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import { ForgotForm } from '@/components/AccountLinkForms';

export const metadata: Metadata = { title: 'Forgot password' };

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col px-6 py-10 sm:px-12">
      <Logo />
      <div className="flex flex-1 items-center justify-center py-12"><ForgotForm /></div>
    </main>
  );
}
