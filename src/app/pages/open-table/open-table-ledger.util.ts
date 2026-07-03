import type { MstRole } from '../../models/role';

/** Top-level order ledger tabs (maps to master DB models). */
export type OrderLedgerCategory =
  | 'FOOD'
  | 'BEVERAGE'
  | 'COCKTAIL'
  | 'PROMOTION'
  | 'MEMBER'
  | 'OTHER'
  | 'TABLE_OPENING';

export const ORDER_LEDGER_CATEGORY_VALUES: readonly OrderLedgerCategory[] = [
  'FOOD',
  'BEVERAGE',
  'COCKTAIL',
  'PROMOTION',
  'MEMBER',
  'OTHER',
  'TABLE_OPENING',
];

export const ORDER_LEDGER_CATEGORY_LABELS: Record<OrderLedgerCategory, string> = {
  FOOD: 'อาหาร',
  BEVERAGE: 'เครื่องดื่ม',
  COCKTAIL: 'ค็อกเทล',
  PROMOTION: 'โปร',
  MEMBER: 'เมมเบอร์',
  OTHER: 'เบ็ดเตล็ด',
  TABLE_OPENING: 'ค่าเปิดโต๊ะ',
};

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
    case 'PROMOTION':
      return 'PROMOTION';
    case 'MEMBER':
      return 'MEMBERSHIP';
    case 'OTHER':
    case 'TABLE_OPENING':
      return 'OTHER';
    default:
      return null;
  }
}

export type StaffLedgerEntryMode = 'REGULAR' | 'OFF_DUTY_PURCHASE';

export const STAFF_LEDGER_ENTRY_MODE_OPTIONS: {
  value: StaffLedgerEntryMode;
  label: string;
}[] = [
  { value: 'REGULAR', label: 'ลงดื่ม' },
  { value: 'OFF_DUTY_PURCHASE', label: 'ซื้อดื่มหยุด' },
];

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

/** `YYYY-MM-DD` shop calendar date string (date-only inputs). */
export function isValidShopDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Display shop date as `DD/MM/BBBB` (พ.ศ.) for operators. ISO value stays ค.ศ. */
export function formatShopDateLabelBe(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  const yearBe = Number(match[1]) + 543;
  return `${match[3]}/${match[2]}/${yearBe}`;
}

/** Display shop datetime as `DD/MM/BBBB HH:mm` (พ.ศ.). */
export function formatShopDatetimeLabelBe(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  return `${formatShopDateLabelBe(match[1])} ${match[2]}:${match[3]}`;
}

/** @deprecated Use formatShopDateLabelBe */
export const formatShopDateLabel = formatShopDateLabelBe;

/** Parse `YYYY-MM-DD` for flatpickr — UTC wall-clock noon avoids device TZ day/year shift. */
export function shopDateInputToLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0),
  );
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
  const hourRaw =
    parts.find((p) => p.type === 'hour' || String(p.type) === 'hour23')?.value ?? '00';
  const hourNum = Math.min(23, Math.max(0, parseInt(hourRaw, 10) || 0));
  const hour = String(hourNum).padStart(2, '0');
  const minute = pick('minute').padStart(2, '0').slice(-2);
  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${minute}`;
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
