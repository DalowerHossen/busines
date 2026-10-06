// src/components/products/product-row-actions.tsx
// The menu at the end of each catalogue row. Deleting asks first, and an item
// already quoted on a document keeps its own copy of the price.

'use client';

import { Archive, MoreHorizontal, PackageOpen, PenLine, RotateCcw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownItem } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { deleteProduct } from '@/features/products/actions/delete-product';
import { restoreProduct } from '@/features/products/actions/restore-product';
import { setProductStatus } from '@/features/products/actions/set-product-status';
import type { ProductSummary } from '@/features/products/types';

export interface ProductRowActionsProps {
  /** Item the menu belongs to. */
  product: ProductSummary;
  /** False when the signed in account may only read. */
  canEdit: boolean;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

/**
 * Renders the row menu for one catalogue item.
 *
 * @param props The item and what the account is allowed to do.
 * @returns The rendered menu.
 */
export function ProductRowActions({ product, canEdit, canDelete }: ProductRowActionsProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Moves the item between the active and archived states.
   *
   * @param status Status to move to.
   * @returns Nothing.
   */
  async function changeStatus(status: 'active' | 'archived'): Promise<void> {
    setIsWorking(true);
    const result = await setProductStatus({ productId: product.id, status });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success(status === 'archived' ? 'Item archived.' : 'Item made active.');
    router.refresh();
  }

  /**
   * Removes the item after the question has been answered.
   *
   * @returns Nothing.
   */
  async function confirmDelete(): Promise<void> {
    setIsWorking(true);
    const result = await deleteProduct({ productId: product.id });
    setIsWorking(false);
    setIsConfirmOpen(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Item deleted. You can restore it from the deleted list.');
    router.refresh();
  }

  /**
   * Brings a deleted item back.
   *
   * @returns Nothing.
   */
  async function handleRestore(): Promise<void> {
    setIsWorking(true);
    const result = await restoreProduct({ productId: product.id });
    setIsWorking(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Item restored.');
    router.refresh();
  }

  const items: DropdownItem[] = [
    {
      key: 'open',
      label: 'Open item',
      icon: PackageOpen,
      onSelect: () => {
        router.push(`${ROUTES.products}/${product.id}`);
      },
    },
  ];

  if (product.isDeleted) {
    items.push({
      key: 'restore',
      label: 'Restore item',
      icon: RotateCcw,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        void handleRestore();
      },
    });
  } else {
    items.push({
      key: 'edit',
      label: 'Edit item',
      icon: PenLine,
      isDisabled: !canEdit,
      onSelect: () => {
        router.push(`${ROUTES.products}/${product.id}/edit`);
      },
    });

    items.push(
      product.status === 'archived'
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
            label: 'Archive item',
            icon: Archive,
            isDisabled: !canEdit || isWorking,
            onSelect: () => {
              void changeStatus('archived');
            },
          }
    );

    items.push({
      key: 'delete',
      label: 'Delete item',
      icon: Trash2,
      isDestructive: true,
      isDisabled: !canDelete || isWorking,
      onSelect: () => {
        setIsConfirmOpen(true);
      },
    });
  }

  return (
    <>
      <DropdownMenu
        align="end"
        triggerLabel={`Actions for ${product.name}`}
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
        title={`Delete ${product.name}?`}
        description="The item leaves your catalogue but nothing is lost. Invoices that already quote it keep their own copy of the price and description."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsConfirmOpen(false);
              }}
            >
              Keep item
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
              Delete item
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          You can bring the item back at any time from the deleted view.
        </p>
      </Modal>
    </>
  );
}
