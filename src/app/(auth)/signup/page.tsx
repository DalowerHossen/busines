import Link from 'next/link';
import { AuthShell, SignupForm } from '@/features/auth';

export const metadata = { title: 'Create an account' };

export default function SignupPage(): React.ReactNode {
  return (
    <AuthShell
      title="Start with a calmer workspace"
      description="Create your account and set up the company workspace that fits your business."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
