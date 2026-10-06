import { AuthShell, TwoFactorForm } from '@/features/auth';

export const metadata = { title: 'Two-factor verification' };

export default function TwoFactorPage(): React.ReactNode {
  return (
    <AuthShell
      title="One more security check"
      description="Enter the six-digit code from your authenticator app to continue."
    >
      <TwoFactorForm />
    </AuthShell>
  );
}
