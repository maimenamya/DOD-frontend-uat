import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { DashboardPreset } from '../models/dashboard';
import type { DrinkPayoutDashboard } from '../models/drink-payout';

export interface DrinkPayoutDateParams {
  preset?: DashboardPreset;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class DrinkPayoutService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getDashboard(params: DrinkPayoutDateParams): Observable<DrinkPayoutDashboard> {
    return this.http.get<DrinkPayoutDashboard>(this.api.resource('drink-payouts'), {
      params: this.buildDateParams(params),
    });
  }

  payFreelance(
    employeeId: string,
    businessDate: string,
    params: DrinkPayoutDateParams,
    changeReason: string,
  ): Observable<DrinkPayoutDashboard> {
    return this.http.post<DrinkPayoutDashboard>(
      this.api.resource('drink-payouts', 'freelance'),
      { employeeId, businessDate, changeReason },
      { params: this.buildDateParams(params) },
    );
  }

  payTag(
    enrollmentId: number,
    params: DrinkPayoutDateParams,
    changeReason: string,
  ): Observable<DrinkPayoutDashboard> {
    return this.http.post<DrinkPayoutDashboard>(
      this.api.resource('drink-payouts', 'tag', String(enrollmentId)),
      { changeReason },
      { params: this.buildDateParams(params) },
    );
  }

  private buildDateParams(params: DrinkPayoutDateParams): HttpParams {
    let httpParams = new HttpParams();
    if (params.preset) {
      httpParams = httpParams.set('preset', params.preset);
    }
    if (params.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params.to) {
      httpParams = httpParams.set('to', params.to);
    }
    return httpParams;
  }
}
