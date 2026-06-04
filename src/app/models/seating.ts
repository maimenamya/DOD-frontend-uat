export type SeatingRateType = 'HOURLY' | 'FLAT_RATE' | 'NONE';

export interface MstSeatingType {
  id: number;
  shopId: number;
  name: string;
  code: string;
  description: string | null;
  rateType: SeatingRateType;
  basePrice: number;
  minimumSpend: number;
  createdAt: string;
  updatedAt: string;
}

export interface MstSeatingTypeSummary {
  id: number;
  name: string;
  code: string;
  rateType: SeatingRateType;
}

export interface MstSeating {
  id: number;
  shopId: number;
  code: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'AWAITING_CLEAR';
  seatingTypeId: number;
  chargesRoomFee: boolean;
  createdAt: string;
  seatingType?: MstSeatingTypeSummary;
}

export interface MstSeatingWritePayload {
  code: string;
  seatingTypeId: number;
  chargesRoomFee?: boolean;
}

export interface MstSeatingTypeWritePayload {
  name: string;
  code: string;
  description?: string | null;
  rateType?: SeatingRateType;
  basePrice?: number;
  minimumSpend?: number;
}
