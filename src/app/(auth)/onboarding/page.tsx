import Link from 'next/link';
import { AuthShell } from '@/features/auth';
import { OnboardingWizard } from '@/features/onboarding';

export const metadata = { title: 'Set up your workspace' };

export default function OnboardingPage(): React.ReactNode {
  return (
    <AuthShell
      title="Set up your workspace"
      description="A few defaults now will make every invoice and client workflow feel ready from day one."
      footer={
        <>
          Need to return later?{' '}
          <Link
            href="/login"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <OnboardingWizard />
    </AuthShell>
  );
}
