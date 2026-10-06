// src/components/receipts/receipt-uploader.tsx
// Sending a photograph of a receipt in. On a phone this opens the camera
// directly, because that is where most receipts are captured.

'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { notify } from '@/components/ui/toaster';
import { UPLOAD_LIMITS } from '@/config/app';

export interface ReceiptUploaderProps {
  /** False when the viewer may look but not send anything in. */
  canUpload: boolean;
}

/**
 * Renders the receipt uploader.
 *
 * @param props What the viewer may do.
 * @returns The rendered uploader.
 */
export function ReceiptUploader({ canUpload }: ReceiptUploaderProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const megabytes = Math.round(UPLOAD_LIMITS.receiptBytes / (1024 * 1024));

  /**
   * Sends one chosen file to be read.
   *
   * @param file The photograph or document chosen.
   * @param source Where it came from.
   * @returns Nothing.
   */
  async function send(file: File, source: 'upload' | 'mobile_camera'): Promise<void> {
    setIsSending(true);
    setFailure(null);

    const body = new FormData();
    body.append('file', file);
    body.append('source', source);

    try {
      const response = await fetch('/api/receipts', { method: 'POST', body });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : 'That receipt could not be sent. Try once more.';

        setFailure(message);

        return;
      }

      notify.success('That receipt is being read.');
      router.refresh();
    } catch {
      setFailure('The receipt could not be sent. Check the connection and try again.');
    } finally {
      setIsSending(false);

      if (fileRef.current) {
        fileRef.current.value = '';
      }

      if (cameraRef.current) {
        cameraRef.current.value = '';
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a receipt in</CardTitle>
        <CardDescription>
          Photograph the paper or attach the PDF. The figures are read for you and nothing reaches
          the books until you have agreed with them. Up to {megabytes} MB per receipt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failure === null ? null : (
          <Alert tone="danger" title="That did not go through">
            {failure}
          </Alert>
        )}

        {canUpload ? null : (
          <Alert tone="info" title="You can look but not send">
            Ask an owner for permission to add expenses if you need to send receipts in.
          </Alert>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="visually-hidden"
          onChange={(event) => {
            const chosen = event.target.files?.[0];

            if (chosen) {
              void send(chosen, 'upload');
            }
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          onChange={(event) => {
            const chosen = event.target.files?.[0];

            if (chosen) {
              void send(chosen, 'mobile_camera');
            }
          }}
        />

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            isLoading={isSending}
            loadingLabel="Sending"
            disabled={!canUpload}
            onClick={() => fileRef.current?.click()}
          >
            Choose a file
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canUpload || isSending}
            onClick={() => cameraRef.current?.click()}
          >
            Use the camera
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
