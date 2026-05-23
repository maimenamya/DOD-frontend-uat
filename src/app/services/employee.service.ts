import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private readonly apiUrl = '/api/employees';

  getEmployeesByTeam(shopId: number, team: EmployeeTeam): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.apiUrl, {
      params: { shopId: shopId.toString(), team },
    });
  }

  createEmployee(payload: CreateEmployeePayload): Observable<Employee> {
    return this.http.post<Employee>(this.apiUrl, payload);
  }

  updateEmployee(id: number, payload: UpdateEmployeePayload): Observable<Employee> {
    return this.http.put<Employee>(`${this.apiUrl}/${id}`, payload);
  }

  deleteEmployee(id: number): Observable<Employee> {
    return this.http.delete<Employee>(`${this.apiUrl}/${id}`);
  }
}
