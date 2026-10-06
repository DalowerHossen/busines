// src/app/(app)/dashboard/loyalty/reviews/page.tsx
// What clients were asked, what they said, and what may be shown publicly.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoyaltyNav } from '@/components/loyalty/loyalty-nav';
import { ReviewBoard } from '@/components/loyalty/review-board';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadReviewBoard } from '@/features/loyalty/queries/list-reviews';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatNumber } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Reviews',
  description: 'What clients said about the work and which quotes may be shown.',
  path: `${ROUTES.loyalty}/reviews`,
  noIndex: true,
});

/**
 * Renders the review board.
 *
 * @returns The rendered page.
 */
export default async function ReviewsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Reviews" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'clients', 'view')) {
    return (
      <>
        <PageHeader title="Reviews" description="You do not have access to the client records." />
        <Alert tone="warning" title="You cannot see the reviews">
          Ask the owner of this business to give your account permission to view clients.
        </Alert>
      </>
    );
  }

  const board = await loadReviewBoard(company.id);

  const cards = [
    {
      key: 'rating',
      label: 'Average rating',
      value: `${board.overview.averageRating} of 5`,
      note: `${formatNumber(board.overview.responseCount)} clients answered`,
    },
    {
      key: 'recommend',
      label: 'Would recommend you',
      value: `${board.overview.recommendRate}%`,
      note: `${formatNumber(board.overview.detractorCount)} were unhappy enough to say so`,
    },
    {
      key: 'waiting',
      label: 'Invitations unanswered',
      value: formatNumber(board.overview.waitingCount),
      note: 'These close by themselves after thirty days',
    },
    {
      key: 'published',
      label: 'Quotes on the site',
      value: formatNumber(board.overview.publishedCount),
      note: `${formatNumber(board.overview.unpublishedCount)} are waiting to be published`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Ask once, at the moment the work is paid for, and keep only what the client agreed you may show. That is the whole method."
      />

      <LoyaltyNav />

      {board.isDegraded ? (
        <Alert tone="warning" title="The reviews could not be read">
          Nothing has been changed. Try again in a moment.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardContent className="space-y-1 pt-6">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="tabular text-2xl font-semibold">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReviewBoard
        requests={board.requests}
        testimonials={board.testimonials}
        canManage={user.role === 'owner' && !company.isReadOnly}
      />
    </div>
  );
}
