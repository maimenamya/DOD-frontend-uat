import type { EmployeeTeam } from '../models/employee';
import type { MstRole, RoleCategory } from '../models/role';
import type { PermissionGroup } from '../models/permission-group';
import { canMutateEmployeeWithRoleGroup } from './permission-group.util';

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
  targetRole: Pick<MstRole, 'name' | 'category' | 'permissionGroup'> | string | undefined,
  viewerPermissionGroup: PermissionGroup | null,
): boolean {
  if (!viewerPermissionGroup) {
    return false;
  }
  if (typeof targetRole === 'string' || !targetRole?.permissionGroup) {
    const name = typeof targetRole === 'string' ? targetRole : targetRole?.name;
    if (!name) return false;
    if (name.toUpperCase() === 'OWNER') {
      return viewerPermissionGroup === 'OWNER';
    }
    return canMutateEmployeeWithRoleGroup(viewerPermissionGroup, 'EMPLOYEE');
  }
  return canMutateEmployeeWithRoleGroup(viewerPermissionGroup, targetRole.permissionGroup);
}

export {
  roleBadgeClass,
  roleDisplayNameEn,
  roleDisplayNameTh,
  roleLabelThai,
  roleOptionLabel,
  compareRolesByThaiLabel,
} from './role-display.util';
