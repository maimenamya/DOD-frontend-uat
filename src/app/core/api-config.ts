import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiConfig {
  /** Base URL for all HTTP API calls (from environment; set at Vercel build via set-env.js). */
  readonly baseUrl = environment.apiUrl;

  /**
   * Build a URL under the API base, e.g. `resource('employees')` → `{apiUrl}/employees`.
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
