// src/components/settings/storage-connection-panel.tsx
// Choosing where the documents of this business are kept.
//
// The database holds the text of the business: clients, invoices, payments.
// Everything that arrives as a file can live in a drive the business owns
// instead, which is both cheaper for us and plainer for them, because the
// documents stay somewhere they already have the keys to.

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { notify } from '@/components/ui/toaster';
import { disconnectCompanyDrive } from '@/features/storage/actions/disconnect-drive';
import type { CompanyStorage } from '@/features/storage/queries/get-company-storage';
import { formatDateTime } from '@/lib/dates';
import { formatFileSize, formatNumber } from '@/lib/format';

export interface StorageConnectionPanelProps {
  /** Where the documents of this business are going now. */
  storage: CompanyStorage;
  /** True when the viewer may change it. */
  canManage: boolean;
}

const OUTCOME_MESSAGES: Readonly<Record<string, { tone: 'success' | 'danger'; text: string }>> = {
  connected: {
    tone: 'success',
    text: 'Your drive is connected. Every document uploaded from now on lands in it.',
  },
  refused: {
    tone: 'danger',
    text: 'Permission was not granted, so nothing has changed.',
  },
  expired: {
    tone: 'danger',
    text: 'That request took too long. Start the connection again.',
  },
  failed: {
    tone: 'danger',
    text: 'The drive answered, but the folder could not be prepared. Try once more.',
  },
  unconfigured: {
    tone: 'danger',
    text: 'Drive storage has not been set up on this installation yet. Write to support.',
  },
};

/**
 * Renders the storage settings panel.
 *
 * @param props Where files go and whether the viewer may change it.
 * @returns The rendered panel.
 */
export function StorageConnectionPanel({ storage, canManage }: StorageConnectionPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isWorking, setIsWorking] = useState(false);

  const outcome = searchParams.get('drive');
  const message = outcome === null ? undefined : OUTCOME_MESSAGES[outcome];

  /**
   * Stops using the connected drive.
   *
   * @returns Nothing.
   */
  async function onDisconnect(): Promise<void> {
    setIsWorking(true);
    const result = await disconnectCompanyDrive({});
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Your drive is no longer used. Nothing already in it has been touched.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {message !== undefined ? (
        <Alert
          tone={message.tone}
          title={message.tone === 'success' ? 'Drive connected' : 'The drive was not connected'}
        >
          {message.text}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Where your documents are kept</CardTitle>
          <CardDescription>
            Your records, clients and invoices are held as text in our database. Receipts, contracts
            and images are files, and you decide where those live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{storage.name}</p>
            {storage.isOwnStorage ? (
              <Badge tone="success">Your own drive</Badge>
            ) : (
              <Badge tone="neutral">Platform storage</Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {`${formatNumber(storage.fileCount)} files here, ${formatFileSize(
              storage.storedBytes
            )} in total, up to ${formatFileSize(storage.maxUploadBytes)} per upload.`}
          </p>

          {storage.folderReference !== null ? (
            <p className="text-sm text-muted-foreground">
              {`Everything is filed into one folder we created for you, reference ${storage.folderReference}.`}
            </p>
          ) : null}

          {storage.lastVerifiedAt !== null ? (
            <p className="text-sm text-muted-foreground">
              {`Last confirmed working ${formatDateTime(storage.lastVerifiedAt)}.`}
            </p>
          ) : null}

          {storage.lastError !== null ? (
            <Alert tone="danger" title="Your drive refused us the last time we tried">
              {`${storage.lastError} Reconnect the drive so new uploads keep working. Nothing already stored has been lost.`}
            </Alert>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  window.location.href = '/api/integrations/drive/start';
                }}
              >
                {storage.isOwnStorage ? 'Reconnect the drive' : 'Connect my drive'}
              </Button>

              {storage.isOwnStorage ? (
                <Button
                  variant="secondary"
                  isLoading={isWorking}
                  loadingLabel="Disconnecting"
                  onClick={() => void onDisconnect()}
                >
                  Stop using it
                </Button>
              ) : null}
            </div>
          ) : (
            <Alert tone="info" title="This is the owner's decision">
              Ask the owner of this business to change where documents are kept.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What connecting a drive changes</CardTitle>
          <CardDescription>Four things, and nothing else.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Every file uploaded after you connect is written to a folder in your drive, created by
              us and owned by you.
            </li>
            <li>
              We only ever see the files we put there. The permission we ask for does not let us
              read the rest of your drive.
            </li>
            <li>
              Files uploaded before you connect stay where they are and keep working. Nothing is
              moved behind your back.
            </li>
            <li>
              Disconnecting is immediate and destroys nothing: new uploads simply go back to
              platform storage.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
