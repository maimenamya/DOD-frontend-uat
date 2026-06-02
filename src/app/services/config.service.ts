import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

import { ApiConfig } from '../core/api-config';

export interface ClientConfig {
  lineOaAddFriendUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiConfig);

  private clientConfig$?: Observable<ClientConfig>;

  getClientConfig(): Observable<ClientConfig> {
    if (!this.clientConfig$) {
      this.clientConfig$ = this.http
        .get<ClientConfig>(this.api.resource('config', 'client'))
        .pipe(
          catchError(() => of({ lineOaAddFriendUrl: null })),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }
    return this.clientConfig$;
  }
}
