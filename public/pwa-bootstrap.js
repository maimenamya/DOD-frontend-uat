/**
 * Runs before Angular — PWA launch routing + shop id memory.
 *
 * When shop is known, manifest href is `/api/manifest?shop=…` so Add to Home
 * Screen bakes shop into start_url (absolute origin URLs — safe under /api/).
 * Fallback static file: `/manifest.webmanifest`.
 *
 * Shop login must be `/login?shop=…` — never `/s/{shop}/login`.
 *
 * Critical for iOS: never use location.replace / location.assign for in-app hops.
 * A full navigation on first launch drops standalone mode and shows Safari chrome
 * (top + bottom bars) even on the login screen. Use history.replaceState instead.
 */
(function () {
  var STORAGE_KEY = 'dod_shop_public_id';
  var SESSION_KEY = 'dod_auth_session';
  var MANIFEST_STATIC = '/manifest.webmanifest';

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

  function manifestHrefForShop(shopPublicId) {
    if (shopPublicId && isSafeShopId(shopPublicId)) {
      return '/api/manifest?shop=' + encodeURIComponent(shopPublicId);
    }
    return MANIFEST_STATIC;
  }

  function setManifestHref(shopPublicId) {
    var href = manifestHrefForShop(shopPublicId);
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

  function wantsHomescreen() {
    return (
      typeof location.search === 'string' && location.search.indexOf('homescreen=1') !== -1
    );
  }

  function isIosStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        return true;
      }
      if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) {
        return true;
      }
      return Boolean(window.navigator && window.navigator.standalone);
    } catch (e) {
      return false;
    }
  }

  function shopLoginUrl(shopPublicId) {
    var url = '/login?shop=' + encodeURIComponent(shopPublicId);
    if (wantsHomescreen() || isIosStandalone()) url += '&homescreen=1';
    return url;
  }

  /** Soft URL change — keeps iOS Home Screen apps in standalone (no Safari chrome). */
  function softNavigate(url) {
    if (!url || url === location.pathname + location.search + location.hash) return;
    try {
      history.replaceState(null, '', url);
    } catch (e) {
      // Same-document only; never fall back to location.replace on iOS PWA.
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

  try {
    document.documentElement.classList.toggle('app-standalone', isIosStandalone());
  } catch (e) {}

  var path = location.pathname.replace(/\/+$/, '') || '/';

  // Old shop login path → canonical /login?shop= (keeps iOS PWA scope at /)
  var pathShop = readShopFromPath();
  if (pathShop && isSafeShopId(pathShop)) {
    softNavigate(shopLoginUrl(pathShop));
    return;
  }

  if (path === '/' || path === '/login') {
    if (hasAuthSession()) {
      softNavigate('/dashboard');
      return;
    }
    if (path === '/') {
      if (shopPublicId) {
        softNavigate(shopLoginUrl(shopPublicId));
      } else {
        softNavigate(wantsHomescreen() ? '/login?homescreen=1' : '/login');
      }
      return;
    }
    // Already on /login — attach stored shop without leaving the document.
    if (path === '/login' && shopPublicId && !readShopFromQuery()) {
      softNavigate(shopLoginUrl(shopPublicId));
    }
  }
})();
