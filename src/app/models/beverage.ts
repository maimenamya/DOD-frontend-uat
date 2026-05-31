export interface MstBeverage {
  id: number;
  name: string;
  price: number;
  unitLabelTh: string;
  isMixer: boolean;
  canReturn: boolean;
  createdAt: string;
}

export interface MstBeverageCreatePayload {
  name: string;
  price: number;
  unitLabelTh?: string;
  isMixer?: boolean;
  canReturn?: boolean;
}

export interface MstBeverageUpdatePayload {
  name?: string;
  price?: number;
  unitLabelTh?: string;
  isMixer?: boolean;
  canReturn?: boolean;
}
