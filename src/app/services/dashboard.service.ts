import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { DashboardSummary, DashboardSummaryParams } from '../models/dashboard';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getSummary(params: DashboardSummaryParams): Observable<DashboardSummary> {
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

    return this.http.get<DashboardSummary>(this.api.resource('dashboard', 'summary'), {
      params: httpParams,
    });
  }

  /** @deprecated Use getSummary */
  getStats(shopId: number): Observable<DashboardSummary> {
    return this.getSummary({ shopId, preset: 'today' });
  }
}
