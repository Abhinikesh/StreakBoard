// Service Worker for StreakBoard push notifications

// ── Lifecycle: activate new SW immediately on deploy ─────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate new SW immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // take control of all open tabs immediately
});

// ── Push event: show the notification ────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'StreakBoard', body: event.data?.text() || '' };
  }

  const options = {
    body:               data.body    || '',
    icon:               data.icon   || '/icon-192.png',
    badge:              data.badge  || '/icon-192.png',
    tag:                data.tag    || 'default',
    vibrate:            [100, 50, 100],
    data:               data.data   || { url: '/dashboard' },
    // Forward action buttons from the push payload so they render in the tray
    actions:            data.actions || [],
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'StreakBoard', options)
  );
});

// ── Notification click: handle action buttons ─────────────────────────────────
//
// Auth note: Service workers cannot access localStorage (browser security
// boundary). The JWT token lives in localStorage keyed 'token'. The solution:
// postMessage the 'mark-all-done' intent to the active app window, which can
// read the token and make the authenticated fetch itself. If no window is open
// we fall back to opening /dashboard?action=mark-all-done so the page picks it
// up from the URL param on load.
//
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data   = event.notification.data || {};
  const url    = data.url || '/dashboard';

  if (action === 'mark-all-done') {
    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          if (windowClients.length > 0) {
            // App is already open — send postMessage so the page calls the API
            // with its own stored token, then focus that tab.
            windowClients[0].postMessage({ type: 'MARK_ALL_DONE' });
            return windowClients[0].focus();
          }
          // No open window — open app; SwActionHandler picks up the URL param.
          return clients.openWindow('/dashboard?action=mark-all-done');
        })
    );
  } else {
    // Default: notification body tap or 'open-app' button — just open the app.
    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          // Focus any existing app window (match on origin, not path)
          for (const client of windowClients) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // No open window — open the target URL
          return clients.openWindow(url);
        })
    );
  }
});
