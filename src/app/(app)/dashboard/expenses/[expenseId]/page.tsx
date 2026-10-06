// src/app/(app)/dashboard/expenses/[expenseId]/page.tsx
// One expense claim: what was bought, what it cost, who approved it and
// whether a client is paying for it.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ExpenseActionsBar } from '@/components/expenses/expense-actions-bar';
import { PAYMENT_METHOD_LABELS } from '@/components/payments/payment-method-label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { getExpense } from '@/features/expenses/queries/get-expense';
import {
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_TONES,
  describeExpenseStatus,
} from '@/features/expenses/status';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Expense',
  description: 'One expense claim and everything recorded against it.',
  path: ROUTES.expenses,
  noIndex: true,
});

export interface ExpensePageProps {
  /** Route parameters of the request. */
  params: { expenseId: string };
}

/**
 * Renders one expense claim.
 *
 * @param props The route parameters of the request.
 * @returns The rendered page.
 */
export default async function ExpensePage({ params }: ExpensePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Expense" description="This account is not attached to a business yet." />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'expenses', 'view')) {
    return (
      <>
        <PageHeader title="Expense" description="You do not have access to the spending." />
        <Alert tone="warning" title="You cannot see expenses">
          Ask the owner of this business to give your account permission to view expenses.
        </Alert>
      </>
    );
  }

  const expense = await getExpense(company.id, params.expenseId);

  if (expense === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={expense.expenseNumber}
        description={describeExpenseStatus(expense.status, expense.isPaid)}
        breadcrumbs={[
          { label: 'Expenses', href: ROUTES.expenses },
          { label: expense.expenseNumber },
        ]}
        actions={
          <ExpenseActionsBar
            expense={expense}
            canEdit={can(user, 'expenses', 'edit')}
            canApprove={can(user, 'expenses', 'approve')}
          />
        }
      />

      {expense.isDeleted ? (
        <Alert tone="warning" title="This expense has been deleted">
          It no longer counts towards your spending. Restore it from the deleted list if it was
          removed by mistake.
        </Alert>
      ) : null}

      {expense.status === 'rejected' && expense.rejectionReason !== null ? (
        <Alert tone="danger" title="This claim was sent back">
          {expense.rejectionReason}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>What was spent</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Description</dt>
                <dd className="font-medium text-foreground">{expense.description}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge tone={EXPENSE_STATUS_TONES[expense.status]}>
                    {EXPENSE_STATUS_LABELS[expense.status]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Date on the receipt</dt>
                <dd className="text-foreground">{formatDate(expense.expenseDate)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Supplier</dt>
                <dd className="text-foreground">{expense.vendorName ?? 'No supplier recorded'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Category</dt>
                <dd className="text-foreground">{expense.categoryName ?? 'Not categorised'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Receipt reference</dt>
                <dd className="text-foreground">{expense.reference ?? 'Not recorded'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">How it was paid</dt>
                <dd className="text-foreground">
                  {expense.paymentMethod === null
                    ? 'Not recorded'
                    : PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                </dd>
              </div>
            </dl>

            {expense.notes === null ? null : (
              <div className="mt-6 rounded-lg bg-surface-muted p-4">
                <h3 className="text-sm font-medium text-foreground">Internal notes</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {expense.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>The amount</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Before tax</dt>
                  <dd className="tabular">
                    {formatMoney(expense.subtotalAmount, expense.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular">{formatMoney(expense.taxAmount, expense.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-border pt-3">
                  <dt className="font-medium text-foreground">Total</dt>
                  <dd className="tabular text-lg font-semibold text-foreground">
                    {formatMoney(expense.totalAmount, expense.currency)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd>
                    {expense.isPaid
                      ? expense.paidAt === null
                        ? 'Yes'
                        : formatDate(expense.paidAt.slice(0, 10))
                      : 'Not yet'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Who carries the cost</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Recharged to a client</dt>
                  <dd className="text-foreground">
                    {expense.isBillable
                      ? `${expense.clientName ?? 'A client'}, markup ${formatNumber(
                          Number.parseFloat(expense.markupPercentage)
                        )} percent`
                      : 'No, the business carries it'}
                  </dd>
                </div>
                {expense.isBillable ? (
                  <div>
                    <dt className="text-muted-foreground">On an invoice</dt>
                    <dd className="text-foreground">
                      {expense.invoiceId === null ? (
                        'Not invoiced yet'
                      ) : (
                        <Link
                          href={`${ROUTES.invoices}/${expense.invoiceId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          Open the invoice
                        </Link>
                      )}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">Owed back to a team member</dt>
                  <dd className="text-foreground">
                    {expense.isReimbursable
                      ? expense.reimbursedAt === null
                        ? 'Yes, not reimbursed yet'
                        : `Reimbursed on ${formatDate(expense.reimbursedAt.slice(0, 10))}`
                      : 'No'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Recorded</dt>
                  <dd className="text-foreground">
                    {expense.createdAt === null ? 'Unknown' : formatDateTime(expense.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sent for approval</dt>
                  <dd className="text-foreground">
                    {expense.submittedAt === null
                      ? 'Not sent yet'
                      : formatDateTime(expense.submittedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Approved</dt>
                  <dd className="text-foreground">
                    {expense.approvedAt === null
                      ? 'Not approved yet'
                      : formatDateTime(expense.approvedAt)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
