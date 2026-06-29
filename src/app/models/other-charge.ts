export type OtherChargeGroup = 'MISCELLANEOUS' | 'TABLE_OPENING';

export const OTHER_CHARGE_GROUP_LABELS: Record<OtherChargeGroup, string> = {
  MISCELLANEOUS: 'เบ็ดเตล็ด',
  TABLE_OPENING: 'ค่าเปิดโต๊ะ',
};

export interface MstOtherCharge {
  id: number;
  name: string;
  price: number;
  unitLabelTh: string;
  isActive: boolean;
  chargeGroup: OtherChargeGroup;
  createdAt: string;
}

export interface MstOtherChargeWritePayload {
  name: string;
  price: number;
  unitLabelTh?: string;
  isActive?: boolean;
  chargeGroup?: OtherChargeGroup;
}

export function isTableOpeningOtherCharge(
  row: Pick<MstOtherCharge, 'chargeGroup'>,
): boolean {
  return row.chargeGroup === 'TABLE_OPENING';
}

export function isMiscOtherCharge(row: Pick<MstOtherCharge, 'chargeGroup'>): boolean {
  return row.chargeGroup !== 'TABLE_OPENING';
}
