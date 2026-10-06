// src/components/invoices/invoice-line-editor.tsx
// The lines of an invoice while it is being written: pick an item from the
// catalogue or type a line by hand, with the line total worked out as you go.

'use client';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { InvoiceProductOption, InvoiceTaxOption } from '@/features/invoices/types';
import { formatMoney } from '@/lib/format';
import { lineTotalOf } from '@/features/invoices/line-math';

export interface InvoiceLineDraft {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitLabel: string;
  discountValue: string;
  taxRateId: string;
  taxPercentage: string;
  productId: string;
}

export interface InvoiceLineEditorProps {
  /** Lines currently on the invoice. */
  lines: readonly InvoiceLineDraft[];
  /** Catalogue items that can be dropped onto a line. */
  products: readonly InvoiceProductOption[];
  /** Tax rates that can be applied to a line. */
  taxRates: readonly InvoiceTaxOption[];
  /** Currency the invoice is written in. */
  currency: string;
  /** Called with the new set of lines whenever one changes. */
  onChange: (lines: InvoiceLineDraft[]) => void;
  /** Validation messages, keyed by the field path the server returned. */
  fieldErrors: Record<string, string[]>;
  /** True while the invoice is being saved. */
  isDisabled: boolean;
}

/**
 * Builds an empty line.
 *
 * @returns A line with nothing filled in yet.
 */
export function emptyInvoiceLine(): InvoiceLineDraft {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    quantity: '1',
    unitPrice: '0.00',
    unitLabel: '',
    discountValue: '',
    taxRateId: '',
    taxPercentage: '0',
    productId: '',
  };
}

/**
 * Renders the line editor of the invoice builder.
 *
 * @param props The lines and the lists they can be filled from.
 * @returns The rendered editor.
 */
export function InvoiceLineEditor({
  lines,
  products,
  taxRates,
  currency,
  onChange,
  fieldErrors,
  isDisabled,
}: InvoiceLineEditorProps) {
  const productOptions = [
    { value: '', label: 'Written by hand' },
    ...products.map((product) => ({
      value: product.id,
      label: product.sku === null ? product.name : `${product.name} (${product.sku})`,
    })),
  ];

  const taxOptions = [
    { value: '', label: 'No tax' },
    ...taxRates.map((rate) => ({ value: rate.id, label: `${rate.name} — ${rate.percentage}%` })),
  ];

  /**
   * Replaces one line with a changed copy.
   *
   * @param index Position of the line.
   * @param patch Fields that changed.
   * @returns Nothing.
   */
  function updateLine(index: number, patch: Partial<InvoiceLineDraft>): void {
    onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }

  /**
   * Fills a line from a catalogue item.
   *
   * @param index Position of the line.
   * @param productId Item chosen, or an empty string for a hand written line.
   * @returns Nothing.
   */
  function applyProduct(index: number, productId: string): void {
    const product = products.find((entry) => entry.id === productId);

    if (product === undefined) {
      updateLine(index, { productId: '' });
      return;
    }

    const rate = taxRates.find((entry) => entry.id === product.taxRateId);

    updateLine(index, {
      productId,
      description: product.description ?? product.name,
      unitPrice: product.unitPrice,
      taxRateId: product.taxRateId ?? '',
      taxPercentage: rate === undefined ? '0' : rate.percentage,
    });
  }

  /**
   * Applies a tax rate to a line and copies its percentage across.
   *
   * @param index Position of the line.
   * @param taxRateId Rate chosen, or an empty string for no tax.
   * @returns Nothing.
   */
  function applyTaxRate(index: number, taxRateId: string): void {
    const rate = taxRates.find((entry) => entry.id === taxRateId);
    updateLine(index, { taxRateId, taxPercentage: rate === undefined ? '0' : rate.percentage });
  }

  return (
    <div className="space-y-4">
      {fieldErrors['lines'] === undefined ? null : (
        <p className="text-sm text-destructive">{fieldErrors['lines'].join(' ')}</p>
      )}

      <ul className="space-y-4">
        {lines.map((line, index) => (
          <li key={line.key} className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`${line.key}-product`}
                >
                  Catalogue item
                </label>
                <Select
                  id={`${line.key}-product`}
                  options={productOptions}
                  value={line.productId}
                  disabled={isDisabled}
                  onChange={(event) => {
                    applyProduct(index, event.target.value);
                  }}
                />
              </div>

              <div className="lg:col-span-7">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`${line.key}-description`}
                >
                  Description
                </label>
                <Input
                  id={`${line.key}-description`}
                  value={line.description}
                  disabled={isDisabled}
                  onChange={(event) => {
                    updateLine(index, { description: event.target.value });
                  }}
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`${line.key}-quantity`}
                >
                  Quantity
                </label>
                <Input
                  id={`${line.key}-quantity`}
                  type="number"
                  min={0}
                  step={0.001}
                  value={line.quantity}
                  disabled={isDisabled}
                  onChange={(event) => {
                    updateLine(index, { quantity: event.target.value });
                  }}
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`${line.key}-unit`}
                >
                  Unit
                </label>
                <Input
                  id={`${line.key}-unit`}
                  value={line.unitLabel}
                  disabled={isDisabled}
                  onChange={(event) => {
                    updateLine(index, { unitLabel: event.target.value });
                  }}
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`${line.key}-price`}
                >
                  Unit price
                </label>
                <Input
                  id={`${line.key}-price`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.unitPrice}
                  disabled={isDisabled}
                  onChange={(event) => {
                    updateLine(index, { unitPrice: event.target.value });
                  }}
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`${line.key}-discount`}
                >
                  Discount
                </label>
                <Input
                  id={`${line.key}-discount`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.discountValue}
                  disabled={isDisabled}
                  onChange={(event) => {
                    updateLine(index, { discountValue: event.target.value });
                  }}
                />
              </div>

              <div className="lg:col-span-3">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`${line.key}-tax`}
                >
                  Tax rate
                </label>
                <Select
                  id={`${line.key}-tax`}
                  options={taxOptions}
                  value={line.taxRateId}
                  disabled={isDisabled}
                  onChange={(event) => {
                    applyTaxRate(index, event.target.value);
                  }}
                />
              </div>

              <div className="flex items-end justify-between gap-3 lg:col-span-1">
                <p className="tabular text-sm font-medium text-foreground">
                  {formatMoney(lineTotalOf(line), currency)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isDisabled || lines.length === 1}
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() => {
                    onChange(lines.filter((_entry, position) => position !== index));
                  }}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {fieldErrors[`lines.${index}.description`] === undefined ? null : (
              <p className="mt-2 text-sm text-destructive">
                {fieldErrors[`lines.${index}.description`]?.join(' ')}
              </p>
            )}
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="secondary"
        disabled={isDisabled}
        leadingIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
        onClick={() => {
          onChange([...lines, emptyInvoiceLine()]);
        }}
      >
        Add a line
      </Button>
    </div>
  );
}
