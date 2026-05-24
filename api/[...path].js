/**
 * Proxies /api/* to the Express backend (BACKEND_URL).
 * Set BACKEND_URL in Vercel → Project Settings → Environment Variables.
 * Example: https://your-api.railway.app
 */
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const backend = process.env.BACKEND_URL?.replace(/\/$/, '');

  if (!backend) {
    return new Response(
      JSON.stringify({ error: 'BACKEND_URL is not configured on Vercel' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const url = new URL(request.url);
  const target = `${backend}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const init = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(target, init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
