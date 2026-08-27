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

  const headers: Record<string, string> = {};
  if (req.method === 'GET') {
    headers['Cache-Control'] = 'no-cache';
    headers['Pragma'] = 'no-cache';
  }
  const token = readToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (Object.keys(headers).length === 0) {
    return next(req);
  }
  return next(req.clone({ setHeaders: headers }));
};
