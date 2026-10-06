// src/app/d/[token]/page.tsx
// The page behind a client link. The token in the address is the only key,
// so the page is never indexed and never leaks a referrer.

import type { Metadata } from 'next';

import { PortalDocument } from '@/components/portal/portal-document';
import { PortalLinkNotice } from '@/components/portal/portal-link-notice';
import { PortalPaymentPanel } from '@/components/portal/portal-payment-panel';
import { PortalWorkEvidence } from '@/components/portal/portal-work-evidence';
import { ROUTES } from '@/config/app';
import { resolvePortalDocument } from '@/features/portal/queries/resolve-portal-document';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your document',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export interface PortalPageProps {
  /** The token taken from the address. */
  params: { token: string };
}

/**
 * Renders the document a client link unlocks.
 *
 * @param props The token from the address.
 * @returns The rendered page.
 */
export default async function PortalPage({ params }: PortalPageProps) {
  const result = await resolvePortalDocument(decodeURIComponent(params.token));

  if (!result.isAvailable) {
    return <PortalLinkNotice failure={result} />;
  }

  const downloadPath = `/api/portal/${encodeURIComponent(params.token)}/pdf`;

  return (
    <>
      <PortalDocument document={result.document} />

      <div className="mx-auto flex w-full max-w-content justify-end">
        <a
          href={downloadPath}
          rel="noopener noreferrer"
          className="inline-flex min-h-touch items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground shadow-xs"
        >
          Download a PDF copy
        </a>
      </div>

      <PortalWorkEvidence
        evidence={result.document.evidence}
        token={decodeURIComponent(params.token)}
      />

      {result.document.kind === 'invoice' ? (
        <>
          {Number.parseFloat(result.document.balanceDue) > 0 ? (
            <div className="mx-auto flex w-full max-w-content justify-end">
              <a
                href={`${ROUTES.clientCheckout}/${encodeURIComponent(params.token)}`}
                rel="noopener noreferrer"
                className="inline-flex min-h-touch items-center rounded-md bg-brand-600 px-5 text-sm font-medium text-white shadow-xs"
              >
                Pay this invoice online
              </a>
            </div>
          ) : null}

          <PortalPaymentPanel document={result.document} />
        </>
      ) : null}
    </>
  );
}
