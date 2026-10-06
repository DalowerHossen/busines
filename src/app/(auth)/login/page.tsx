import Link from 'next/link';
import { AuthShell, LoginForm } from '@/features/auth';

export const metadata = { title: 'Sign in' };

export default function LoginPage(): React.ReactNode {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to keep your billing work moving."
      footer={
        <>
          New to KD SOLUTION IT?{' '}
          <Link
            href="/signup"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
