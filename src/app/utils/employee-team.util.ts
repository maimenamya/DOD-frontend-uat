import type { EmployeeTeam } from '../models/employee';
import type { EmployeeRole } from '../models/role';

/** Maps API role name to legacy `team` param required by employee create API. */
export function teamForRole(roleName: string): EmployeeTeam {
  const normalized = roleName.toUpperCase();
  if (normalized === 'SALE') return 'sale';
  if (normalized === 'PR') return 'pr';
  if (normalized === 'ADMIN' || normalized === 'MANAGER') return 'managers';
  return 'sale';
}

export function isRoleMutableByViewer(
  targetRoleName: string | undefined,
  viewerIsOwner: boolean,
  viewerCanManage: boolean,
): boolean {
  if (!targetRoleName || targetRoleName === 'OWNER') {
    return false;
  }
  if (viewerIsOwner) {
    return targetRoleName === 'ADMIN' || targetRoleName === 'MANAGER' || targetRoleName === 'SALE' || targetRoleName === 'PR';
  }
  if (!viewerCanManage) {
    return false;
  }
  return targetRoleName === 'SALE' || targetRoleName === 'PR';
}

export const ROLE_LABEL_TH: Record<string, string> = {
  OWNER: 'เจ้าของร้าน',
  ADMIN: 'ผู้ดูแลระบบ',
  MANAGER: 'ผู้จัดการ',
  SALE: 'เซลส์',
  PR: 'พีอาร์',
};

export function roleLabelThai(roleName: string): string {
  return ROLE_LABEL_TH[roleName.toUpperCase()] ?? roleName;
}
