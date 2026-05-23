import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ResourceItem } from '../models/resource';

@Injectable({
  providedIn: 'root',
})
export class ResourceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000';

  getResources(): Observable<ResourceItem[]> {
    return this.http.get<ResourceItem[]>(`${this.apiUrl}/drink-types`);
  }
}

