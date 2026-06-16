import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  ShopReceiptPrinterConfig,
  ShopReceiptPrinterInput,
} from '../models/shop-receipt-printer';

@Injectable({ providedIn: 'root' })
export class ShopReceiptPrinterService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  get(shopId: number): Observable<ShopReceiptPrinterConfig> {
    return this.http.get<ShopReceiptPrinterConfig>(
      this.api.resource('shops', String(shopId), 'receipt-printer'),
    );
  }

  save(shopId: number, payload: ShopReceiptPrinterInput): Observable<ShopReceiptPrinterConfig> {
    return this.http.put<ShopReceiptPrinterConfig>(
      this.api.resource('shops', String(shopId), 'receipt-printer'),
      payload,
    );
  }
}
