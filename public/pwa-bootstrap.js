/**
 * Runs before Angular — remembers shop login URL for PWA "Add to Home Screen".
 *
 * Manifest start_url stays at `/login?homescreen=1` (site root), not `/s/{shop}/…`.
 * iOS scopes the installed app from start_url’s directory; a shop subpath made
 * `/dashboard` open with Safari chrome after login. Shop id is stored here and
 * we replace to `/s/{shop}/login` when launching from `/` or `/login`.
 */
(function () {
  var STORAGE_KEY = 'dod_shop_public_id';
  var SESSION_KEY = 'dod_auth_session';

  function readShopFromPath() {
    var match = location.pathname.match(/^\/s\/([^/]+)\/login\/?$/i);
    return match ? decodeURIComponent(match[1]).trim() : '';
  }

  function readShopFromQuery() {
    try {
      var params = new URLSearchParams(location.search || '');
      return (params.get('shop') || '').trim();
    } catch (e) {
      return '';
    }
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

  function isSafeShopId(shopPublicId) {
    return /^[a-zA-Z0-9_-]{1,64}$/.test(shopPublicId);
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

  function setManifestHref(shopPublicId) {
    var href = shopPublicId
      ? '/api/manifest?shop=' + encodeURIComponent(shopPublicId)
      : '/api/manifest';
    var links = document.querySelectorAll('link[rel="manifest"]');
    if (!links.length) {
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.type = 'application/manifest+json';
      link.href = href;
      document.head.appendChild(link);
      return;
    }
    for (var i = 0; i < links.length; i += 1) {
      links[i].href = href;
    }
  }

  var shopFromUrl = readShopFromPath() || readShopFromQuery();
  if (shopFromUrl && isSafeShopId(shopFromUrl)) {
    writeStoredShop(shopFromUrl);
  }

  var shopPublicId = '';
  if (shopFromUrl && isSafeShopId(shopFromUrl)) {
    shopPublicId = shopFromUrl;
  } else {
    var stored = readStoredShop();
    if (stored && isSafeShopId(stored)) shopPublicId = stored;
  }

  setManifestHref(shopPublicId);

  var path = location.pathname.replace(/\/+$/, '') || '/';
  if ((path === '/' || path === '/login') && shopPublicId && !hasAuthSession()) {
    var homescreen =
      typeof location.search === 'string' && location.search.indexOf('homescreen=1') !== -1
        ? '?homescreen=1'
        : '';
    location.replace(
      '/s/' + encodeURIComponent(shopPublicId) + '/login' + homescreen,
    );
  }
})();
