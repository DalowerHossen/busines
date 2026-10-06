// src/components/invoices/work-evidence-panel.tsx
// Proof of the work, attached to the invoice that bills for it.
//
// A client who can see the delivered files, the link and the hours pays
// faster and argues less, and the same record is what answers a chargeback
// months later. Anything marked as private stays with the seller: it still
// counts as evidence, it is simply not shown to the client.

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { addWorkEvidence } from '@/features/evidence/actions/add-evidence';
import { removeWorkEvidence } from '@/features/evidence/actions/remove-evidence';
import type { WorkEvidenceItem, WorkEvidenceSummary } from '@/features/evidence/types';
import { completeFileUpload } from '@/features/files/actions/complete-upload';
import { requestFileUpload } from '@/features/files/actions/request-upload';
import { formatDate } from '@/lib/dates';
import { formatFileSize, formatNumber, humanise } from '@/lib/format';

export interface WorkEvidencePanelProps {
  /** Invoice the proof belongs to. */
  invoiceId: string;
  /** The proof attached so far. */
  items: readonly WorkEvidenceItem[];
  /** Totals across that proof. */
  summary: WorkEvidenceSummary;
  /** True when the viewer may attach or remove proof. */
  canEdit: boolean;
}

type EvidenceKind = 'file' | 'link' | 'note' | 'hours' | 'milestone';

const KIND_OPTIONS = [
  { value: 'file', label: 'A file I delivered' },
  { value: 'link', label: 'A link to the work' },
  { value: 'hours', label: 'Hours worked' },
  { value: 'milestone', label: 'A milestone that was met' },
  { value: 'note', label: 'A note about the work' },
];

/**
 * Works out the checksum of a file inside the browser.
 *
 * @param file File being uploaded.
 * @returns The checksum, in hexadecimal.
 */
async function checksumOf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Renders the proof of work panel.
 *
 * @param props The invoice, the proof so far and whether it can be edited.
 * @returns The rendered panel.
 */
