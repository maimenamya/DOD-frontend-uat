import type { PermissionGroup } from './permission-group';
import type { RoleCategory } from './role';
import type { WorkDuty } from './work-duty';
import type {
  EmployeeAttendanceStatus,
  EmployeeTableSeatStatus,
} from '../utils/employee-status-label.util';

export interface MstEmployee {
  id: number;
  /** Local code within shop (e.g. 1001). */
  employeeId: string;
  /** Internal login username (legacy storage; login uses shop URL + employeeId). */
  username?: string;
  email: string | null;
  nickname: string;
  roleId: number;
  role?: {
    id: number;
    name: string;
    displayNameTh?: string | null;
    category?: RoleCategory;
    permissionGroup?: PermissionGroup;
    startDrinks?: number;
    nextHourDrinks?: number;
    defaultPricePerDrink?: number;
    drinkShopPortionBaht?: number;
    createdAt?: string;
  };
  shopId: number;
  status: string;
  tableSeatStatus?: EmployeeTableSeatStatus;
  attendanceStatus?: EmployeeAttendanceStatus;
  /** Station / notification duties for this person. */
  workDuties?: WorkDuty[];
  createdAt: string;
  /** Joined from ACTIVE TxnPrTagEnrollment — not stored on MstEmployee. */
  hasActivePrTag?: boolean;
  activePrTagEnrollmentId?: number | null;
  activePrTagId?: number | null;
  activePrTagName?: string | null;
  shop?: {
    id: number;
    name: string;
    createdAt?: string;
  };
}

export type EmployeeTeam = 'sale' | 'pr' | 'managers';

export interface CreateEmployeePayload {
  employeeId: string;
  password: string;
  nickname: string;
  roleId: number;
  shopId: number;
  team: EmployeeTeam;
  email?: string;
  workDuties?: WorkDuty[];
}

export interface UpdateEmployeePayload {
  nickname?: string;
  email?: string | null;
  status?: string;
  roleId?: number;
  password?: string;
  workDuties?: WorkDuty[];
  changeReason?: string;
}
