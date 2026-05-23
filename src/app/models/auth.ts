import type { EmployeeRole } from './role';

export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface RegisterRequest {
  employeeId: string;
  name: string;
  password: string;
  shopId: number;
  role: EmployeeRole;
  email?: string;
  nickname?: string;
}

export interface AuthUser {
  id: number;
  employeeId: string;
  name: string;
  email: string | null;
  nickname: string;
  shopId: number;
  roleId: number;
  role: EmployeeRole;
  shopName: string;
}

export interface AuthResponse {
  token: string;
  employee: {
    id: number;
    employeeId: string;
    name: string;
    email: string | null;
    nickname: string;
    shopId: number;
    roleId: number;
    role: { id: number; name: EmployeeRole };
    shop: { id: number; name: string };
  };
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string | null;
  nickname?: string;
  password?: string;
}
