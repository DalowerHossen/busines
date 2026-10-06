// src/components/products/stock-console.tsx
// What is on the shelf, what it is worth, and what is about to run out.
//
// The low stock list comes first on purpose. Everything else on this screen
// is a record of the past; that list is the only part that tells somebody
// to do something today.

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
  recordStockMovement,
  saveWarehouse,
  transferStock,
} from '@/features/inventory/actions/manage-stock';
import type {
  LowStockRow,
  StockLevelRow,
  StockMovementRow,
  WarehouseRow,
} from '@/features/inventory/types';
import { MOVEMENT_TYPES } from '@/features/inventory/validation/inventory';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface StockConsoleProps {
  /** Places stock is kept. */
  warehouses: readonly WarehouseRow[];
  /** What is on hand. */
  levels: readonly StockLevelRow[];
  /** What moved recently. */
  movements: readonly StockMovementRow[];
  /** What has fallen to its reorder point. */
  lowStock: readonly LowStockRow[];
  /** What everything on hand is worth. */
  totalValue: string;
  /** Products that can be moved. */
  products: readonly { id: string; name: string }[];
  /** True when the viewer may record movements. */
  canEdit: boolean;
  /** Currency this business works in. */
  currency: string;
}

type MovementType = (typeof MOVEMENT_TYPES)[number];

const MOVEMENT_LABELS: Readonly<Record<MovementType, string>> = {
  opening_balance: 'Opening balance, what you already had',
  purchase: 'Bought in',
  sales_return: 'A client sent it back',
  purchase_return: 'Sent back to the supplier',
  adjustment_increase: 'Found more than the records said',
  adjustment_decrease: 'Found less than the records said',
  damage: 'Damaged',
  write_off: 'Written off',
};

/**
 * Renders the stock console.
 *
 * @param props Everything about the stock position.
 * @returns The rendered console.
 */
