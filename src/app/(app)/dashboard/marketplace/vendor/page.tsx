// src/app/(app)/dashboard/marketplace/vendor/page.tsx
// The vendor desk: apply to sell, write listings, and watch what they earn.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ListingEditor } from '@/components/marketplace/listing-editor';
import { VendorApplicationForm } from '@/components/marketplace/vendor-application-form';
import { VendorEarningsPanel } from '@/components/marketplace/vendor-earnings-panel';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadVendorDesk } from '@/features/marketplace/queries/get-vendor-desk';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Vendor desk',
  description: 'Sell the templates you already use to other businesses.',
  path: `${ROUTES.marketplace}/vendor`,
  noIndex: true,
});

/**
 * Renders the vendor desk.
 *
 * @returns The rendered page.
 */
export default async function VendorDeskPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Vendor desk"
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          A vendor account belongs to a business, so ask to be invited to one first.
        </Alert>
      </div>
    );
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Vendor desk"
          description="Only the owner decides what this business sells."
        />
        <Alert tone="info" title="This is the owner's decision">
          Ask the owner of this business to open a vendor account.
        </Alert>
      </div>
    );
  }

  const desk = await loadVendorDesk(company.id);

  if (desk.profile === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Vendor desk"
          description="Package the invoice layouts, charts of accounts and reminder sets you already use, and sell them to other businesses."
        />

        <VendorApplicationForm defaultName={company.displayName} defaultEmail={user.email} />
      </div>
    );
  }

  const profile = desk.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.vendorName}
        description={`You keep ${profile.revenueSharePercentage}% of every sale. The platform handles the money, the invoice and the refunds.`}
      />

      {desk.isDegraded ? (
        <Alert tone="warning" title="Part of your desk could not be read">
          Your listings are safe. Reload the page in a moment before changing anything.
        </Alert>
      ) : null}

      {profile.status === 'approved' ? null : (
        <Alert tone="info" title="Your vendor account is being read">
          We write to {profile.supportEmail ?? 'your support address'} the moment it is approved.
        </Alert>
      )}

      <VendorEarningsPanel profile={profile} earnings={desk.earnings} />

      <ListingEditor
        listings={desk.listings}
        currency={profile.payoutCurrency}
        isApproved={profile.status === 'approved'}
      />
    </div>
  );
}
