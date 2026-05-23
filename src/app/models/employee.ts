import type { EmployeeRole } from './role';

export interface Employee {
  id: number;
  employeeId: string;
  name: string;
  email: string | null;
  nickname: string;
  roleId: number;
  role?: {
    id: number;
    name: EmployeeRole;
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
  name: string;
  password: string;
  nickname: string;
  roleId: number;
  shopId: number;
  team: EmployeeTeam;
  email?: string;
}

export interface UpdateEmployeePayload {
  name?: string;
  nickname?: string;
  email?: string | null;
  status?: string;
  roleId?: number;
  password?: string;
}
