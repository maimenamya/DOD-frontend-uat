/**
 * Production (Vercel build).
 * Overwritten by `scripts/generate-environment.mjs` when BACKEND_URL is set.
 * Local prod build without BACKEND_URL keeps `/api` (dev proxy).
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
};
