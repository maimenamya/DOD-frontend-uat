import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import type {
  CreateResourcePayload,
  ResourceItem,
  UpdateResourcePayload,
} from '../models/resource';

@Injectable({
  providedIn: 'root',
})
export class ResourceService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  getResources(): Observable<ResourceItem[]> {
    return this.http.get<ResourceItem[]>(this.api.resource('drink-types'));
  }

  createResource(payload: CreateResourcePayload): Observable<ResourceItem> {
    return this.http.post<ResourceItem>(this.api.resource('drink-types'), payload);
  }

  updateResource(id: number, payload: UpdateResourcePayload): Observable<ResourceItem> {
    return this.http.put<ResourceItem>(this.api.resource(`drink-types/${id}`), payload);
  }

  deleteResource(id: number): Observable<void> {
    return this.http.delete<void>(this.api.resource(`drink-types/${id}`));
  }
}
