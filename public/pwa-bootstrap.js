/**
 * Runs before Angular — PWA launch routing + shop id memory.
 *
 * Manifest is `/manifest.webmanifest` at site root (not `/api/manifest`) so iOS
 * resolves scope `/` against the origin, not the `/api/` directory.
 *
 * Shop login must be `/login?shop=…` — never `/s/{shop}/login`. Installing a
 * Home Screen app while on `/s/{shop}/login` made iOS treat scope as `/s/{shop}/`,
 * so `/dashboard` opened with Safari chrome after login.
 */
(function () {
  var STORAGE_KEY = 'dod_shop_public_id';
  var SESSION_KEY = 'dod_auth_session';
  var MANIFEST_HREF = '/manifest.webmanifest';

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

  function setManifestHref() {
    var links = document.querySelectorAll('link[rel="manifest"]');
    if (!links.length) {
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.type = 'application/manifest+json';
      link.href = MANIFEST_HREF;
      document.head.appendChild(link);
      return;
    }
    for (var i = 0; i < links.length; i += 1) {
      links[i].href = MANIFEST_HREF;
    }
  }

  function wantsHomescreen() {
    return (
      typeof location.search === 'string' && location.search.indexOf('homescreen=1') !== -1
    );
  }

  function shopLoginUrl(shopPublicId) {
    var url = '/login?shop=' + encodeURIComponent(shopPublicId);
    if (wantsHomescreen()) url += '&homescreen=1';
    return url;
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

  setManifestHref();

  var path = location.pathname.replace(/\/+$/, '') || '/';

  // Old shop login path → canonical /login?shop= (keeps iOS PWA scope at /)
  var pathShop = readShopFromPath();
  if (pathShop && isSafeShopId(pathShop)) {
    location.replace(shopLoginUrl(pathShop));
    return;
  }

  if (path === '/' || path === '/login') {
    if (hasAuthSession()) {
      location.replace('/dashboard');
      return;
    }
    if (path === '/' && shopPublicId) {
      location.replace(shopLoginUrl(shopPublicId));
    }
  }
})();
