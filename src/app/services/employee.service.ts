import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  CreateEmployeePayload,
  MstEmployee,
  EmployeeTeam,
  UpdateEmployeePayload,
} from '../models/employee';

@Injectable({
  providedIn: 'root',
})
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly employeesUrl = this.api.resource('employees');

  getEmployeesByShop(shopId: number, team?: EmployeeTeam): Observable<MstEmployee[]> {
    const params: Record<string, string> = { shopId: shopId.toString() };
    if (team) {
      params['team'] = team;
    }
    return this.http.get<MstEmployee[]>(this.employeesUrl, { params });
  }

  /** @deprecated Use getEmployeesByShop — kept for legacy team routes */
  getEmployeesByTeam(shopId: number, team: EmployeeTeam): Observable<MstEmployee[]> {
    return this.getEmployeesByShop(shopId, team);
  }

  createEmployee(payload: CreateEmployeePayload): Observable<MstEmployee> {
    return this.http.post<MstEmployee>(this.employeesUrl, payload);
  }

  updateEmployee(id: number, payload: UpdateEmployeePayload): Observable<MstEmployee> {
    return this.http.put<MstEmployee>(`${this.employeesUrl}/${id}`, payload);
  }

  deleteEmployee(id: number): Observable<MstEmployee> {
    return this.http.delete<MstEmployee>(`${this.employeesUrl}/${id}`);
  }
}
