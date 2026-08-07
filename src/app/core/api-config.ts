import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

/** Trim leading/trailing `/` without regex alternation (Sonar S8786). */
function trimSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.codePointAt(start) === 47 /* / */) start += 1;
  while (end > start && value.codePointAt(end - 1) === 47) end -= 1;
  return value.slice(start, end);
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.codePointAt(end - 1) === 47 /* / */) end -= 1;
  return value.slice(0, end);
}

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
      .map((segment) => trimSlashes(segment))
      .filter(Boolean)
      .join('/');

    const base = trimTrailingSlashes(this.baseUrl);
    return path ? `${base}/${path}` : base;
  }
}
