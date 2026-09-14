/**
 * Keep in sync with backend/src/policies/shop-plan.policy.ts
 * and docs/PRICING_PACKAGES.md
 *
 * Prefer named `shopPlanAllows*` helpers so each feature’s minimum plan is obvious.
 */
export type ShopSubscriptionPlan = 'BASIC' | 'STANDARD' | 'PRO';

export type ShopPlanFeature =
  | 'stock'
  | 'package_deposits'
  | 'attendance'
  | 'pr_tag'
  | 'drink_payout'
  | 'guest_order'
  | 'station_noti';

const PLAN_RANK: Record<ShopSubscriptionPlan, number> = {
  BASIC: 1,
  STANDARD: 2,
  PRO: 3,
};

function planAtLeast(
  plan: ShopSubscriptionPlan,
  minimum: ShopSubscriptionPlan,
): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum];
}

export function normalizeShopSubscriptionPlan(
  value: string | null | undefined,
): ShopSubscriptionPlan {
  if (value === 'BASIC' || value === 'STANDARD' || value === 'PRO') return value;
  return 'BASIC';
}

/** สต๊อกเครื่องดื่ม — Standard / Pro */
export function shopPlanAllowsStock(plan: ShopSubscriptionPlan): boolean {
  return planAtLeast(plan, 'STANDARD');
}

/** ฝากเมม / โปร — Standard / Pro */
export function shopPlanAllowsPackageDeposits(plan: ShopSubscriptionPlan): boolean {
  return planAtLeast(plan, 'STANDARD');
}

/** ลงเวลา — Standard / Pro */
export function shopPlanAllowsAttendance(plan: ShopSubscriptionPlan): boolean {
  return planAtLeast(plan, 'STANDARD');
}

/** แท็ก PR — Pro */
export function shopPlanAllowsPrTag(plan: ShopSubscriptionPlan): boolean {
  return planAtLeast(plan, 'PRO');
}

/** จ่ายค่าดื่ม PR — Pro */
export function shopPlanAllowsDrinkPayout(plan: ShopSubscriptionPlan): boolean {
  return planAtLeast(plan, 'PRO');
}

/** QR สั่งอาหาร — Pro */
export function shopPlanAllowsGuestOrder(plan: ShopSubscriptionPlan): boolean {
  return planAtLeast(plan, 'PRO');
}

/** แจ้งเตือน / คิวสถานี — Pro */
export function shopPlanAllowsStationNoti(plan: ShopSubscriptionPlan): boolean {
  return planAtLeast(plan, 'PRO');
}

export function shopPlanHasFeature(
  plan: ShopSubscriptionPlan,
  feature: ShopPlanFeature,
): boolean {
  switch (feature) {
    case 'stock':
      return shopPlanAllowsStock(plan);
    case 'package_deposits':
      return shopPlanAllowsPackageDeposits(plan);
    case 'attendance':
      return shopPlanAllowsAttendance(plan);
    case 'pr_tag':
      return shopPlanAllowsPrTag(plan);
    case 'drink_payout':
      return shopPlanAllowsDrinkPayout(plan);
    case 'guest_order':
      return shopPlanAllowsGuestOrder(plan);
    case 'station_noti':
      return shopPlanAllowsStationNoti(plan);
    default:
      return false;
  }
}
