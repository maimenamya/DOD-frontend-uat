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
  createdAt: string;
  category?: MstBeverageCategory;
}

export interface MstBeverageCreatePayload {
  name: string;
  price: number;
  categoryId: number;
  unitLabelTh?: string;
  canReturn?: boolean;
}

export interface MstBeverageUpdatePayload {
  name?: string;
  price?: number;
  categoryId?: number;
  unitLabelTh?: string;
  canReturn?: boolean;
}

export interface MstBeverageCategoryCreatePayload {
  name: string;
}

export interface MstBeverageCategoryUpdatePayload {
  name?: string;
}
