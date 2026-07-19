import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  MstStockItem,
  MstStockItemDeletePayload,
  MstStockItemUpdatePayload,
  MstStockItemWritePayload,
} from '../models/beverage-stock';

export type {
  MstStockItem,
  MstStockItemDeletePayload,
  MstStockItemUpdatePayload,
  MstStockItemWritePayload,
  MstBeverageStock,
  MstBeverageStockUpdatePayload,
  MstBeverageStockWritePayload,
} from '../models/beverage-stock';

@Injectable({ providedIn: 'root' })
export class BeverageStockService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getAll(): Observable<MstStockItem[]> {
    return this.http.get<MstStockItem[]>(this.api.resource('stock'));
  }

  create(payload: MstStockItemWritePayload): Observable<MstStockItem> {
    return this.http.post<MstStockItem>(this.api.resource('stock'), payload);
  }

  updateQuantity(stockItemId: number, payload: MstStockItemUpdatePayload): Observable<MstStockItem> {
    return this.http.put<MstStockItem>(this.api.resource('stock', String(stockItemId)), payload);
  }

  remove(stockItemId: number, payload: MstStockItemDeletePayload): Observable<void> {
    return this.http.delete<void>(this.api.resource('stock', String(stockItemId)), {
      body: payload,
    });
  }
}
