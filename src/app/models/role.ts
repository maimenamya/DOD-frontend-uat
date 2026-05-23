export const EMPLOYEE_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SALE', 'PR'] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const MANAGEMENT_ROLES: readonly EmployeeRole[] = ['OWNER', 'ADMIN', 'MANAGER'];

export const FIELD_STAFF_ROLES: readonly EmployeeRole[] = ['SALE', 'PR'];

/** Roles ADMIN/MANAGER may assign or mutate via employee CRUD */
export const STAFF_MANAGEABLE_ROLES: readonly EmployeeRole[] = ['SALE', 'PR'];

/** Shown in the Management table (never includes OWNER) */
export const MANAGEMENT_TABLE_ROLES: readonly EmployeeRole[] = ['ADMIN', 'MANAGER'];

export interface Role {
  id: number;
  name: string;
  createdAt?: string;
}
