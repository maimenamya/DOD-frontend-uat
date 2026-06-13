import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { ShopPolicyConfig, ShopPolicyInput } from '../models/shop-policy';

@Injectable({ providedIn: 'root' })
export class ShopPolicyService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  get(): Observable<ShopPolicyConfig> {
    return this.http.get<ShopPolicyConfig>(this.api.resource('shop-policy'));
  }

  save(payload: ShopPolicyInput): Observable<ShopPolicyConfig> {
    return this.http.put<ShopPolicyConfig>(this.api.resource('shop-policy'), payload);
  }
}
