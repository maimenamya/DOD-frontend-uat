/* Web Push service worker — keep at site root for full scope. */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: '',
    body: '',
    url: '/dashboard',
  };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : '';
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  // Show only table + items — never brand name as the notification title.
  const title = String(data.title || '').trim();
  const body = String(data.body || '').trim();
  const displayTitle = title || body || 'ออเดอร์ใหม่';
  const displayBody = title ? body : '';

  event.waitUntil(
    self.registration.showNotification(displayTitle, {
      body: displayBody,
      icon: '/favicon-64.png',
      badge: '/favicon-32.png',
      data: { url: data.url || '/dashboard' },
      tag: data.notificationId ? `dod-noti-${data.notificationId}` : 'dod-noti',
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
