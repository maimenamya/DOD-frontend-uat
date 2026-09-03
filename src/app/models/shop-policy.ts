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
  freelanceLateDrinkTiers: { cutoffTime: string; extraShopPortionBaht: number }[];
  expectedCheckOutTime: string | null;
  expectedCheckOutNextDay: boolean;
  autoCloseCutoffTime: string | null;
  forgotCheckOutDeductionBaht: number;
  /** Shared first-login / reset password for employees at this shop. */
  employeeInitialPassword: string | null;
}

export type ShopPolicyInput = Omit<
  ShopPolicyConfig,
  'shopId' | 'expectedCheckOutTime' | 'employeeInitialPassword'
> & {
  /** Omit to leave shop legacy check-out column unchanged (staff times on roles). */
  expectedCheckOutTime?: string | null;
  employeeInitialPassword: string;
};
