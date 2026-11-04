self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Smart Home', body: event.data?.text() ?? '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Smart Home', {
    body: data.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (list[0]) return list[0].focus();
    return clients.openWindow(event.notification.data?.url || './');
  })());
});
