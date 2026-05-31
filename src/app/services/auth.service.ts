import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import type {
  AuthResponse,
  AuthSession,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from '../models/auth';
import { ApiConfig } from '../core/api-config';
import type { RoleCategory } from '../models/role';
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

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.api.resource('auth', 'register'), payload);
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

  getRole(): string | null {
    return this.getUser()?.role ?? null;
  }

  getRoleDisplayNameTh(): string | null {
    return this.getUser()?.roleDisplayNameTh ?? null;
  }

  getRoleCategory(): RoleCategory | null {
    return this.getUser()?.roleCategory ?? null;
  }

  isOwner(): boolean {
    return this.getRole()?.toUpperCase() === 'OWNER';
  }

  isManagerRole(): boolean {
    const role = this.getRole()?.toUpperCase();
    return role === 'ADMIN' || role === 'MANAGER';
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
    return this.isOwner() || this.isManagerRole();
  }

  canMutateEmployeeRow(targetRoleName?: string): boolean {
    if (!targetRoleName || targetRoleName === 'OWNER') {
      return false;
    }
    return this.canAccessTeamManagement();
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
    const user = this.normalizeUser({
      id: employee.id,
      employeeId: employee.employeeId,
      email: employee.email,
      nickname: employee.nickname,
      shopId: employee.shopId,
      roleId: employee.roleId,
      role: employee.role.name,
      roleDisplayNameTh: this.resolveRoleDisplayNameTh(
        employee.role.name,
        employee.role.displayNameTh,
      ),
      roleCategory: employee.role.category,
      shopName: employee.shop.name,
    });
    return { token, user };
  }

  private normalizeUser(user: AuthUser & { name?: string }): AuthUser {
    const nickname =
      user.nickname?.trim() || user.name?.trim() || user.employeeId?.trim() || '';
    const role =
      typeof user.role === 'string'
        ? user.role
        : ((user as { role?: { name?: string } }).role?.name ?? '');
    const roleCategory =
      user.roleCategory ??
      (role.toUpperCase() === 'PR' ? 'ENTERTAINER' : 'STAFF');
    const roleDisplayNameTh = this.resolveRoleDisplayNameTh(
      role,
      user.roleDisplayNameTh,
    );
    return {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email ?? null,
      nickname,
      shopId: user.shopId,
      roleId: user.roleId,
      role,
      roleDisplayNameTh,
      roleCategory,
      shopName: user.shopName,
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
