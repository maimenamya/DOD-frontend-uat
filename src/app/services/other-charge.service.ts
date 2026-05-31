import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { MstOtherCharge, MstOtherChargeWritePayload } from '../models/other-charge';

@Injectable({ providedIn: 'root' })
export class OtherChargeService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getAll(): Observable<MstOtherCharge[]> {
    return this.http.get<MstOtherCharge[]>(this.api.resource('other-charges'));
  }

  create(payload: MstOtherChargeWritePayload): Observable<MstOtherCharge> {
    return this.http.post<MstOtherCharge>(this.api.resource('other-charges'), payload);
  }

  update(id: number, payload: Partial<MstOtherChargeWritePayload>): Observable<MstOtherCharge> {
    return this.http.put<MstOtherCharge>(this.api.resource(`other-charges/${id}`), payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`other-charges/${id}`));
  }
}
