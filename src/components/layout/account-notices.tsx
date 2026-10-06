// src/components/layout/account-notices.tsx
// The messages that belong at the top of every page inside the application:
// an address still to confirm, a trial running out, a business that has been
// put into read only. Nothing is shown when there is nothing to say.

import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { ROUTES } from '@/config/app';
import { daysBetween, todayIso } from '@/lib/dates';
import type { CompanyContext, SessionUser } from '@/lib/auth/types';

export interface AccountNoticesProps {
  /** Signed in account. */
  user: SessionUser;
  /** Business being worked inside, when there is one. */
  company: CompanyContext | null;
}

/**
 * Counts the days left on a trial.
 *
 * @param trialEndsAt Moment the trial ends, in ISO 8601 form.
 * @returns Whole days remaining, or null when there is no trial.
 */
function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) {
    return null;
  }

  const endDate = trialEndsAt.slice(0, 10);
  const days = daysBetween(todayIso(), endDate);

  return Number.isFinite(days) ? days : null;
}

/**
 * Renders the notices that apply to this account right now.
 *
 * @param props Account and business being worked inside.
 * @returns The rendered notices, or nothing when all is well.
 */
export function AccountNotices({ user, company }: AccountNoticesProps) {
  const notices = [];

  if (!user.emailVerifiedAt) {
    notices.push(
      <Alert
        key="email"
        tone="warning"
        title="Confirm your email address"
        action={
          <Link href={ROUTES.verifyEmail} className={buttonVariants({ size: 'sm' })}>
            Confirm now
          </Link>
        }
      >
        Sending invoices is held back until the address on this account is confirmed.
      </Alert>
    );
  }

  const daysLeft = trialDaysLeft(company?.trialEndsAt ?? null);

  if (company && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7) {
    notices.push(
      <Alert
        key="trial"
        tone="info"
        title={daysLeft === 0 ? 'Your trial ends today' : `Your trial ends in ${daysLeft} days`}
        action={
          <Link
            href={ROUTES.pricing}
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            See the plans
          </Link>
        }
      >
        Nothing is deleted when a trial ends. The account moves to the free plan until a paid plan
        is chosen.
      </Alert>
    );
  }

  if (company?.isReadOnly) {
    notices.push(
      <Alert key="read-only" tone="warning" title="This business is read only">
        You can read and export everything, but new documents cannot be created until the account is
        active again.
      </Alert>
    );
  }

  if (notices.length === 0) {
    return null;
  }

  return <div className="space-y-3">{notices}</div>;
}
