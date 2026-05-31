import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { MstRole, MstRoleWritePayload } from '../models/role';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getRoles(): Observable<MstRole[]> {
    return this.http.get<MstRole[]>(this.api.resource('roles'));
  }

  /** Roles with active employees in the given shop (for drink entry, filters, etc.). */
  getRolesForShop(shopId: number): Observable<MstRole[]> {
    return this.http.get<MstRole[]>(this.api.resource('roles', 'for-shop'), {
      params: { shopId: shopId.toString() },
    });
  }

  createRole(payload: MstRoleWritePayload): Observable<MstRole> {
    return this.http.post<MstRole>(this.api.resource('roles'), payload);
  }

  updateRole(id: number, payload: MstRoleWritePayload): Observable<MstRole> {
    return this.http.put<MstRole>(this.api.resource(`roles/${id}`), payload);
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`roles/${id}`));
  }
}
