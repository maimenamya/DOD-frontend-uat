import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  AttendanceKioskPayload,
  AttendanceLogsResponse,
  AttendanceMePayload,
  AttendancePunchResult,
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
}
