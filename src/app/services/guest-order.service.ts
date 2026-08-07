import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { BillReceiptResponse } from '../models/bill-receipt';
import type {
  GuestOrderMenuPayload,
  GuestOrderSubmitItem,
  GuestOrderSubmitResult,
} from '../models/guest-order';

@Injectable({ providedIn: 'root' })
export class GuestOrderService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getMenu(token: string, shopPublicId?: string): Observable<GuestOrderMenuPayload> {
    const params = new URLSearchParams({ t: token });
    if (shopPublicId?.trim()) {
      params.set('shopPublicId', shopPublicId.trim());
    }
    return this.http.get<GuestOrderMenuPayload>(
      `${this.api.resource('guest-order', 'menu')}?${params.toString()}`,
    );
  }

  submitOrder(
    token: string,
    items: GuestOrderSubmitItem[],
    shopPublicId?: string,
  ): Observable<GuestOrderSubmitResult> {
    return this.http.post<GuestOrderSubmitResult>(this.api.resource('guest-order', 'items'), {
      t: token,
      shopPublicId,
      items,
    });
  }

  printQr(sessionId: number, frontendBaseUrl: string): Observable<BillReceiptResponse & { orderUrl: string }> {
    return this.http.post<BillReceiptResponse & { orderUrl: string }>(
      this.api.resource('guest-order', 'print-qr'),
      { sessionId, frontendBaseUrl },
    );
  }
}
