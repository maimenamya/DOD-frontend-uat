import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type { ResourceItem } from '../models/resource';

@Injectable({
  providedIn: 'root',
})
export class ResourceService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getResources(): Observable<ResourceItem[]> {
    return this.http.get<ResourceItem[]>(this.api.resource('drink-types'));
  }
}
