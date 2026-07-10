export const WORK_DUTIES = ['BARTENDER', 'CHEF', 'FLOOR_SALE', 'PR_FLOOR', 'SERVER'] as const;

export type WorkDuty = (typeof WORK_DUTIES)[number];

export const WORK_DUTY_LABEL_TH: Record<WorkDuty, string> = {
  BARTENDER: 'บาร์น้ำ',
  CHEF: 'ครัว',
  FLOOR_SALE: 'เซล / พื้นที่',
  PR_FLOOR: 'พีอาร์เดินคิว',
  SERVER: 'เสิร์ฟ / รับของ',
};

export const WORK_DUTY_OPTIONS = WORK_DUTIES.map((duty) => ({
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

export function canConfigureWorkDuties(permissionGroup: string): boolean {
  return permissionGroup !== 'OWNER' && permissionGroup !== 'MANAGER';
}

/** True when this user should poll/show the in-app notification bell. */
export function receivesShopNotifications(user: {
  permissionGroup: string;
  workDuties?: WorkDuty[] | null;
  pendingRoleSetup?: boolean;
}): boolean {
  if (user.pendingRoleSetup) return false;
  if (user.permissionGroup === 'OWNER' || user.permissionGroup === 'MANAGER') return false;
  return true;
}

export function hasWorkDuty(
  user: {
    permissionGroup: string;
    workDuties?: WorkDuty[] | null;
    pendingRoleSetup?: boolean;
  } | null | undefined,
  duty: WorkDuty,
): boolean {
  if (!user || !receivesShopNotifications(user)) return false;
  return (user.workDuties ?? []).includes(duty);
}
