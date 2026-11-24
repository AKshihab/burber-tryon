// Minimal service worker. Its only job is to let phones show the "your turn is close"
// notification (Chrome on Android does not allow pages to create notifications directly).
// It caches nothing and does not intercept requests.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w);
      return open ? open.focus() : self.clients.openWindow('/token');
    }),
  );
});
