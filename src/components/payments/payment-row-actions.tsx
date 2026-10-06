// src/components/payments/payment-row-actions.tsx
// The menu at the end of each payment row. A payment entered by hand and not
// yet applied can be removed; everything else stays on record.

'use client';

import { HandCoins, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, type DropdownItem } from '@/components/ui/dropdown-menu';
import { Modal } from '@/components/ui/modal';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { deletePayment } from '@/features/payments/actions/delete-payment';
import type { PaymentSummary } from '@/features/payments/types';

export interface PaymentRowActionsProps {
  /** Payment the menu belongs to. */
  payment: PaymentSummary;
  /** False when the signed in account may not delete. */
  canDelete: boolean;
}

/**
 * Renders the row menu for one payment.
 *
 * @param props The payment and what the account is allowed to do.
 * @returns The rendered menu.
 */
export function PaymentRowActions({ payment, canDelete }: PaymentRowActionsProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const isRemovable =
    payment.isManual && Number.parseFloat(payment.allocatedAmount) === 0 && !payment.isDeleted;

  /**
   * Deletes the payment after the question has been answered.
   *
   * @returns Nothing.
   */
  async function confirmDelete(): Promise<void> {
    setIsWorking(true);
    const result = await deletePayment({ paymentId: payment.id });
    setIsWorking(false);
    setIsConfirmOpen(false);

    if (!result.success) {
      notify.error(result.error);
      return;
    }

    notify.success('Payment removed.');
    router.refresh();
  }

  const items: DropdownItem[] = [
    {
      key: 'open',
      label: 'Open payment',
      icon: HandCoins,
      onSelect: () => {
        router.push(`${ROUTES.payments}/${payment.id}`);
      },
    },
  ];

  if (isRemovable) {
    items.push({
      key: 'delete',
      label: 'Delete payment',
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
        triggerLabel={`Actions for the payment of ${payment.amount} ${payment.currency}`}
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
        title="Delete this payment?"
        description="It was entered by hand and has not been applied to an invoice, so removing it changes no balance."
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsConfirmOpen(false);
              }}
            >
              Keep payment
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
              Delete payment
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          The entry stays in your audit trail, so the deletion itself is on record.
        </p>
      </Modal>
    </>
  );
}
