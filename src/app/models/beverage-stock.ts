export interface MstStockItem {
  id: number;
  shopId: number;
  name: string;
  unitLabelTh: string;
  quantityOnHand: number;
  adjustNote: string | null;
  beverages?: Array<{
    id: number;
    name: string;
    category?: { id: number; name: string };
  }>;
}

export interface MstStockItemWritePayload {
  name: string;
  unitLabelTh?: string;
  quantityOnHand: number;
  adjustNote?: string | null;
}

export interface MstStockItemUpdatePayload {
  quantityOnHand: number;
  adjustNote?: string | null;
}

/** @deprecated Use MstStockItem */
export type MstBeverageStock = MstStockItem;

/** @deprecated Use MstStockItemWritePayload */
export type MstBeverageStockWritePayload = MstStockItemWritePayload;

/** @deprecated Use MstStockItemUpdatePayload */
export type MstBeverageStockUpdatePayload = MstStockItemUpdatePayload;
