/**
 * Runs before Angular — remembers shop login URL for PWA "Add to Home Screen".
 * Standalone apps hide the address bar; start_url must point at /s/{publicId}/login.
 */
(function () {
  var STORAGE_KEY = 'dod_shop_public_id';
  var SESSION_KEY = 'dod_auth_session';

  function readShopFromPath() {
    var match = location.pathname.match(/^\/s\/([^/]+)\/login\/?$/i);
    return match ? decodeURIComponent(match[1]).trim() : '';
  }

  function readStoredShop() {
    try {
      return (localStorage.getItem(STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function writeStoredShop(shopPublicId) {
    if (!shopPublicId) return;
    try {
      localStorage.setItem(STORAGE_KEY, shopPublicId);
    } catch (e) {}
  }

  function hasAuthSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      return !!(parsed && parsed.token && parsed.user && parsed.user.shopId);
    } catch (e) {
      return false;
    }
  }

  function installManifest(shopPublicId) {
    var startUrl = shopPublicId ? '/s/' + encodeURIComponent(shopPublicId) + '/login' : '/login';
    var manifest = {
      name: 'DOD',
      short_name: 'DOD',
      description: 'ระบบ POS ร้านบาร์',
      start_url: startUrl,
      scope: '/',
      display: 'standalone',
      background_color: '#10141d',
      theme_color: '#10141d',
      orientation: 'any',
      lang: 'th',
      icons: [
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any',
        },
        {
          src: '/apple-touch-icon.svg',
          sizes: '180x180',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        },
      ],
    };

    var blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    var blobUrl = URL.createObjectURL(blob);
    var link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = blobUrl;
  }

  var shopFromUrl = readShopFromPath();
  if (shopFromUrl) {
    writeStoredShop(shopFromUrl);
  }

  var shopPublicId = shopFromUrl || readStoredShop();
  installManifest(shopPublicId);

  var path = location.pathname.replace(/\/+$/, '') || '/';
  if ((path === '/' || path === '/login') && shopPublicId && !hasAuthSession()) {
    location.replace('/s/' + encodeURIComponent(shopPublicId) + '/login');
  }
})();
