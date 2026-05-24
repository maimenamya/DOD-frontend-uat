import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  Beverage,
  CreateBeveragePayload,
  UpdateBeveragePayload,
} from '../models/beverage';

@Injectable({
  providedIn: 'root',
})
export class BeverageService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getBeverages(): Observable<Beverage[]> {
    return this.http.get<Beverage[]>(this.api.resource('beverages'));
  }

  createBeverage(payload: CreateBeveragePayload): Observable<Beverage> {
    return this.http.post<Beverage>(this.api.resource('beverages'), payload);
  }

  updateBeverage(id: number, payload: UpdateBeveragePayload): Observable<Beverage> {
    return this.http.put<Beverage>(this.api.resource(`beverages/${id}`), payload);
  }

  deleteBeverage(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`beverages/${id}`));
  }
}
