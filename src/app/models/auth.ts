import type { RoleCategory } from './role';

export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface RegisterRequest {
  employeeId: string;
  password: string;
  shopId: number;
  role: string;
  email?: string;
  nickname: string;
}

export interface AuthUser {
  id: number;
  employeeId: string;
  email: string | null;
  lineUserId: string | null;
  nickname: string;
  shopId: number;
  roleId: number;
  /** MstRole name from master (e.g. SALE, PR, COYOTY). */
  role: string;
  /** Thai label for header/profile (from JWT / login response). */
  roleDisplayNameTh: string;
  roleCategory: RoleCategory;
  shop: { id: number; name: string };
}

export interface AuthResponse {
  token: string;
  employee: {
    id: number;
    employeeId: string;
    email: string | null;
    lineUserId: string | null;
    nickname: string;
    shopId: number;
    roleId: number;
    role: {
      id: number;
      name: string;
      displayNameTh?: string | null;
      category: RoleCategory;
    };
    shop: { id: number; name: string };
  };
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface UpdateProfileRequest {
  email?: string | null;
  lineUserId?: string | null;
  nickname?: string;
  password?: string;
}
