import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { Role, RoleWritePayload } from '../models/role';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(this.api.resource('roles'));
  }

  createRole(payload: RoleWritePayload): Observable<Role> {
    return this.http.post<Role>(this.api.resource('roles'), payload);
  }

  updateRole(id: number, payload: RoleWritePayload): Observable<Role> {
    return this.http.put<Role>(this.api.resource(`roles/${id}`), payload);
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`roles/${id}`));
  }
}
