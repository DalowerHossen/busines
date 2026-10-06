// src/features/inventory/types.ts
// The shapes the stock screens work with.

export interface WarehouseRow {
  warehouseId: string;
  name: string;
  code: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface StockLevelRow {
  levelId: string;
  productId: string;
  productName: string;
  sku: string | null;
  warehouseName: string;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  averageCost: string;
  stockValue: string;
  reorderPoint: string | null;
}

export interface StockMovementRow {
  movementId: string;
  productName: string;
  movementType: string;
  quantity: string;
  unitCost: string;
  movementDate: string;
  referenceLabel: string | null;
  notes: string | null;
}

export interface LowStockRow {
  productId: string;
  productName: string;
  warehouseName: string;
  quantityAvailable: string;
  reorderPoint: string;
  reorderQuantity: string;
  estimatedCost: string;
}
