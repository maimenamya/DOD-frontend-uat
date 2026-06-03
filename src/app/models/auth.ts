import type { PermissionGroup } from './permission-group';
import type { RoleCategory } from './role';

export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface CompleteRoleSetupRequest {
  roleId: number;
}

export interface AuthUser {
  id: number;
  employeeId: string;
  email: string | null;
  lineUserId: string | null;
  nickname: string;
  shopId: number;
  pendingRoleSetup: boolean;
  roleId: number | null;
  /** MstRole name from master (e.g. SALE, PR, COYOTY). */
  role: string;
  /** Thai label for header/profile (from JWT / login response). */
  roleDisplayNameTh: string;
  roleCategory: RoleCategory;
  permissionGroup: PermissionGroup;
  shop: { id: number; name: string; abbreviation: string };
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
    pendingRoleSetup: boolean;
    roleId: number | null;
    role: {
      id: number;
      name: string;
      displayNameTh?: string | null;
      category: RoleCategory;
      permissionGroup: PermissionGroup;
    } | null;
    shop: { id: number; name: string; abbreviation: string };
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
