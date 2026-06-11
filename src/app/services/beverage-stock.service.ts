import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  MstBeverageStock,
  MstBeverageStockWritePayload,
} from '../models/beverage-stock';

@Injectable({ providedIn: 'root' })
export class BeverageStockService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getAll(): Observable<MstBeverageStock[]> {
    return this.http.get<MstBeverageStock[]>(this.api.resource('stock'));
  }

  create(payload: MstBeverageStockWritePayload): Observable<MstBeverageStock> {
    return this.http.post<MstBeverageStock>(this.api.resource('stock'), payload);
  }

  updateQuantity(
    beverageId: number,
    quantityOnHand: number,
  ): Observable<MstBeverageStock> {
    return this.http.put<MstBeverageStock>(
      this.api.resource(`stock/${beverageId}`),
      { quantityOnHand },
    );
  }

  remove(beverageId: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`stock/${beverageId}`));
  }
}
