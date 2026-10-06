// src/app/(app)/dashboard/setup/page.tsx
// The route from signing up to being paid.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SetupChecklist } from '@/components/onboarding/setup-checklist';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadOnboardingState } from '@/features/onboarding/queries/get-onboarding';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Getting started',
  description: 'The steps between signing up and being paid.',
  path: '/dashboard/setup',
  noIndex: true,
});

/**
 * Renders the setup page.
 *
 * @returns The rendered page.
 */
export default async function SetupPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Getting started"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </div>
    );
  }

  const state = await loadOnboardingState(company.id);
  const canAct = (user.role === 'owner' || user.role === 'super_admin') && !company.isReadOnly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Getting started"
        description="Your client pays by card, we hold the money for a short period, then you withdraw it. Here is what has to be in place first."
      />

      {state.isDegraded ? (
        <Alert tone="warning" title="Your progress could not be read">
          Nothing is wrong with your account. Reload the page in a moment.
        </Alert>
      ) : (
        <SetupChecklist state={state} canAct={canAct} />
      )}
    </div>
  );
}