export function StockConsole({
  warehouses,
  levels,
  movements,
  lowStock,
  totalValue,
  products,
  canEdit,
  currency,
}: StockConsoleProps) {
  const router = useRouter();

  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [movementType, setMovementType] = useState<MovementType>('purchase');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.warehouseId ?? '');
  const [isRecording, setIsRecording] = useState(false);

  const [transferProduct, setTransferProduct] = useState(products[0]?.id ?? '');
  const [fromWarehouse, setFromWarehouse] = useState(warehouses[0]?.warehouseId ?? '');
  const [toWarehouse, setToWarehouse] = useState(warehouses[1]?.warehouseId ?? '');
  const [transferQuantity, setTransferQuantity] = useState('1');
  const [isTransferring, setIsTransferring] = useState(false);

  const [placeName, setPlaceName] = useState('');
  const [isSavingPlace, setIsSavingPlace] = useState(false);

  /**
   * Records one movement of stock.
   *
   * @returns Nothing.
   */
  async function onRecord(): Promise<void> {
    setIsRecording(true);

    const result = await recordStockMovement({
      productId,
      warehouseId: warehouseId === '' ? undefined : warehouseId,
      movementType,
      quantity,
      unitCost: unitCost === '' ? undefined : unitCost,
    });

    setIsRecording(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Recorded. The quantity and the average cost both moved.');
    setUnitCost('');
    router.refresh();
  }

  /**
   * Moves stock from one place to another.
   *
   * @returns Nothing.
   */
  async function onTransfer(): Promise<void> {
    setIsTransferring(true);

    const result = await transferStock({
      productId: transferProduct,
      fromWarehouseId: fromWarehouse,
      toWarehouseId: toWarehouse,
      quantity: transferQuantity,
    });

    setIsTransferring(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Moved. Both places have been updated.');
    router.refresh();
  }

  /**
   * Adds a place stock can be kept.
   *
   * @returns Nothing.
   */
  async function onSavePlace(): Promise<void> {
    setIsSavingPlace(true);
    const result = await saveWarehouse({ name: placeName, isDefault: warehouses.length === 0 });
    setIsSavingPlace(false);

    if (!result.success) {
      notify.error(result.error);

      return;
    }

    notify.success('Added.');
    setPlaceName('');
    router.refresh();
  }

  const productOptions = products.map((product) => ({ value: product.id, label: product.name }));
  const warehouseOptions = warehouses.map((warehouse) => ({
    value: warehouse.warehouseId,
    label: warehouse.name,
  }));

  return (
    <div className="space-y-6">
      {lowStock.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Running out</CardTitle>
            <CardDescription>
              These have reached the point you said to reorder at. Everything else on this page is
              history; this part is today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead isNumeric>Left</TableHead>
                  <TableHead isNumeric>Reorder at</TableHead>
                  <TableHead isNumeric>Reorder cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((row) => (
                  <TableRow key={`${row.productId}-${row.warehouseName}`}>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.warehouseName}</TableCell>
                    <TableCell isNumeric>
                      {formatNumber(Number(row.quantityAvailable), 2)}
                    </TableCell>
                    <TableCell isNumeric>{formatNumber(Number(row.reorderPoint), 2)}</TableCell>
                    <TableCell isNumeric>{formatMoney(row.estimatedCost, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>What is on hand</CardTitle>
              <CardDescription>
                Valued at average cost, which is the figure your accounts should agree with.
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total value</p>
              <p className="tabular text-2xl font-semibold">{formatMoney(totalValue, currency)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {levels.length === 0 ? (
            <EmptyState
              title="Nothing is in stock yet"
              description="Record an opening balance below for whatever you already have, and the valuation starts from there."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead isNumeric>On hand</TableHead>
                  <TableHead isNumeric>Reserved</TableHead>
                  <TableHead isNumeric>Available</TableHead>
                  <TableHead isNumeric>Average cost</TableHead>
                  <TableHead isNumeric>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((level) => (
                  <TableRow key={level.levelId}>
                    <TableCell>
                      {level.productName}
                      {level.sku === null ? '' : ` (${level.sku})`}
                    </TableCell>
                    <TableCell>{level.warehouseName}</TableCell>
                    <TableCell isNumeric>{formatNumber(Number(level.quantityOnHand), 2)}</TableCell>
                    <TableCell isNumeric>
                      {formatNumber(Number(level.quantityReserved), 2)}
                    </TableCell>
                    <TableCell isNumeric>
                      {formatNumber(Number(level.quantityAvailable), 2)}
                    </TableCell>
                    <TableCell isNumeric>{formatMoney(level.averageCost, currency)}</TableCell>
                    <TableCell isNumeric>{formatMoney(level.stockValue, currency)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={6}>TOTAL</TableCell>
                  <TableCell isNumeric>{formatMoney(totalValue, currency)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit && products.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Record a movement</CardTitle>
            <CardDescription>
              The quantity and the average cost move together, so the valuation stays true.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <FormField id="movement-product" label="Product" isRequired>
                <Select
                  id="movement-product"
                  value={productId}
                  options={productOptions}
                  onChange={(event) => setProductId(event.target.value)}
                />
              </FormField>

              <FormField id="movement-type" label="What happened" isRequired>
                <Select
                  id="movement-type"
                  value={movementType}
                  options={MOVEMENT_TYPES.map((entry) => ({
                    value: entry,
                    label: MOVEMENT_LABELS[entry],
                  }))}
                  onChange={(event) => setMovementType(event.target.value as MovementType)}
                />
              </FormField>

              <FormField id="movement-quantity" label="How many" isRequired>
                <Input
                  id="movement-quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </FormField>

              <FormField
                id="movement-cost"
                label={`Cost each (${currency})`}
                hint="Only needed when stock comes in."
              >
                <Input
                  id="movement-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                />
              </FormField>

              {warehouses.length > 0 ? (
                <FormField id="movement-place" label="Where">
                  <Select
                    id="movement-place"
                    value={warehouseId}
                    options={warehouseOptions}
                    onChange={(event) => setWarehouseId(event.target.value)}
                  />
                </FormField>
              ) : null}
            </div>

            <Button
              isLoading={isRecording}
              loadingLabel="Recording"
              onClick={() => void onRecord()}
            >
              Record this movement
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Places you keep stock</CardTitle>
          <CardDescription>
            A shop, a warehouse, a spare room. Stock can be moved between them without changing what
            it is worth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {warehouses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No place is set up yet. The first one you add becomes the default.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {warehouses.map((warehouse) => (
                <li key={warehouse.warehouseId}>
                  <Badge tone={warehouse.isDefault ? 'success' : 'neutral'}>
                    {warehouse.isDefault ? `${warehouse.name} (default)` : warehouse.name}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {canEdit ? (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <FormField id="place-name" label="Add a place" isRequired>
                <Input
                  id="place-name"
                  value={placeName}
                  onChange={(event) => setPlaceName(event.target.value)}
                />
              </FormField>

              <Button
                variant="secondary"
                isLoading={isSavingPlace}
                loadingLabel="Adding"
                onClick={() => void onSavePlace()}
              >
                Add it
              </Button>
            </div>
          ) : null}

          {canEdit && warehouses.length > 1 && products.length > 0 ? (
            <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <FormField id="transfer-product" label="Move which product">
                <Select
                  id="transfer-product"
                  value={transferProduct}
                  options={productOptions}
                  onChange={(event) => setTransferProduct(event.target.value)}
                />
              </FormField>

              <FormField id="transfer-from" label="From">
                <Select
                  id="transfer-from"
                  value={fromWarehouse}
                  options={warehouseOptions}
                  onChange={(event) => setFromWarehouse(event.target.value)}
                />
              </FormField>

              <FormField id="transfer-to" label="To">
                <Select
                  id="transfer-to"
                  value={toWarehouse}
                  options={warehouseOptions}
                  onChange={(event) => setToWarehouse(event.target.value)}
                />
              </FormField>

              <FormField id="transfer-quantity" label="How many">
                <Input
                  id="transfer-quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  value={transferQuantity}
                  onChange={(event) => setTransferQuantity(event.target.value)}
                />
              </FormField>

              <div className="sm:col-span-4">
                <Button
                  variant="secondary"
                  isLoading={isTransferring}
                  loadingLabel="Moving"
                  onClick={() => void onTransfer()}
                >
                  Move this stock
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What moved recently</CardTitle>
          <CardDescription>
            Every change to a quantity, including the ones an invoice made by itself.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has moved yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>What happened</TableHead>
                  <TableHead isNumeric>Quantity</TableHead>
                  <TableHead isNumeric>Cost each</TableHead>
                  <TableHead>Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.movementId}>
                    <TableCell>{formatDate(movement.movementDate)}</TableCell>
                    <TableCell>{movement.productName}</TableCell>
                    <TableCell>{humanise(movement.movementType)}</TableCell>
                    <TableCell isNumeric>{formatNumber(Number(movement.quantity), 2)}</TableCell>
                    <TableCell isNumeric>{formatMoney(movement.unitCost, currency)}</TableCell>
                    <TableCell>
                      {movement.referenceLabel ?? movement.notes ?? 'Not noted'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert tone="info" title="Stock moves on its own when you sell">
        Issuing an invoice for a product you track reduces the quantity and posts the cost of what
        you sold. Nothing here has to be done twice.
      </Alert>
    </div>
  );
}
