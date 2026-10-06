// src/features/inventory/actions/manage-stock.ts
// Receiving stock, moving it between places and writing off what broke.
//
// Every change to a quantity goes through the database routine rather than
// a direct update, because the average cost has to be recalculated at the
// same moment. A quantity edited on its own leaves the valuation wrong, and
// a wrong valuation is wrong in the accounts as well.

'use server';

import { revalidatePath } from 'next/cache';

import {
  recordMovementSchema,
  saveWarehouseSchema,
  transferStockSchema,
} from '@/features/inventory/validation/inventory';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the stock screens live, for cache invalidation. */
const STOCK_PATH = '/dashboard/products/stock';

export interface MovementResult {
  /** Identifier of the movement that was recorded. */
  movementId: string;
}

export const recordStockMovement = createAction(
  recordMovementSchema,
  async (input): Promise<MovementResult> => {
    const { company } = await requirePermission('products', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('record_stock_movement', {
      p_product_id: input.productId,
      p_movement_type: input.movementType,
      p_quantity: input.quantity,
      p_unit_cost: input.unitCost ?? null,
      p_warehouse_id: input.warehouseId ?? null,
      p_reference_type: 'manual',
      p_reference_id: null,
      p_reference_label: 'Recorded by hand',
      p_movement_date: input.movementDate ?? null,
      p_notes: input.notes ?? null,
    });

    if (error) {
      logger.error('A stock movement could not be recorded', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That movement could not be recorded. Check there is enough stock to take it out.'
      );
    }

    const movementId = typeof data === 'string' ? data : null;

    if (movementId === null) {
      throw new AppError('database_failure', 'It was recorded but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'stock_movement',
      entityId: movementId,
      companyId: company.id,
      description: `Stock movement recorded: ${input.movementType}.`,
      metadata: { quantity: input.quantity, movement_type: input.movementType },
    });

    revalidatePath(STOCK_PATH);

    return { movementId };
  },
  { name: 'recordStockMovement' }
);

export interface TransferResult {
  /** Identifier of the pair of movements that were written. */
  transferId: string;
}

export const transferStock = createAction(
  transferStockSchema,
  async (input): Promise<TransferResult> => {
    const { company } = await requirePermission('products', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('transfer_stock', {
      p_product_id: input.productId,
      p_from_warehouse_id: input.fromWarehouseId,
      p_to_warehouse_id: input.toWarehouseId,
      p_quantity: input.quantity,
      p_notes: input.notes ?? null,
    });

    if (error) {
      logger.error('Stock could not be transferred', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That transfer could not be made. Check there is enough stock where it is coming from.'
      );
    }

    const transferId = typeof data === 'string' ? data : null;

    if (transferId === null) {
      throw new AppError('database_failure', 'It was moved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'stock_movement',
      entityId: transferId,
      companyId: company.id,
      description: 'Stock transferred between two places.',
    });

    revalidatePath(STOCK_PATH);

    return { transferId };
  },
  { name: 'transferStock' }
);

export interface WarehouseResult {
  /** Identifier of the place. */
  warehouseId: string;
}

export const saveWarehouse = createAction(
  saveWarehouseSchema,
  async (input): Promise<WarehouseResult> => {
    const { company } = await requirePermission('products', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const values = {
      company_id: company.id,
      name: input.name,
      code: input.code ?? null,
      is_default: input.isDefault,
    };

    if (input.warehouseId === undefined) {
      const { data, error } = await supabase
        .from('warehouses')
        .insert(values)
        .select('id')
        .maybeSingle();

      if (error || data === null) {
        logger.error('A warehouse could not be created', error, { companyId: company.id });

        throw new AppError('database_failure', 'That place could not be added.');
      }

      const warehouseId = typeof data.id === 'string' ? data.id : '';

      await recordAuditEntry({
        action: 'insert',
        entityType: 'warehouse',
        entityId: warehouseId,
        companyId: company.id,
        description: `Stock location ${input.name} added.`,
      });

      revalidatePath(STOCK_PATH);

      return { warehouseId };
    }

    const { error } = await supabase
      .from('warehouses')
      .update(values)
      .eq('id', input.warehouseId)
      .eq('company_id', company.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A warehouse could not be changed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That place could not be changed.');
    }

    revalidatePath(STOCK_PATH);

    return { warehouseId: input.warehouseId };
  },
  { name: 'saveWarehouse' }
);
