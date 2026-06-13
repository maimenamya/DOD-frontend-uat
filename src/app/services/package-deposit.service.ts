import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { PackageDepositRecord } from '../models/package-deposit';

@Injectable({ providedIn: 'root' })
export class PackageDepositService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  list(): Observable<PackageDepositRecord[]> {
    return this.http.get<PackageDepositRecord[]>(this.api.resource('package-deposits'));
  }
}
