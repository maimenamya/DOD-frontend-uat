import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';

export interface BatchDrinkLinePayload {
  employeeId: string;
  quantity: number;
  roleId: number;
  billAsTag?: boolean;
}

export interface BatchDrinkPayload {
  billReference: string;
  saleEmployeeId: string;
  billAmount: number;
  businessDate: string;
  transactions: BatchDrinkLinePayload[];
}

export interface BatchDrinkResult {
  billReference: string;
  billId: number;
  saleEmployeeId: string;
  billAmount: number;
  businessDate: string;
  shopId: number;
  count: number;
  totalAmount: number;
  totalDrinks: number;
  transactions: {
    id: number;
    shopId: number;
    amount: number;
    drinksCount: number;
    employeeId: string;
    billReference: string | null;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);
  private readonly baseUrl = this.api.resource('transactions');

  createBatchDrinks(payload: BatchDrinkPayload): Observable<BatchDrinkResult> {
    return this.http.post<BatchDrinkResult>(`${this.baseUrl}/batch`, payload);
  }
}
