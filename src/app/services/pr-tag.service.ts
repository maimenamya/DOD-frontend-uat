import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  MstPrTag,
  MstPrTagWritePayload,
  PrTagOperationsDashboard,
  PrTagOperationsRow,
} from '../models/pr-tag';

@Injectable({ providedIn: 'root' })
export class PrTagService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getAllTags(): Observable<MstPrTag[]> {
    return this.http.get<MstPrTag[]>(this.api.resource('pr-tags'));
  }

  createTag(payload: MstPrTagWritePayload): Observable<MstPrTag> {
    return this.http.post<MstPrTag>(this.api.resource('pr-tags'), payload);
  }

  updateTag(id: number, payload: Partial<MstPrTagWritePayload>): Observable<MstPrTag> {
    return this.http.put<MstPrTag>(this.api.resource(`pr-tags/${id}`), payload);
  }

  deleteTag(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`pr-tags/${id}`));
  }

  getOperationsDashboard(): Observable<PrTagOperationsDashboard> {
    return this.http.get<PrTagOperationsDashboard>(this.api.resource('pr-tags', 'operations'));
  }

  assignTag(employeeId: string, prTagId: number): Observable<PrTagOperationsRow> {
    return this.http.post<PrTagOperationsRow>(this.api.resource('pr-tags', 'assign'), {
      employeeId,
      prTagId,
    });
  }

  checkIn(enrollmentId: number): Observable<PrTagOperationsRow> {
    return this.http.post<PrTagOperationsRow>(
      this.api.resource('pr-tags', 'enrollments', String(enrollmentId), 'check-in'),
      {},
    );
  }

  recordOffDay(enrollmentId: number): Observable<PrTagOperationsRow> {
    return this.http.post<PrTagOperationsRow>(
      this.api.resource('pr-tags', 'enrollments', String(enrollmentId), 'off-day'),
      {},
    );
  }

  forceCut(enrollmentId: number): Observable<PrTagOperationsRow> {
    return this.http.post<PrTagOperationsRow>(
      this.api.resource('pr-tags', 'enrollments', String(enrollmentId), 'force-cut'),
      {},
    );
  }
}
