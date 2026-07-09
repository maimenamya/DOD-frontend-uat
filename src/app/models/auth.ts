import type { PermissionGroup } from './permission-group';
import type { RoleCategory } from './role';
import type { WorkDuty } from './work-duty';

export interface LoginRequest {
  shopPublicId: string;
  employeeId: string;
  password: string;
}

export interface CompleteRoleSetupRequest {
  roleId: number;
}

export interface AuthBranchOption {
  shopId: number;
  branchName: string;
  branchCode: string;
  publicId: string;
  roleId: number;
  roleName: string;
  roleDisplayNameTh: string;
  permissionGroup: PermissionGroup;
  isDefault: boolean;
}

export interface AuthUser {
  id: number;
  employeeId: string;
  username: string;
  email: string | null;
  lineUserId: string | null;
  nickname: string;
  organizationId: number;
  shopId: number;
  pendingRoleSetup: boolean;
  mustChangePassword: boolean;
  roleId: number | null;
  /** MstRole name from master (e.g. SALE, PR, COYOTY). */
  role: string;
  /** Thai label for header/profile (from JWT / login response). */
  roleDisplayNameTh: string;
  roleCategory: RoleCategory;
  permissionGroup: PermissionGroup;
  /** Station duties for in-app notifications (from MstRole.workDuties). */
  workDuties?: WorkDuty[];
  shop: {
    id: number;
    name: string;
    branchCode: string;
    organizationId: number;
    publicId?: string;
  };
}

export interface AuthResponse {
  needsBranchSelection?: boolean;
  branches?: AuthBranchOption[];
  token?: string;
  employee?: {
    id: number;
    employeeId: string;
    username: string;
    email: string | null;
    lineUserId: string | null;
    nickname: string;
    organizationId: number;
    shopId: number;
    pendingRoleSetup: boolean;
    mustChangePassword: boolean;
    roleId: number | null;
    role: {
      id: number;
      name: string;
      displayNameTh?: string | null;
      category: RoleCategory;
      permissionGroup: PermissionGroup;
      workDuties?: WorkDuty[];
    } | null;
    shop: {
      id: number;
      name: string;
      branchCode: string;
      organizationId: number;
    };
  };
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  /** Cached for branch switch UI when user has multiple branches. */
  availableBranches?: AuthBranchOption[];
}

export interface UpdateProfileRequest {
  email?: string | null;
  lineUserId?: string | null;
  nickname?: string;
  password?: string;
}
