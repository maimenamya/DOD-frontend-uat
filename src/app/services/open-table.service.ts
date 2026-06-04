import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  TxnActiveSessionRecord,
  AddItemsPayload,
  CheckInPayload,
  CheckoutPayload,
  CheckoutPreviewPayload,
  CheckoutPreview,
  CheckoutResult,
  ReleaseCustomerPayload,
  OpenTableFloorPlan,
  OpenTableSessionDetail,
  AddRoomChargePayload,
  StopRoomChargePayload,
  ReturnBeveragePayload,
  VoidSessionItemsPayload,
  StopStaffDrinkPayload,
  StopStaffDrinkPreview,
  StopStaffDrinkPreviewPayload,
  TransferSeatPayload,
} from '../models/open-table';

@Injectable({ providedIn: 'root' })
export class OpenTableService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getFloorPlan(): Observable<OpenTableFloorPlan> {
    return this.http.get<OpenTableFloorPlan>(this.api.resource('open-table', 'floor-plan'));
  }

  getSessionDetail(sessionId: number): Observable<OpenTableSessionDetail> {
    return this.http.get<OpenTableSessionDetail>(
      this.api.resource('open-table', 'sessions', String(sessionId)),
    );
  }

  openTable(payload: CheckInPayload): Observable<TxnActiveSessionRecord> {
    return this.http.post<TxnActiveSessionRecord>(this.api.resource('open-table', 'check-in'), payload);
  }

  addOrderItems(payload: AddItemsPayload): Observable<OpenTableSessionDetail> {
    return this.http.post<OpenTableSessionDetail>(
      this.api.resource('open-table', 'add-items'),
      payload,
    );
  }

  stopStaffDrink(payload: StopStaffDrinkPayload): Observable<OpenTableSessionDetail> {
    return this.http.post<OpenTableSessionDetail>(
      this.api.resource('open-table', 'stop-staff-drink'),
      payload,
    );
  }

  previewStopStaffDrink(
    payload: StopStaffDrinkPreviewPayload,
  ): Observable<StopStaffDrinkPreview> {
    return this.http.post<StopStaffDrinkPreview>(
      this.api.resource('open-table', 'stop-staff-drink-preview'),
      payload,
    );
  }

  transferSeat(payload: TransferSeatPayload): Observable<{ sessionId: number }> {
    return this.http.post<{ sessionId: number }>(
      this.api.resource('open-table', 'transfer'),
      payload,
    );
  }

  addRoomCharge(payload: AddRoomChargePayload): Observable<OpenTableSessionDetail> {
    return this.http.post<OpenTableSessionDetail>(
      this.api.resource('open-table', 'add-room-charge'),
      payload,
    );
  }

  stopRoomCharge(payload: StopRoomChargePayload): Observable<OpenTableSessionDetail> {
    return this.http.post<OpenTableSessionDetail>(
      this.api.resource('open-table', 'stop-room-charge'),
      payload,
    );
  }

  returnBeverage(payload: ReturnBeveragePayload): Observable<OpenTableSessionDetail> {
    return this.http.post<OpenTableSessionDetail>(
      this.api.resource('open-table', 'return-beverage'),
      payload,
    );
  }

  voidSessionItems(payload: VoidSessionItemsPayload): Observable<OpenTableSessionDetail> {
    return this.http.post<OpenTableSessionDetail>(
      this.api.resource('open-table', 'void-items'),
      payload,
    );
  }

  previewCheckout(payload: CheckoutPreviewPayload): Observable<CheckoutPreview> {
    return this.http.post<CheckoutPreview>(
      this.api.resource('open-table', 'checkout-preview'),
      payload,
    );
  }

  checkoutBill(payload: CheckoutPayload): Observable<CheckoutResult> {
    return this.http.post<CheckoutResult>(this.api.resource('open-table', 'checkout'), payload);
  }

  releaseCustomer(payload: ReleaseCustomerPayload): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      this.api.resource('open-table', 'release-customer'),
      payload,
    );
  }

}
