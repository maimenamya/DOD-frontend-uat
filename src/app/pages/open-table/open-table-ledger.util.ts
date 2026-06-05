import type { MstRole } from '../../models/role';

/** Top-level order ledger tabs (maps to master DB models). */
export type OrderLedgerCategory =
  | 'FOOD'
  | 'BEVERAGE'
  | 'COCKTAIL'
  | 'PRO_MEMBER'
  | 'OTHER';

export const ORDER_LEDGER_CATEGORY_VALUES: readonly OrderLedgerCategory[] = [
  'FOOD',
  'BEVERAGE',
  'COCKTAIL',
  'PRO_MEMBER',
  'OTHER',
];

export const ORDER_LEDGER_CATEGORY_LABELS: Record<OrderLedgerCategory, string> = {
  FOOD: 'อาหาร',
  BEVERAGE: 'เครื่องดื่ม',
  COCKTAIL: 'ค็อกเทล',
  PRO_MEMBER: 'โปร/เมมเบอร์',
  OTHER: 'อื่นๆ',
};

/** Dropdown value: `P:{promoId}` or `M:{membershipId}`. */
export type ProMemberLedgerKey = `P:${number}` | `M:${number}`;

export function proMemberLedgerKey(
  kind: 'PROMOTION' | 'MEMBERSHIP',
  id: number,
): ProMemberLedgerKey {
  return kind === 'PROMOTION' ? `P:${id}` : `M:${id}`;
}

export function parseProMemberLedgerKey(
  key: string | null | undefined,
): { kind: 'PROMOTION' | 'MEMBERSHIP'; id: number } | null {
  if (!key) return null;
  const match = /^([PM]):(\d+)$/.exec(key);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isFinite(id)) return null;
  return match[1] === 'P'
    ? { kind: 'PROMOTION', id }
    : { kind: 'MEMBERSHIP', id };
}

export type SessionOrderItemType =
  | 'FOOD'
  | 'DRINK'
  | 'COCKTAIL'
  | 'PROMOTION'
  | 'MEMBERSHIP'
  | 'OTHER';

export function sessionItemTypeForLedgerCategory(
  category: OrderLedgerCategory,
): SessionOrderItemType | null {
  switch (category) {
    case 'FOOD':
      return 'FOOD';
    case 'PRO_MEMBER':
      return null;
    case 'OTHER':
      return 'OTHER';
    default:
      return null;
  }
}

export function isFixedDrinkStaffRole(role: Pick<MstRole, 'category'>): boolean {
  return role.category === 'STAFF';
}

const ENTERTAINER_ROLE_NAMES = new Set(['PR', 'CO', 'MODEL']);

export function isEntertainmentStaffRole(
  role: Pick<MstRole, 'category' | 'name'>,
): boolean {
  if (role.category === 'ENTERTAINER') return true;
  return ENTERTAINER_ROLE_NAMES.has(role.name.toUpperCase());
}

const SHOP_TIMEZONE = 'Asia/Bangkok';

/** Today `YYYY-MM-DD` in shop calendar (Asia/Bangkok) — for date inputs, not browser local TZ. */
export function shopCalendarTodayInput(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIMEZONE }).format(new Date());
}

/** Current shop wall clock for datetime pickers (Asia/Bangkok). */
export function currentDatetimeLocalValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}

/** Send wall-clock string to API; backend stores shop time (do not use toISOString). */
export function isValidShopDatetimeLocal(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value.trim());
}

export type ShopDatetimeLocalParts = {
  datePart: string;
  hour: string;
  minute: string;
};

export function splitShopDatetimeLocal(value: string): ShopDatetimeLocalParts {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (match) {
    return { datePart: match[1], hour: match[2], minute: match[3] };
  }
  return splitShopDatetimeLocal(currentDatetimeLocalValue());
}

export function joinShopDatetimeLocal(
  datePart: string,
  hour: string,
  minute: string,
): string {
  const h = hour.padStart(2, '0').slice(-2);
  const m = minute.padStart(2, '0').slice(-2);
  return `${datePart}T${h}:${m}`;
}

/** Up to 2 digits while typing (hour/minute fields). */
export function sanitizeShopTimePartInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 2);
}

export function clampShopHourPart(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '00';
  const n = Math.min(23, Math.max(0, Number.parseInt(digits, 10)));
  return String(n).padStart(2, '0');
}

export function clampShopMinutePart(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '00';
  const n = Math.min(59, Math.max(0, Number.parseInt(digits, 10)));
  return String(n).padStart(2, '0');
}
