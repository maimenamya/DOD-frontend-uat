import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  MstBeverage,
  MstBeverageCreatePayload,
  MstBeverageUpdatePayload,
} from '../models/beverage';

@Injectable({
  providedIn: 'root',
})
export class BeverageService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getBeverages(): Observable<MstBeverage[]> {
    return this.http.get<MstBeverage[]>(this.api.resource('beverages'));
  }

  createBeverage(payload: MstBeverageCreatePayload): Observable<MstBeverage> {
    return this.http.post<MstBeverage>(this.api.resource('beverages'), payload);
  }

  updateBeverage(id: number, payload: MstBeverageUpdatePayload): Observable<MstBeverage> {
    return this.http.put<MstBeverage>(this.api.resource(`beverages/${id}`), payload);
  }

  deleteBeverage(id: number, changeReason: string): Observable<void> {
    return this.http.delete<void>(this.api.resource(`beverages/${id}`), {
      body: { changeReason },
    });
  }
}
