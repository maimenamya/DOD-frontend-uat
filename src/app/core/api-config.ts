import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiConfig {
  /** Base path for all HTTP API calls (never hardcode localhost in services). */
  readonly baseUrl = environment.apiBaseUrl;

  /**
   * Build a URL under the API base, e.g. `resource('employees')` → `/api/employees`.
   */
  resource(...segments: string[]): string {
    const path = segments
      .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');

    const base = this.baseUrl.replace(/\/+$/, '');
    return path ? `${base}/${path}` : base;
  }
}
