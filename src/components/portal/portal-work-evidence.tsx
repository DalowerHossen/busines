// src/components/portal/portal-work-evidence.tsx
// What the client is being asked to pay for, shown before the pay button.
//
// This is the part of the page that answers the only question a client
// actually has: was the work done. Files, links and logged hours are listed
// plainly, with no account needed to open any of them.

import type { PortalEvidence } from '@/features/portal/types';
import { formatDate } from '@/lib/dates';
import { formatFileSize, formatNumber, humanise } from '@/lib/format';

export interface PortalWorkEvidenceProps {
  /** Proof the seller marked as visible to the client. */
  evidence: readonly PortalEvidence[];
  /** Token of this link, used to open attached files. */
  token: string;
}

/**
 * Renders the proof of work on a client link.
 *
 * @param props The proof and the link token.
 * @returns The rendered section, or nothing when there is no proof.
 */
export function PortalWorkEvidence({ evidence, token }: PortalWorkEvidenceProps) {
  if (evidence.length === 0) {
    return null;
  }

  const hours = evidence.reduce(
    (running, item) => running + (item.hoursWorked === null ? 0 : Number(item.hoursWorked)),
    0
  );

  return (
    <section className="mx-auto w-full max-w-content rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">The work this invoice covers</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {hours > 0
          ? `Delivered work attached by your supplier, covering ${formatNumber(hours, 2)} hours.`
          : 'Delivered work attached by your supplier.'}
      </p>

      <ul className="mt-4 space-y-3">
        {evidence.map((item) => (
          <li key={item.evidenceId} className="rounded-md border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{item.title}</p>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                {humanise(item.kind)}
              </span>
            </div>

            {item.description === null ? null : (
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            )}

            {item.hoursWorked === null ? null : (
              <p className="tabular mt-1 text-sm text-muted-foreground">
                {`${formatNumber(Number(item.hoursWorked), 2)} hours${
                  item.performedOn === null ? '' : ` on ${formatDate(item.performedOn)}`
                }`}
              </p>
            )}

            {item.externalUrl === null ? null : (
              <a
                className="mt-2 inline-block break-all text-sm text-brand-700 underline"
                href={item.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.externalUrl}
              </a>
            )}

            {item.fileId === null ? null : (
              <a
                className="mt-2 inline-flex min-h-touch items-center rounded-md border border-border px-3 text-sm font-medium text-foreground"
                href={`/api/portal/${encodeURIComponent(token)}/evidence/${item.evidenceId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.fileName === null
                  ? 'Open the attached file'
                  : `Open ${item.fileName} (${formatFileSize(item.byteSize)})`}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
