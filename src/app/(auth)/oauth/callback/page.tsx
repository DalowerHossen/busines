import Link from 'next/link';
import { Alert, Button } from '@/components/ui';
import { AuthShell } from '@/features/auth';

export const metadata = { title: 'Sign-in callback' };

export default function OAuthCallbackPage(): React.ReactNode {
  return (
    <AuthShell
      title="Sign-in needs attention"
      description="We could not finish the social sign-in handoff. Start again from the sign-in page."
    >
      <Alert variant="warning">
        Your sign-in session could not be completed. No provider credentials were stored in this
        browser.
      </Alert>
      <Link href="/login" className="mt-6 block">
        <Button type="button" className="w-full">
          Return to sign in
        </Button>
      </Link>
    </AuthShell>
  );
}
