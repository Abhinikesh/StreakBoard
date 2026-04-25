// Service Worker for StreakBoard push notifications

// ── Push event: show the notification ────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  event.waitUntil(
    self.registration.showNotification(data.title || 'StreakBoard', {
      body:    data.body    || 'Time to log your habits!',
      icon:    data.icon   || '/icon-192.png',
      badge:   data.badge  || '/icon-192.png',
      tag:     data.tag    || 'streakboard',
      vibrate: [100, 50, 100],
      // Forward actions from the push payload so notification buttons render
      actions: data.actions || [
        { action: 'open', title: '✅ Log Now' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      data: {
        url: data.data?.url || data.url || '/dashboard',
      },
    })
  );
});

// ── Notification click: handle action buttons ─────────────────────────────────
//
// Auth note: Service workers cannot access localStorage (browser security
// boundary). The JWT token lives in localStorage keyed 'token'. The solution:
// postMessage the 'mark-all-done' intent to the active app window, which can
// read the token and make the authenticated fetch itself. If no window is open
// we fall back to opening /dashboard (user marks habits manually).
//
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // ── Dismiss button: do nothing ──────────────────────────────────────────
  if (event.action === 'dismiss') return;

  // ── Mark All Done button ────────────────────────────────────────────────
  if (event.action === 'mark-all-done') {
    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            // App is already open — postMessage so the page makes the API call
            // with its own stored token, then focus that tab.
            const target = clientList[0];
            target.postMessage({ type: 'MARK_ALL_DONE' });
            return target.focus();
          }

          // No open window — open the app; it will act on the message on load.
          // Store the intent in a SW-accessible way via the notification data URL.
          return clients.openWindow('/dashboard?action=mark-all-done');
        })
    );
    return;
  }

  // ── Open App button or notification body click (default) ────────────────
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab showing the target URL
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // No matching tab — open a new one
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
