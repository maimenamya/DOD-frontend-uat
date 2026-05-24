/**
 * Local development (`ng serve`).
 * Requests use relative `/api` — proxied to the backend via `proxy.conf.json`.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};
