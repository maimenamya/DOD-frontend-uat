import type { EmployeeRole, RoleCategory } from './role';

export interface Employee {
  id: number;
  employeeId: string;
  email: string | null;
  nickname: string;
  roleId: number;
  role?: {
    id: number;
    name: EmployeeRole;
    category?: RoleCategory;
    startDrinks?: number;
    nextHourDrinks?: number;
    defaultPricePerDrink?: number;
    createdAt?: string;
  };
  shopId: number;
  status: string;
  createdAt: string;
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
}

export interface UpdateEmployeePayload {
  nickname?: string;
  email?: string | null;
  status?: string;
  roleId?: number;
  password?: string;
}
