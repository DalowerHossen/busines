// src/components/storefronts/storefront-order-table.tsx
// Every order the shops have sent, and what became of it.
//
// An order that is still waiting is the one worth looking at, so the state
// is the first thing read and the invoice behind it is one click away.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { cancelStorefrontOrder } from '@/features/storefronts/actions/cancel-order';
import type { StorefrontOrderRecord } from '@/features/storefronts/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface StorefrontOrderTableProps {
  /** The orders to show, newest first. */
  orders: readonly StorefrontOrderRecord[];
  /** True when the viewer may cancel an order. */
  canManage: boolean;
}

const STATUS_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger' | 'neutral'>> = {
  paid: 'success',
  awaiting_payment: 'warning',
  received: 'neutral',
  cancelled: 'neutral',
  refunded: 'warning',
  failed: 'danger',
};

/**
 * Renders the shop order table.
 *
 * @param props The orders and what the viewer may do.
 * @returns The rendered table.
 */
export function StorefrontOrderTable({ orders, canManage }: StorefrontOrderTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Cancels one order so it stops being chased.
   *
   * @param orderId Order being cancelled.
   * @returns Nothing.
   */
  async function onCancel(orderId: string): Promise<void> {
    setBusyId(orderId);
    const result = await cancelStorefrontOrder({
      orderId,
      reason: 'Cancelled from the shop settings screen.',
    });
    setBusyId(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('That order has been cancelled.');
    router.refresh();
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Once a shop is live, every order it sends appears here with the invoice raised against it."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Shop</TableHead>
          <TableHead>Shopper</TableHead>
          <TableHead isNumeric>Amount</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Invoice</TableHead>
          {canManage ? <TableHead>Action</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.orderId}>
            <TableCell>{order.externalOrderNumber ?? order.externalOrderId}</TableCell>
            <TableCell>{order.storeName}</TableCell>
            <TableCell>{order.customerName ?? order.customerEmail ?? 'Not given'}</TableCell>
            <TableCell isNumeric>{formatMoney(order.totalAmount, order.currency)}</TableCell>
            <TableCell>
              <Badge tone={STATUS_TONES[order.status] ?? 'neutral'}>{humanise(order.status)}</Badge>
            </TableCell>
            <TableCell>{formatDate(order.createdAt)}</TableCell>
            <TableCell>
              {order.invoiceId === null ? (
                'Not raised'
              ) : (
                <Link
                  className="text-brand-700 underline underline-offset-2"
                  href={`${ROUTES.invoices}/${order.invoiceId}`}
                >
                  {order.invoiceNumber ?? 'Open invoice'}
                </Link>
              )}
            </TableCell>
            {canManage ? (
              <TableCell>
                {order.status === 'paid' ||
                order.status === 'cancelled' ||
                order.status === 'refunded' ? (
                  <span className="text-sm text-muted-foreground">Closed</span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={busyId === order.orderId}
                    loadingLabel="Cancelling"
                    onClick={() => void onCancel(order.orderId)}
                  >
                    Cancel
                  </Button>
                )}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
