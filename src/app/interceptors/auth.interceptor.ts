import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { ApiConfig } from '../core/api-config';

const AUTH_STORAGE_KEY = 'dod_auth_session';

function readToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiConfig);

  const isLoginEndpoint = req.url.includes(api.resource('auth', 'login'));

  if (isLoginEndpoint) {
    return next(req);
  }

  const token = readToken();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
