import type { PermissionGroup } from './permission-group';
import type { RoleCategory } from './role';
import type { WorkDuty } from './work-duty';

export interface LoginRequest {
  shopPublicId: string;
  employeeId: string;
  password: string;
}

export interface CompleteRoleSetupRequest {
  roleId?: number;
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

export type ShopSubscriptionPlan = 'BASIC' | 'STANDARD' | 'PRO';

export interface AuthUser {
  id: number;
  employeeId: string;
  username: string;
  email: string | null;
  nickname: string;
  /** Own photo URL — always returned to the owner. */
  imageUrl?: string | null;
  /** Whether other staff may see this photo. Default false (PDPA opt-in). */
  imageIsPublic?: boolean;
  organizationId: number;
  shopId: number;
  pendingRoleSetup: boolean;
  mustChangePassword: boolean;
  /** OWNER only — org has not accepted current privacy policy. */
  needsPrivacyConsent?: boolean;
  /** Any role — org privacy version behind; show staff reminder banner. */
  orgPrivacyConsentPending?: boolean;
  /** Org opt-in to share business data with supplier partners. */
  allowBusinessDataPartnerShare?: boolean;
  roleId: number | null;
  /** MstRole name from master (e.g. SALE, PR, COYOTY). */
  role: string;
  /** Thai label for header/profile (from JWT / login response). */
  roleDisplayNameTh: string;
  roleCategory: RoleCategory;
  permissionGroup: PermissionGroup;
  /** Station duties for menus / notifications (from MstEmployee.workDuties). */
  workDuties?: WorkDuty[];
  shop: {
    id: number;
    name: string;
    branchCode: string;
    organizationId: number;
    publicId?: string;
    /** SaaS package — gates stock / attendance / Pro features. */
    subscriptionPlan: ShopSubscriptionPlan;
    /** Last paid day YYYY-MM-DD, or null when expiry not enforced. */
    subscriptionExpiresOn: string | null;
    subscriptionAccess: 'unlimited' | 'active' | 'grace' | 'locked';
    subscriptionGraceEndsOn: string | null;
    subscriptionGraceDaysRemaining: number | null;
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
    nickname: string;
    imageUrl?: string | null;
    imageIsPublic?: boolean;
    organizationId: number;
    shopId: number;
    pendingRoleSetup: boolean;
    mustChangePassword: boolean;
    needsPrivacyConsent?: boolean;
    orgPrivacyConsentPending?: boolean;
    allowBusinessDataPartnerShare?: boolean;
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
      publicId?: string;
      subscriptionPlan?: ShopSubscriptionPlan;
      subscriptionExpiresOn?: string | null;
      subscriptionAccess?: 'unlimited' | 'active' | 'grace' | 'locked';
      subscriptionGraceEndsOn?: string | null;
      subscriptionGraceDaysRemaining?: number | null;
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
  nickname?: string;
  imageIsPublic?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
