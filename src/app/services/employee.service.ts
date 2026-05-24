import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  CreateEmployeePayload,
  Employee,
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

  getEmployeesByTeam(shopId: number, team: EmployeeTeam): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.employeesUrl, {
      params: { shopId: shopId.toString(), team },
    });
  }

  createEmployee(payload: CreateEmployeePayload): Observable<Employee> {
    return this.http.post<Employee>(this.employeesUrl, payload);
  }

  updateEmployee(id: number, payload: UpdateEmployeePayload): Observable<Employee> {
    return this.http.put<Employee>(`${this.employeesUrl}/${id}`, payload);
  }

  deleteEmployee(id: number): Observable<Employee> {
    return this.http.delete<Employee>(`${this.employeesUrl}/${id}`);
  }
}
