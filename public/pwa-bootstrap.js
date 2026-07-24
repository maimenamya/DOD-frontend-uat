/**
 * Runs before Angular — remembers shop login URL for PWA "Add to Home Screen".
 *
 * Important (iOS Web Push): keep the HTTP `manifest.webmanifest` link.
 * Do NOT replace it with a blob: URL — iOS then installs a bookmark/web-clip
 * without PushManager even when opened from the home icon.
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

  var shopFromUrl = readShopFromPath();
  if (shopFromUrl) {
    writeStoredShop(shopFromUrl);
  }

  var shopPublicId = shopFromUrl || readStoredShop();

  var path = location.pathname.replace(/\/+$/, '') || '/';
  if ((path === '/' || path === '/login') && shopPublicId && !hasAuthSession()) {
    location.replace('/s/' + encodeURIComponent(shopPublicId) + '/login');
  }
})();
