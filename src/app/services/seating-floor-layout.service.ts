import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  FloorLayoutBoard,
  FloorLayoutWriteItem,
} from '../models/seating-floor-layout';

@Injectable({ providedIn: 'root' })
export class SeatingFloorLayoutService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getBoard(): Observable<FloorLayoutBoard> {
    return this.http.get<FloorLayoutBoard>(this.api.resource('seating-floor-layouts'));
  }

  saveBoard(items: FloorLayoutWriteItem[]): Observable<FloorLayoutBoard> {
    return this.http.put<FloorLayoutBoard>(this.api.resource('seating-floor-layouts'), {
      items,
    });
  }
}
