import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiConfig } from '../core/api-config';
import { AuthService } from '../services/auth.service';

function isLoginRequest(url: string, api: ApiConfig): boolean {
  return url.includes(api.resource('auth', 'login'));
}

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const api = inject(ApiConfig);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isLoginRequest(req.url, api) &&
        auth.getToken()
      ) {
        auth.handleSessionExpired();
      }
      return throwError(() => error);
    }),
  );
};
