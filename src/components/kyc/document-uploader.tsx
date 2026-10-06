// src/components/kyc/document-uploader.tsx
// Putting the papers against the identity check. Each kind of paper has its
// own slot, so it is obvious what is still missing.

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { removeDocument } from '@/features/kyc/actions/remove-document';
import type { KycDocument, KycDocumentSide, KycDocumentType } from '@/features/kyc/types';
import { KYC_DOCUMENT_SIDES, KYC_DOCUMENT_TYPES } from '@/features/kyc/types';
import { ACCEPTED_DOCUMENT_TYPES, UPLOAD_LIMITS } from '@/config/app';
import { humanise } from '@/lib/format';
import type { SelectOption } from '@/types/common';

export interface DocumentUploaderProps {
  /** Check the papers belong to. */
  verificationId: string;
  /** Papers already uploaded. */
  documents: readonly KycDocument[];
  /** False once the check is with us. */
  isEditable: boolean;
}

const TYPE_OPTIONS: readonly SelectOption[] = KYC_DOCUMENT_TYPES.map((value) => ({
  value,
  label: humanise(value),
}));

const SIDE_OPTIONS: readonly SelectOption[] = KYC_DOCUMENT_SIDES.map((value) => ({
  value,
  label: humanise(value),
}));

/**
 * Writes a byte count the way a person reads it.
 *
 * @param bytes Size of the paper.
 * @returns Something like "1.4 MB".
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders the paper list and the upload control.
 *
 * @param props Check, papers and whether they may be changed.
 * @returns The rendered card.
 */
export function DocumentUploader({ verificationId, documents, isEditable }: DocumentUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documentType, setDocumentType] = useState<KycDocumentType>('national_id');
  const [documentSide, setDocumentSide] = useState<KycDocumentSide>('front');
  const [isUploading, setIsUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Sends the chosen file to the upload route.
   *
   * @param file File the owner picked.
   * @returns Nothing.
   */
  async function upload(file: File): Promise<void> {
    setIsUploading(true);
    setFailure(null);

    const body = new FormData();
    body.set('file', file);
    body.set('verificationId', verificationId);
    body.set('documentType', documentType);
    body.set('documentSide', documentSide);

    const response = await fetch('/api/kyc/documents', { method: 'POST', body });

    setIsUploading(false);

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const message =
        payload !== null && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : 'The upload did not complete.';

      setFailure(message);
      return;
    }

    notify.success('Document uploaded.');
    router.refresh();
  }

  /**
   * Takes a paper back off the check.
   *
   * @param documentId Paper being removed.
   * @returns Nothing.
   */
  async function onRemove(documentId: string): Promise<void> {
    setBusyId(documentId);
    setFailure(null);

    const result = await removeDocument({ documentId });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success('Document removed.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Papers</CardTitle>
        <CardDescription>
          Two sides of one photographic identity document, and the registration or tax certificate
          unless you trade in your own name. PDF, PNG or JPEG up to{' '}
          {formatSize(UPLOAD_LIMITS.kycDocumentBytes)}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {failure ? (
          <Alert tone="danger" title="That did not work">
            {failure}
          </Alert>
        ) : null}

        {documents.length === 0 ? (
          <EmptyState
            title="No papers yet"
            description="Choose what you are uploading, then pick the file."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {humanise(document.documentType)} &middot; {humanise(document.documentSide)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {document.fileName} &middot; {formatSize(document.byteSize)}
                  </p>
                  {document.reviewNote ? (
                    <p className="mt-1 text-xs text-warning">{document.reviewNote}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {document.isAccepted === true ? <Badge tone="success">Accepted</Badge> : null}
                  {document.isAccepted === false ? <Badge tone="danger">Not accepted</Badge> : null}
                  {isEditable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isLoading={busyId === document.id}
                      loadingLabel="Removing"
                      onClick={() => {
                        void onRemove(document.id);
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {isEditable ? (
          <div className="grid gap-4 md:grid-cols-3">
            <FormField id="kyc-doc-type" label="Kind of paper">
              <Select
                {...fieldAccessibilityProps('kyc-doc-type', false, false)}
                options={TYPE_OPTIONS}
                value={documentType}
                onChange={(event) => {
                  setDocumentType(event.target.value as KycDocumentType);
                }}
              />
            </FormField>

            <FormField id="kyc-doc-side" label="Side">
              <Select
                {...fieldAccessibilityProps('kyc-doc-side', false, false)}
                options={SIDE_OPTIONS}
                value={documentSide}
                onChange={(event) => {
                  setDocumentSide(event.target.value as KycDocumentSide);
                }}
              />
            </FormField>

            <FormField id="kyc-doc-file" label="File">
              <input
                {...fieldAccessibilityProps('kyc-doc-file', false, false)}
                ref={inputRef}
                type="file"
                accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
                disabled={isUploading}
                className="min-h-touch w-full rounded-md border border-input bg-surface px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    void upload(file);
                  }
                }}
              />
            </FormField>
          </div>
        ) : null}

        {isUploading ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      </CardContent>
    </Card>
  );
}
