import type { PermissionGroup } from '../models/permission-group';
import type { RoleCategory } from '../models/role';
import { normalizeRoleName } from './role-display.util';

/**
 * หลักสิทธิ์ UI: ใครเข้าหน้าได้จาก `permissionGuard(feature)` ต้องทำงานบนหน้านั้นได้ด้วย
 * (`hasFeature(feature)` สำหรับปุ่มบันทึก/แก้ไข/ลบ — ห้ามใช้ canAccessTeamManagement แยกต่างหาก)
 */

export type AppFeature =
  | 'dashboard'
  | 'open_table'
  | 'pr_tag_operations'
  | 'reports'
  | 'daily_expenses'
  | 'manage_employees'
  | 'manage_roles'
  | 'master_data';

export function hasFeature(group: PermissionGroup, feature: AppFeature): boolean {
  switch (group) {
    case 'OWNER':
      return true;
    case 'MANAGER':
      return true;
    case 'CASHIER':
      return true;
    case 'EMPLOYEE':
      return feature === 'dashboard';
    default:
      return false;
  }
}

export function usesSelfOnlyDashboard(group: PermissionGroup): boolean {
  return group === 'EMPLOYEE';
}

/** Sale (EMPLOYEE) may open read-only self-bill view on open-table page. */
export function openTableSelfBillOnly(
  group: PermissionGroup,
  roleName: string | null | undefined,
  roleCategory?: RoleCategory | null,
): boolean {
  if (group !== 'EMPLOYEE') {
    return false;
  }
  if (roleCategory === 'ENTERTAINER') {
    return false;
  }
  return normalizeRoleName(roleName) === 'SALE';
}

export function canAccessOpenTablePage(
  group: PermissionGroup,
  roleName: string | null | undefined,
  roleCategory?: RoleCategory | null,
): boolean {
  return hasFeature(group, 'open_table') || openTableSelfBillOnly(group, roleName, roleCategory);
}

export function canManageEmployees(group: PermissionGroup): boolean {
  return group === 'OWNER' || group === 'MANAGER' || group === 'CASHIER';
}

export function canManageRoles(group: PermissionGroup): boolean {
  return canManageEmployees(group);
}

export function canMutateEmployeeWithRoleGroup(
  viewerGroup: PermissionGroup,
  targetRoleGroup: PermissionGroup,
): boolean {
  if (targetRoleGroup === 'OWNER') {
    return viewerGroup === 'OWNER';
  }
  if (targetRoleGroup === 'MANAGER') {
    return viewerGroup === 'OWNER' || viewerGroup === 'MANAGER';
  }
  if (viewerGroup === 'CASHIER') {
    return targetRoleGroup === 'CASHIER' || targetRoleGroup === 'EMPLOYEE';
  }
  return canManageEmployees(viewerGroup);
}

export function canMutateRoleRecord(
  viewerGroup: PermissionGroup,
  targetRoleGroup: PermissionGroup,
): boolean {
  if (targetRoleGroup === 'OWNER') {
    return false;
  }
  if (targetRoleGroup === 'MANAGER') {
    return viewerGroup === 'OWNER' || viewerGroup === 'MANAGER';
  }
  return canManageRoles(viewerGroup);
}
