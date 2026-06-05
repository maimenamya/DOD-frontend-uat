import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import type {
  AuthResponse,
  AuthSession,
  AuthUser,
  CompleteRoleSetupRequest,
  LoginRequest,
  UpdateProfileRequest,
} from '../models/auth';
import { ApiConfig } from '../core/api-config';
import type { PermissionGroup } from '../models/permission-group';
import type { RoleCategory } from '../models/role';
import {
  canManageEmployees,
  canManageRoles,
  canMutateEmployeeWithRoleGroup,
  hasFeature,
  usesSelfOnlyDashboard,
  type AppFeature,
} from '../utils/permission-group.util';
import { roleDisplayNameTh } from '../utils/role-display.util';

const STORAGE_KEY = 'dod_auth_session';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  private readonly sessionSignal = signal<AuthSession | null>(this.readStoredSession());

  readonly session = this.sessionSignal.asReadonly();

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.api.resource('auth', 'login'), credentials)
      .pipe(tap((response) => this.persistSession(response)));
  }

  completeRoleSetup(payload: CompleteRoleSetupRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(this.api.resource('auth', 'complete-role-setup'), payload)
      .pipe(tap((response) => this.persistSession(response)));
  }

  needsRoleSetup(): boolean {
    return this.getUser()?.pendingRoleSetup === true;
  }

  updateProfile(payload: UpdateProfileRequest): Observable<AuthResponse> {
    return this.http
      .put<AuthResponse>(this.api.resource('auth', 'me'), payload)
      .pipe(tap((response) => this.persistSession(response)));
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.sessionSignal.set(null);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return this.sessionSignal()?.token ?? null;
  }

  getUser(): AuthUser | null {
    return this.sessionSignal()?.user ?? null;
  }

  getDisplayNickname(): string {
    const user = this.getUser();
    if (!user) {
      return '—';
    }
    const nick = user.nickname?.trim();
    if (nick) {
      return nick;
    }
    return user.employeeId?.trim() || '—';
  }

  getShopId(): number | null {
    return this.getUser()?.shopId ?? null;
  }

  getShopDisplayName(): string {
    const label = this.getUser()?.shop?.name?.trim();
    return label || '—';
  }

  getShopAbbreviation(): string {
    return this.getUser()?.shop?.abbreviation?.trim() ?? '';
  }

  getRole(): string | null {
    return this.getUser()?.role ?? null;
  }

  getRoleDisplayNameTh(): string | null {
    return this.getUser()?.roleDisplayNameTh ?? null;
  }

  getRoleCategory(): RoleCategory | null {
    return this.getUser()?.roleCategory ?? null;
  }

  getPermissionGroup(): PermissionGroup | null {
    return this.getUser()?.permissionGroup ?? null;
  }

  hasFeature(feature: AppFeature): boolean {
    const group = this.getPermissionGroup();
    if (!group) return false;
    return hasFeature(group, feature);
  }

  /** Same as route guard — use for save/edit/delete on a page the user can open. */
  canWriteOnPage(feature: AppFeature): boolean {
    return this.hasFeature(feature);
  }

  usesSelfOnlyDashboard(): boolean {
    const group = this.getPermissionGroup();
    return group ? usesSelfOnlyDashboard(group) : false;
  }

  isOwner(): boolean {
    return this.getPermissionGroup() === 'OWNER';
  }

  isManagerRole(): boolean {
    return this.getPermissionGroup() === 'MANAGER';
  }

  isFieldStaff(): boolean {
    if (this.isOwner() || this.isManagerRole()) {
      return false;
    }
    const role = this.getRole()?.toUpperCase();
    if (role === 'SALE' || role === 'PR') {
      return true;
    }
    const category = this.getRoleCategory();
    return category === 'STAFF' || category === 'ENTERTAINER';
  }

  isEntertainerRole(): boolean {
    if (this.getRole()?.toUpperCase() === 'PR') {
      return true;
    }
    return this.getRoleCategory() === 'ENTERTAINER';
  }

  isSaleTeamRole(): boolean {
    if (this.getRole()?.toUpperCase() === 'SALE') {
      return true;
    }
    return this.getRoleCategory() === 'STAFF' && !this.isManagerRole() && !this.isOwner();
  }

  canAccessTeamManagement(): boolean {
    const group = this.getPermissionGroup();
    return group ? canManageEmployees(group) : false;
  }

  canAccessMasterData(): boolean {
    return this.hasFeature('master_data');
  }

  canManageRoles(): boolean {
    const group = this.getPermissionGroup();
    return group ? canManageRoles(group) : false;
  }

  canMutateEmployeeRow(targetRole?: {
    name?: string;
    permissionGroup?: PermissionGroup;
  }): boolean {
    const viewer = this.getPermissionGroup();
    if (!viewer || !targetRole?.permissionGroup) {
      return false;
    }
    return canMutateEmployeeWithRoleGroup(viewer, targetRole.permissionGroup);
  }

  canMutateOnManagersPage(targetRoleName?: string): boolean {
    if (!this.isOwner() || !targetRoleName) {
      return false;
    }
    return targetRoleName === 'ADMIN' || targetRoleName === 'MANAGER';
  }

  private persistSession(response: AuthResponse): void {
    const session = this.toSession(response);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  updateSessionUser(user: AuthUser): void {
    const current = this.sessionSignal();
    if (!current) return;
    const next = { ...current, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.sessionSignal.set(next);
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as AuthSession & {
        user?: AuthUser & { name?: string };
      };
      if (!parsed?.token || !parsed?.user?.shopId) {
        return null;
      }
      const session: AuthSession = {
        token: parsed.token,
        user: this.normalizeUser(parsed.user),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      return session;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private toSession(response: AuthResponse): AuthSession {
    const { employee, token } = response;
    const pendingRoleSetup = employee.pendingRoleSetup;
    const user = pendingRoleSetup
      ? this.normalizeUser({
          id: employee.id,
          employeeId: employee.employeeId,
          username: employee.username,
          email: employee.email,
          lineUserId: employee.lineUserId ?? null,
          nickname: employee.nickname,
          shopId: employee.shopId,
          pendingRoleSetup: true,
          roleId: null,
          role: '',
          roleDisplayNameTh: 'กำลังตั้งค่าตำแหน่ง',
          roleCategory: 'STAFF',
          permissionGroup: 'OWNER',
          shop: {
            id: employee.shop.id,
            name: employee.shop.name,
            abbreviation: employee.shop.abbreviation,
          },
        })
      : this.normalizeUser({
          id: employee.id,
          employeeId: employee.employeeId,
          username: employee.username,
          email: employee.email,
          lineUserId: employee.lineUserId ?? null,
          nickname: employee.nickname,
          shopId: employee.shopId,
          pendingRoleSetup: false,
          roleId: employee.roleId,
          role: employee.role!.name,
          roleDisplayNameTh: this.resolveRoleDisplayNameTh(
            employee.role!.name,
            employee.role!.displayNameTh,
          ),
          roleCategory: employee.role!.category,
          permissionGroup: employee.role!.permissionGroup,
          shop: {
            id: employee.shop.id,
            name: employee.shop.name,
            abbreviation: employee.shop.abbreviation,
          },
        });
    return { token, user };
  }

  private normalizeUser(user: AuthUser & { name?: string }): AuthUser {
    const username =
      user.username?.trim() || user.employeeId?.trim() || '';
    const nickname =
      user.nickname?.trim() || user.name?.trim() || username || '';
    if (user.pendingRoleSetup) {
      return {
        id: user.id,
        employeeId: user.employeeId,
        username,
        email: user.email ?? null,
        lineUserId: user.lineUserId ?? null,
        nickname,
        shopId: user.shopId,
        pendingRoleSetup: true,
        roleId: null,
        role: '',
        roleDisplayNameTh: user.roleDisplayNameTh?.trim() || 'กำลังตั้งค่าตำแหน่ง',
        roleCategory: 'STAFF',
        permissionGroup: 'OWNER',
        shop: user.shop ?? { id: user.shopId, name: '', abbreviation: '' },
      };
    }
    const role =
      typeof user.role === 'string'
        ? user.role
        : ((user as { role?: { name?: string } }).role?.name ?? '');
    const roleCategory =
      user.roleCategory ??
      (role.toUpperCase() === 'PR' ? 'ENTERTAINER' : 'STAFF');
    const permissionGroup =
      user.permissionGroup ??
      (role.toUpperCase() === 'OWNER'
        ? 'OWNER'
        : role === 'ADMIN' || role === 'MANAGER'
          ? 'MANAGER'
          : 'EMPLOYEE');
    const roleDisplayNameTh = this.resolveRoleDisplayNameTh(
      role,
      user.roleDisplayNameTh,
    );
    return {
      id: user.id,
      employeeId: user.employeeId,
      username,
      email: user.email ?? null,
      lineUserId: user.lineUserId ?? null,
      nickname,
      shopId: user.shopId,
      pendingRoleSetup: false,
      roleId: user.roleId,
      role,
      roleDisplayNameTh,
      roleCategory,
      permissionGroup,
      shop:
        user.shop ??
        (user.shopId
          ? {
              id: user.shopId,
              name:
                (user as AuthUser & { shopName?: string }).shopName?.trim() ||
                '',
              abbreviation: '',
            }
          : { id: 0, name: '', abbreviation: '' }),
    };
  }

  private resolveRoleDisplayNameTh(
    roleName: string,
    fromSession?: string | null,
  ): string {
    const trimmed = fromSession?.trim();
    if (trimmed) return trimmed;
    return roleDisplayNameTh({ name: roleName });
  }
}
