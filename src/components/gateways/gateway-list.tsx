// src/components/gateways/gateway-list.tsx
// The payment connections of a business: what is connected, whether it was
// last seen working, and which one a client is offered first.

'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { GatewayForm } from '@/components/gateways/gateway-form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { notify } from '@/components/ui/toaster';
import { setGatewayState } from '@/features/gateways/actions/set-gateway-state';
import { testGateway } from '@/features/gateways/actions/test-gateway';
import { GATEWAY_CATALOG } from '@/features/gateways/catalog';
import type { GatewayConnection } from '@/features/gateways/types';
import { formatDateTime } from '@/lib/dates';

export interface GatewayListProps {
  /** The connections to show. */
  connections: readonly GatewayConnection[];
  /** False when the signed in account may only read. */
  canManage: boolean;
}

/**
 * Renders the list of payment connections.
 *
 * @param props The connections and what the viewer may do.
 * @returns The rendered list.
 */
export function GatewayList({ connections, canManage }: GatewayListProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<GatewayConnection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Checks one connection against its provider.
   *
   * @param connection Connection to check.
   * @returns Nothing.
   */
  async function test(connection: GatewayConnection): Promise<void> {
    setBusyId(connection.id);
    setFormError(null);

    const result = await testGateway({ gatewayId: connection.id });
    setBusyId(null);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    if (result.data.isHealthy) {
      notify.success(result.data.message);
    } else {
      notify.error(result.data.message);
    }

    router.refresh();
  }

  /**
   * Turns a connection on or off, or makes it the default.
   *
   * @param connection Connection to change.
   * @param changes What to change about it.
   * @returns Nothing.
   */
  async function change(
    connection: GatewayConnection,
    changes: { isEnabled?: boolean; makeDefault?: boolean }
  ): Promise<void> {
    setBusyId(connection.id);
    setFormError(null);

    const result = await setGatewayState({ gatewayId: connection.id, ...changes });
    setBusyId(null);

    if (!result.success) {
      setFormError(result.error);
      return;
    }

    notify.success('Saved.');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {formError ? (
        <Alert tone="danger" title="That did not work">
          {formError}
        </Alert>
      ) : null}

      {canManage ? (
        <div className="flex justify-end">
          <Button
            type="button"
            leadingIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setIsFormOpen(true);
            }}
          >
            Connect a provider
          </Button>
        </div>
      ) : null}

      {connections.length === 0 ? (
        <EmptyState
          title="No payment provider is connected yet"
          description="Connect one and your clients can pay an invoice the moment they open it. Until then you can still be paid by transfer and record it yourself."
        />
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{connection.displayName}</span>
                    <Badge tone={connection.mode === 'live' ? 'brand' : 'neutral'}>
                      {connection.mode === 'live' ? 'Live' : 'Test'}
                    </Badge>
                    <Badge tone={connection.isEnabled ? 'success' : 'neutral'}>
                      {connection.isEnabled ? 'On' : 'Off'}
                    </Badge>
                    {connection.isDefault ? <Badge tone="info">Offered first</Badge> : null}
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {GATEWAY_CATALOG[connection.provider].description}
                  </p>

                  {connection.credentialHint ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Stored key: {connection.credentialHint}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-warning">No key has been saved yet.</p>
                  )}

                  {connection.lastTestedAt ? (
                    <p
                      className={`mt-1 text-sm ${
                        connection.lastTestSucceeded ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {connection.lastTestMessage ??
                        (connection.lastTestSucceeded ? 'Working' : 'Not working')}{' '}
                      — checked {formatDateTime(connection.lastTestedAt)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Not checked yet.</p>
                  )}

                  {connection.lastErrorMessage ? (
                    <p className="mt-1 text-sm text-destructive">
                      Last error: {connection.lastErrorMessage}
                    </p>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === connection.id}
                      loadingLabel="Checking"
                      onClick={() => {
                        void test(connection);
                      }}
                    >
                      Test connection
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === connection.id}
                      onClick={() => {
                        setEditing(connection);
                        setIsFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === connection.id}
                      onClick={() => {
                        void change(connection, { isEnabled: !connection.isEnabled });
                      }}
                    >
                      {connection.isEnabled ? 'Turn off' : 'Turn on'}
                    </Button>
                    {connection.isDefault ? null : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === connection.id}
                        onClick={() => {
                          void change(connection, { makeDefault: true });
                        }}
                      >
                        Offer first
                      </Button>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GatewayForm
        key={editing?.id ?? 'new-connection'}
        isOpen={isFormOpen}
        connection={editing}
        onClose={() => {
          setIsFormOpen(false);
        }}
      />
    </div>
  );
}
