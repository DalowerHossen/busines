// src/components/expenses/expense-form.tsx
// Recording what was spent: the supplier, the amount, the tax, and whether it
// is recharged to a client or owed back to the person who paid.

'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { ROUTES } from '@/config/app';
import { CURRENCIES } from '@/config/currencies';
import { createExpense } from '@/features/expenses/actions/create-expense';
import { updateExpense } from '@/features/expenses/actions/update-expense';
import type { ExpenseDetail, ExpenseFormData } from '@/features/expenses/types';
import { PAYMENT_METHOD_LABELS } from '@/components/payments/payment-method-label';
import { todayIso } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { addMoney, toStoredAmount } from '@/lib/money';
import { PAYMENT_METHOD_TYPES } from '@/types/enums';

export interface ExpenseFormProps {
  /** Claim being edited, or undefined when recording a new one. */
  expense?: ExpenseDetail;
  /** The suppliers, categories and clients to offer. */
  formData: ExpenseFormData;
  /** Currency the company reports in. */
  defaultCurrency: string;
}

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} — ${currency.name}`,
}));

const METHOD_OPTIONS = [
  { value: '', label: 'Not recorded' },
  ...PAYMENT_METHOD_TYPES.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] })),
];

/**
 * Renders the expense form.
 *
 * @param props The claim being edited and the lists to offer.
 * @returns The rendered form.
 */
export function ExpenseForm({ expense, formData, defaultCurrency }: ExpenseFormProps) {
  const router = useRouter();
  const isEditing = expense !== undefined;

  const [description, setDescription] = useState(expense?.description ?? '');
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? todayIso());
  const [vendorId, setVendorId] = useState(expense?.vendorId ?? '');
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '');
  const [reference, setReference] = useState(expense?.reference ?? '');
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency);
  const [subtotalAmount, setSubtotalAmount] = useState(expense?.subtotalAmount ?? '0.00');
  const [taxAmount, setTaxAmount] = useState(expense?.taxAmount ?? '0.00');
  const [paymentMethod, setPaymentMethod] = useState<string>(expense?.paymentMethod ?? '');
  const [isPaid, setIsPaid] = useState(expense?.isPaid ?? false);
  const [isBillable, setIsBillable] = useState(expense?.isBillable ?? false);
  const [clientId, setClientId] = useState(expense?.clientId ?? '');
  const [markupPercentage, setMarkupPercentage] = useState(expense?.markupPercentage ?? '0');
  const [isReimbursable, setIsReimbursable] = useState(expense?.isReimbursable ?? false);
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const total = useMemo(() => {
    const safeSubtotal = /^\d+(\.\d{1,2})?$/.test(subtotalAmount) ? subtotalAmount : '0';
    const safeTax = /^\d+(\.\d{1,2})?$/.test(taxAmount) ? taxAmount : '0';

    return toStoredAmount(addMoney(safeSubtotal, safeTax));
  }, [subtotalAmount, taxAmount]);

  const vendorOptions = [
    { value: '', label: 'No supplier recorded' },
    ...formData.vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
  ];

  const categoryOptions = [
    { value: '', label: 'Not categorised' },
    ...formData.categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  const clientOptions = [
    { value: '', label: 'Choose a client' },
    ...formData.clients.map((client) => ({ value: client.id, label: client.name })),
  ];

  /**
   * Saves the claim and opens it.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      description,
      expenseDate,
      vendorId,
      categoryId,
      reference,
      currency,
      subtotalAmount,
      taxAmount,
      taxRateId: '',
      paymentMethod,
      isPaid,
      isBillable,
      clientId,
      markupPercentage,
      isReimbursable,
      notes,
    };

    const result = isEditing
      ? await updateExpense({ ...payload, expenseId: expense.id })
      : await createExpense(payload);

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success(isEditing ? 'Expense saved.' : 'Expense recorded.');
    router.push(`${ROUTES.expenses}/${result.data.expenseId}`);
    router.refresh();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-6"
    >
      {formError ? (
        <Alert tone="danger" title="The expense was not saved">
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What was bought</CardTitle>
          <CardDescription>
            A short description and the date on the receipt are enough to start.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="expense-description"
            label="Description"
            isRequired
            errors={fieldErrors['description']}
          >
            <Input
              {...fieldAccessibilityProps(
                'expense-description',
                false,
                Boolean(fieldErrors['description'])
              )}
              name="description"
              value={description}
              disabled={isSubmitting}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="expense-date"
            label="Date on the receipt"
            errors={fieldErrors['expenseDate']}
          >
            <Input
              {...fieldAccessibilityProps(
                'expense-date',
                false,
                Boolean(fieldErrors['expenseDate'])
              )}
              type="date"
              name="expenseDate"
              value={expenseDate}
              disabled={isSubmitting}
              onChange={(event) => {
                setExpenseDate(event.target.value);
              }}
            />
          </FormField>

          <FormField id="expense-vendor" label="Supplier" errors={fieldErrors['vendorId']}>
            <Select
              id="expense-vendor"
              name="vendorId"
              options={vendorOptions}
              value={vendorId}
              disabled={isSubmitting}
              onChange={(event) => {
                setVendorId(event.target.value);
              }}
            />
          </FormField>

          <FormField id="expense-category" label="Category" errors={fieldErrors['categoryId']}>
            <Select
              id="expense-category"
              name="categoryId"
              options={categoryOptions}
              value={categoryId}
              disabled={isSubmitting}
              onChange={(event) => {
                setCategoryId(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="expense-reference"
            label="Receipt or invoice number"
            errors={fieldErrors['reference']}
          >
            <Input
              {...fieldAccessibilityProps(
                'expense-reference',
                false,
                Boolean(fieldErrors['reference'])
              )}
              name="reference"
              value={reference}
              disabled={isSubmitting}
              onChange={(event) => {
                setReference(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The amount</CardTitle>
          <CardDescription>
            Enter the net amount and the tax separately so the figures match the receipt.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="expense-currency" label="Currency" errors={fieldErrors['currency']}>
            <Select
              id="expense-currency"
              name="currency"
              options={CURRENCY_OPTIONS}
              value={currency}
              disabled={isSubmitting}
              onChange={(event) => {
                setCurrency(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="expense-subtotal"
            label="Amount before tax"
            isRequired
            errors={fieldErrors['subtotalAmount']}
          >
            <Input
              {...fieldAccessibilityProps(
                'expense-subtotal',
                false,
                Boolean(fieldErrors['subtotalAmount'])
              )}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              name="subtotalAmount"
              value={subtotalAmount}
              disabled={isSubmitting}
              onChange={(event) => {
                setSubtotalAmount(event.target.value);
              }}
            />
          </FormField>

          <FormField id="expense-tax" label="Tax" errors={fieldErrors['taxAmount']}>
            <Input
              {...fieldAccessibilityProps('expense-tax', false, Boolean(fieldErrors['taxAmount']))}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              name="taxAmount"
              value={taxAmount}
              disabled={isSubmitting}
              onChange={(event) => {
                setTaxAmount(event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="expense-method"
            label="How it was paid"
            errors={fieldErrors['paymentMethod']}
          >
            <Select
              id="expense-method"
              name="paymentMethod"
              options={METHOD_OPTIONS}
              value={paymentMethod}
              disabled={isSubmitting}
              onChange={(event) => {
                setPaymentMethod(event.target.value);
              }}
            />
          </FormField>

          <div className="rounded-lg bg-surface-muted p-4 sm:col-span-2">
            <p className="text-sm text-muted-foreground">Total on this claim</p>
            <p className="tabular text-2xl font-semibold text-foreground">
              {formatMoney(total, currency)}
            </p>
          </div>

          <div className="sm:col-span-2">
            <Checkbox
              id="expense-paid"
              name="isPaid"
              label="This has already been paid"
              description="Leave it unticked if the supplier is still waiting for the money."
              checked={isPaid}
              disabled={isSubmitting}
              onChange={(event) => {
                setIsPaid(event.target.checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who carries the cost</CardTitle>
          <CardDescription>
            Recharged spending appears on the next invoice of that client. Reimbursable spending is
            owed back to whoever paid for it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Checkbox
            id="expense-billable"
            name="isBillable"
            label="Recharge this to a client"
            description="It is added to their next invoice with any markup you set."
            checked={isBillable}
            disabled={isSubmitting}
            onChange={(event) => {
              setIsBillable(event.target.checked);
            }}
          />

          {isBillable ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="expense-client"
                label="Client"
                isRequired
                errors={fieldErrors['clientId']}
              >
                <Select
                  id="expense-client"
                  name="clientId"
                  options={clientOptions}
                  value={clientId}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setClientId(event.target.value);
                  }}
                />
              </FormField>

              <FormField
                id="expense-markup"
                label="Markup percentage"
                hint="Leave at zero to recharge the cost exactly."
                errors={fieldErrors['markupPercentage']}
              >
                <Input
                  {...fieldAccessibilityProps(
                    'expense-markup',
                    true,
                    Boolean(fieldErrors['markupPercentage'])
                  )}
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000"
                  inputMode="decimal"
                  name="markupPercentage"
                  value={markupPercentage}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setMarkupPercentage(event.target.value);
                  }}
                />
              </FormField>
            </div>
          ) : null}

          <Checkbox
            id="expense-reimbursable"
            name="isReimbursable"
            label="I paid for this myself"
            description="The business owes you the amount once the claim is approved."
            checked={isReimbursable}
            disabled={isSubmitting}
            onChange={(event) => {
              setIsReimbursable(event.target.checked);
            }}
          />

          <FormField id="expense-notes" label="Internal notes" errors={fieldErrors['notes']}>
            <Textarea
              {...fieldAccessibilityProps('expense-notes', false, Boolean(fieldErrors['notes']))}
              name="notes"
              rows={3}
              value={notes}
              disabled={isSubmitting}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => {
            router.back();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting} loadingLabel="Saving">
          {isEditing ? 'Save expense' : 'Record expense'}
        </Button>
      </div>
    </form>
  );
}
