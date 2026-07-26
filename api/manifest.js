/**
 * Legacy dynamic manifest (kept for old clients).
 * Prefer `/manifest.webmanifest` at site root — iOS scopes relative to manifest URL.
 */
module.exports = function handler(req, res) {
  const raw = typeof req.query.shop === 'string' ? req.query.shop.trim() : '';
  const shop = /^[a-zA-Z0-9_-]{1,64}$/.test(raw) ? raw : '';
  const startUrl = shop
    ? `/login?homescreen=1&shop=${encodeURIComponent(shop)}`
    : '/login?homescreen=1';

  const manifest = {
    id: '/',
    name: 'D-rink',
    short_name: 'D-rink',
    description: 'ระบบ POS ร้านบาร์',
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    display_override: ['standalone'],
    background_color: '#080c15',
    theme_color: '#10141d',
    orientation: 'any',
    lang: 'th',
    icons: [
      {
        src: '/icon-192-v4.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-v4.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192-v4.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/app-icon-v4.png',
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
