// src/components/files/file-uploader.tsx
// Choosing a file and sending it straight to storage.
//
// The browser asks the server for permission first, then uploads the bytes
// to the store itself, then tells the server what it sent. Nothing large
// travels through the application, the checksum is worked out in the browser
// so identical files are only stored once, and the camera is offered on a
// phone because most receipts start as a photograph.

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { notify } from '@/components/ui/toaster';
import { completeFileUpload } from '@/features/files/actions/complete-upload';
import { requestFileUpload } from '@/features/files/actions/request-upload';
import type { UploadPolicy } from '@/features/files/types';
import { formatFileSize, humanise } from '@/lib/format';

export interface FileUploaderProps {
  /** What the store will accept. */
  policy: UploadPolicy;
  /** Kinds of file the person may file this under. */
  purposes: readonly string[];
}

type UploadStage = 'idle' | 'preparing' | 'sending' | 'finishing';

/**
 * Works out the checksum of a file inside the browser.
 *
 * @param file File the person chose.
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
 * Renders the uploader.
 *
 * @param props What the store accepts and how the file may be filed.
 * @returns The rendered uploader.
 */
export function FileUploader({ policy, purposes }: FileUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [purpose, setPurpose] = useState<string>(purposes[0] ?? 'attachment');
  const [stage, setStage] = useState<UploadStage>('idle');
  const [failure, setFailure] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const purposeOptions = purposes.map((entry) => ({ value: entry, label: humanise(entry) }));
  const accept = policy.allowedMimeTypes.join(',');

  /**
   * Sends one file all the way to the store.
   *
   * @param file File the person chose.
   * @returns Nothing.
   */
  async function upload(file: File): Promise<void> {
    setFailure(null);

    if (policy.maxUploadBytes > 0 && file.size > policy.maxUploadBytes) {
      setFailure(`That file is larger than the ${formatFileSize(policy.maxUploadBytes)} limit.`);

      return;
    }

    if (policy.allowedMimeTypes.length > 0 && !policy.allowedMimeTypes.includes(file.type)) {
      setFailure('Files of that type are not accepted here.');

      return;
    }

    setStage('preparing');

    const ticket = await requestFileUpload({
      fileName: file.name,
      mimeType: file.type === '' ? 'application/octet-stream' : file.type,
      byteSize: file.size,
      filePurpose: purpose,
    });

    if (!ticket.success) {
      setStage('idle');
      setFailure(ticket.error);

      return;
    }

    setStage('sending');
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

      // A drive answers with the name it gave the object, which has to be
      // handed back so the file can be found again.
      const answer: unknown = await response
        .clone()
        .json()
        .catch(() => null);

      if (typeof answer === 'object' && answer !== null && 'id' in answer) {
        externalObjectId = String((answer as { id: unknown }).id);
      }
    } catch {
      setStage('idle');
      setFailure('The file could not be sent to storage. Check your connection and try again.');

      return;
    }

    setStage('finishing');

    const finished = await completeFileUpload({
      sessionId: ticket.data.sessionId,
      byteSize: file.size,
      contentHash: await checksumOf(file),
      externalObjectId,
    });

    setStage('idle');

    if (!finished.success) {
      setFailure(finished.error);

      return;
    }

    notify.success(`${file.name} is in your files.`);

    if (inputRef.current !== null) {
      inputRef.current.value = '';
    }

    router.refresh();
  }

  /**
   * Handles a file chosen from the picker.
   *
   * @param event The change event.
   * @returns Nothing.
   */
  function onPick(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];

    if (file !== undefined) {
      void upload(file);
    }
  }

  /**
   * Handles a file dropped onto the panel.
   *
   * @param event The drop event.
   * @returns Nothing.
   */
  function onDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];

    if (file !== undefined) {
      void upload(file);
    }
  }

  const isBusy = stage !== 'idle';
  const stageLabel =
    stage === 'preparing'
      ? 'Asking storage for room'
      : stage === 'sending'
        ? 'Sending the file'
        : 'Filing it away';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a file</CardTitle>
        <CardDescription>
          {policy.maxUploadBytes > 0
            ? `Up to ${formatFileSize(policy.maxUploadBytes)} per file. The file goes straight to storage, so large ones are no slower here than anywhere else.`
            : 'The file goes straight to storage rather than through this page.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!policy.isConfigured ? (
          <Alert tone="warning" title="File storage has not been set up yet">
            Ask the platform team to finish the storage settings. Until then an upload will be
            refused rather than silently lost.
          </Alert>
        ) : null}

        {failure !== null ? (
          <Alert tone="danger" title="That file was not uploaded">
            {failure}
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium" htmlFor="file-purpose">
            What is it?
            <Select
              id="file-purpose"
              options={purposeOptions}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
            />
          </label>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={
            isDragging
              ? 'rounded-lg border-2 border-dashed border-brand-600 bg-brand-50 p-6 text-center'
              : 'rounded-lg border-2 border-dashed border-border p-6 text-center'
          }
        >
          <p className="text-sm text-muted-foreground">
            Drag a file here, or choose one from your device.
          </p>

          <input
            ref={inputRef}
            id="file-input"
            type="file"
            accept={accept === '' ? undefined : accept}
            onChange={onPick}
            disabled={isBusy}
            className="mt-4 block w-full text-sm file:mr-4 file:min-h-touch file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />

          <p className="mt-3 text-sm text-muted-foreground">
            On a phone the same button offers the camera, which is the quickest way to file a paper
            receipt.
          </p>
        </div>

        {isBusy ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {`${stageLabel}…`}
          </p>
        ) : null}

        <Button
          variant="secondary"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          isLoading={isBusy}
          loadingLabel={stageLabel}
        >
          Choose a file
        </Button>
      </CardContent>
    </Card>
  );
}
