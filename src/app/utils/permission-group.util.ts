import type { PermissionGroup } from '../models/permission-group';

/**
 * หลักสิทธิ์ UI: ใครเข้าหน้าได้จาก `permissionGuard(feature)` ต้องทำงานบนหน้านั้นได้ด้วย
 * (`hasFeature(feature)` สำหรับปุ่มบันทึก/แก้ไข/ลบ — ห้ามใช้ canAccessTeamManagement แยกต่างหาก)
 *
 * | หน้า | feature |
 * |------|---------|
 * | เปิดโต๊ะ | open_table |
 * | จัดการ tag | pr_tag_operations |
 * | ออกรายงาน | reports |
 * | บันทึกค่าใช้จ่าย | daily_expenses |
 * | พนักงาน | manage_employees |
 * | ตำแหน่ง | manage_roles |
 * | เมนูจัดการ (อาหาร/โต๊ะ/แท็ก master ฯลฯ) | master_data |
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
      return (
        feature === 'dashboard' ||
        feature === 'open_table' ||
        feature === 'pr_tag_operations' ||
        feature === 'reports' ||
        feature === 'daily_expenses'
      );
    case 'EMPLOYEE':
      return feature === 'dashboard';
    default:
      return false;
  }
}

export function usesSelfOnlyDashboard(group: PermissionGroup): boolean {
  return group === 'EMPLOYEE';
}

export function canManageEmployees(group: PermissionGroup): boolean {
  return group === 'OWNER' || group === 'MANAGER';
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
  return canManageEmployees(viewerGroup);
}
