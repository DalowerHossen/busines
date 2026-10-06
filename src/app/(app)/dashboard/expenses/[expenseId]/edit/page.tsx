// src/app/(app)/dashboard/expenses/[expenseId]/edit/page.tsx
// Correcting a claim before it has been approved.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ExpenseForm } from '@/components/expenses/expense-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadExpenseFormData } from '@/features/expenses/queries/expense-form-data';
import { getExpense } from '@/features/expenses/queries/get-expense';
import { isEditableExpense } from '@/features/expenses/status';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Edit expense',
  description: 'Correct a claim before it goes for approval.',
  path: ROUTES.expenses,
  noIndex: true,
});

export interface EditExpensePageProps {
  /** Route parameters of the request. */
  params: { expenseId: string };
}

/**
 * Renders the expense edit page.
 *
 * @param props The route parameters of the request.
 * @returns The rendered page.
 */
export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'expenses', 'edit')) {
    return (
      <>
        <PageHeader
          title="Edit expense"
          description="You cannot change spending in this business."
        />
        <Alert tone="warning" title="You cannot edit this expense">
          Ask the owner of this business to give your account permission to edit expenses.
        </Alert>
      </>
    );
  }

  const expense = await getExpense(company.id, params.expenseId);

  if (expense === null) {
    notFound();
  }

  if (!isEditableExpense(expense.status) || expense.isDeleted) {
    return (
      <>
        <PageHeader
          title={expense.expenseNumber}
          description="This claim can no longer be changed."
          breadcrumbs={[
            { label: 'Expenses', href: ROUTES.expenses },
            { label: expense.expenseNumber, href: `${ROUTES.expenses}/${expense.id}` },
            { label: 'Edit' },
          ]}
        />
        <Alert tone="warning" title="This claim is closed to edits">
          An approved claim keeps the figures it was approved on. Record a correcting expense
          instead.
        </Alert>
      </>
    );
  }

  const formData = await loadExpenseFormData(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${expense.expenseNumber}`}
        description="Correct the figures and send the claim for approval again."
        breadcrumbs={[
          { label: 'Expenses', href: ROUTES.expenses },
          { label: expense.expenseNumber, href: `${ROUTES.expenses}/${expense.id}` },
          { label: 'Edit' },
        ]}
      />

      <ExpenseForm expense={expense} formData={formData} defaultCurrency={company.baseCurrency} />
    </div>
  );
}
