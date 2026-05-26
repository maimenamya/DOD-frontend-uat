import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  DashboardBillStatus,
  DashboardSummary,
  DashboardSummaryParams,
} from '../models/dashboard';

export interface DashboardBillStatusParams extends DashboardSummaryParams {
  billEmployeeId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getSummary(params: DashboardSummaryParams): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(this.api.resource('dashboard', 'summary'), {
      params: this.buildDateParams(params),
    });
  }

  getBillStatus(params: DashboardBillStatusParams): Observable<DashboardBillStatus | null> {
    let httpParams = this.buildDateParams(params);
    if (params.billEmployeeId) {
      httpParams = httpParams.set('billEmployeeId', params.billEmployeeId);
    }
    return this.http.get<DashboardBillStatus | null>(
      this.api.resource('dashboard', 'bill-status'),
      { params: httpParams },
    );
  }

  private buildDateParams(params: DashboardSummaryParams): HttpParams {
    let httpParams = new HttpParams().set('shopId', params.shopId.toString());
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
