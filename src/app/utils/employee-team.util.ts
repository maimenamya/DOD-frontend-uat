import type { EmployeeTeam } from '../models/employee';
import type { MstRole, RoleCategory } from '../models/role';

/** Maps role (name + category from master) to legacy `team` param for employee API. */
export function teamForRole(role: Pick<MstRole, 'name' | 'category'>): EmployeeTeam {
  const normalized = role.name.toUpperCase();
  if (normalized === 'SALE') return 'sale';
  if (normalized === 'PR') return 'pr';
  if (normalized === 'ADMIN' || normalized === 'MANAGER') return 'managers';
  if (role.category === 'ENTERTAINER') return 'pr';
  return 'sale';
}

/** @deprecated Prefer teamForRole with category. */
export function teamForRoleName(roleName: string, category?: RoleCategory): EmployeeTeam {
  return teamForRole({ name: roleName, category: category ?? 'STAFF' });
}

export function isRoleMutableByViewer(
  targetRole: Pick<MstRole, 'name' | 'category'> | string | undefined,
  viewerIsOwner: boolean,
  viewerCanManage: boolean,
): boolean {
  const name = typeof targetRole === 'string' ? targetRole : targetRole?.name;
  if (!name || name === 'OWNER') {
    return false;
  }
  if (name === 'ADMIN' || name === 'MANAGER') {
    return viewerIsOwner;
  }
  if (viewerIsOwner) {
    return true;
  }
  if (!viewerCanManage) {
    return false;
  }
  return name === 'SALE' || name === 'PR' || typeof targetRole !== 'string';
}

export {
  roleBadgeClass,
  roleDisplayNameEn,
  roleDisplayNameTh,
  roleLabelThai,
  roleOptionLabel,
  compareRolesByThaiLabel,
} from './role-display.util';
