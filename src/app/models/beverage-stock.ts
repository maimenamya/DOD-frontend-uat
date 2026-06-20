import type { MstBeverageCategory } from './beverage';

export interface MstBeverageStock {
  id: number;
  shopId: number;
  beverageId: number;
  quantityOnHand: number;
  adjustNote: string | null;
  beverage: {
    id: number;
    name: string;
    unitLabelTh: string;
    category: Pick<MstBeverageCategory, 'id' | 'name' | 'kind'>;
  };
}

export interface MstBeverageStockWritePayload {
  beverageId: number;
  quantityOnHand: number;
  adjustNote?: string | null;
}

export interface MstBeverageStockUpdatePayload {
  quantityOnHand: number;
  adjustNote?: string | null;
}
