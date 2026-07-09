import type { PermissionGroup } from './permission-group';
import type { WorkDuty } from './work-duty';

export const EMPLOYEE_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALE', 'PR'] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export type RoleCategory = 'STAFF' | 'ENTERTAINER';

export type DrinkAccrualMode = 'HOUR_BLOCKS' | 'MINUTE_LINEAR';
export type DrinkAccrualRounding = 'FLOOR' | 'CEIL';

export const MANAGEMENT_ROLES: readonly EmployeeRole[] = ['OWNER', 'ADMIN', 'MANAGER'];

export const FIELD_STAFF_ROLES: readonly EmployeeRole[] = ['SALE', 'PR'];

/** Roles ADMIN/MANAGER may assign or mutate via employee CRUD */
export const STAFF_MANAGEABLE_ROLES: readonly EmployeeRole[] = ['SALE', 'PR'];

/** Shown in the Management table (never includes OWNER) */
export const MANAGEMENT_TABLE_ROLES: readonly EmployeeRole[] = ['ADMIN', 'MANAGER'];

export interface MstRole {
  id: number;
  organizationId?: number;
  name: string;
  permissionGroup: PermissionGroup;
  displayNameTh?: string | null;
  category?: RoleCategory;
  startDrinks: number;
  nextHourDrinks: number;
  defaultPricePerDrink: number;
  drinkShopPortionBaht: number;
  drinkAccrualMode?: DrinkAccrualMode;
  drinkAccrualRounding?: DrinkAccrualRounding;
  attendanceLeaveQuotaPerMonth?: number;
  workDuties?: WorkDuty[];
  createdAt?: string;
}

export interface MstRoleWritePayload {
  name: string;
  displayNameTh: string;
  permissionGroup: PermissionGroup;
  category?: RoleCategory;
  startDrinks: number;
  nextHourDrinks: number;
  defaultPricePerDrink: number;
  drinkShopPortionBaht: number;
  drinkAccrualMode?: DrinkAccrualMode;
  drinkAccrualRounding?: DrinkAccrualRounding;
  attendanceLeaveQuotaPerMonth?: number;
  workDuties?: WorkDuty[];
}
