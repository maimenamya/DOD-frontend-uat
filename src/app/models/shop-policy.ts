export type ShopSeatDrinkRounding = 'FLOOR' | 'CEIL';

export interface ShopPolicyConfig {
  shopId: number;
  seatDrinkTier15Drinks: number;
  seatDrinkTier30Drinks: number;
  seatDrinkTier45Drinks: number;
  seatDrinkRounding: ShopSeatDrinkRounding;
  lateFinePerMinuteBaht: number;
  absenceDeductionBaht: number;
}

export type ShopPolicyInput = Omit<ShopPolicyConfig, 'shopId'>;
