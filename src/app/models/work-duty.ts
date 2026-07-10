import type { RoleCategory } from './role';
import { normalizeRoleName } from '../utils/role-display.util';

export const WORK_DUTIES = ['BARTENDER', 'CHEF', 'FLOOR_SALE', 'PR_FLOOR', 'SERVER'] as const;

export type WorkDuty = (typeof WORK_DUTIES)[number];

export const WORK_DUTY_LABEL_TH: Record<WorkDuty, string> = {
  BARTENDER: 'บาร์',
  CHEF: 'ครัว',
  FLOOR_SALE: 'เซลล์',
  PR_FLOOR: 'เด็กนั่งดริ้ง',
  SERVER: 'เซอร์วิส',
};

export const WORK_DUTY_OPTIONS = WORK_DUTIES.map((duty) => ({
  value: duty,
  label: WORK_DUTY_LABEL_TH[duty],
}));

/** พนักงาน (STAFF) — ไม่รวมเด็กนั่งดริ้ง (ผูกกับประเภท ENTERTAINER) */
export const STAFF_WORK_DUTIES = ['FLOOR_SALE', 'SERVER', 'CHEF', 'BARTENDER'] as const;
export type StaffWorkDuty = (typeof STAFF_WORK_DUTIES)[number];

export const STAFF_WORK_DUTY_OPTIONS = STAFF_WORK_DUTIES.map((duty) => ({
  value: duty,
  label: WORK_DUTY_LABEL_TH[duty],
}));

export function workDutyLabels(duties: WorkDuty[] | undefined | null): string {
  if (!duties?.length) return '—';
  return duties.map((duty) => WORK_DUTY_LABEL_TH[duty]).join(', ');
}

export function parseWorkDuties(value: unknown): WorkDuty[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<WorkDuty>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim().toUpperCase() as WorkDuty;
    if ((WORK_DUTIES as readonly string[]).includes(normalized)) {
      set.add(normalized);
    }
  }
  return [...set];
}

export function parseStaffWorkDuties(value: unknown): WorkDuty[] {
  const staffSet = new Set<string>(STAFF_WORK_DUTIES);
  return parseWorkDuties(value).filter((duty) => staffSet.has(duty));
}

export function canConfigureWorkDuties(permissionGroup: string): boolean {
  return permissionGroup !== 'OWNER' && permissionGroup !== 'MANAGER';
}

export type WorkDutyNavUser = {
  permissionGroup: string;
  role?: string | null;
  roleCategory?: RoleCategory | null;
  workDuties?: WorkDuty[] | null;
  pendingRoleSetup?: boolean;
};

/** Station queue tabs shown on the bell sidebar menu. */
export const STATION_WORK_DUTIES = ['CHEF', 'BARTENDER', 'SERVER'] as const;
export type StationWorkDuty = (typeof STATION_WORK_DUTIES)[number];

export type StationWorkTab = 'food' | 'drink' | 'pickup';

export const STATION_WORK_TAB_LABEL: Record<StationWorkTab, string> = {
  food: 'คิวครัว',
  drink: 'คิวบาร์',
  pickup: 'รับของ',
};

export const STATION_WORK_TAB_DUTY: Record<StationWorkTab, StationWorkDuty> = {
  food: 'CHEF',
  drink: 'BARTENDER',
  pickup: 'SERVER',
};

const STATION_OPS_SET = new Set<WorkDuty>(STATION_WORK_DUTIES);

/** True when this user should poll/show the in-app notification bell. */
export function receivesShopNotifications(user: WorkDutyNavUser | null | undefined): boolean {
  if (!user?.permissionGroup || user.pendingRoleSetup) return false;
  if (user.permissionGroup === 'OWNER' || user.permissionGroup === 'MANAGER') return false;
  return true;
}

