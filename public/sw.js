// StecoPro service worker — push notifications + deep-link only.
// Deliberately NO offline caching: a stale cached live dashboard would mislead.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || 'StecoPro'
  const options = {
    body: data.body || '',
    data: { url: data.url || '/skift' },
    icon: '/icon-192',
    badge: '/icon-192',
    tag: data.tag, // collapse same-cause notifications
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/skift'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && 'focus' in w) return w.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
