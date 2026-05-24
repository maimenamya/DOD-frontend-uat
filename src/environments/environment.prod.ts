/**
 * Production build (Vercel).
 * Requests use relative `/api` — proxied to Railway via `api/[...path].js` + `BACKEND_URL`.
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
};
