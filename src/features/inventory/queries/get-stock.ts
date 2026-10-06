// src/features/inventory/queries/get-stock.ts
// Reading what is on the shelf, what it is worth and what is running out.

import type {
  LowStockRow,
  StockLevelRow,
  StockMovementRow,
  WarehouseRow,
} from '@/features/inventory/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface StockBoard {
  warehouses: readonly WarehouseRow[];
  levels: readonly StockLevelRow[];
  movements: readonly StockMovementRow[];
  lowStock: readonly LowStockRow[];
  /** What everything on hand is worth. */
  totalValue: string;
  /** True when something could not be read. */
  isDegraded: boolean;
}

/**
 * Reads the stock position of one business.
 *
 * @param companyId Business being read.
 * @returns The places, the levels, the recent movements and what is low.
 */
export async function loadStockBoard(companyId: string): Promise<StockBoard> {
  const supabase = createServerSupabaseClient();

  const [warehouses, levels, movements, lowStock] = await Promise.all([
    supabase
      .from('warehouses')
      .select('id, name, code, is_default, is_active')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('stock_levels')
      .select(
        'id, product_id, quantity_on_hand, quantity_reserved, quantity_available, average_cost, stock_value, reorder_point, products(name, sku), warehouses(name)'
      )
      .eq('company_id', companyId)
      .order('stock_value', { ascending: false })
      .limit(200),
    supabase
      .from('stock_movements')
      .select(
        'id, movement_type, quantity, unit_cost, movement_date, reference_label, notes, products(name)'
      )
      .eq('company_id', companyId)
      .order('movement_date', { ascending: false })
      .limit(50),
    supabase.rpc('low_stock_report', { p_company_id: companyId }),
  ]);

  if (warehouses.error || levels.error) {
    logger.error('The stock position could not be read', warehouses.error ?? levels.error, {
      companyId,
    });

    return {
      warehouses: [],
      levels: [],
      movements: [],
      lowStock: [],
      totalValue: '0',
      isDegraded: true,
    };
  }

  const levelRows = asRows(levels.data).map((row) => {
    const product = asRow(row['products']);
    const warehouse = asRow(row['warehouses']);

    return {
      levelId: readString(row, 'id') ?? '',
      productId: readString(row, 'product_id') ?? '',
      productName: product === null ? 'Unnamed product' : (readString(product, 'name') ?? ''),
      sku: product === null ? null : readString(product, 'sku'),
      warehouseName: warehouse === null ? 'Main' : (readString(warehouse, 'name') ?? 'Main'),
      quantityOnHand: readAmount(row, 'quantity_on_hand'),
      quantityReserved: readAmount(row, 'quantity_reserved'),
      quantityAvailable: readAmount(row, 'quantity_available'),
      averageCost: readAmount(row, 'average_cost'),
      stockValue: readAmount(row, 'stock_value'),
      reorderPoint: row['reorder_point'] === null ? null : readAmount(row, 'reorder_point'),
    };
  });

  const totalValue = levelRows
    .reduce((running, level) => running + Number.parseFloat(level.stockValue), 0)
    .toFixed(2);

  return {
    warehouses: asRows(warehouses.data).map((row) => ({
      warehouseId: readString(row, 'id') ?? '',
      name: readString(row, 'name') ?? '',
      code: readString(row, 'code'),
      isDefault: readBoolean(row, 'is_default'),
      isActive: readBoolean(row, 'is_active'),
    })),
    levels: levelRows,
    movements: asRows(movements.data).map((row) => {
      const product = asRow(row['products']);

      return {
        movementId: readString(row, 'id') ?? '',
        productName: product === null ? 'Unnamed product' : (readString(product, 'name') ?? ''),
        movementType: readString(row, 'movement_type') ?? 'adjustment_increase',
        quantity: readAmount(row, 'quantity'),
        unitCost: readAmount(row, 'unit_cost'),
        movementDate: readString(row, 'movement_date') ?? '',
        referenceLabel: readString(row, 'reference_label'),
        notes: readString(row, 'notes'),
      };
    }),
    lowStock: asRows(lowStock.data).map((row) => ({
      productId: readString(row, 'product_id') ?? '',
      productName: readString(row, 'product_name') ?? '',
      warehouseName: readString(row, 'warehouse_name') ?? '',
      quantityAvailable: readAmount(row, 'quantity_available'),
      reorderPoint: readAmount(row, 'reorder_point'),
      reorderQuantity: readAmount(row, 'reorder_quantity'),
      estimatedCost: readAmount(row, 'estimated_cost'),
    })),
    totalValue,
    isDegraded: false,
  };
}
