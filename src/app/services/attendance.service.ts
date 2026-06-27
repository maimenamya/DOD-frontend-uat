import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  AttendanceKioskPayload,
  AttendanceLogsResponse,
  AttendanceMePayload,
  AttendancePunchResult,
  AttendanceEmployeeMonthPayload,
} from '../models/attendance';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getKiosk(shopPublicId: string): Observable<AttendanceKioskPayload> {
    return this.http.get<AttendanceKioskPayload>(
      this.api.resource('attendance', 'kiosk', shopPublicId),
    );
  }

  punch(token: string): Observable<AttendancePunchResult> {
    return this.http.post<AttendancePunchResult>(this.api.resource('attendance', 'punch'), {
      token,
    });
  }

  getMe(): Observable<AttendanceMePayload> {
    return this.http.get<AttendanceMePayload>(this.api.resource('attendance', 'me'));
  }

  listTodayLogs(): Observable<AttendanceLogsResponse> {
    return this.http.get<AttendanceLogsResponse>(this.api.resource('attendance', 'logs'));
  }

  getEmployeeMonth(
    employeeId: string,
    year: number,
    month: number,
  ): Observable<AttendanceEmployeeMonthPayload> {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    return this.http.get<AttendanceEmployeeMonthPayload>(
      `${this.api.resource('attendance', 'employee', employeeId, 'month')}?${params.toString()}`,
    );
  }

  getMyMonth(year: number, month: number): Observable<AttendanceEmployeeMonthPayload> {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    return this.http.get<AttendanceEmployeeMonthPayload>(
      `${this.api.resource('attendance', 'me', 'month')}?${params.toString()}`,
    );
  }

  waiveShiftDeduction(
    employeeId: string,
    roundDateIso: string,
  ): Observable<AttendanceEmployeeMonthPayload> {
    return this.http.post<AttendanceEmployeeMonthPayload>(
      this.api.resource(
        'attendance',
        'employee',
        employeeId,
        'shift',
        roundDateIso,
        'waive-deduction',
      ),
      {},
    );
  }

  revokeShiftDeductionWaiver(
    employeeId: string,
    roundDateIso: string,
  ): Observable<AttendanceEmployeeMonthPayload> {
    return this.http.delete<AttendanceEmployeeMonthPayload>(
      this.api.resource(
        'attendance',
        'employee',
        employeeId,
        'shift',
        roundDateIso,
        'waive-deduction',
      ),
    );
  }
}
