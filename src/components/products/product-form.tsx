// src/components/products/product-form.tsx
// The one form used to add a catalogue item and to edit one, grouped into
// what it is, what it sells for, and how it is bought and stocked.

'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

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
import { createProduct } from '@/features/products/actions/create-product';
import { updateProduct } from '@/features/products/actions/update-product';
import type { CatalogueReferences, ProductDetail } from '@/features/products/types';
import { PRODUCT_STATUSES, PRODUCT_TYPES } from '@/types/enums';

export interface ProductFormProps {
  /** Item being edited, or undefined when adding a new one. */
  product?: ProductDetail;
  /** The categories, units and tax rates this company has. */
  references: CatalogueReferences;
  /** Currency the company bills in, used as the default. */
  defaultCurrency: string;
}

interface ProductFormState {
  name: string;
  sku: string;
  barcode: string;
  description: string;
  productType: string;
  status: string;
  categoryId: string;
  unitOfMeasureId: string;
  unitPrice: string;
  currency: string;
  taxRateId: string;
  isTaxInclusivePrice: boolean;
  allowPriceOverride: boolean;
  minimumPrice: string;
  costPrice: string;
  preferredSupplierName: string;
  isBillableByTime: boolean;
  defaultHours: string;
  trackInventory: boolean;
  lowStockThreshold: string;
  openingStockQuantity: string;
  hsCode: string;
  incomeAccountCode: string;
  expenseAccountCode: string;
  internalNotes: string;
  isFeatured: boolean;
}

const TYPE_LABELS: Record<(typeof PRODUCT_TYPES)[number], string> = {
  goods: 'Goods',
  service: 'Service',
  digital: 'Digital download',
  subscription: 'Subscription',
  billable_expense: 'Billable expense',
};

const TYPE_OPTIONS = PRODUCT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));

const STATUS_LABELS: Record<(typeof PRODUCT_STATUSES)[number], string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

