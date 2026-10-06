import { AuthShell, ForgotPasswordForm } from '@/features/auth';

export const metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage(): React.ReactNode {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your account email and we will send a secure reset link."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
