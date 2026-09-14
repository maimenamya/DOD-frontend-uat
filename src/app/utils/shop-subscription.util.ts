/**
 * Keep in sync with backend/src/policies/shop-subscription.policy.ts
 * Grace = 5 calendar days after subscriptionExpiresOn (inclusive).
 */
export const SUBSCRIPTION_GRACE_DAYS = 5;

export type ShopSubscriptionAccess = 'unlimited' | 'active' | 'grace' | 'locked';

export type ShopSubscriptionFields = {
  subscriptionExpiresOn: string | null;
  subscriptionAccess: ShopSubscriptionAccess;
  subscriptionGraceEndsOn: string | null;
  subscriptionGraceDaysRemaining: number | null;
};

export function normalizeShopSubscriptionAccess(
  value: string | null | undefined,
): ShopSubscriptionAccess {
  if (
    value === 'unlimited' ||
    value === 'active' ||
    value === 'grace' ||
    value === 'locked'
  ) {
    return value;
  }
  return 'unlimited';
}

export function emptySubscriptionFields(): ShopSubscriptionFields {
  return {
    subscriptionExpiresOn: null,
    subscriptionAccess: 'unlimited',
    subscriptionGraceEndsOn: null,
    subscriptionGraceDaysRemaining: null,
  };
}

export function normalizeSubscriptionFields(
  shop: Partial<ShopSubscriptionFields> | null | undefined,
): ShopSubscriptionFields {
  return {
    subscriptionExpiresOn: shop?.subscriptionExpiresOn?.trim() || null,
    subscriptionAccess: normalizeShopSubscriptionAccess(shop?.subscriptionAccess),
    subscriptionGraceEndsOn: shop?.subscriptionGraceEndsOn?.trim() || null,
    subscriptionGraceDaysRemaining:
      typeof shop?.subscriptionGraceDaysRemaining === 'number'
        ? shop.subscriptionGraceDaysRemaining
        : null,
  };
}

export function isShopSubscriptionLocked(
  access: ShopSubscriptionAccess | null | undefined,
): boolean {
  return access === 'locked';
}

export function isShopSubscriptionInGrace(
  access: ShopSubscriptionAccess | null | undefined,
): boolean {
  return access === 'grace';
}