export function WorkEvidencePanel({ invoiceId, items, summary, canEdit }: WorkEvidencePanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<EvidenceKind>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [performedOn, setPerformedOn] = useState('');
  const [isClientVisible, setIsClientVisible] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Clears the form after something has been attached.
   *
   * @returns Nothing.
   */
  function resetForm(): void {
    setTitle('');
    setDescription('');
    setExternalUrl('');
    setHoursWorked('');
    setPerformedOn('');
    setIsClientVisible(true);

    if (fileInputRef.current !== null) {
      fileInputRef.current.value = '';
    }
  }

  /**
   * Sends a delivered file to storage and returns what it was stored as.
   *
   * @param file File the person chose.
   * @returns The identifier of the stored file, or null when it failed.
   */
  async function uploadDelivered(file: File): Promise<string | null> {
    const ticket = await requestFileUpload({
      fileName: file.name,
      mimeType: file.type === '' ? 'application/octet-stream' : file.type,
      byteSize: file.size,
      filePurpose: 'attachment',
      ownerType: 'invoice',
      ownerId: invoiceId,
    });

    if (!ticket.success) {
      setFailure(ticket.error);

      return null;
    }

    let externalObjectId: string | undefined;

    try {
      const response = await fetch(ticket.data.uploadUrl, {
        method: ticket.data.method,
        headers: { ...ticket.data.headers },
        body: file,
      });

      if (!response.ok) {
        throw new Error('The store refused the file.');
      }

      const answer: unknown = await response
        .clone()
        .json()
        .catch(() => null);

      if (typeof answer === 'object' && answer !== null && 'id' in answer) {
        externalObjectId = String((answer as { id: unknown }).id);
      }
    } catch {
      setFailure('The file could not be sent to storage. Check your connection and try again.');

      return null;
    }

    const finished = await completeFileUpload({
      sessionId: ticket.data.sessionId,
      byteSize: file.size,
      contentHash: await checksumOf(file),
      externalObjectId,
    });

    if (!finished.success) {
      setFailure(finished.error);

      return null;
    }

    return finished.data.fileId;
  }

  /**
   * Attaches whatever is in the form.
   *
   * @returns Nothing.
   */
  async function onAttach(): Promise<void> {
    setFailure(null);
    setIsWorking(true);

    let fileId: string | undefined;

    if (kind === 'file') {
      const chosen = fileInputRef.current?.files?.[0] ?? null;

      if (chosen === null) {
        setIsWorking(false);
        setFailure('Choose the file you delivered.');

        return;
      }

      const stored = await uploadDelivered(chosen);

      if (stored === null) {
        setIsWorking(false);

        return;
      }

      fileId = stored;
    }

    const result = await addWorkEvidence({
      invoiceId,
      kind,
      title: title === '' ? 'Delivered work' : title,
      description: description === '' ? undefined : description,
      fileId,
      externalUrl: externalUrl === '' ? undefined : externalUrl,
      hoursWorked: hoursWorked === '' ? undefined : hoursWorked,
      performedOn: performedOn === '' ? undefined : performedOn,
      isClientVisible,
    });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Attached. Your client will see this beside the pay button.');
    resetForm();
    router.refresh();
  }

  /**
   * Removes one piece of proof.
   *
   * @param evidenceId Proof being removed.
   * @returns Nothing.
   */
  async function onRemove(evidenceId: string): Promise<void> {
    const result = await removeWorkEvidence({ evidenceId, invoiceId });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Removed.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proof of the work</CardTitle>
        <CardDescription>
          {summary.itemCount === 0
            ? 'Attach what you delivered. Clients who can see the work pay sooner, and this is what answers a chargeback later.'
            : `${formatNumber(summary.clientVisibleCount)} of ${formatNumber(
                summary.itemCount
              )} items are shown to your client${
                Number(summary.hoursLogged) > 0
                  ? `, covering ${formatNumber(Number(summary.hoursLogged), 2)} hours`
                  : ''
              }.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {summary.isSealed ? (
          <Alert tone="info" title="This proof is sealed">
            The invoice has been paid, so what the client saw is frozen exactly as it was. That is
            what makes it worth something if the payment is ever disputed.
          </Alert>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="Nothing is attached yet"
            description="A screenshot, the delivered file, a link to the live work or the hours behind the figure. Any of them makes this invoice easier to pay."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.evidenceId}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <Badge tone="neutral">{humanise(item.kind)}</Badge>
                    {item.isClientVisible ? null : <Badge tone="warning">Private</Badge>}
                    {item.isSealed ? <Badge tone="info">Sealed</Badge> : null}
                  </div>

                  {item.description === null ? null : (
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  )}

                  {item.fileName === null ? null : (
                    <p className="text-sm text-muted-foreground">
                      {`${item.fileName} · ${formatFileSize(item.byteSize)}`}
                    </p>
                  )}

                  {item.externalUrl === null ? null : (
                    <a
                      className="break-all text-sm text-brand-700 underline"
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.externalUrl}
                    </a>
                  )}

                  {item.hoursWorked === null ? null : (
                    <p className="tabular text-sm text-muted-foreground">
                      {`${formatNumber(Number(item.hoursWorked), 2)} hours${
                        item.performedOn === null ? '' : ` on ${formatDate(item.performedOn)}`
                      }`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {item.fileId === null ? null : (
                    <a
                      className="text-sm text-brand-700 underline"
                      href={`/api/files/${item.fileId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  )}

                  {canEdit && !item.isSealed ? (
                    <Button variant="ghost" onClick={() => void onRemove(item.evidenceId)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEdit && !summary.isSealed ? (
          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Attach something</h3>

            {failure === null ? null : (
              <Alert tone="danger" title="That could not be attached">
                {failure}
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="evidence-kind" label="What are you attaching" isRequired>
                <Select
                  id="evidence-kind"
                  value={kind}
                  options={KIND_OPTIONS}
                  onChange={(event) => setKind(event.target.value as EvidenceKind)}
                />
              </FormField>

              <FormField
                id="evidence-title"
                label="Title"
                hint="What your client will read first."
                isRequired
              >
                <Input
                  id="evidence-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </FormField>

              {kind === 'file' ? (
                <FormField
                  id="evidence-file"
                  label="The delivered file"
                  hint="It is uploaded straight to your storage."
                  isRequired
                >
                  <input
                    id="evidence-file"
                    ref={fileInputRef}
                    type="file"
                    className="min-h-touch w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  />
                </FormField>
              ) : null}

              {kind === 'link' ? (
                <FormField
                  id="evidence-url"
                  label="Address of the work"
                  hint="Has to start with https."
                  isRequired
                >
                  <Input
                    id="evidence-url"
                    type="url"
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                  />
                </FormField>
              ) : null}

              {kind === 'hours' ? (
                <>
                  <FormField id="evidence-hours" label="Hours worked" isRequired>
                    <Input
                      id="evidence-hours"
                      type="number"
                      step="0.25"
                      min="0"
                      value={hoursWorked}
                      onChange={(event) => setHoursWorked(event.target.value)}
                    />
                  </FormField>

                  <FormField id="evidence-date" label="Date of the work">
                    <Input
                      id="evidence-date"
                      type="date"
                      value={performedOn}
                      onChange={(event) => setPerformedOn(event.target.value)}
                    />
                  </FormField>
                </>
              ) : null}
            </div>

            <FormField
              id="evidence-description"
              label="Description"
              hint="A sentence of context helps a client who was not in the meeting."
            >
              <Textarea
                id="evidence-description"
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </FormField>

            <Checkbox
              id="evidence-visible"
              label="Show this to the client"
              description="Leave it off to keep the item for your own records and for a future dispute."
              checked={isClientVisible}
              onChange={(event) => setIsClientVisible(event.target.checked)}
            />

            <Button isLoading={isWorking} loadingLabel="Attaching" onClick={() => void onAttach()}>
              Attach to this invoice
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
