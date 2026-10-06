import { AuthShell, ResetPasswordForm } from '@/features/auth';

export const metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage({
  searchParams,
}: {
  readonly searchParams: { readonly token?: string };
}): React.ReactNode {
  return (
    <AuthShell
      title="Choose a new password"
      description="Use a strong password to protect your billing workspace."
    >
      <ResetPasswordForm token={searchParams.token ?? ''} />
    </AuthShell>
  );
}
