import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { DashboardStats } from '../models/dashboard';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getStats(shopId: number): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(this.api.resource('dashboard', 'stats'), {
      params: { shopId: shopId.toString() },
    });
  }
}
