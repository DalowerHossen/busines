import { AuthShell, VerifyEmailForm } from '@/features/auth';

export const metadata = { title: 'Verify your email' };

export default function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: { readonly token?: string };
}): React.ReactNode {
  return (
    <AuthShell
      title="Verify your email"
      description="Confirm your email address to activate your workspace access."
    >
      <VerifyEmailForm token={searchParams.token} />
    </AuthShell>
  );
}
