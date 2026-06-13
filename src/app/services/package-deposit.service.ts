import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { PackageDepositPayload, PackageDepositRecord } from '../models/package-deposit';

@Injectable({ providedIn: 'root' })
export class PackageDepositService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<PackageDepositRecord[]> {
    return this.http.get<PackageDepositRecord[]>(this.api.resource('package-deposits'));
  }

  deposit(id: number, payload: PackageDepositPayload): Observable<PackageDepositRecord> {
    return this.http.post<PackageDepositRecord>(
      this.api.resource('package-deposits', String(id), 'deposit'),
      payload,
    );
  }

  close(id: number): Observable<PackageDepositRecord> {
    return this.http.post<PackageDepositRecord>(
      this.api.resource('package-deposits', String(id), 'close'),
      {},
    );
  }
}