/** Duties from role config, or legacy fallback from role name when unset. */
export function effectiveWorkDuties(user: WorkDutyNavUser | null | undefined): WorkDuty[] {
  if (!user) return [];
  const configured = user.workDuties ?? [];
  if (configured.length > 0) return configured;

  switch (normalizeRoleName(user.role)) {
    case 'SALE':
      return ['FLOOR_SALE'];
    case 'PR':
      return ['PR_FLOOR'];
    case 'SERVICE':
      return ['SERVER'];
    case 'BARTENDER':
      return ['BARTENDER'];
    default:
      return [];
  }
}

export function hasWorkDuty(
  user: WorkDutyNavUser | null | undefined,
  duty: WorkDuty,
): boolean {
  if (!user || !receivesShopNotifications(user)) return false;
  return effectiveWorkDuties(user).includes(duty);
}

export function isStationOpsOnlyUser(user: WorkDutyNavUser | null | undefined): boolean {
  const duties = effectiveWorkDuties(user);
  if (duties.length === 0) return false;
  return duties.every((duty) => STATION_OPS_SET.has(duty));
}

export function stationWorkTabsFromDuties(duties: WorkDuty[]): StationWorkTab[] {
  const set = new Set(duties);
  const tabs: StationWorkTab[] = [];
  if (set.has('CHEF')) tabs.push('food');
  if (set.has('BARTENDER')) tabs.push('drink');
  if (set.has('SERVER')) tabs.push('pickup');
  return tabs;
}

export function stationWorkTabsForUser(
  user: WorkDutyNavUser | null | undefined,
): StationWorkTab[] {
  if (!user || !receivesShopNotifications(user)) return [];
  return stationWorkTabsFromDuties(effectiveWorkDuties(user));
}

/** คิวงาน — ครัว/บาร์/เซอร์วิส only; เซลล์และเด็กนั่งดริ้งไม่เห็น */
export function hasStationWorkMenu(user: WorkDutyNavUser | null | undefined): boolean {
  if (!user || !receivesShopNotifications(user)) return false;
  const duties = effectiveWorkDuties(user);
  if (duties.includes('FLOOR_SALE') || duties.includes('PR_FLOOR')) return false;
  return stationWorkTabsFromDuties(duties).length > 0;
}

/** แดชบอร์ด — ซ่อนสำหรับครัว/บาร์/เซอร์วิสล้วน */
export function showDashboardNav(user: WorkDutyNavUser | null | undefined): boolean {
  if (!user || user.pendingRoleSetup) return false;
  const group = user.permissionGroup;
  if (group === 'OWNER' || group === 'MANAGER' || group === 'CASHIER') return true;
  if (group === 'EMPLOYEE' && isStationOpsOnlyUser(user)) return false;
  return group === 'EMPLOYEE';
}

/** บิลของฉัน — เซลล์เท่านั้น; ไม่ให้เด็กนั่งดริ้งและทีมครัว/บาร์/เซอร์วิส */
export function showMyBillsNav(user: WorkDutyNavUser | null | undefined): boolean {
  if (!user || user.permissionGroup !== 'EMPLOYEE' || user.pendingRoleSetup) return false;
  if (isStationOpsOnlyUser(user)) return false;

  const duties = effectiveWorkDuties(user);
  if (duties.includes('PR_FLOOR') && !duties.includes('FLOOR_SALE')) return false;
  if (duties.includes('FLOOR_SALE')) return true;
  if (normalizeRoleName(user.role) === 'SALE') return true;

  return false;
}

/** หน้าแรกหลังล็อกอิน */
export function homeRouteSegmentsForUser(
  user: WorkDutyNavUser | null | undefined,
): string[] {
  if (user && isStationOpsOnlyUser(user)) {
    const tabs = stationWorkTabsForUser(user);
    if (tabs.length > 0) {
      return ['/dashboard/station-work', tabs[0]];
    }
    return ['/dashboard/attendance'];
  }
  return ['/dashboard'];
}
