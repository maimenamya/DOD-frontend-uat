import type { MstEmployee } from '../models/employee';
import type { MstRole } from '../models/role';

/** Dropdown label: local code + nickname (e.g. `1000 - ไก่`). */
export function employeeDropdownLabel(employee: Pick<MstEmployee, 'employeeId' | 'nickname'>): string {
  return `${employee.employeeId} - ${employee.nickname}`;
}

export function compareEmployeeIdAsc(a: string, b: string): number {
  const na = extractEmployeeCodeNumber(a);
  const nb = extractEmployeeCodeNumber(b);
  if (na !== nb) return na - nb;
  return a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' });
}

function extractEmployeeCodeNumber(employeeId: string): number {
  const digits = employeeId.replace(/\D/g, '');
  if (!digits) return Number.MAX_SAFE_INTEGER;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

export function sortEmployeesByCode<T extends Pick<MstEmployee, 'employeeId'>>(employees: T[]): T[] {
  return [...employees].sort((a, b) => compareEmployeeIdAsc(a.employeeId, b.employeeId));
}

/** Match org-wide employee to branch role dropdown (same role name, any shop roleId). */
export function employeeMatchesBranchRole(
  employee: Pick<MstEmployee, 'role'>,
  branchRole: Pick<MstRole, 'name'> | null | undefined,
): boolean {
  const employeeRole = employee.role?.name?.trim().toUpperCase();
  const selectedRole = branchRole?.name?.trim().toUpperCase();
  if (!employeeRole || !selectedRole) return false;
  return employeeRole === selectedRole;
}
