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
  expectedCheckOutTime: string | null;
  expectedCheckOutNextDay: boolean;
  /** บาท/ดื่มที่หักเข้าร้าน */
  drinkShopPortionBaht: number;
}

export type ShopPolicyInput = Omit<ShopPolicyConfig, 'shopId'>;
