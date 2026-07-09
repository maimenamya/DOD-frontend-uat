import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { StationTicket, StationTicketKind } from '../models/station-ticket';

@Injectable({
  providedIn: 'root',
})
export class StationTicketService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  listPrep(kind: StationTicketKind): Observable<StationTicket[]> {
    return this.http.get<StationTicket[]>(this.api.resource('station-tickets', 'prep'), {
      params: { kind },
    });
  }

  listService(): Observable<StationTicket[]> {
    return this.http.get<StationTicket[]>(this.api.resource('station-tickets', 'service'));
  }

  markReady(id: number): Observable<StationTicket> {
    return this.http.post<StationTicket>(this.api.resource(`station-tickets/${id}/ready`), {});
  }

  markPickedUp(id: number): Observable<StationTicket> {
    return this.http.post<StationTicket>(
      this.api.resource(`station-tickets/${id}/picked-up`),
      {},
    );
  }
}
