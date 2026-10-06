// src/components/portal/portal-link-notice.tsx
// What a client sees when their link cannot be opened: a plain explanation
// and what to do next, never a technical error.

import { BRAND } from '@/config/brand';
import type { PortalFailure } from '@/features/portal/types';

export interface PortalLinkNoticeProps {
  /** Why the link did not open. */
  failure: PortalFailure;
}

const HEADINGS: Readonly<Record<PortalFailure['reason'], string>> = {
  invalid: 'This link does not open a document',
  expired: 'This link has expired',
  revoked: 'This link has been withdrawn',
  used: 'This link has already been used',
  unavailable: 'This document is not available right now',
};

/**
 * Renders the message shown instead of a document.
 *
 * @param props The reason the link failed.
 * @returns The rendered message.
 */
export function PortalLinkNotice({ failure }: PortalLinkNoticeProps) {
  return (
    <section className="mx-auto w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center shadow-xs">
      <h1 className="text-xl font-semibold text-foreground">{HEADINGS[failure.reason]}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{failure.message}</p>
      <p className="mt-6 text-sm text-muted-foreground">
        Reply to the email you received and the sender can issue a new link in a few seconds.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">Delivered securely by {BRAND.name}.</p>
    </section>
  );
}
