export interface MstOtherCharge {
  id: number;
  name: string;
  price: number;
  unitLabelTh: string;
  isActive: boolean;
  createdAt: string;
}

export interface MstOtherChargeWritePayload {
  name: string;
  price: number;
  unitLabelTh?: string;
  isActive?: boolean;
}
