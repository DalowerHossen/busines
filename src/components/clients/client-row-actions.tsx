// src/components/clients/client-row-actions.tsx
// The menu at the end of each row in the client list. Deleting always asks
// first, and a client that carries invoices is archived rather than removed.

'use client';

import { Archive, MoreHorizontal, PenLine, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownItem } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { deleteClient } from '@/features/clients/actions/delete-client';
import { restoreClient } from '@/features/clients/actions/restore-client';
import { setClientStatus } from '@/features/clients/actions/set-client-status';
import type { ClientSummary } from '@/features/clients/types';

export interface ClientRowActionsProps {
  /** Client the menu belongs to. */
  client: ClientSummary;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

/**
 * Renders the row menu for one client.
 *
 * @param props The client and what the account is allowed to do.
 * @returns The rendered menu.
 */
export function ClientRowActions({ client, canEdit, canDelete }: ClientRowActionsProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Moves the client between the active and archived states.
   *
   * @param status Status to move to.
   * @returns Nothing.
   */
  async function changeStatus(status: 'active' | 'archived'): Promise<void> {
    setIsWorking(true);
    const result = await setClientStatus({ clientId: client.id, status });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success(status === 'archived' ? 'Client archived.' : 'Client made active.');
    router.refresh();
  }

  /**
   * Removes the client after the question has been answered.
   *
   * @returns Nothing.
   */
  async function confirmDelete(): Promise<void> {
    setIsWorking(true);
    const result = await deleteClient({ clientId: client.id });
    setIsWorking(false);
    setIsConfirmOpen(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success(
      result.data.wasArchived
        ? 'The client has invoices, so it was archived instead of deleted.'
        : 'Client deleted. You can restore it from the deleted list.'
    );
    router.refresh();
  }

  /**
   * Brings a deleted client back.
   *
   * @returns Nothing.
   */
  async function handleRestore(): Promise<void> {
    setIsWorking(true);
    const result = await restoreClient({ clientId: client.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Client restored.');
    router.refresh();
  }

  const items: DropdownItem[] = [];

  items.push({
    key: 'open',
    label: 'Open client',
    icon: UserCheck,
    onSelect: () => {
      router.push(`${ROUTES.clients}/${client.id}`);
    },
  });

  if (client.isArchived) {
    items.push({
      key: 'restore',
      label: 'Restore client',
      icon: RotateCcw,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        void handleRestore();
      },
    });

    return (
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for ${client.displayName}`}
        items={items}
        trigger={
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />
    );
  }

  items.push({
    key: 'edit',
    label: 'Edit details',
    icon: PenLine,
    isDisabled: !canEdit,
    onSelect: () => {
      router.push(`${ROUTES.clients}/${client.id}/edit`);
    },
  });

  items.push(
    client.status === 'archived'
      ? {
          key: 'activate',
          label: 'Make active',
          icon: RotateCcw,
          isDisabled: !canEdit || isWorking,
          onSelect: () => {
            void changeStatus('active');
          },
        }
      : {
          key: 'archive',
          label: 'Archive client',
          icon: Archive,
          isDisabled: !canEdit || isWorking,
          onSelect: () => {
            void changeStatus('archived');
          },
        }
  );

  items.push({
    key: 'delete',
    label: 'Delete client',
    icon: Trash2,
    isDestructive: true,
    isDisabled: !canDelete || isWorking,
    onSelect: () => {
      setIsConfirmOpen(true);
    },
  });

  return (
    <>
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for ${client.displayName}`}
        items={items}
        trigger={
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
        }}
        title={`Delete ${client.displayName}?`}
        description="The client leaves your lists but nothing is lost. Invoices already raised stay exactly as they are, and you can restore the client at any time."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsConfirmOpen(false);
              }}
            >
              Keep client
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isWorking}
              loadingLabel="Deleting"
              onClick={() => {
                void confirmDelete();
              }}
            >
              Delete client
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          If this client already has invoices, it will be archived instead so your accounts stay
          complete.
        </p>
      </Modal>
    </>
  );
}
