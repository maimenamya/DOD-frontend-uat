import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  DailyExpenseListResponse,
  DailyExpenseWritePayload,
  TxnDailyExpense,
} from '../models/daily-expense';

@Injectable({ providedIn: 'root' })
export class DailyExpenseService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(from: string, to: string): Observable<DailyExpenseListResponse> {
    const params = new HttpParams().set('from', from).set('to', to).set('preset', 'custom');
    return this.http.get<DailyExpenseListResponse>(this.api.resource('daily-expenses'), {
      params,
    });
  }

  create(payload: DailyExpenseWritePayload): Observable<TxnDailyExpense> {
    return this.http.post<TxnDailyExpense>(this.api.resource('daily-expenses'), payload);
  }

  update(id: number, payload: Partial<DailyExpenseWritePayload>): Observable<TxnDailyExpense> {
    return this.http.put<TxnDailyExpense>(this.api.resource('daily-expenses', String(id)), payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource('daily-expenses', String(id)));
  }
}