const STATUS_OPTIONS = PRODUCT_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} — ${currency.name}`,
}));

/**
 * Builds the starting values of the form.
 *
 * @param product Item being edited, when there is one.
 * @param defaultCurrency Currency the company bills in.
 * @returns The initial field values.
 */
function toFormState(
  product: ProductDetail | undefined,
  defaultCurrency: string
): ProductFormState {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    description: product?.description ?? '',
    productType: product?.productType ?? 'service',
    status: product?.status ?? 'active',
    categoryId: product?.categoryId ?? '',
    unitOfMeasureId: product?.unitOfMeasureId ?? '',
    unitPrice: product?.unitPrice ?? '0.00',
    currency: product?.currency ?? defaultCurrency,
    taxRateId: product?.taxRateId ?? '',
    isTaxInclusivePrice: product?.isTaxInclusivePrice ?? false,
    allowPriceOverride: product?.allowPriceOverride ?? true,
    minimumPrice: product?.minimumPrice ?? '',
    costPrice: product?.costPrice ?? '',
    preferredSupplierName: product?.preferredSupplierName ?? '',
    isBillableByTime: product?.isBillableByTime ?? false,
    defaultHours: product?.defaultHours ?? '',
    trackInventory: product?.trackInventory ?? false,
    lowStockThreshold: product?.lowStockThreshold ?? '',
    openingStockQuantity: product?.openingStockQuantity ?? '0',
    hsCode: product?.hsCode ?? '',
    incomeAccountCode: product?.incomeAccountCode ?? '',
    expenseAccountCode: product?.expenseAccountCode ?? '',
    internalNotes: product?.internalNotes ?? '',
    isFeatured: product?.isFeatured ?? false,
  };
}

/**
 * Renders the add and edit form for a catalogue item.
 *
 * @param props The item being edited and the reference lists.
 * @returns The rendered form.
 */
export function ProductForm({ product, references, defaultCurrency }: ProductFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormState>(() =>
    toFormState(product, defaultCurrency)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isEditing = product !== undefined;

  const categoryOptions = [
    { value: '', label: 'No category' },
    ...references.categories.map((entry) => ({ value: entry.id, label: entry.label })),
  ];

  const unitOptions = [
    { value: '', label: 'No unit' },
    ...references.units.map((entry) => ({ value: entry.id, label: entry.label })),
  ];

  const taxOptions = [
    { value: '', label: 'No tax rate' },
    ...references.taxRates.map((entry) => ({ value: entry.id, label: entry.label })),
  ];

  /**
   * Updates one field of the form.
   *
   * @param field Field being changed.
   * @param value New value for that field.
   * @returns Nothing.
   */
  function setField<Field extends keyof ProductFormState>(
    field: Field,
    value: ProductFormState[Field]
  ): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /**
   * Saves the item and opens its page.
   *
   * @param event Submit event from the form.
   * @returns Nothing.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const result = isEditing
      ? await updateProduct({ ...values, productId: product.id })
      : await createProduct(values);

    if (!result.success) {
      setIsSubmitting(false);
      setFormError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    notify.success(isEditing ? 'Item saved.' : 'Item added to the catalogue.');
    router.push(`${ROUTES.products}/${result.data.productId}`);
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
        <Alert
          tone="danger"
          title={isEditing ? 'The item was not saved' : 'The item was not added'}
        >
          {formError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What you are selling</CardTitle>
          <CardDescription>
            The name and description here are copied onto an invoice line, where you can still
            adjust them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="product-name"
            label="Name"
            isRequired
            errors={fieldErrors['name']}
            className="sm:col-span-2"
          >
            <Input
              {...fieldAccessibilityProps('product-name', false, Boolean(fieldErrors['name']))}
              name="name"
              autoFocus
              value={values.name}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('name', event.target.value);
              }}
            />
          </FormField>

          <FormField id="product-type" label="Type" errors={fieldErrors['productType']}>
            <Select
              id="product-type"
              name="productType"
              options={TYPE_OPTIONS}
              value={values.productType}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('productType', event.target.value);
              }}
            />
          </FormField>

          <FormField id="product-status" label="Status" errors={fieldErrors['status']}>
            <Select
              id="product-status"
              name="status"
              options={STATUS_OPTIONS}
              value={values.status}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('status', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-sku"
            label="Item code"
            hint="Your own reference, shown on the invoice line."
            errors={fieldErrors['sku']}
          >
            <Input
              {...fieldAccessibilityProps('product-sku', true, Boolean(fieldErrors['sku']))}
              name="sku"
              value={values.sku}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('sku', event.target.value);
              }}
            />
          </FormField>

          <FormField id="product-barcode" label="Barcode" errors={fieldErrors['barcode']}>
            <Input
              {...fieldAccessibilityProps(
                'product-barcode',
                false,
                Boolean(fieldErrors['barcode'])
              )}
              name="barcode"
              value={values.barcode}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('barcode', event.target.value);
              }}
            />
          </FormField>

          <FormField id="product-category" label="Category" errors={fieldErrors['categoryId']}>
            <Select
              id="product-category"
              name="categoryId"
              options={categoryOptions}
              value={values.categoryId}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('categoryId', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-unit"
            label="Unit of measure"
            errors={fieldErrors['unitOfMeasureId']}
          >
            <Select
              id="product-unit"
              name="unitOfMeasureId"
              options={unitOptions}
              value={values.unitOfMeasureId}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('unitOfMeasureId', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-description"
            label="Description"
            errors={fieldErrors['description']}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldAccessibilityProps(
                'product-description',
                false,
                Boolean(fieldErrors['description'])
              )}
              name="description"
              rows={4}
              value={values.description}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('description', event.target.value);
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price and tax</CardTitle>
          <CardDescription>
            Prices carry two decimal places on the invoice and are stored exactly as entered.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="product-unit-price"
            label="Selling price"
            isRequired
            errors={fieldErrors['unitPrice']}
          >
            <Input
              {...fieldAccessibilityProps(
                'product-unit-price',
                false,
                Boolean(fieldErrors['unitPrice'])
              )}
              type="number"
              min={0}
              step={0.01}
              name="unitPrice"
              value={values.unitPrice}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('unitPrice', event.target.value);
              }}
            />
          </FormField>

          <FormField id="product-currency" label="Currency" errors={fieldErrors['currency']}>
            <Select
              id="product-currency"
              name="currency"
              options={CURRENCY_OPTIONS}
              value={values.currency}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('currency', event.target.value);
              }}
            />
          </FormField>

          <FormField id="product-tax-rate" label="Tax rate" errors={fieldErrors['taxRateId']}>
            <Select
              id="product-tax-rate"
              name="taxRateId"
              options={taxOptions}
              value={values.taxRateId}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('taxRateId', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-minimum-price"
            label="Lowest price allowed"
            hint="Leave empty to allow any price."
            errors={fieldErrors['minimumPrice']}
          >
            <Input
              {...fieldAccessibilityProps(
                'product-minimum-price',
                true,
                Boolean(fieldErrors['minimumPrice'])
              )}
              type="number"
              min={0}
              step={0.01}
              name="minimumPrice"
              value={values.minimumPrice}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('minimumPrice', event.target.value);
              }}
            />
          </FormField>

          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              id="product-tax-inclusive"
              name="isTaxInclusivePrice"
              label="The price above already includes tax"
              checked={values.isTaxInclusivePrice}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('isTaxInclusivePrice', event.target.checked);
              }}
            />
            <Checkbox
              id="product-price-override"
              name="allowPriceOverride"
              label="Let the price be changed on an invoice"
              checked={values.allowPriceOverride}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('allowPriceOverride', event.target.checked);
              }}
            />
            <Checkbox
              id="product-featured"
              name="isFeatured"
              label="Show this item at the top of the picker"
              checked={values.isFeatured}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('isFeatured', event.target.checked);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost, time and stock</CardTitle>
          <CardDescription>
            Cost gives you margin on the reports. Stock control is available for goods.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="product-cost-price" label="Cost price" errors={fieldErrors['costPrice']}>
            <Input
              {...fieldAccessibilityProps(
                'product-cost-price',
                false,
                Boolean(fieldErrors['costPrice'])
              )}
              type="number"
              min={0}
              step={0.01}
              name="costPrice"
              value={values.costPrice}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('costPrice', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-supplier"
            label="Usual supplier"
            errors={fieldErrors['preferredSupplierName']}
          >
            <Input
              {...fieldAccessibilityProps(
                'product-supplier',
                false,
                Boolean(fieldErrors['preferredSupplierName'])
              )}
              name="preferredSupplierName"
              value={values.preferredSupplierName}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('preferredSupplierName', event.target.value);
              }}
            />
          </FormField>

          <div className="space-y-3 sm:col-span-2">
            <Checkbox
              id="product-billable-time"
              name="isBillableByTime"
              label="This item is billed by the hour"
              description="Hours recorded against a project can be turned into an invoice line using this item."
              checked={values.isBillableByTime}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('isBillableByTime', event.target.checked);
              }}
            />
            <Checkbox
              id="product-track-inventory"
              name="trackInventory"
              label="Keep stock figures for this item"
              description="Available for goods. Quantities are adjusted as invoices are issued."
              checked={values.trackInventory}
              disabled={isSubmitting || values.productType !== 'goods'}
              onChange={(event) => {
                setField('trackInventory', event.target.checked);
              }}
            />
          </div>

          {values.isBillableByTime ? (
            <FormField
              id="product-default-hours"
              label="Hours offered by default"
              errors={fieldErrors['defaultHours']}
            >
              <Input
                {...fieldAccessibilityProps(
                  'product-default-hours',
                  false,
                  Boolean(fieldErrors['defaultHours'])
                )}
                type="number"
                min={0}
                step={0.25}
                name="defaultHours"
                value={values.defaultHours}
                disabled={isSubmitting}
                onChange={(event) => {
                  setField('defaultHours', event.target.value);
                }}
              />
            </FormField>
          ) : null}

          {values.trackInventory ? (
            <>
              <FormField
                id="product-low-stock"
                label="Warn me below"
                errors={fieldErrors['lowStockThreshold']}
              >
                <Input
                  {...fieldAccessibilityProps(
                    'product-low-stock',
                    false,
                    Boolean(fieldErrors['lowStockThreshold'])
                  )}
                  type="number"
                  min={0}
                  step={0.001}
                  name="lowStockThreshold"
                  value={values.lowStockThreshold}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setField('lowStockThreshold', event.target.value);
                  }}
                />
              </FormField>

              {isEditing ? null : (
                <FormField
                  id="product-opening-stock"
                  label="Opening quantity"
                  errors={fieldErrors['openingStockQuantity']}
                >
                  <Input
                    {...fieldAccessibilityProps(
                      'product-opening-stock',
                      false,
                      Boolean(fieldErrors['openingStockQuantity'])
                    )}
                    type="number"
                    min={0}
                    step={0.001}
                    name="openingStockQuantity"
                    value={values.openingStockQuantity}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      setField('openingStockQuantity', event.target.value);
                    }}
                  />
                </FormField>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounting and trade</CardTitle>
          <CardDescription>
            Optional codes that keep your books and your customs paperwork tidy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            id="product-income-code"
            label="Income account code"
            errors={fieldErrors['incomeAccountCode']}
          >
            <Input
              {...fieldAccessibilityProps(
                'product-income-code',
                false,
                Boolean(fieldErrors['incomeAccountCode'])
              )}
              name="incomeAccountCode"
              value={values.incomeAccountCode}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('incomeAccountCode', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-expense-code"
            label="Expense account code"
            errors={fieldErrors['expenseAccountCode']}
          >
            <Input
              {...fieldAccessibilityProps(
                'product-expense-code',
                false,
                Boolean(fieldErrors['expenseAccountCode'])
              )}
              name="expenseAccountCode"
              value={values.expenseAccountCode}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('expenseAccountCode', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-hs-code"
            label="Customs code"
            hint="The tariff code used when the item crosses a border."
            errors={fieldErrors['hsCode']}
          >
            <Input
              {...fieldAccessibilityProps('product-hs-code', true, Boolean(fieldErrors['hsCode']))}
              name="hsCode"
              value={values.hsCode}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('hsCode', event.target.value);
              }}
            />
          </FormField>

          <FormField
            id="product-internal-notes"
            label="Internal notes"
            errors={fieldErrors['internalNotes']}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldAccessibilityProps(
                'product-internal-notes',
                false,
                Boolean(fieldErrors['internalNotes'])
              )}
              name="internalNotes"
              rows={3}
              value={values.internalNotes}
              disabled={isSubmitting}
              onChange={(event) => {
                setField('internalNotes', event.target.value);
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
          {isEditing ? 'Save item' : 'Add item'}
        </Button>
      </div>
    </form>
  );
}
