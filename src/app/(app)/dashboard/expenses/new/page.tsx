// src/app/(app)/dashboard/expenses/new/page.tsx
// Recording a new cost. It is saved as a draft, so the figures can be checked
// before it goes for approval.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ExpenseForm } from '@/components/expenses/expense-form';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadExpenseFormData } from '@/features/expenses/queries/expense-form-data';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Record an expense',
  description: 'Record a cost, attach it to a supplier and recharge it if a client should pay.',
  path: `${ROUTES.expenses}/new`,
  noIndex: true,
});

/**
 * Renders the new expense page.
 *
 * @returns The rendered page.
 */
export default async function NewExpensePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company || !can(user, 'expenses', 'create')) {
    return (
      <>
        <PageHeader
          title="Record an expense"
          description="You cannot record spending in this business."
        />
        <Alert tone="warning" title="You cannot record an expense">
          Ask the owner of this business to give your account permission to create expenses.
        </Alert>
      </>
    );
  }

  const formData = await loadExpenseFormData(company.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record an expense"
        description="Saved as a draft until you send it for approval."
        breadcrumbs={[{ label: 'Expenses', href: ROUTES.expenses }, { label: 'Record an expense' }]}
      />

      <ExpenseForm formData={formData} defaultCurrency={company.baseCurrency} />
    </div>
  );
}
