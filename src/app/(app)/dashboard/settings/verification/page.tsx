// src/app/(app)/dashboard/settings/verification/page.tsx
// The identity check a business completes before we will hold and settle
// card money on its behalf.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DocumentUploader } from '@/components/kyc/document-uploader';
import { VerificationForm } from '@/components/kyc/verification-form';
import { VerificationStatusCard } from '@/components/kyc/verification-status-card';
import { SettingsNav } from '@/components/settings/settings-nav';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadVerification } from '@/features/kyc/queries/get-verification';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Verification',
  description: 'The identity check that lets us settle card payments to your business.',
  path: `${ROUTES.settings}/verification`,
  noIndex: true,
});

/**
 * Renders the identity check page.
 *
 * @returns The rendered page.
 */
export default async function VerificationSettingsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title="Verification"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    return (
      <>
        <PageHeader
          title="Verification"
          description="Only the owner of the business can complete the identity check."
        />
        <SettingsNav />
        <Alert tone="info" title="This part is for the owner">
          Identity papers are personal, so only the owner of this business may see or send them.
        </Alert>
      </>
    );
  }

  const { verification, isDegraded } = await loadVerification(company.id);
  const status = verification?.status ?? 'not_started';
  const isEditable = status === 'not_started' || status === 'in_progress' || status === 'rejected';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification"
        description="We are the merchant of record for card payments, so the law requires us to know who we are collecting for. Your papers are stored privately and are never shown to your clients."
      />

      <SettingsNav />

      {isDegraded ? (
        <Alert tone="warning" title="Your check could not be read">
          Something went wrong on our side. Reload the page in a moment rather than starting again,
          so nothing is duplicated.
        </Alert>
      ) : null}

      <VerificationStatusCard verification={verification} />

      <VerificationForm
        verification={verification}
        defaultCountry={company.countryCode}
        defaultLegalName={company.legalName || company.displayName}
        isEditable={isEditable}
      />

      {verification ? (
        <DocumentUploader
          verificationId={verification.id}
          documents={verification.documents}
          isEditable={isEditable}
        />
      ) : (
        <Alert tone="info" title="Papers come next">
          Save your answers first. The upload slots appear as soon as the check exists.
        </Alert>
      )}
    </div>
  );
}
