/** API may return legacy kinds (BEER/LIQUOR/OTHER) — treat as sale unless MIXER. */
export type BeverageCategoryKind = 'MIXER' | 'SALE' | 'BEER' | 'LIQUOR' | 'OTHER';

export interface MstBeverageCategory {
  id: number;
  name: string;
  kind: BeverageCategoryKind;
  shopId: number;
  createdAt: string;
}

export interface MstBeverage {
  id: number;
  name: string;
  price: number;
  unitLabelTh: string;
  categoryId: number;
  canReturn: boolean;
  stockItemId?: number | null;
  createdAt: string;
  category?: MstBeverageCategory;
  stockItem?: {
    id: number;
    name: string;
    unitLabelTh: string;
    quantityOnHand: number;
  } | null;
}

export interface MstBeverageCreatePayload {
  name: string;
  price: number;
  categoryId: number;
  unitLabelTh?: string;
  canReturn?: boolean;
  stockItemId?: number | null;
}

export interface MstBeverageUpdatePayload {
  name?: string;
  price?: number;
  categoryId?: number;
  unitLabelTh?: string;
  canReturn?: boolean;
  stockItemId?: number | null;
}

export interface MstBeverageCategoryCreatePayload {
  name: string;
  isMixer: boolean;
}

export interface MstBeverageCategoryUpdatePayload {
  name?: string;
  isMixer?: boolean;
}
