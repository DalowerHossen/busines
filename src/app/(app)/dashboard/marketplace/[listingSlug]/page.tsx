// src/app/(app)/dashboard/marketplace/[listingSlug]/page.tsx
// One listing in full: what it is, who wrote it, what other businesses
// thought of it, and the single button that puts it to work.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Star } from 'lucide-react';

import { InstallButton } from '@/components/marketplace/install-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadListingPage } from '@/features/marketplace/queries/get-listing';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Marketplace listing',
  description: 'A template packaged by another business.',
  path: ROUTES.marketplace,
  noIndex: true,
});

export interface ListingPageProps {
  /** The listing being opened. */
  params: { listingSlug: string };
}

/**
 * Renders one marketplace listing.
 *
 * @param props The listing address.
 * @returns The rendered page.
 */
export default async function MarketplaceListingPage({ params }: ListingPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;
  const page = await loadListingPage(params.listingSlug, company?.id ?? null);

  if (page === null) {
    notFound();
  }

  const { listing, reviews, installId } = page;
  const canInstall = (user.role === 'owner' || user.role === 'super_admin') && company !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={listing.title}
        description={listing.summary}
        actions={
          <Link
            href={ROUTES.marketplace}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
          >
            Back to the marketplace
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>What this template does</CardTitle>
              <CardDescription>
                Version {listing.version}
                {listing.publishedAt === null
                  ? ''
                  : `, published ${formatDate(listing.publishedAt)}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">{listing.description ?? listing.summary}</p>

              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">{humanise(listing.category)}</Badge>
                <Badge tone="neutral">{humanise(listing.artifactKind)}</Badge>
                {listing.tags.map((tag) => (
                  <Badge key={tag} tone="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                {formatNumber(listing.installCount)} businesses run this template.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What buyers said</CardTitle>
              <CardDescription>
                Only a business that installed the template can rate it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <EmptyState
                  title="Nobody has rated this yet"
                  description="Install it and you can leave the first rating from your marketplace page."
                />
              ) : (
                <ul className="space-y-4">
                  {reviews.map((review) => (
                    <li key={review.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2">
                        <Star aria-hidden="true" className="h-4 w-4 text-brand-700" />
                        <span className="tabular text-sm font-semibold text-foreground">
                          {review.rating} out of 5
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>

                      {review.title === null ? null : (
                        <p className="mt-2 text-sm font-medium text-foreground">{review.title}</p>
                      )}

                      {review.body === null ? null : (
                        <p className="mt-1 text-sm text-muted-foreground">{review.body}</p>
                      )}

                      {review.vendorReply === null ? null : (
                        <p className="mt-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
                          {review.vendorReply}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {listing.pricingModel === 'free'
                  ? 'Free'
                  : formatMoney(listing.priceAmount, listing.priceCurrency)}
              </CardTitle>
              <CardDescription>
                {listing.averageRating === null
                  ? 'Not rated yet'
                  : `Rated ${listing.averageRating} by ${formatNumber(listing.ratingCount)} businesses`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InstallButton
                listingId={listing.listingId}
                pricingModel={listing.pricingModel}
                priceAmount={listing.priceAmount}
                priceCurrency={listing.priceCurrency}
                isInstalled={installId !== null}
                canInstall={canInstall}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{listing.vendorName}</CardTitle>
              <CardDescription>{listing.vendorHeadline ?? 'Marketplace vendor'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {listing.vendorSupportEmail === null ? (
                <p>Support runs through the platform.</p>
              ) : (
                <p>
                  Support:{' '}
                  <a
                    className="text-brand-700 underline-offset-2 hover:underline"
                    href={`mailto:${listing.vendorSupportEmail}`}
                  >
                    {listing.vendorSupportEmail}
                  </a>
                </p>
              )}

              {listing.demoUrl === null ? null : (
                <p>
                  <a
                    className="text-brand-700 underline-offset-2 hover:underline"
                    href={listing.demoUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    See it in use
                  </a>
                </p>
              )}
            </CardContent>
          </Card>

          {company === null ? (
            <Alert tone="info" title="No business is attached to this account">
              Templates install into a business, so ask to be invited to one first.
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}
