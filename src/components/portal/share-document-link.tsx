// src/components/portal/share-document-link.tsx
// The owner's side of a client link: create one, read it once, copy it.

'use client';

import { Copy, Link2 } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { notify } from '@/components/ui/toaster';
import { absoluteUrl } from '@/lib/env/env.client';
import { createDocumentLink } from '@/features/portal/actions/create-document-link';
import { formatDate } from '@/lib/dates';

export interface ShareDocumentLinkProps {
  /** Which kind of document is being shared. */
  documentKind: 'invoice' | 'estimate';
  /** Identifier of the document. */
  documentId: string;
  /** Address the document is going to, when one is known. */
  recipientEmail?: string | null;
  /** False when the signed in account may not share documents. */
  canShare: boolean;
}

/**
 * Renders the client link panel.
 *
 * @param props The document being shared and who may share it.
 * @returns The rendered panel.
 */
export function ShareDocumentLink({
  documentKind,
  documentId,
  recipientEmail = null,
  canShare,
}: ShareDocumentLinkProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Creates a fresh link for this document.
   *
   * @returns Nothing.
   */
  async function create(): Promise<void> {
    setIsWorking(true);
    setFormError(null);

    const result = await createDocumentLink({
      documentKind,
      documentId,
      recipientEmail: recipientEmail ?? undefined,
    });

    setIsWorking(false);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    setLink(absoluteUrl(result.data.linkPath));
    setExpiresAt(result.data.expiresAt);
    setRequiresOtp(result.data.requiresEmailOtp);
    notify.success('Link created. It is shown once, so copy it now.');
  }

  /**
   * Copies the link to the clipboard.
   *
   * @returns Nothing.
   */
  async function copyLink(): Promise<void> {
    if (!link || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(link);
    notify.success('Link copied.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client link</CardTitle>
        <CardDescription>
          A private address your client can open without an account. It expires on its own, and you
          can create a new one whenever you like.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {formError ? (
          <Alert tone="danger" title="The link was not created">
            {formError}
          </Alert>
        ) : null}

        {link ? (
          <>
            <p className="break-all rounded-md border border-border bg-surface-muted p-3 text-sm">
              {link}
            </p>
            <p className="text-sm text-muted-foreground">
              Works until {expiresAt ? formatDate(expiresAt) : 'it expires'}.
              {requiresOtp
                ? ' Your client is asked for a code sent to their email before the document opens.'
                : ' It opens the document straight away.'}
            </p>
            <Button
              type="button"
              variant="secondary"
              leadingIcon={<Copy aria-hidden="true" className="h-4 w-4" />}
              onClick={() => {
                void copyLink();
              }}
            >
              Copy link
            </Button>
          </>
        ) : (
          <Button
            type="button"
            isLoading={isWorking}
            loadingLabel="Creating"
            disabled={!canShare}
            leadingIcon={<Link2 aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              void create();
            }}
          >
            Create client link
          </Button>
        )}

        {canShare ? null : (
          <p className="text-sm text-muted-foreground">
            Only the owner of this business can put a document in front of a client.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
