// src/components/expenses/supplier-console.tsx
// Who this business buys from, and what it owes them.
//
// The number at the top is the one that gets businesses into trouble: what
// is owed and already late. Everything else here exists to keep that number
// honest, which is why a payment is recorded as its own act rather than by
// editing a bill until it looks settled.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import {
  deleteSupplierBill,
  recordBillPayment,
  saveSupplier,
  saveSupplierBill,
} from '@/features/purchasing/actions/manage-purchasing';
import type { PurchaseOrderRow, SupplierBillRow, SupplierRow } from '@/features/purchasing/types';
import { formatDate, todayIso } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface SupplierConsoleProps {
  /** Who this business buys from. */
  suppliers: readonly SupplierRow[];
  /** What they have billed. */
  bills: readonly SupplierBillRow[];
  /** What is on order. */
  orders: readonly PurchaseOrderRow[];
  /** Everything still owed. */
  outstandingTotal: string;
  /** What is owed and late. */
  overdueTotal: string;
  /** True when the viewer may record bills and payments. */
  canEdit: boolean;
  /** Currency this business works in. */
  currency: string;
}

/**
 * Renders the supplier console.
 *
 * @param props The suppliers, the bills and what is on order.
 * @returns The rendered console.
 */
export function SupplierConsole({
  suppliers,
  bills,
  orders,
  outstandingTotal,
  overdueTotal,
  canEdit,
  currency,
}: SupplierConsoleProps) {
  const router = useRouter();

  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [terms, setTerms] = useState('30');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  const [vendorId, setVendorId] = useState(suppliers[0]?.vendorId ?? '');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [billDate, setBillDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(todayIso());
  const [totalAmount, setTotalAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [payingId, setPayingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  /**
   * Adds a supplier.
   *
   * @returns Nothing.
   */
  async function onSaveSupplier(): Promise<void> {
    setIsSavingSupplier(true);

    const result = await saveSupplier({
      displayName: supplierName,
      email: supplierEmail === '' ? undefined : supplierEmail,
      paymentTermsDays: terms,
    });

    setIsSavingSupplier(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Added.');
    setSupplierName('');
    setSupplierEmail('');
    router.refresh();
  }

  /**
   * Records a bill from a supplier.
   *
   * @returns Nothing.
   */
  async function onSaveBill(): Promise<void> {
    setIsSavingBill(true);
    setFieldErrors({});

    const result = await saveSupplierBill({
      vendorId,
      vendorInvoiceNumber,
      billDate,
      dueDate,
      totalAmount,
      taxAmount,
    });

    setIsSavingBill(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Recorded. It now counts against what you owe.');
    setVendorInvoiceNumber('');
    setTotalAmount('');
    router.refresh();
  }

  /**
   * Records a payment against a bill.
   *
   * @param billId Bill being paid.
   * @returns Nothing.
   */
  async function onPay(billId: string): Promise<void> {
    const result = await recordBillPayment({ billId, amount: payAmount });

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success(
      Number.parseFloat(result.data.balanceDue) <= 0
        ? 'Settled in full.'
        : `Recorded. ${formatMoney(result.data.balanceDue, currency)} still owed on it.`
    );
    setPayingId(null);
    setPayAmount('');
    router.refresh();
  }

  /**
   * Removes a bill that was entered by mistake.
   *
   * A bill recorded twice overstates what the business owes, which is the
   * kind of error that only shows up when somebody pays it twice.
   *
   * @param billId Bill being removed.
   * @returns Nothing.
   */
  async function onRemoveBill(billId: string): Promise<void> {
    const result = await deleteSupplierBill({ billId });

    setRemovingId(null);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Removed. What you owe has been recalculated.');
    router.refresh();
  }

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.vendorId,
    label: supplier.displayName,
  }));

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Owed to suppliers</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatMoney(outstandingTotal, currency)}
            </dd>
            <p className="text-sm text-muted-foreground">Across every bill not yet settled.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Already late</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatMoney(overdueTotal, currency)}
            </dd>
            <p className="text-sm text-muted-foreground">
              Past the date you agreed with the supplier.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Suppliers</dt>
            <dd className="tabular text-2xl font-semibold">{formatNumber(suppliers.length)}</dd>
            <p className="text-sm text-muted-foreground">People and businesses you buy from.</p>
          </CardContent>
        </Card>
      </dl>

      {Number.parseFloat(overdueTotal) > 0 ? (
        <Alert tone="warning" title="Some bills are past their date">
          {`${formatMoney(overdueTotal, currency)} is owed and late. A supplier who is paid late once asks for money up front the next time.`}
        </Alert>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Record a bill</CardTitle>
            <CardDescription>
              Use the number the supplier put on their own invoice, so the two documents can be
              matched by anybody later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add a supplier below before recording a bill.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <FormField id="bill-vendor" label="Supplier" isRequired>
                    <Select
                      id="bill-vendor"
                      value={vendorId}
                      options={supplierOptions}
                      onChange={(event) => setVendorId(event.target.value)}
                    />
                  </FormField>

                  <FormField
                    id="bill-reference"
                    label="Their invoice number"
                    errors={fieldErrors['vendorInvoiceNumber']}
                    isRequired
                  >
                    <Input
                      id="bill-reference"
                      value={vendorInvoiceNumber}
                      onChange={(event) => setVendorInvoiceNumber(event.target.value)}
                    />
                  </FormField>

                  <FormField id="bill-date" label="Date on the bill" isRequired>
                    <Input
                      id="bill-date"
                      type="date"
                      value={billDate}
                      onChange={(event) => setBillDate(event.target.value)}
                    />
                  </FormField>

                  <FormField id="bill-due" label="Pay by" isRequired>
                    <Input
                      id="bill-due"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                    />
                  </FormField>

                  <FormField
                    id="bill-total"
                    label={`Total (${currency})`}
                    errors={fieldErrors['totalAmount']}
                    isRequired
                  >
                    <Input
                      id="bill-total"
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                    />
                  </FormField>

                  <FormField
                    id="bill-tax"
                    label={`Of which tax (${currency})`}
                    hint="Leave at zero if there is none."
                  >
                    <Input
                      id="bill-tax"
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxAmount}
                      onChange={(event) => setTaxAmount(event.target.value)}
                    />
                  </FormField>
                </div>

                <Button
                  isLoading={isSavingBill}
                  loadingLabel="Recording"
                  onClick={() => void onSaveBill()}
                >
                  Record this bill
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Bills</CardTitle>
          <CardDescription>
            Soonest due first, because that is the order they have to be paid in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <EmptyState
              title="No bill recorded yet"
              description="Record what your suppliers have invoiced you and this page tells you what is owed and when."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Their reference</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead isNumeric>Total</TableHead>
                  <TableHead isNumeric>Paid</TableHead>
                  <TableHead isNumeric>Still owed</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.billId}>
                    <TableCell>{bill.vendorName ?? 'Not recorded'}</TableCell>
                    <TableCell>{bill.vendorInvoiceNumber ?? bill.billNumber}</TableCell>
                    <TableCell>{formatDate(bill.dueDate)}</TableCell>
                    <TableCell isNumeric>{formatMoney(bill.totalAmount, bill.currency)}</TableCell>
                    <TableCell isNumeric>{formatMoney(bill.paidAmount, bill.currency)}</TableCell>
                    <TableCell isNumeric>{formatMoney(bill.balanceDue, bill.currency)}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge
                          tone={
                            Number.parseFloat(bill.balanceDue) <= 0
                              ? 'success'
                              : bill.isOverdue
                                ? 'danger'
                                : 'neutral'
                          }
                        >
                          {Number.parseFloat(bill.balanceDue) <= 0
                            ? 'Settled'
                            : bill.isOverdue
                              ? 'Late'
                              : humanise(bill.status)}
                        </Badge>

                        {canEdit && Number.parseFloat(bill.balanceDue) > 0 ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setPayingId(payingId === bill.billId ? null : bill.billId)
                            }
                          >
                            {payingId === bill.billId ? 'Close' : 'Record a payment'}
                          </Button>
                        ) : null}

                        {canEdit && Number.parseFloat(bill.paidAmount) === 0 ? (
                          removingId === bill.billId ? (
                            <div className="flex flex-wrap gap-2">
                              <Button onClick={() => void onRemoveBill(bill.billId)}>
                                Yes, remove it
                              </Button>
                              <Button variant="ghost" onClick={() => setRemovingId(null)}>
                                Keep it
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" onClick={() => setRemovingId(bill.billId)}>
                              Entered by mistake
                            </Button>
                          )
                        ) : null}

                        {payingId === bill.billId ? (
                          <div className="space-y-2">
                            <FormField id={`pay-${bill.billId}`} label={`Paid (${bill.currency})`}>
                              <Input
                                id={`pay-${bill.billId}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={payAmount}
                                onChange={(event) => setPayAmount(event.target.value)}
                              />
                            </FormField>
                            <Button onClick={() => void onPay(bill.billId)}>Save it</Button>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
          <CardDescription>Who you buy from, and on what terms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No supplier is recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead isNumeric>Terms</TableHead>
                  <TableHead isNumeric>Billed to date</TableHead>
                  <TableHead isNumeric>Paid to date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.vendorId}>
                    <TableCell>{supplier.displayName}</TableCell>
                    <TableCell>{supplier.reference}</TableCell>
                    <TableCell>{supplier.email ?? supplier.phone ?? 'Not recorded'}</TableCell>
                    <TableCell isNumeric>
                      {`${formatNumber(supplier.paymentTermsDays)} days`}
                    </TableCell>
                    <TableCell isNumeric>{formatMoney(supplier.totalBilled, currency)}</TableCell>
                    <TableCell isNumeric>{formatMoney(supplier.totalPaid, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {canEdit ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <FormField id="supplier-name" label="Name" isRequired>
                <Input
                  id="supplier-name"
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                />
              </FormField>

              <FormField id="supplier-email" label="Email">
                <Input
                  id="supplier-email"
                  type="email"
                  value={supplierEmail}
                  onChange={(event) => setSupplierEmail(event.target.value)}
                />
              </FormField>

              <FormField id="supplier-terms" label="Pay within (days)">
                <Input
                  id="supplier-terms"
                  type="number"
                  min="0"
                  max="365"
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                />
              </FormField>

              <div className="flex items-end">
                <Button
                  variant="secondary"
                  isLoading={isSavingSupplier}
                  loadingLabel="Adding"
                  onClick={() => void onSaveSupplier()}
                >
                  Add this supplier
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {orders.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>On order</CardTitle>
            <CardDescription>
              What has been ordered, how much has arrived and how much has been billed for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead isNumeric>Ordered</TableHead>
                  <TableHead isNumeric>Received</TableHead>
                  <TableHead isNumeric>Billed</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.vendorName ?? 'Not recorded'}</TableCell>
                    <TableCell>
                      {order.expectedDate === null ? 'No date' : formatDate(order.expectedDate)}
                    </TableCell>
                    <TableCell isNumeric>
                      {formatMoney(order.totalAmount, order.currency)}
                    </TableCell>
                    <TableCell isNumeric>
                      {formatMoney(order.receivedValue, order.currency)}
                    </TableCell>
                    <TableCell isNumeric>
                      {formatMoney(order.billedValue, order.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge tone="neutral">{humanise(order.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
