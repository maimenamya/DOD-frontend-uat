export type ShopSeatDrinkRounding = 'FLOOR' | 'CEIL';

export interface ShopPolicyConfig {
  shopId: number;
  seatDrinkTier15Drinks: number;
  seatDrinkTier30Drinks: number;
  seatDrinkTier45Drinks: number;
  seatDrinkRounding: ShopSeatDrinkRounding;
  lateFinePerMinuteBaht: number;
  absenceDeductionBaht: number;
  expectedCheckInTime: string | null;
  expectedOnFloorTime: string | null;
  freelanceLateDrinkCutoffTime: string | null;
  freelanceLateDrinkExtraShopPortionBaht: number;
  expectedCheckOutTime: string | null;
  expectedCheckOutNextDay: boolean;
  autoCloseCutoffTime: string | null;
  forgotCheckOutDeductionBaht: number;
}

export type ShopPolicyInput = Omit<ShopPolicyConfig, 'shopId'>;
