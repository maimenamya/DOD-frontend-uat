/**
 * Dynamic manifest with shop baked into start_url.
 * Used when the user is on /login?shop=… so Add to Home Screen opens that shop
 * even if standalone storage is empty.
 *
 * start_url / scope / icons use absolute origin URLs so iOS does not resolve
 * them relative to /api/ (which would break scope).
 */
module.exports = function handler(req, res) {
  const raw = typeof req.query.shop === 'string' ? req.query.shop.trim() : '';
  const shop = /^[a-zA-Z0-9_-]{1,64}$/.test(raw) ? raw : '';

  const protoHeader = req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'];
  const proto = String(protoHeader || 'https')
    .split(',')[0]
    .trim()
    .replace(/:$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  const origin = host ? `${proto}://${host}` : '';

  const startPath = shop
    ? `/login?homescreen=1&shop=${encodeURIComponent(shop)}`
    : '/login?homescreen=1';
  const startUrl = origin ? `${origin}${startPath}` : startPath;
  const scope = origin ? `${origin}/` : '/';
  const id = origin ? `${origin}/` : '/';
  const icon = (path) => (origin ? `${origin}${path}` : path);

  const manifest = {
    id,
    name: 'D-rink',
    short_name: 'D-rink',
    description: 'ระบบ POS ร้านบาร์',
    start_url: startUrl,
    scope,
    display: 'standalone',
    display_override: ['standalone'],
    background_color: '#080c15',
    theme_color: '#10141d',
    orientation: 'any',
    lang: 'th',
    icons: [
      {
        src: icon('/icon-192-v4.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon('/app-icon-v4.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icon('/icon-192-v4.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: icon('/app-icon-v4.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.status(200).send(JSON.stringify(manifest));
};
