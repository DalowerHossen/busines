// src/components/products/product-detail-cards.tsx
// The reference view of one catalogue item: what it is, what it sells for and
// how it is bought, stocked and posted to the books.

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProductDetail } from '@/features/products/types';
import { formatMoney, formatNumber } from '@/lib/format';

export interface ProductDetailCardsProps {
  /** Item being shown. */
  product: ProductDetail;
  /** Currency used when the item has none of its own. */
  fallbackCurrency: string;
}

const TYPE_LABELS: Record<string, string> = {
  goods: 'Goods',
  service: 'Service',
  digital: 'Digital download',
  subscription: 'Subscription',
  billable_expense: 'Billable expense',
};

/**
 * Renders the detail cards of one catalogue item.
 *
 * @param props The item and the fallback currency.
 * @returns The rendered cards.
 */
export function ProductDetailCards({ product, fallbackCurrency }: ProductDetailCardsProps) {
  const currency = product.currency ?? fallbackCurrency;

  const pricing = [
    { label: 'Selling price', value: formatMoney(product.unitPrice, currency) },
    {
      label: 'Lowest price allowed',
      value:
        product.minimumPrice === null ? 'Any price' : formatMoney(product.minimumPrice, currency),
    },
    { label: 'Tax rate', value: product.taxRateName ?? 'No tax rate' },
    {
      label: 'Price includes tax',
      value: product.isTaxInclusivePrice ? 'Yes' : 'No',
    },
    {
      label: 'Cost price',
      value: product.costPrice === null ? 'Not recorded' : formatMoney(product.costPrice, currency),
    },
    { label: 'Usual supplier', value: product.preferredSupplierName ?? 'Not recorded' },
  ];

  const details = [
    { label: 'Type', value: TYPE_LABELS[product.productType] ?? product.productType },
    { label: 'Item code', value: product.sku ?? 'Not set' },
    { label: 'Barcode', value: product.barcode ?? 'Not set' },
    { label: 'Category', value: product.categoryName ?? 'Uncategorised' },
    { label: 'Unit of measure', value: product.unitName ?? 'Not set' },
    { label: 'Customs code', value: product.hsCode ?? 'Not set' },
    { label: 'Income account', value: product.incomeAccountCode ?? 'Not set' },
    { label: 'Expense account', value: product.expenseAccountCode ?? 'Not set' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Price and tax</CardTitle>
          <CardDescription>
            What a new invoice line starts from. Documents already issued keep the figures they
            carried at the time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {pricing.map((row) => (
              <div key={row.label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2">
            <Badge tone={product.allowPriceOverride ? 'success' : 'neutral'}>
              {product.allowPriceOverride ? 'Price can be changed' : 'Price is fixed'}
            </Badge>
            {product.isBillableByTime ? <Badge tone="info">Billed by the hour</Badge> : null}
            {product.isFeatured ? <Badge tone="brand">Shown first</Badge> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {details.map((row) => (
              <div key={row.label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>

          {product.description === null ? null : (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Description</h3>
              <p className="whitespace-pre-line text-sm text-foreground">{product.description}</p>
            </div>
          )}

          {product.internalNotes === null ? null : (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                Internal notes
              </h3>
              <p className="whitespace-pre-line text-sm text-foreground">{product.internalNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {product.trackInventory ? (
        <Card>
          <CardHeader>
            <CardTitle>Stock</CardTitle>
            <CardDescription>
              Quantities move as invoices are issued and as stock is received.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Opening quantity
                </dt>
                <dd className="tabular text-sm text-foreground">
                  {formatNumber(Number.parseFloat(product.openingStockQuantity))}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Warn below
                </dt>
                <dd className="tabular text-sm text-foreground">
                  {product.lowStockThreshold === null
                    ? 'No warning set'
                    : formatNumber(Number.parseFloat(product.lowStockThreshold))}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
