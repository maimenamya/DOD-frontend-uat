import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { BillHistoryListParams, BillHistoryListResponse } from '../models/bill-history';

@Injectable({ providedIn: 'root' })
export class BillHistoryService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(params: BillHistoryListParams): Observable<BillHistoryListResponse> {
    const httpParams = new HttpParams().set('from', params.from).set('to', params.to);
    return this.http.get<BillHistoryListResponse>(this.api.resource('bill-history'), {
      params: httpParams,
    });
  }
}
