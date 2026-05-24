import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { Role } from '../models/role';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(this.api.resource('roles'));
  }
}
