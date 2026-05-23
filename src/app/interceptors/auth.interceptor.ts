import { HttpInterceptorFn } from '@angular/common/http';

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
  const isAuthEndpoint =
    req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register');

  if (isAuthEndpoint) {
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
